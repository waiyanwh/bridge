package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// DashboardHandler handles dashboard-related HTTP requests
type DashboardHandler struct {
	k8sService *k8s.Service
}

// NewDashboardHandler creates a new DashboardHandler
func NewDashboardHandler(k8sService *k8s.Service) *DashboardHandler {
	return &DashboardHandler{
		k8sService: k8sService,
	}
}

// ClusterHealthStatus represents the cluster health information
type ClusterHealthStatus struct {
	Status     string `json:"status"` // "Healthy" or "Degraded"
	TotalNodes int    `json:"totalNodes"`
	ReadyNodes int    `json:"readyNodes"`
	NotReady   int    `json:"notReady"`
}

// AccessStats represents the access statistics
type AccessStats struct {
	ActiveUsers  int `json:"activeUsers"`
	ExpiringSoon int `json:"expiringSoon"` // Within 24 hours
	Permanent    int `json:"permanent"`
}

// ResourceUsage represents resource usage statistics
type ResourceUsage struct {
	Usage      string `json:"usage"`      // e.g., "4500m" or "12Gi"
	Capacity   string `json:"capacity"`   // e.g., "16000m" or "32Gi"
	Percentage int    `json:"percentage"` // 0-100
}

// DashboardStatsResponse represents the dashboard stats response
type DashboardStatsResponse struct {
	ClusterHealth  ClusterHealthStatus `json:"clusterHealth"`
	NamespaceCount int                 `json:"namespaceCount"`
	AccessStats    AccessStats         `json:"accessStats"`
	CPU            *ResourceUsage      `json:"cpu,omitempty"`
	Memory         *ResourceUsage      `json:"memory,omitempty"`
}

// Internal structs for parsing Metrics API response
type nodeMetricsList struct {
	Items []nodeMetricsItem `json:"items"`
}

type nodeMetricsItem struct {
	Usage corev1.ResourceList `json:"usage"`
}

// GetStats handles GET /api/v1/dashboard/stats
func (h *DashboardHandler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	// Get cluster health & total capacity
	clusterHealth := ClusterHealthStatus{
		Status: "Healthy",
	}

	var totalCPUCapacity int64 // millicores
	var totalMemCapacity int64 // bytes

	nodeList, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		clusterHealth.TotalNodes = len(nodeList.Items)
		for _, node := range nodeList.Items {
			// Health check
			isReady := false
			for _, condition := range node.Status.Conditions {
				if condition.Type == "Ready" && condition.Status == "True" {
					isReady = true
					break
				}
			}
			if isReady {
				clusterHealth.ReadyNodes++
			} else {
				clusterHealth.NotReady++
			}

			// Sum capacity
			totalCPUCapacity += node.Status.Capacity.Cpu().MilliValue()
			totalMemCapacity += node.Status.Capacity.Memory().Value()
		}
		if clusterHealth.NotReady > 0 {
			clusterHealth.Status = "Degraded"
		}
	}

	// Calculate Resource Usage
	var cpuUsage, memUsage *ResourceUsage

	// Fetch metrics from metrics.k8s.io
	// We use raw REST call because we don't want to import the entire metrics client
	data, err := clientset.CoreV1().RESTClient().Get().AbsPath("/apis/metrics.k8s.io/v1beta1/nodes").DoRaw(ctx)
	if err == nil {
		var metricsList nodeMetricsList
		if jsonErr := json.Unmarshal(data, &metricsList); jsonErr == nil {
			var totalCPUUsage int64 // millicores
			var totalMemUsage int64 // bytes

			for _, item := range metricsList.Items {
				totalCPUUsage += item.Usage.Cpu().MilliValue()
				totalMemUsage += item.Usage.Memory().Value()
			}

			if totalCPUCapacity > 0 {
				percent := int((totalCPUUsage * 100) / totalCPUCapacity)
				cpuUsage = &ResourceUsage{
					Usage:      fmt.Sprintf("%dm", totalCPUUsage),
					Capacity:   fmt.Sprintf("%dm", totalCPUCapacity),
					Percentage: percent,
				}
			}

			if totalMemCapacity > 0 {
				percent := int((totalMemUsage * 100) / totalMemCapacity)
				// Convert to GiB for display if large enough, else MiB
				usageGi := float64(totalMemUsage) / (1024 * 1024 * 1024)
				capGi := float64(totalMemCapacity) / (1024 * 1024 * 1024)

				memUsage = &ResourceUsage{
					Usage:      fmt.Sprintf("%.1fGi", usageGi),
					Capacity:   fmt.Sprintf("%.1fGi", capGi),
					Percentage: percent,
				}
			}
		}
	}

	// Get namespace count
	namespaceCount := 0
	nsList, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err == nil {
		namespaceCount = len(nsList.Items)
	}

	// Get access stats from Bridge-managed ServiceAccounts
	accessStats := AccessStats{}
	labelSelector := "app.kubernetes.io/managed-by=bridge"
	saList, err := clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err == nil {
		now := time.Now()
		twentyFourHoursLater := now.Add(24 * time.Hour)

		for _, sa := range saList.Items {
			expiresAtStr := ""
			if sa.Annotations != nil {
				expiresAtStr = sa.Annotations[AnnotationExpiresAt]
			}

			if expiresAtStr == "" {
				// Permanent access
				accessStats.ActiveUsers++
				accessStats.Permanent++
			} else {
				expiresAt, err := time.Parse(time.RFC3339, expiresAtStr)
				if err == nil {
					if expiresAt.After(now) {
						// Still active
						accessStats.ActiveUsers++
						// Check if expiring within 24 hours
						if expiresAt.Before(twentyFourHoursLater) {
							accessStats.ExpiringSoon++
						}
					}
					// If expired, don't count
				}
			}
		}
	}

	c.JSON(http.StatusOK, DashboardStatsResponse{
		ClusterHealth:  clusterHealth,
		NamespaceCount: namespaceCount,
		AccessStats:    accessStats,
		CPU:            cpuUsage,
		Memory:         memUsage,
	})
}
