package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NetworkHandler handles network-related HTTP requests
type NetworkHandler struct {
	k8sService *k8s.Service
}

// NewNetworkHandler creates a new NetworkHandler
func NewNetworkHandler(k8sService *k8s.Service) *NetworkHandler {
	return &NetworkHandler{
		k8sService: k8sService,
	}
}

// ServiceInfo represents a Service
type ServiceInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Type      string   `json:"type"`
	ClusterIP string   `json:"clusterIP"`
	Ports     []string `json:"ports"`
	Age       string   `json:"age"`
}

// IngressInfo represents an Ingress
type IngressInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Hosts     []string `json:"hosts"`
	Address   string   `json:"address"`
	Class     string   `json:"class"`
	Age       string   `json:"age"`
}

// NetworkPolicyInfo represents a NetworkPolicy
type NetworkPolicyInfo struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	PodSelector string   `json:"podSelector"`
	PolicyTypes []string `json:"policyTypes"`
	Age         string   `json:"age"`
}

// ListServicesResponse response for listing services
type ListServicesResponse struct {
	Services  []ServiceInfo `json:"services"`
	Namespace string        `json:"namespace"`
	Count     int           `json:"count"`
}

// ListIngressesResponse response for listing ingresses
type ListIngressesResponse struct {
	Ingresses []IngressInfo `json:"ingresses"`
	Namespace string        `json:"namespace"`
	Count     int           `json:"count"`
}

// ListNetworkPoliciesResponse response for listing network policies
type ListNetworkPoliciesResponse struct {
	NetworkPolicies []NetworkPolicyInfo `json:"networkPolicies"`
	Namespace       string              `json:"namespace"`
	Count           int                 `json:"count"`
}

// ListServices handles GET /api/v1/services
func (h *NetworkHandler) ListServices(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	serviceList, err := h.k8sService.GetClientset().CoreV1().Services(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]ServiceInfo, 0, len(serviceList.Items))
	for _, svc := range serviceList.Items {
		ports := make([]string, 0, len(svc.Spec.Ports))
		for _, port := range svc.Spec.Ports {
			var portStr string
			if port.NodePort != 0 {
				portStr = fmt.Sprintf("%d:%d/%s", port.Port, port.NodePort, port.Protocol)
			} else {
				portStr = fmt.Sprintf("%d/%s", port.Port, port.Protocol)
			}
			ports = append(ports, portStr)
		}

		result = append(result, ServiceInfo{
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Type:      string(svc.Spec.Type),
			ClusterIP: svc.Spec.ClusterIP,
			Ports:     ports,
			Age:       formatAge(svc.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListServicesResponse{
		Services:  result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// ListIngresses handles GET /api/v1/ingresses
func (h *NetworkHandler) ListIngresses(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	ingressList, err := h.k8sService.GetClientset().NetworkingV1().Ingresses(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]IngressInfo, 0, len(ingressList.Items))
	for _, ing := range ingressList.Items {
		hosts := make([]string, 0)
		for _, rule := range ing.Spec.Rules {
			if rule.Host != "" {
				hosts = append(hosts, rule.Host)
			}
		}

		// Get load balancer address
		address := ""
		if len(ing.Status.LoadBalancer.Ingress) > 0 {
			lb := ing.Status.LoadBalancer.Ingress[0]
			if lb.IP != "" {
				address = lb.IP
			} else if lb.Hostname != "" {
				address = lb.Hostname
			}
		}

		// Get ingress class
		ingressClass := ""
		if ing.Spec.IngressClassName != nil {
			ingressClass = *ing.Spec.IngressClassName
		}

		result = append(result, IngressInfo{
			Name:      ing.Name,
			Namespace: ing.Namespace,
			Hosts:     hosts,
			Address:   address,
			Class:     ingressClass,
			Age:       formatAge(ing.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListIngressesResponse{
		Ingresses: result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// ListNetworkPolicies handles GET /api/v1/networkpolicies
func (h *NetworkHandler) ListNetworkPolicies(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	npList, err := h.k8sService.GetClientset().NetworkingV1().NetworkPolicies(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]NetworkPolicyInfo, 0, len(npList.Items))
	for _, np := range npList.Items {
		// Format pod selector
		podSelector := ""
		labels := np.Spec.PodSelector.MatchLabels
		if len(labels) > 0 {
			parts := make([]string, 0, len(labels))
			for k, v := range labels {
				parts = append(parts, fmt.Sprintf("%s=%s", k, v))
			}
			podSelector = strings.Join(parts, ", ")
		} else {
			podSelector = "(all pods)"
		}

		// Get policy types
		policyTypes := make([]string, 0, len(np.Spec.PolicyTypes))
		for _, pt := range np.Spec.PolicyTypes {
			policyTypes = append(policyTypes, string(pt))
		}

		result = append(result, NetworkPolicyInfo{
			Name:        np.Name,
			Namespace:   np.Namespace,
			PodSelector: podSelector,
			PolicyTypes: policyTypes,
			Age:         formatAge(np.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListNetworkPoliciesResponse{
		NetworkPolicies: result,
		Namespace:       displayNs,
		Count:           len(result),
	})
}
