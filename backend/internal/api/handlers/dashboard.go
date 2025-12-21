package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
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

// DashboardStatsResponse represents the dashboard stats response
type DashboardStatsResponse struct {
	ClusterHealth  ClusterHealthStatus `json:"clusterHealth"`
	NamespaceCount int                 `json:"namespaceCount"`
	AccessStats    AccessStats         `json:"accessStats"`
}

// GetStats handles GET /api/v1/dashboard/stats
func (h *DashboardHandler) GetStats(c *gin.Context) {
	ctx := c.Request.Context()
	clientset := h.k8sService.GetClientset()

	// Get cluster health
	clusterHealth := ClusterHealthStatus{
		Status: "Healthy",
	}

	nodeList, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		clusterHealth.TotalNodes = len(nodeList.Items)
		for _, node := range nodeList.Items {
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
		}
		if clusterHealth.NotReady > 0 {
			clusterHealth.Status = "Degraded"
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
	})
}
