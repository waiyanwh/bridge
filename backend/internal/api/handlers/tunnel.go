package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/tunnel"
)

// TunnelHandler handles tunnel-related HTTP requests
type TunnelHandler struct {
	manager *tunnel.Manager
}

// NewTunnelHandler creates a new TunnelHandler
func NewTunnelHandler(manager *tunnel.Manager) *TunnelHandler {
	return &TunnelHandler{
		manager: manager,
	}
}

// CreateTunnelRequest represents request body for creating a tunnel
type CreateTunnelRequest struct {
	Namespace    string `json:"namespace" binding:"required"`
	ResourceType string `json:"resourceType" binding:"required"` // "pod" or "service"
	ResourceName string `json:"resourceName" binding:"required"`
	TargetPort   int    `json:"targetPort" binding:"required"`
	LocalPort    int    `json:"localPort,omitempty"`
}

// ListTunnelsResponse response for listing tunnels
type ListTunnelsResponse struct {
	Tunnels []tunnel.TunnelInfo `json:"tunnels"`
	Count   int                 `json:"count"`
}

// CreateTunnel handles POST /api/v1/tunnels
func (h *TunnelHandler) CreateTunnel(c *gin.Context) {
	var req CreateTunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	tunnelReq := tunnel.CreateTunnelRequest{
		Namespace:    req.Namespace,
		ResourceType: req.ResourceType,
		ResourceName: req.ResourceName,
		TargetPort:   req.TargetPort,
		LocalPort:    req.LocalPort,
	}

	tunnelInfo, err := h.manager.Create(tunnelReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "TUNNEL_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, tunnelInfo)
}

// ListTunnels handles GET /api/v1/tunnels
func (h *TunnelHandler) ListTunnels(c *gin.Context) {
	tunnels := h.manager.List()
	c.JSON(http.StatusOK, ListTunnelsResponse{
		Tunnels: tunnels,
		Count:   len(tunnels),
	})
}

// GetTunnel handles GET /api/v1/tunnels/:id
func (h *TunnelHandler) GetTunnel(c *gin.Context) {
	id := c.Param("id")

	tunnelInfo, err := h.manager.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, tunnelInfo)
}

// DeleteTunnel handles DELETE /api/v1/tunnels/:id
func (h *TunnelHandler) DeleteTunnel(c *gin.Context) {
	id := c.Param("id")

	err := h.manager.Delete(id)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tunnel stopped", "id": id})
}
