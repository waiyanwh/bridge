package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// WorkloadActionsHandler handles workload write operations
type WorkloadActionsHandler struct {
	k8sService *k8s.Service
}

// NewWorkloadActionsHandler creates a new WorkloadActionsHandler
func NewWorkloadActionsHandler(k8sService *k8s.Service) *WorkloadActionsHandler {
	return &WorkloadActionsHandler{
		k8sService: k8sService,
	}
}

// ScaleRequest represents the request body for scaling
type ScaleRequest struct {
	Replicas int32 `json:"replicas" binding:"required,min=0"`
}

// SuspendRequest represents the request body for suspend/resume
type SuspendRequest struct {
	Suspend bool `json:"suspend"`
}

// ActionResponse represents the response for workload actions
type ActionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// RestartWorkload handles POST /api/v1/workloads/:kind/:namespace/:name/restart
// Triggers a rollout restart by patching the restartedAt annotation
func (h *WorkloadActionsHandler) RestartWorkload(c *gin.Context) {
	kind := c.Param("kind")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace and name are required",
		})
		return
	}

	ctx := context.Background()
	clientset := h.k8sService.GetClientset()

	// Patch data to trigger restart
	restartPatch := map[string]interface{}{
		"spec": map[string]interface{}{
			"template": map[string]interface{}{
				"metadata": map[string]interface{}{
					"annotations": map[string]string{
						"kubectl.kubernetes.io/restartedAt": time.Now().Format(time.RFC3339),
					},
				},
			},
		},
	}

	patchData, err := json.Marshal(restartPatch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PATCH_ERROR",
			Message: err.Error(),
		})
		return
	}

	switch kind {
	case "deployment", "deployments":
		_, err = clientset.AppsV1().Deployments(namespace).Patch(
			ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
		)
	case "statefulset", "statefulsets":
		_, err = clientset.AppsV1().StatefulSets(namespace).Patch(
			ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
		)
	case "daemonset", "daemonsets":
		_, err = clientset.AppsV1().DaemonSets(namespace).Patch(
			ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
		)
	default:
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_KIND",
			Message: fmt.Sprintf("Unsupported workload kind: %s", kind),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "RESTART_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ActionResponse{
		Success: true,
		Message: fmt.Sprintf("Rolling restart triggered for %s/%s", kind, name),
	})
}

// ScaleWorkload handles POST /api/v1/workloads/:kind/:namespace/:name/scale
// Scales a workload to the specified number of replicas
func (h *WorkloadActionsHandler) ScaleWorkload(c *gin.Context) {
	kind := c.Param("kind")
	namespace := c.Param("namespace")
	name := c.Param("name")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace and name are required",
		})
		return
	}

	var req ScaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	ctx := context.Background()
	clientset := h.k8sService.GetClientset()

	// Patch data for scaling
	scalePatch := map[string]interface{}{
		"spec": map[string]interface{}{
			"replicas": req.Replicas,
		},
	}

	patchData, err := json.Marshal(scalePatch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PATCH_ERROR",
			Message: err.Error(),
		})
		return
	}

	switch kind {
	case "deployment", "deployments":
		_, err = clientset.AppsV1().Deployments(namespace).Patch(
			ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
		)
	case "statefulset", "statefulsets":
		_, err = clientset.AppsV1().StatefulSets(namespace).Patch(
			ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
		)
	default:
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_KIND",
			Message: fmt.Sprintf("Scaling not supported for kind: %s", kind),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SCALE_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ActionResponse{
		Success: true,
		Message: fmt.Sprintf("Scaled %s/%s to %d replicas", kind, name, req.Replicas),
	})
}

// SuspendCronJob handles POST /api/v1/cronjobs/:namespace/:name/suspend
// Suspends or resumes a CronJob
func (h *WorkloadActionsHandler) SuspendCronJob(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace and name are required",
		})
		return
	}

	var req SuspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	ctx := context.Background()
	clientset := h.k8sService.GetClientset()

	// Patch data for suspend
	suspendPatch := map[string]interface{}{
		"spec": map[string]interface{}{
			"suspend": req.Suspend,
		},
	}

	patchData, err := json.Marshal(suspendPatch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PATCH_ERROR",
			Message: err.Error(),
		})
		return
	}

	_, err = clientset.BatchV1().CronJobs(namespace).Patch(
		ctx, name, types.StrategicMergePatchType, patchData, metav1.PatchOptions{},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SUSPEND_FAILED",
			Message: err.Error(),
		})
		return
	}

	action := "resumed"
	if req.Suspend {
		action = "suspended"
	}

	c.JSON(http.StatusOK, ActionResponse{
		Success: true,
		Message: fmt.Sprintf("CronJob %s %s", name, action),
	})
}
