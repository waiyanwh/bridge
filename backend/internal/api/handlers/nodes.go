package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
)

// NodeHandler handles node-related HTTP requests
type NodeHandler struct {
	k8sService *k8s.Service
}

// NewNodeHandler creates a new NodeHandler
func NewNodeHandler(k8sService *k8s.Service) *NodeHandler {
	return &NodeHandler{
		k8sService: k8sService,
	}
}

// ListNodesResponse represents the JSON response for listing nodes
type ListNodesResponse struct {
	Nodes []k8s.NodeInfo `json:"nodes"`
	Count int            `json:"count"`
}

// ListNodes handles GET /api/v1/nodes
func (h *NodeHandler) ListNodes(c *gin.Context) {
	nodes, err := h.k8sService.ListNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ListNodesResponse{
		Nodes: nodes,
		Count: len(nodes),
	})
}
