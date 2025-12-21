package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
)

// ContextHandler handles context-related API requests
type ContextHandler struct {
	k8sService *k8s.Service
}

// NewContextHandler creates a new ContextHandler
func NewContextHandler(k8sService *k8s.Service) *ContextHandler {
	return &ContextHandler{
		k8sService: k8sService,
	}
}

// SwitchContextRequest represents the request body for switching context
type SwitchContextRequest struct {
	ContextName string `json:"contextName" binding:"required"`
}

// ContextListResponse represents the response for listing contexts
type ContextListResponse struct {
	Contexts       []k8s.ContextInfo `json:"contexts"`
	CurrentContext string            `json:"currentContext"`
	CurrentServer  string            `json:"currentServer"`
	Count          int               `json:"count"`
}

// ListContexts handles GET /api/v1/contexts
func (h *ContextHandler) ListContexts(c *gin.Context) {
	manager := h.k8sService.GetManager()
	
	contexts, err := manager.ListContexts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LIST_CONTEXTS_FAILED",
			Message: err.Error(),
		})
		return
	}
	
	currentContext, currentServer := manager.GetClusterInfo()
	
	c.JSON(http.StatusOK, ContextListResponse{
		Contexts:       contexts,
		CurrentContext: currentContext,
		CurrentServer:  currentServer,
		Count:          len(contexts),
	})
}

// SwitchContext handles POST /api/v1/contexts/switch
func (h *ContextHandler) SwitchContext(c *gin.Context) {
	var req SwitchContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}
	
	manager := h.k8sService.GetManager()
	
	if err := manager.SwitchContext(req.ContextName); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "SWITCH_FAILED",
			Message: err.Error(),
		})
		return
	}
	
	currentContext, currentServer := manager.GetClusterInfo()
	
	c.JSON(http.StatusOK, gin.H{
		"message":        "Successfully switched context",
		"currentContext": currentContext,
		"currentServer":  currentServer,
	})
}

// GetCurrentContext handles GET /api/v1/contexts/current
func (h *ContextHandler) GetCurrentContext(c *gin.Context) {
	manager := h.k8sService.GetManager()
	currentContext, currentServer := manager.GetClusterInfo()
	
	c.JSON(http.StatusOK, gin.H{
		"context": currentContext,
		"server":  currentServer,
	})
}
