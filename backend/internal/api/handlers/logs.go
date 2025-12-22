package handlers

import (
	"bufio"
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/waiyan/bridge/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// LogsHandler handles pod log streaming via WebSocket
type LogsHandler struct {
	k8sService *k8s.Service
}

// NewLogsHandler creates a new LogsHandler
func NewLogsHandler(k8sService *k8s.Service) *LogsHandler {
	return &LogsHandler{
		k8sService: k8sService,
	}
}

// StreamLogs handles GET /api/v1/pods/:namespace/:name/logs
// Upgrades to WebSocket and streams pod logs
func (h *LogsHandler) StreamLogs(c *gin.Context) {
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container") // Optional: specific container

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	// Create context that cancels when connection closes
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Handle connection close from client
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				cancel()
				return
			}
		}
	}()

	// Get pod to find first container if not specified
	if container == "" {
		pod, err := h.k8sService.GetPod(ctx, namespace, podName)
		if err != nil {
			h.sendError(conn, "Failed to get pod: "+err.Error())
			return
		}
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			h.sendError(conn, "No containers found in pod")
			return
		}
	}

	// Configure log options
	opts := &corev1.PodLogOptions{
		Container: container,
		Follow:    true,
		TailLines: int64Ptr(100), // Start with last 100 lines
	}

	// Get log stream
	stream, err := h.k8sService.GetPodLogs(ctx, namespace, podName, opts)
	if err != nil {
		h.sendError(conn, "Failed to get logs: "+err.Error())
		return
	}
	defer stream.Close()

	// Read and send logs
	scanner := bufio.NewScanner(stream)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
			line := scanner.Text()
			if err := conn.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
				log.Printf("Failed to write to WebSocket: %v", err)
				return
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Scanner error: %v", err)
	}
}

func (h *LogsHandler) sendError(conn *websocket.Conn, msg string) {
	conn.WriteMessage(websocket.TextMessage, []byte("ERROR: "+msg))
	time.Sleep(100 * time.Millisecond)
}

func int64Ptr(i int64) *int64 {
	return &i
}

// LogLine represents a log line with metadata
type LogLine struct {
	Pod       string `json:"pod"`
	Container string `json:"container"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp,omitempty"`
}

// StreamAggregatedLogs handles GET /api/v1/logs/stream?selector=app=frontend
// Streams logs from all pods matching the selector
func (h *LogsHandler) StreamAggregatedLogs(c *gin.Context) {
	selector := c.Query("selector")
	namespace := c.Query("namespace")
	if namespace == "" {
		namespace = "default"
	}

	log.Printf("Aggregated logs request: selector=%s, namespace=%s", selector, namespace)

	if selector == "" {
		log.Printf("Empty selector, returning 400")
		c.JSON(http.StatusBadRequest, gin.H{"error": "selector query parameter is required"})
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("WebSocket connection established for selector: %s", selector)

	// Create context that cancels when connection closes
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Handle connection close from client
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				cancel()
				return
			}
		}
	}()

	// List pods matching the selector
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		h.sendError(conn, "Client not ready: "+err.Error())
		return
	}
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil {
		log.Printf("Failed to list pods with selector %s: %v", selector, err)
		h.sendError(conn, "Failed to list pods: "+err.Error())
		return
	}

	log.Printf("Found %d pods matching selector %s", len(pods.Items), selector)

	if len(pods.Items) == 0 {
		h.sendError(conn, "No pods found matching selector: "+selector)
		return
	}

	// Send initial message about which pods we're tailing
	podNames := make([]string, len(pods.Items))
	for i, pod := range pods.Items {
		podNames[i] = pod.Name
	}

	initMsg := map[string]interface{}{
		"type":  "init",
		"pods":  podNames,
		"count": len(podNames),
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		log.Printf("Failed to send init message: %v", err)
		return
	}

	// Create a channel to aggregate all log lines
	logChan := make(chan LogLine, 100)
	var wg sync.WaitGroup

	// Launch a goroutine for each pod to stream its logs
	for _, pod := range pods.Items {
		// Skip non-running pods
		if pod.Status.Phase != corev1.PodRunning {
			continue
		}

		// Get first container name
		if len(pod.Spec.Containers) == 0 {
			continue
		}
		containerName := pod.Spec.Containers[0].Name

		wg.Add(1)
		go func(podName, containerName string) {
			defer wg.Done()
			h.streamPodLogs(ctx, namespace, podName, containerName, logChan)
		}(pod.Name, containerName)
	}

	// Close logChan when all goroutines complete
	go func() {
		wg.Wait()
		close(logChan)
	}()

	// Fan-in: Read from the aggregated channel and send to WebSocket
	for {
		select {
		case <-ctx.Done():
			return
		case logLine, ok := <-logChan:
			if !ok {
				// Channel closed, all streams ended
				return
			}
			if err := conn.WriteJSON(logLine); err != nil {
				log.Printf("Failed to write to WebSocket: %v", err)
				return
			}
		}
	}
}

// streamPodLogs streams logs from a single pod to the aggregated channel
func (h *LogsHandler) streamPodLogs(ctx context.Context, namespace, podName, containerName string, logChan chan<- LogLine) {
	opts := &corev1.PodLogOptions{
		Container:  containerName,
		Follow:     true,
		TailLines:  int64Ptr(50), // Last 50 lines per pod
		Timestamps: true,
	}

	stream, err := h.k8sService.GetPodLogs(ctx, namespace, podName, opts)
	if err != nil {
		log.Printf("Failed to get logs for pod %s: %v", podName, err)
		return
	}
	defer stream.Close()

	scanner := bufio.NewScanner(stream)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
			line := scanner.Text()

			// Parse timestamp if present (format: 2006-01-02T15:04:05.999999999Z message)
			timestamp := ""
			message := line
			if len(line) > 30 && line[4] == '-' && line[7] == '-' {
				// Likely has a timestamp prefix
				spaceIdx := 30 // Approximate position after timestamp
				for i := 20; i < len(line) && i < 40; i++ {
					if line[i] == ' ' {
						spaceIdx = i
						break
					}
				}
				timestamp = line[:spaceIdx]
				if spaceIdx < len(line) {
					message = line[spaceIdx+1:]
				}
			}

			logChan <- LogLine{
				Pod:       podName,
				Container: containerName,
				Message:   message,
				Timestamp: timestamp,
			}
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Scanner error for pod %s: %v", podName, err)
	}
}
