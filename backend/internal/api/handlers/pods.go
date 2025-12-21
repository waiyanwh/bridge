package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
)

// PodHandler handles pod-related HTTP requests
type PodHandler struct {
	k8sService *k8s.Service
}

// NewPodHandler creates a new PodHandler
func NewPodHandler(k8sService *k8s.Service) *PodHandler {
	return &PodHandler{
		k8sService: k8sService,
	}
}

// ListPodsResponse represents the JSON response for listing pods
type ListPodsResponse struct {
	Pods      []k8s.PodInfo `json:"pods"`
	Namespace string        `json:"namespace"`
	Count     int           `json:"count"`
}

// ErrorResponse represents a JSON error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// ListPods handles GET /api/v1/pods
// Query parameters:
//   - namespace: the namespace to list pods from (empty or "all" for all namespaces)
func (h *PodHandler) ListPods(c *gin.Context) {
	// Get namespace from query parameter
	namespace := c.Query("namespace")

	var pods []k8s.PodInfo
	var err error
	var responseNamespace string

	// Handle all namespaces case
	if namespace == "" || namespace == "all" {
		pods, err = h.k8sService.ListPods(c.Request.Context(), "")
		responseNamespace = "all"
	} else {
		pods, err = h.k8sService.ListPods(c.Request.Context(), namespace)
		responseNamespace = namespace
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Return structured response
	c.JSON(http.StatusOK, ListPodsResponse{
		Pods:      pods,
		Namespace: responseNamespace,
		Count:     len(pods),
	})
}

// GetPod handles GET /api/v1/pods/:namespace/:name
func (h *PodHandler) GetPod(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get pod details
	podDetail, err := h.k8sService.GetPodDetail(c.Request.Context(), namespace, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, podDetail)
}

