package handlers

import (
	"fmt"
	"net/http"

	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TopologyHandler handles topology-related API requests
type TopologyHandler struct {
	k8sService *k8s.Service
}

// NewTopologyHandler creates a new TopologyHandler
func NewTopologyHandler(k8sService *k8s.Service) *TopologyHandler {
	return &TopologyHandler{
		k8sService: k8sService,
	}
}

// TopologyNode represents a node in the topology graph
type TopologyNode struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Position Position               `json:"position"`
	Data     map[string]interface{} `json:"data"`
}

// Position represents x,y coordinates
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// TopologyEdge represents an edge connecting two nodes
type TopologyEdge struct {
	ID       string `json:"id"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	Type     string `json:"type,omitempty"`
	Animated bool   `json:"animated,omitempty"`
}

// TopologyResponse represents the full topology graph
type TopologyResponse struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}

// GetTopology handles GET /api/v1/bridge/topology
func (h *TopologyHandler) GetTopology(c *gin.Context) {
	namespace := c.Query("namespace")
	if namespace == "" {
		namespace = "default"
	}

	ctx := c.Request.Context()
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	nodes := []TopologyNode{}
	edges := []TopologyEdge{}

	// Maps for building relationships
	serviceSelectors := make(map[string]map[string]string) // serviceName -> selector
	podLabels := make(map[string]map[string]string)        // podName -> labels
	deploymentPods := make(map[string]string)              // podName -> deploymentName (via OwnerRef)

	// Fetch Ingresses
	ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ing := range ingresses.Items {
			nodeID := fmt.Sprintf("ingress-%s", ing.Name)
			nodes = append(nodes, TopologyNode{
				ID:       nodeID,
				Type:     "ingress",
				Position: Position{X: 0, Y: 0}, // Layout will be computed on frontend
				Data: map[string]interface{}{
					"label":     ing.Name,
					"name":      ing.Name,
					"kind":      "Ingress",
					"namespace": ing.Namespace,
					"hosts":     getIngressHosts(&ing),
					"class":     getIngressClass(&ing),
					"address":   getIngressAddress(&ing),
					"age":       getAge(ing.CreationTimestamp),
				},
			})

			// Build edges from Ingress to Services
			for _, rule := range ing.Spec.Rules {
				if rule.HTTP != nil {
					for _, path := range rule.HTTP.Paths {
						if path.Backend.Service != nil {
							serviceName := path.Backend.Service.Name
							edgeID := fmt.Sprintf("%s-to-svc-%s", nodeID, serviceName)
							edges = append(edges, TopologyEdge{
								ID:     edgeID,
								Source: nodeID,
								Target: fmt.Sprintf("service-%s", serviceName),
								Type:   "smoothstep",
							})
						}
					}
				}
			}
		}
	}

	// Fetch Services
	services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, svc := range services.Items {
			nodeID := fmt.Sprintf("service-%s", svc.Name)
			nodes = append(nodes, TopologyNode{
				ID:       nodeID,
				Type:     "service",
				Position: Position{X: 0, Y: 0},
				Data: map[string]interface{}{
					"label":      svc.Name,
					"name":       svc.Name,
					"kind":       "Service",
					"namespace":  svc.Namespace,
					"type":       string(svc.Spec.Type),
					"clusterIP":  svc.Spec.ClusterIP,
					"ports":      getServicePorts(&svc),
					"externalIP": getServiceExternalIP(&svc),
					"selector":   svc.Spec.Selector,
					"age":        getAge(svc.CreationTimestamp),
				},
			})

			// Store selector for later matching
			if len(svc.Spec.Selector) > 0 {
				serviceSelectors[svc.Name] = svc.Spec.Selector
			}
		}
	}

	// Fetch Deployments
	deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, dep := range deployments.Items {
			nodeID := fmt.Sprintf("deployment-%s", dep.Name)

			ready := int32(0)
			if dep.Status.ReadyReplicas > 0 {
				ready = dep.Status.ReadyReplicas
			}

			nodes = append(nodes, TopologyNode{
				ID:       nodeID,
				Type:     "deployment",
				Position: Position{X: 0, Y: 0},
				Data: map[string]interface{}{
					"label":        dep.Name,
					"name":         dep.Name,
					"kind":         "Deployment",
					"namespace":    dep.Namespace,
					"replicas":     dep.Status.Replicas,
					"ready":        ready, // kept for graph compat
					"readyCount":   ready,
					"desiredCount": *dep.Spec.Replicas,
					"images":       getDeploymentImages(&dep),
					"selector":     dep.Spec.Selector.MatchLabels,
					"age":          getAge(dep.CreationTimestamp),
				},
			})
		}
	}

	// Fetch Pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			nodeID := fmt.Sprintf("pod-%s", pod.Name)

			status := string(pod.Status.Phase)
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.State.Waiting != nil {
					status = cs.State.Waiting.Reason
					break
				}
			}

			nodes = append(nodes, TopologyNode{
				ID:       nodeID,
				Type:     "pod",
				Position: Position{X: 0, Y: 0},
				Data: map[string]interface{}{
					"label":     pod.Name,
					"name":      pod.Name,
					"kind":      "Pod",
					"namespace": pod.Namespace,
					"status":    status,
					"ip":        pod.Status.PodIP,
				},
			})

			// Store labels for service matching
			podLabels[pod.Name] = pod.Labels

			// Check OwnerReferences for Deployment relationship
			for _, ownerRef := range pod.OwnerReferences {
				if ownerRef.Kind == "ReplicaSet" {
					// ReplicaSet name typically includes deployment name
					rsName := ownerRef.Name
					// Look up the ReplicaSet to find its owner (Deployment)
					rs, err := clientset.AppsV1().ReplicaSets(namespace).Get(ctx, rsName, metav1.GetOptions{})
					if err == nil {
						for _, rsOwner := range rs.OwnerReferences {
							if rsOwner.Kind == "Deployment" {
								deploymentPods[pod.Name] = rsOwner.Name
							}
						}
					}
				}
			}
		}
	}

	// Build edges: Service -> Pods (via selector matching)
	for svcName, selector := range serviceSelectors {
		for podName, labels := range podLabels {
			if matchLabels(selector, labels) {
				edgeID := fmt.Sprintf("svc-%s-to-pod-%s", svcName, podName)
				edges = append(edges, TopologyEdge{
					ID:       edgeID,
					Source:   fmt.Sprintf("service-%s", svcName),
					Target:   fmt.Sprintf("pod-%s", podName),
					Type:     "smoothstep",
					Animated: true,
				})
			}
		}
	}

	// Build edges: Deployment -> Pods (via OwnerReference)
	for podName, depName := range deploymentPods {
		edgeID := fmt.Sprintf("dep-%s-to-pod-%s", depName, podName)
		edges = append(edges, TopologyEdge{
			ID:     edgeID,
			Source: fmt.Sprintf("deployment-%s", depName),
			Target: fmt.Sprintf("pod-%s", podName),
			Type:   "smoothstep",
		})
	}

	c.JSON(http.StatusOK, TopologyResponse{
		Nodes: nodes,
		Edges: edges,
	})
}

// matchLabels checks if all selector labels match pod labels
func matchLabels(selector, labels map[string]string) bool {
	if len(selector) == 0 {
		return false
	}
	for key, value := range selector {
		if labels[key] != value {
			return false
		}
	}
	return true
}

// getIngressHosts extracts hosts from ingress rules
func getIngressHosts(ing *networkingv1.Ingress) []string {
	hosts := []string{}
	for _, rule := range ing.Spec.Rules {
		if rule.Host != "" {
			hosts = append(hosts, rule.Host)
		}
	}
	return hosts
}

// getIngressClass extracts ingress class name
func getIngressClass(ing *networkingv1.Ingress) string {
	if ing.Spec.IngressClassName != nil {
		return *ing.Spec.IngressClassName
	}
	return ""
}

// getIngressAddress extracts load balancer address
func getIngressAddress(ing *networkingv1.Ingress) string {
	if len(ing.Status.LoadBalancer.Ingress) > 0 {
		if ing.Status.LoadBalancer.Ingress[0].Hostname != "" {
			return ing.Status.LoadBalancer.Ingress[0].Hostname
		}
		return ing.Status.LoadBalancer.Ingress[0].IP
	}
	return ""
}

// getServiceExternalIP extracts external IP
func getServiceExternalIP(svc *corev1.Service) string {
	if len(svc.Status.LoadBalancer.Ingress) > 0 {
		if svc.Status.LoadBalancer.Ingress[0].Hostname != "" {
			return svc.Status.LoadBalancer.Ingress[0].Hostname
		}
		return svc.Status.LoadBalancer.Ingress[0].IP
	}
	return ""
}

// getDeploymentImages extracts container images
func getDeploymentImages(dep *appsv1.Deployment) []string {
	images := []string{}
	for _, container := range dep.Spec.Template.Spec.Containers {
		images = append(images, container.Image)
	}
	return images
}

// getServicePorts extracts port info from service
func getServicePorts(svc *corev1.Service) []string {
	ports := []string{}
	for _, p := range svc.Spec.Ports {
		ports = append(ports, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
	}
	return ports
}

// getAge calculates resource age
func getAge(timestamp metav1.Time) string {
	duration := time.Since(timestamp.Time)
	if duration.Hours() > 24 {
		return fmt.Sprintf("%dd", int(duration.Hours()/24))
	}
	if duration.Hours() > 1 {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	}
	if duration.Minutes() > 1 {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	}
	return fmt.Sprintf("%ds", int(duration.Seconds()))
}
