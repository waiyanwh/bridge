package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
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
