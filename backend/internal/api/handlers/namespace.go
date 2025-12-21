package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"	
	"github.com/waiyan/bridge/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NamespaceHandler handles namespace related HTTP requests
type NamespaceHandler struct {
	k8sService *k8s.Service
}

// NewNamespaceHandler creates a new NamespaceHandler
func NewNamespaceHandler(k8sService *k8s.Service) *NamespaceHandler {
	return &NamespaceHandler{
		k8sService: k8sService,
	}
}

// ListNamespacesResponse represents the response
type ListNamespacesResponse struct {
	Namespaces []string `json:"namespaces"`
	Count      int      `json:"count"`
}

// ListNamespaces handles GET /api/v1/namespaces
func (h *NamespaceHandler) ListNamespaces(c *gin.Context) {
	namespaces, err := h.k8sService.GetClientset().CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	names := make([]string, 0, len(namespaces.Items))
	for _, ns := range namespaces.Items {
		names = append(names, ns.Name)
	}

	c.JSON(http.StatusOK, ListNamespacesResponse{
		Namespaces: names,
		Count:      len(names),
	})
}

// ResourceQuotaInfo represents resource quota details
type ResourceQuotaInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	// Hard limits
	HardCPU    string `json:"hardCPU"`
	HardMemory string `json:"hardMemory"`
	HardPods   string `json:"hardPods"`
	// Used
	UsedCPU    string `json:"usedCPU"`
	UsedMemory string `json:"usedMemory"`
	UsedPods   string `json:"usedPods"`
	// Percentages (calculated)
	CpuUsagePercent    float64 `json:"cpuUsagePercent"`
	MemoryUsagePercent float64 `json:"memoryUsagePercent"`
	PodsUsagePercent   float64 `json:"podsUsagePercent"`
}

// ResourceQuotasResponse represents the response
type ResourceQuotasResponse struct {
	Quotas []ResourceQuotaInfo `json:"quotas"`
}

// GetResourceQuotas handles GET /api/v1/resourcequotas/:namespace
func (h *NamespaceHandler) GetResourceQuotas(c *gin.Context) {
	namespace := c.Param("namespace")

	quotas, err := h.k8sService.GetClientset().CoreV1().ResourceQuotas(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	var quotaInfos []ResourceQuotaInfo
	for _, q := range quotas.Items {
		info := ResourceQuotaInfo{
			Name:      q.Name,
			Namespace: q.Namespace,
		}

		// Hard limits
		if q.Status.Hard != nil {
			if val, ok := q.Status.Hard[corev1.ResourceCPU]; ok {
				info.HardCPU = val.String()
			}
			if val, ok := q.Status.Hard[corev1.ResourceMemory]; ok {
				info.HardMemory = val.String()
			}
			if val, ok := q.Status.Hard[corev1.ResourcePods]; ok {
				info.HardPods = val.String()
			}
		}

		// Used
		if q.Status.Used != nil {
			// CPU
			if hard, ok := q.Status.Hard[corev1.ResourceCPU]; ok {
				if used, ok := q.Status.Used[corev1.ResourceCPU]; ok {
					info.UsedCPU = used.String()
					if hard.MilliValue() > 0 {
						info.CpuUsagePercent = float64(used.MilliValue()) / float64(hard.MilliValue()) * 100
					}
				}
			}

			// Memory
			if hard, ok := q.Status.Hard[corev1.ResourceMemory]; ok {
				if used, ok := q.Status.Used[corev1.ResourceMemory]; ok {
					info.UsedMemory = used.String()
					if hard.Value() > 0 {
						info.MemoryUsagePercent = float64(used.Value()) / float64(hard.Value()) * 100
					}
				}
			}

			// Pods
			if hard, ok := q.Status.Hard[corev1.ResourcePods]; ok {
				if used, ok := q.Status.Used[corev1.ResourcePods]; ok {
					info.UsedPods = used.String()
					if hard.Value() > 0 {
						info.PodsUsagePercent = float64(used.Value()) / float64(hard.Value()) * 100
					}
				}
			}
		}

		quotaInfos = append(quotaInfos, info)
	}

	c.JSON(http.StatusOK, ResourceQuotasResponse{Quotas: quotaInfos})
}
