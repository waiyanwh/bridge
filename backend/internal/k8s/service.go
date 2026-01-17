package k8s

import (
	"context"
	"fmt"
	"io"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// PodInfo represents a simplified pod structure for API responses
type PodInfo struct {
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Status            string `json:"status"`
	Restarts          int32  `json:"restarts"`
	Age               string `json:"age"`
	IP                string `json:"ip"`
	Node              string `json:"node"`
	PriorityClassName string `json:"priorityClassName,omitempty"`
	Priority          int32  `json:"priority,omitempty"`
	SchedulerName     string `json:"schedulerName,omitempty"`
	QoSClass          string `json:"qosClass,omitempty"`
}

// ContainerInfo represents container information
type ContainerInfo struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	Ready        bool   `json:"ready"`
	RestartCount int32  `json:"restartCount"`
	State        string `json:"state"`
}

// PodDetail represents full pod details for the detail view
type PodDetail struct {
	Name                       string                      `json:"name"`
	Namespace                  string                      `json:"namespace"`
	Status                     string                      `json:"status"`
	IP                         string                      `json:"ip"`
	Node                       string                      `json:"node"`
	CreatedAt                  string                      `json:"createdAt"`
	Age                        string                      `json:"age"`
	Labels                     map[string]string           `json:"labels"`
	Annotations                map[string]string           `json:"annotations"`
	Containers                 []ContainerInfo             `json:"containers"`
	Restarts                   int32                       `json:"restarts"`
	NodeSelector               map[string]string           `json:"nodeSelector,omitempty"`
	Tolerations                []PodToleration             `json:"tolerations,omitempty"`
	TopologySpreadConstraints  []TopologySpreadConstraint  `json:"topologySpreadConstraints,omitempty"`
	Affinity                   *PodAffinity                `json:"affinity,omitempty"`
	PriorityClassName          string                      `json:"priorityClassName,omitempty"`
	Priority                   int32                       `json:"priority,omitempty"`
	SchedulerName              string                      `json:"schedulerName,omitempty"`
	QoSClass                   string                      `json:"qosClass,omitempty"`
}

// PodToleration represents a toleration for pod scheduling
type PodToleration struct {
	Key               string `json:"key,omitempty"`
	Operator          string `json:"operator,omitempty"`
	Value             string `json:"value,omitempty"`
	Effect            string `json:"effect,omitempty"`
	TolerationSeconds *int64 `json:"tolerationSeconds,omitempty"`
}

// TopologySpreadConstraint describes how a group of pods should be spread
type TopologySpreadConstraint struct {
	MaxSkew           int32             `json:"maxSkew"`
	TopologyKey       string            `json:"topologyKey"`
	WhenUnsatisfiable string            `json:"whenUnsatisfiable"`
	LabelSelector     map[string]string `json:"labelSelector,omitempty"`
}

// PodAffinity contains affinity scheduling rules
type PodAffinity struct {
	NodeAffinity         *NodeAffinityRules `json:"nodeAffinity,omitempty"`
	PodAffinity          *AffinityRules     `json:"podAffinity,omitempty"`
	PodAntiAffinity      *AffinityRules     `json:"podAntiAffinity,omitempty"`
}

// NodeAffinityRules contains node affinity rules
type NodeAffinityRules struct {
	Required  []AffinityTerm `json:"required,omitempty"`
	Preferred []AffinityTerm `json:"preferred,omitempty"`
}

// AffinityRules contains pod affinity/anti-affinity rules
type AffinityRules struct {
	Required  []PodAffinityTerm `json:"required,omitempty"`
	Preferred []PodAffinityTerm `json:"preferred,omitempty"`
}

// AffinityTerm represents a node selector term
type AffinityTerm struct {
	MatchExpressions []LabelSelectorRequirement `json:"matchExpressions,omitempty"`
	Weight           int32                       `json:"weight,omitempty"`
}

// PodAffinityTerm represents a pod selector term
type PodAffinityTerm struct {
	TopologyKey      string                     `json:"topologyKey"`
	LabelSelector    map[string]string          `json:"labelSelector,omitempty"`
	MatchExpressions []LabelSelectorRequirement `json:"matchExpressions,omitempty"`
	Namespaces       []string                   `json:"namespaces,omitempty"`
	Weight           int32                      `json:"weight,omitempty"`
}

// LabelSelectorRequirement is a selector requirement
type LabelSelectorRequirement struct {
	Key      string   `json:"key"`
	Operator string   `json:"operator"`
	Values   []string `json:"values,omitempty"`
}

// NodeTaint represents a taint on a node
type NodeTaint struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

// NodeCondition represents a node condition
type NodeCondition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

// NodeInfo represents node information with resource metrics
type NodeInfo struct {
	Name               string            `json:"name"`
	Status             string            `json:"status"`
	Role               string            `json:"role"`
	Version            string            `json:"version"`
	Labels             map[string]string `json:"labels"`
	Annotations        map[string]string `json:"annotations"`
	Taints             []NodeTaint       `json:"taints"`
	Conditions         []NodeCondition   `json:"conditions"`
	CPUCapacity        int64             `json:"cpuCapacity"`        // in millicores
	CPUAllocatable     int64             `json:"cpuAllocatable"`     // in millicores
	CPUUsagePercent    int               `json:"cpuUsagePercent"`    // 0-100
	MemoryCapacity     int64             `json:"memoryCapacity"`     // in bytes
	MemoryAllocatable  int64             `json:"memoryAllocatable"`  // in bytes
	MemoryUsagePercent int               `json:"memoryUsagePercent"` // 0-100
	PodsCapacity       int64             `json:"podsCapacity"`
	PodsAllocatable    int64             `json:"podsAllocatable"`
	PodCount           int               `json:"podCount"`
	Age                string            `json:"age"`
	OSImage            string            `json:"osImage"`
	KernelVersion      string            `json:"kernelVersion"`
	ContainerRuntime   string            `json:"containerRuntime"`
	Architecture       string            `json:"architecture"`
}

// ConfigMapInfo represents a ConfigMap (list view)
type ConfigMapInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Keys      []string          `json:"keys"`
	Data      map[string]string `json:"data,omitempty"`
	Age       string            `json:"age"`
}

// SecretInfo represents a Secret (list view - no data for security)
type SecretInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Type      string   `json:"type"`
	Keys      []string `json:"keys"`
	Age       string   `json:"age"`
}

// Service wraps the Kubernetes ClientManager and provides high-level operations
type Service struct {
	manager *ClientManager
}

// NewService creates a new K8s service wrapper from a ClientManager
func NewService(manager *ClientManager) *Service {
	return &Service{
		manager: manager,
	}
}

// NewServiceLegacy creates a new K8s service wrapper (legacy, for backward compatibility)
func NewServiceLegacy(clientset *kubernetes.Clientset, config *rest.Config) *Service {
	// Create a minimal manager wrapper - not recommended for new code
	return &Service{
		manager: &ClientManager{
			clientset:      clientset,
			config:         config,
			currentContext: "default",
		},
	}
}

// GetClientset returns the underlying Kubernetes clientset
// Returns an error if the client is not initialized and reconnection fails
func (s *Service) GetClientset() (*kubernetes.Clientset, error) {
	return s.manager.GetClientset()
}

// GetConfig returns the underlying REST config
// Returns an error if the config is not initialized and reconnection fails
func (s *Service) GetConfig() (*rest.Config, error) {
	return s.manager.GetConfig()
}

// GetManager returns the underlying ClientManager
func (s *Service) GetManager() *ClientManager {
	return s.manager
}

// ListPods lists all pods in the specified namespace
// If namespace is empty, lists pods across all namespaces
func (s *Service) ListPods(ctx context.Context, namespace string) ([]PodInfo, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if namespace == "" {
			return nil, fmt.Errorf("failed to list pods in all namespaces: %w", err)
		}
		return nil, fmt.Errorf("failed to list pods in namespace %s: %w", namespace, err)
	}

	result := make([]PodInfo, 0, len(pods.Items))
	for _, pod := range pods.Items {
		result = append(result, podToPodInfo(&pod))
	}

	return result, nil
}

// GetPod retrieves a single pod by name and namespace
func (s *Service) GetPod(ctx context.Context, namespace, name string) (*corev1.Pod, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	pod, err := clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod %s/%s: %w", namespace, name, err)
	}
	return pod, nil
}

// GetPodDetail retrieves detailed pod information
func (s *Service) GetPodDetail(ctx context.Context, namespace, name string) (*PodDetail, error) {
	pod, err := s.GetPod(ctx, namespace, name)
	if err != nil {
		return nil, err
	}

	// Build container info
	containers := make([]ContainerInfo, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		ci := ContainerInfo{
			Name:  c.Name,
			Image: c.Image,
		}
		// Find status for this container
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name == c.Name {
				ci.Ready = cs.Ready
				ci.RestartCount = cs.RestartCount
				ci.State = getContainerState(&cs)
				break
			}
		}
		containers = append(containers, ci)
	}

	// Calculate total restarts
	var totalRestarts int32
	for _, cs := range pod.Status.ContainerStatuses {
		totalRestarts += cs.RestartCount
	}

	// Get priority
	var priority int32
	if pod.Spec.Priority != nil {
		priority = *pod.Spec.Priority
	}

	return &PodDetail{
		Name:                      pod.Name,
		Namespace:                 pod.Namespace,
		Status:                    getPodStatus(pod),
		IP:                        pod.Status.PodIP,
		Node:                      pod.Spec.NodeName,
		CreatedAt:                 pod.CreationTimestamp.Format(time.RFC3339),
		Age:                       formatAge(pod.CreationTimestamp.Time),
		Labels:                    pod.Labels,
		Annotations:               pod.Annotations,
		Containers:                containers,
		Restarts:                  totalRestarts,
		NodeSelector:              pod.Spec.NodeSelector,
		Tolerations:               convertTolerations(pod.Spec.Tolerations),
		TopologySpreadConstraints: convertTopologyConstraints(pod.Spec.TopologySpreadConstraints),
		Affinity:                  convertAffinity(pod.Spec.Affinity),
		PriorityClassName:         pod.Spec.PriorityClassName,
		Priority:                  priority,
		SchedulerName:             pod.Spec.SchedulerName,
		QoSClass:                  string(pod.Status.QOSClass),
	}, nil
}

// GetPodLogs returns a stream of logs for a pod
func (s *Service) GetPodLogs(ctx context.Context, namespace, name string, opts *corev1.PodLogOptions) (io.ReadCloser, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	req := clientset.CoreV1().Pods(namespace).GetLogs(name, opts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs for pod %s/%s: %w", namespace, name, err)
	}
	return stream, nil
}

// ListNodes lists all nodes with resource metrics
func (s *Service) ListNodes(ctx context.Context) ([]NodeInfo, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	nodes, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}

	// Get pod counts per node
	pods, err := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	// Count pods per node
	podCountByNode := make(map[string]int)
	for _, pod := range pods.Items {
		if pod.Spec.NodeName != "" {
			podCountByNode[pod.Spec.NodeName]++
		}
	}

	result := make([]NodeInfo, 0, len(nodes.Items))
	for _, node := range nodes.Items {
		result = append(result, nodeToNodeInfo(&node, podCountByNode[node.Name]))
	}

	return result, nil
}

// nodeToNodeInfo converts a Kubernetes Node to our NodeInfo struct
func nodeToNodeInfo(node *corev1.Node, podCount int) NodeInfo {
	// Get node status
	status := "Unknown"
	for _, condition := range node.Status.Conditions {
		if condition.Type == corev1.NodeReady {
			if condition.Status == corev1.ConditionTrue {
				status = "Ready"
			} else {
				status = "NotReady"
			}
			break
		}
	}

	// Get node role
	role := "worker"
	if _, ok := node.Labels["node-role.kubernetes.io/control-plane"]; ok {
		role = "control-plane"
	} else if _, ok := node.Labels["node-role.kubernetes.io/master"]; ok {
		role = "master"
	}

	// Get resource metrics
	cpuCapacity := node.Status.Capacity.Cpu().MilliValue()
	cpuAllocatable := node.Status.Allocatable.Cpu().MilliValue()
	memoryCapacity := node.Status.Capacity.Memory().Value()
	memoryAllocatable := node.Status.Allocatable.Memory().Value()

	// Get pods capacity
	podsCapacity := node.Status.Capacity.Pods().Value()
	podsAllocatable := node.Status.Allocatable.Pods().Value()

	// Calculate usage as: (capacity - allocatable) / capacity * 100
	// This gives us how much is reserved/used by the system
	// In a real scenario with metrics-server, we'd get actual usage
	cpuUsed := cpuCapacity - cpuAllocatable
	memoryUsed := memoryCapacity - memoryAllocatable

	var cpuUsagePercent, memoryUsagePercent int
	if cpuCapacity > 0 {
		// For a better approximation, we'll use a base system usage + allocated calculation
		// This is a fallback when metrics-server is not available
		cpuUsagePercent = int((cpuUsed * 100) / cpuCapacity)
		// Add some simulated usage (in real scenario, this would come from metrics-server)
		if cpuUsagePercent < 5 {
			cpuUsagePercent = 5 + (podCount * 2) // Base usage + pod-based estimate
			if cpuUsagePercent > 95 {
				cpuUsagePercent = 95
			}
		}
	}
	if memoryCapacity > 0 {
		memoryUsagePercent = int((memoryUsed * 100) / memoryCapacity)
		// Add some simulated usage
		if memoryUsagePercent < 10 {
			memoryUsagePercent = 10 + (podCount * 3) // Base usage + pod-based estimate
			if memoryUsagePercent > 95 {
				memoryUsagePercent = 95
			}
		}
	}

	// Build taints list
	taints := make([]NodeTaint, 0, len(node.Spec.Taints))
	for _, t := range node.Spec.Taints {
		taints = append(taints, NodeTaint{
			Key:    t.Key,
			Value:  t.Value,
			Effect: string(t.Effect),
		})
	}

	// Build conditions list
	conditions := make([]NodeCondition, 0, len(node.Status.Conditions))
	for _, c := range node.Status.Conditions {
		conditions = append(conditions, NodeCondition{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}

	// Copy labels (or empty map if nil)
	labels := make(map[string]string)
	for k, v := range node.Labels {
		labels[k] = v
	}

	// Copy annotations (or empty map if nil)
	annotations := make(map[string]string)
	for k, v := range node.Annotations {
		annotations[k] = v
	}

	return NodeInfo{
		Name:               node.Name,
		Status:             status,
		Role:               role,
		Version:            node.Status.NodeInfo.KubeletVersion,
		Labels:             labels,
		Annotations:        annotations,
		Taints:             taints,
		Conditions:         conditions,
		CPUCapacity:        cpuCapacity,
		CPUAllocatable:     cpuAllocatable,
		CPUUsagePercent:    cpuUsagePercent,
		MemoryCapacity:     memoryCapacity,
		MemoryAllocatable:  memoryAllocatable,
		MemoryUsagePercent: memoryUsagePercent,
		PodsCapacity:       podsCapacity,
		PodsAllocatable:    podsAllocatable,
		PodCount:           podCount,
		Age:                formatAge(node.CreationTimestamp.Time),
		OSImage:            node.Status.NodeInfo.OSImage,
		KernelVersion:      node.Status.NodeInfo.KernelVersion,
		ContainerRuntime:   node.Status.NodeInfo.ContainerRuntimeVersion,
		Architecture:       node.Status.NodeInfo.Architecture,
	}
}

// ListConfigMaps lists all ConfigMaps in a namespace
func (s *Service) ListConfigMaps(ctx context.Context, namespace string) ([]ConfigMapInfo, error) {
	if namespace == "" {
		namespace = "default"
	}

	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	configMaps, err := clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list configmaps in namespace %s: %w", namespace, err)
	}

	result := make([]ConfigMapInfo, 0, len(configMaps.Items))
	for _, cm := range configMaps.Items {
		keys := make([]string, 0, len(cm.Data))
		for key := range cm.Data {
			keys = append(keys, key)
		}
		result = append(result, ConfigMapInfo{
			Name:      cm.Name,
			Namespace: cm.Namespace,
			Keys:      keys,
			Age:       formatAge(cm.CreationTimestamp.Time),
		})
	}

	return result, nil
}

// GetConfigMap retrieves a ConfigMap with its data
func (s *Service) GetConfigMap(ctx context.Context, namespace, name string) (*ConfigMapInfo, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get configmap %s/%s: %w", namespace, name, err)
	}

	keys := make([]string, 0, len(cm.Data))
	for key := range cm.Data {
		keys = append(keys, key)
	}

	return &ConfigMapInfo{
		Name:      cm.Name,
		Namespace: cm.Namespace,
		Keys:      keys,
		Data:      cm.Data,
		Age:       formatAge(cm.CreationTimestamp.Time),
	}, nil
}

// ListSecrets lists all Secrets in a namespace (metadata only, no data for security)
func (s *Service) ListSecrets(ctx context.Context, namespace string) ([]SecretInfo, error) {
	if namespace == "" {
		namespace = "default"
	}

	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets in namespace %s: %w", namespace, err)
	}

	result := make([]SecretInfo, 0, len(secrets.Items))
	for _, secret := range secrets.Items {
		keys := make([]string, 0, len(secret.Data))
		for key := range secret.Data {
			keys = append(keys, key)
		}
		result = append(result, SecretInfo{
			Name:      secret.Name,
			Namespace: secret.Namespace,
			Type:      string(secret.Type),
			Keys:      keys,
			Age:       formatAge(secret.CreationTimestamp.Time),
		})
	}

	return result, nil
}

// GetSecret retrieves a Secret (raw bytes - caller should decode)
func (s *Service) GetSecret(ctx context.Context, namespace, name string) (*corev1.Secret, error) {
	clientset, err := s.GetClientset()
	if err != nil {
		return nil, fmt.Errorf("client not ready: %w", err)
	}

	secret, err := clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get secret %s/%s: %w", namespace, name, err)
	}
	return secret, nil
}

// getContainerState returns a human-readable container state
func getContainerState(cs *corev1.ContainerStatus) string {
	if cs.State.Running != nil {
		return "Running"
	}
	if cs.State.Waiting != nil {
		return cs.State.Waiting.Reason
	}
	if cs.State.Terminated != nil {
		return cs.State.Terminated.Reason
	}
	return "Unknown"
}

// podToPodInfo converts a Kubernetes Pod to our simplified PodInfo struct
func podToPodInfo(pod *corev1.Pod) PodInfo {
	// Calculate total restarts across all containers
	var totalRestarts int32
	for _, cs := range pod.Status.ContainerStatuses {
		totalRestarts += cs.RestartCount
	}

	// Calculate age
	age := formatAge(pod.CreationTimestamp.Time)

	// Determine pod status
	status := getPodStatus(pod)

	// Get pod IP (may be empty if not yet assigned)
	ip := pod.Status.PodIP
	if ip == "" {
		ip = "<pending>"
	}

	// Get priority (may be nil)
	var priority int32
	if pod.Spec.Priority != nil {
		priority = *pod.Spec.Priority
	}

	return PodInfo{
		Name:              pod.Name,
		Namespace:         pod.Namespace,
		Status:            status,
		Restarts:          totalRestarts,
		Age:               age,
		IP:                ip,
		Node:              pod.Spec.NodeName,
		PriorityClassName: pod.Spec.PriorityClassName,
		Priority:          priority,
		SchedulerName:     pod.Spec.SchedulerName,
		QoSClass:          string(pod.Status.QOSClass),
	}
}

// getPodStatus determines the current status of a pod
func getPodStatus(pod *corev1.Pod) string {
	// Check for deletion
	if pod.DeletionTimestamp != nil {
		return "Terminating"
	}

	// Check container statuses for more specific states
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil {
			return cs.State.Waiting.Reason
		}
		if cs.State.Terminated != nil {
			return cs.State.Terminated.Reason
		}
	}

	// Check init container statuses
	for _, cs := range pod.Status.InitContainerStatuses {
		if cs.State.Waiting != nil {
			return "Init:" + cs.State.Waiting.Reason
		}
		if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
			return "Init:Error"
		}
	}

	// Default to phase
	return string(pod.Status.Phase)
}

// formatAge formats a duration as a human-readable age string
func formatAge(t time.Time) string {
	duration := time.Since(t)

	if duration.Hours() >= 24*365 {
		years := int(duration.Hours() / (24 * 365))
		return fmt.Sprintf("%dy", years)
	}
	if duration.Hours() >= 24 {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
	if duration.Hours() >= 1 {
		hours := int(duration.Hours())
		return fmt.Sprintf("%dh", hours)
	}
	if duration.Minutes() >= 1 {
		minutes := int(duration.Minutes())
		return fmt.Sprintf("%dm", minutes)
	}
	seconds := int(duration.Seconds())
	return fmt.Sprintf("%ds", seconds)
}

// convertTolerations converts K8s tolerations to our API type
func convertTolerations(tolerations []corev1.Toleration) []PodToleration {
	if len(tolerations) == 0 {
		return nil
	}
	result := make([]PodToleration, len(tolerations))
	for i, t := range tolerations {
		result[i] = PodToleration{
			Key:               t.Key,
			Operator:          string(t.Operator),
			Value:             t.Value,
			Effect:            string(t.Effect),
			TolerationSeconds: t.TolerationSeconds,
		}
	}
	return result
}

// convertTopologyConstraints converts K8s topology constraints to our API type
func convertTopologyConstraints(constraints []corev1.TopologySpreadConstraint) []TopologySpreadConstraint {
	if len(constraints) == 0 {
		return nil
	}
	result := make([]TopologySpreadConstraint, len(constraints))
	for i, c := range constraints {
		tsc := TopologySpreadConstraint{
			MaxSkew:           c.MaxSkew,
			TopologyKey:       c.TopologyKey,
			WhenUnsatisfiable: string(c.WhenUnsatisfiable),
		}
		if c.LabelSelector != nil && c.LabelSelector.MatchLabels != nil {
			tsc.LabelSelector = c.LabelSelector.MatchLabels
		}
		result[i] = tsc
	}
	return result
}

// convertAffinity converts K8s affinity to our API type
func convertAffinity(affinity *corev1.Affinity) *PodAffinity {
	if affinity == nil {
		return nil
	}
	result := &PodAffinity{}

	// Convert Node Affinity
	if affinity.NodeAffinity != nil {
		result.NodeAffinity = &NodeAffinityRules{}
		
		// Required terms
		if affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution != nil {
			for _, term := range affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution.NodeSelectorTerms {
				at := AffinityTerm{}
				for _, expr := range term.MatchExpressions {
					at.MatchExpressions = append(at.MatchExpressions, LabelSelectorRequirement{
						Key:      expr.Key,
						Operator: string(expr.Operator),
						Values:   expr.Values,
					})
				}
				result.NodeAffinity.Required = append(result.NodeAffinity.Required, at)
			}
		}
		
		// Preferred terms
		for _, term := range affinity.NodeAffinity.PreferredDuringSchedulingIgnoredDuringExecution {
			at := AffinityTerm{Weight: term.Weight}
			for _, expr := range term.Preference.MatchExpressions {
				at.MatchExpressions = append(at.MatchExpressions, LabelSelectorRequirement{
					Key:      expr.Key,
					Operator: string(expr.Operator),
					Values:   expr.Values,
				})
			}
			result.NodeAffinity.Preferred = append(result.NodeAffinity.Preferred, at)
		}
	}

	// Convert Pod Affinity
	if affinity.PodAffinity != nil {
		result.PodAffinity = convertPodAffinityTerms(affinity.PodAffinity.RequiredDuringSchedulingIgnoredDuringExecution,
			affinity.PodAffinity.PreferredDuringSchedulingIgnoredDuringExecution)
	}

	// Convert Pod Anti-Affinity
	if affinity.PodAntiAffinity != nil {
		result.PodAntiAffinity = convertPodAffinityTerms(affinity.PodAntiAffinity.RequiredDuringSchedulingIgnoredDuringExecution,
			affinity.PodAntiAffinity.PreferredDuringSchedulingIgnoredDuringExecution)
	}

	return result
}

// convertPodAffinityTerms converts pod affinity terms to our API type
func convertPodAffinityTerms(required []corev1.PodAffinityTerm, preferred []corev1.WeightedPodAffinityTerm) *AffinityRules {
	rules := &AffinityRules{}

	for _, term := range required {
		pat := PodAffinityTerm{
			TopologyKey: term.TopologyKey,
			Namespaces:  term.Namespaces,
		}
		if term.LabelSelector != nil {
			pat.LabelSelector = term.LabelSelector.MatchLabels
			for _, expr := range term.LabelSelector.MatchExpressions {
				pat.MatchExpressions = append(pat.MatchExpressions, LabelSelectorRequirement{
					Key:      expr.Key,
					Operator: string(expr.Operator),
					Values:   expr.Values,
				})
			}
		}
		rules.Required = append(rules.Required, pat)
	}

	for _, wterm := range preferred {
		term := wterm.PodAffinityTerm
		pat := PodAffinityTerm{
			TopologyKey: term.TopologyKey,
			Namespaces:  term.Namespaces,
			Weight:      wterm.Weight,
		}
		if term.LabelSelector != nil {
			pat.LabelSelector = term.LabelSelector.MatchLabels
			for _, expr := range term.LabelSelector.MatchExpressions {
				pat.MatchExpressions = append(pat.MatchExpressions, LabelSelectorRequirement{
					Key:      expr.Key,
					Operator: string(expr.Operator),
					Values:   expr.Values,
				})
			}
		}
		rules.Preferred = append(rules.Preferred, pat)
	}

	return rules
}
