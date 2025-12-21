package tunnel

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

// TunnelStatus represents the status of a tunnel
type TunnelStatus string

const (
	TunnelStatusActive TunnelStatus = "Active"
	TunnelStatusDead   TunnelStatus = "Dead"
)

// Tunnel represents an active port forward
type Tunnel struct {
	ID           string       `json:"id"`
	Namespace    string       `json:"namespace"`
	ResourceType string       `json:"resourceType"` // "pod" or "service"
	ResourceName string       `json:"resourceName"`
	PodName      string       `json:"podName"` // actual pod being forwarded (for services)
	TargetPort   int          `json:"targetPort"`
	LocalPort    int          `json:"localPort"`
	Status       TunnelStatus `json:"status"`
	CreatedAt    time.Time    `json:"createdAt"`
	ErrorMsg     string       `json:"errorMsg,omitempty"`

	// Internal fields (not serialized)
	stopChan  chan struct{}
	readyChan chan struct{}
	forwarder *portforward.PortForwarder
}

// Manager manages port forwards
type Manager struct {
	tunnels    map[string]*Tunnel
	mutex      sync.RWMutex
	clientset  kubernetes.Interface
	restConfig *rest.Config
}

// NewManager creates a new tunnel manager
func NewManager(clientset kubernetes.Interface, restConfig *rest.Config) *Manager {
	return &Manager{
		tunnels:    make(map[string]*Tunnel),
		clientset:  clientset,
		restConfig: restConfig,
	}
}

// CreateTunnelRequest represents a request to create a tunnel
type CreateTunnelRequest struct {
	Namespace    string `json:"namespace"`
	ResourceType string `json:"resourceType"` // "pod" or "service"
	ResourceName string `json:"resourceName"`
	TargetPort   int    `json:"targetPort"`
	LocalPort    int    `json:"localPort,omitempty"` // 0 means auto-assign
}

// TunnelInfo represents tunnel info for API responses
type TunnelInfo struct {
	ID           string       `json:"id"`
	Namespace    string       `json:"namespace"`
	ResourceType string       `json:"resourceType"`
	ResourceName string       `json:"resourceName"`
	PodName      string       `json:"podName,omitempty"`
	TargetPort   int          `json:"targetPort"`
	LocalPort    int          `json:"localPort"`
	Status       TunnelStatus `json:"status"`
	CreatedAt    time.Time    `json:"createdAt"`
	ErrorMsg     string       `json:"errorMsg,omitempty"`
	URL          string       `json:"url"`
}

// Create starts a new port forward
func (m *Manager) Create(req CreateTunnelRequest) (*TunnelInfo, error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Generate unique ID
	id := uuid.New().String()[:8]

	// Use provided local port or auto-assign
	localPort := req.LocalPort
	if localPort == 0 {
		localPort = m.findAvailablePort()
	}

	// For services, we need to find a backing pod
	podName := req.ResourceName
	if strings.ToLower(req.ResourceType) == "service" {
		foundPod, err := m.findPodForService(req.Namespace, req.ResourceName)
		if err != nil {
			return nil, fmt.Errorf("failed to find pod for service: %w", err)
		}
		podName = foundPod
	}

	tunnel := &Tunnel{
		ID:           id,
		Namespace:    req.Namespace,
		ResourceType: req.ResourceType,
		ResourceName: req.ResourceName,
		PodName:      podName,
		TargetPort:   req.TargetPort,
		LocalPort:    localPort,
		Status:       TunnelStatusActive,
		CreatedAt:    time.Now(),
		stopChan:     make(chan struct{}),
		readyChan:    make(chan struct{}),
	}

	// Start port forward in goroutine
	go m.startPortForward(tunnel)

	m.tunnels[id] = tunnel

	return tunnel.toInfo(), nil
}

// findPodForService finds a pod that backs a service
func (m *Manager) findPodForService(namespace, serviceName string) (string, error) {
	ctx := context.Background()

	// Get the service to find its selector
	svc, err := m.clientset.CoreV1().Services(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get service: %w", err)
	}

	if len(svc.Spec.Selector) == 0 {
		return "", fmt.Errorf("service has no selector")
	}

	// Convert selector to label selector string
	var selectorParts []string
	for k, v := range svc.Spec.Selector {
		selectorParts = append(selectorParts, fmt.Sprintf("%s=%s", k, v))
	}
	labelSelector := strings.Join(selectorParts, ",")

	// Find pods matching the selector
	pods, err := m.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
		Limit:         1,
	})
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %w", err)
	}

	if len(pods.Items) == 0 {
		return "", fmt.Errorf("no pods found for service")
	}

	// Return the first running pod
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			return pod.Name, nil
		}
	}

	// If no running pod, return the first one anyway
	return pods.Items[0].Name, nil
}

// List returns all active tunnels
func (m *Manager) List() []TunnelInfo {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	result := make([]TunnelInfo, 0, len(m.tunnels))
	for _, t := range m.tunnels {
		result = append(result, *t.toInfo())
	}
	return result
}

// Delete stops and removes a tunnel
func (m *Manager) Delete(id string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	tunnel, exists := m.tunnels[id]
	if !exists {
		return fmt.Errorf("tunnel %s not found", id)
	}

	// Stop the port forward
	if tunnel.stopChan != nil {
		close(tunnel.stopChan)
	}

	delete(m.tunnels, id)
	return nil
}

// Get returns a specific tunnel
func (m *Manager) Get(id string) (*TunnelInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	tunnel, exists := m.tunnels[id]
	if !exists {
		return nil, fmt.Errorf("tunnel %s not found", id)
	}

	return tunnel.toInfo(), nil
}

func (t *Tunnel) toInfo() *TunnelInfo {
	return &TunnelInfo{
		ID:           t.ID,
		Namespace:    t.Namespace,
		ResourceType: t.ResourceType,
		ResourceName: t.ResourceName,
		PodName:      t.PodName,
		TargetPort:   t.TargetPort,
		LocalPort:    t.LocalPort,
		Status:       t.Status,
		CreatedAt:    t.CreatedAt,
		ErrorMsg:     t.ErrorMsg,
		URL:          fmt.Sprintf("http://localhost:%d", t.LocalPort),
	}
}

func (m *Manager) findAvailablePort() int {
	// Start from a reasonable port range
	basePort := 9000
	for port := basePort; port < 65535; port++ {
		inUse := false
		for _, t := range m.tunnels {
			if t.LocalPort == port {
				inUse = true
				break
			}
		}
		if !inUse {
			return port
		}
	}
	return basePort
}

func (m *Manager) startPortForward(tunnel *Tunnel) {
	defer func() {
		if r := recover(); r != nil {
			m.mutex.Lock()
			tunnel.Status = TunnelStatusDead
			tunnel.ErrorMsg = fmt.Sprintf("panic: %v", r)
			m.mutex.Unlock()
		}
	}()

	// Always forward to a pod (PodName is set even for services)
	path := fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/portforward",
		tunnel.Namespace, tunnel.PodName)

	hostURL, err := url.Parse(m.restConfig.Host)
	if err != nil {
		m.setTunnelError(tunnel, err)
		return
	}

	hostURL.Path = path

	transport, upgrader, err := spdy.RoundTripperFor(m.restConfig)
	if err != nil {
		m.setTunnelError(tunnel, err)
		return
	}

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, http.MethodPost, hostURL)

	ports := []string{fmt.Sprintf("%d:%d", tunnel.LocalPort, tunnel.TargetPort)}

	// Create a simple writer that discards output
	out := &discardWriter{}
	errOut := &discardWriter{}

	forwarder, err := portforward.New(dialer, ports, tunnel.stopChan, tunnel.readyChan, out, errOut)
	if err != nil {
		m.setTunnelError(tunnel, err)
		return
	}

	tunnel.forwarder = forwarder

	// Run the port forward (blocks until stopped or error)
	err = forwarder.ForwardPorts()
	if err != nil {
		m.setTunnelError(tunnel, err)
	}
}

func (m *Manager) setTunnelError(tunnel *Tunnel, err error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	tunnel.Status = TunnelStatusDead
	tunnel.ErrorMsg = err.Error()
}

type discardWriter struct{}

func (w *discardWriter) Write(p []byte) (n int, err error) {
	return len(p), nil
}
