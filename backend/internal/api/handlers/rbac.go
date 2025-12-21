package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RBACHandler handles RBAC-related HTTP requests
type RBACHandler struct {
	k8sService *k8s.Service
}

// NewRBACHandler creates a new RBACHandler
func NewRBACHandler(k8sService *k8s.Service) *RBACHandler {
	return &RBACHandler{
		k8sService: k8sService,
	}
}

// ServiceAccountInfo represents a ServiceAccount
type ServiceAccountInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	SecretsCount int    `json:"secretsCount"`
	Age          string `json:"age"`
}

// PolicyRule represents a parsed policy rule
type PolicyRule struct {
	Verbs     []string `json:"verbs"`
	Resources []string `json:"resources"`
	APIGroups []string `json:"apiGroups"`
}

// RoleInfo represents a Role
type RoleInfo struct {
	Name      string       `json:"name"`
	Namespace string       `json:"namespace"`
	Rules     []PolicyRule `json:"rules"`
	Age       string       `json:"age"`
}

// ClusterRoleInfo represents a ClusterRole
type ClusterRoleInfo struct {
	Name  string       `json:"name"`
	Rules []PolicyRule `json:"rules"`
	Age   string       `json:"age"`
}

// ListServiceAccountsResponse response for listing service accounts
type ListServiceAccountsResponse struct {
	ServiceAccounts []ServiceAccountInfo `json:"serviceAccounts"`
	Namespace       string               `json:"namespace"`
	Count           int                  `json:"count"`
}

// ListRolesResponse response for listing roles
type ListRolesResponse struct {
	Roles     []RoleInfo `json:"roles"`
	Namespace string     `json:"namespace"`
	Count     int        `json:"count"`
}

// ListClusterRolesResponse response for listing cluster roles
type ListClusterRolesResponse struct {
	ClusterRoles []ClusterRoleInfo `json:"clusterRoles"`
	Count        int               `json:"count"`
}

// ListServiceAccounts handles GET /api/v1/serviceaccounts
func (h *RBACHandler) ListServiceAccounts(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	saList, err := h.k8sService.GetClientset().CoreV1().ServiceAccounts(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]ServiceAccountInfo, 0, len(saList.Items))
	for _, sa := range saList.Items {
		result = append(result, ServiceAccountInfo{
			Name:         sa.Name,
			Namespace:    sa.Namespace,
			SecretsCount: len(sa.Secrets),
			Age:          formatAge(sa.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListServiceAccountsResponse{
		ServiceAccounts: result,
		Namespace:       displayNs,
		Count:           len(result),
	})
}

// ListRoles handles GET /api/v1/roles
func (h *RBACHandler) ListRoles(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	roleList, err := h.k8sService.GetClientset().RbacV1().Roles(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]RoleInfo, 0, len(roleList.Items))
	for _, role := range roleList.Items {
		rules := make([]PolicyRule, 0, len(role.Rules))
		for _, r := range role.Rules {
			rules = append(rules, PolicyRule{
				Verbs:     r.Verbs,
				Resources: r.Resources,
				APIGroups: r.APIGroups,
			})
		}

		result = append(result, RoleInfo{
			Name:      role.Name,
			Namespace: role.Namespace,
			Rules:     rules,
			Age:       formatAge(role.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListRolesResponse{
		Roles:     result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// ListClusterRoles handles GET /api/v1/clusterroles
func (h *RBACHandler) ListClusterRoles(c *gin.Context) {
	crList, err := h.k8sService.GetClientset().RbacV1().ClusterRoles().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]ClusterRoleInfo, 0, len(crList.Items))
	for _, cr := range crList.Items {
		rules := make([]PolicyRule, 0, len(cr.Rules))
		for _, r := range cr.Rules {
			rules = append(rules, PolicyRule{
				Verbs:     r.Verbs,
				Resources: r.Resources,
				APIGroups: r.APIGroups,
			})
		}

		result = append(result, ClusterRoleInfo{
			Name:  cr.Name,
			Rules: rules,
			Age:   formatAge(cr.CreationTimestamp.Time),
		})
	}

	c.JSON(http.StatusOK, ListClusterRolesResponse{
		ClusterRoles: result,
		Count:        len(result),
	})
}

// RoleBindingInfo represents a RoleBinding
type RoleBindingInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	RoleRef   string   `json:"roleRef"`
	RoleKind  string   `json:"roleKind"`
	Subjects  []string `json:"subjects"`
	Age       string   `json:"age"`
}

// ClusterRoleBindingInfo represents a ClusterRoleBinding
type ClusterRoleBindingInfo struct {
	Name     string   `json:"name"`
	RoleRef  string   `json:"roleRef"`
	RoleKind string   `json:"roleKind"`
	Subjects []string `json:"subjects"`
	Age      string   `json:"age"`
}

// ListRoleBindingsResponse response for listing role bindings
type ListRoleBindingsResponse struct {
	RoleBindings []RoleBindingInfo `json:"roleBindings"`
	Namespace    string            `json:"namespace"`
	Count        int               `json:"count"`
}

// ListClusterRoleBindingsResponse response for listing cluster role bindings
type ListClusterRoleBindingsResponse struct {
	ClusterRoleBindings []ClusterRoleBindingInfo `json:"clusterRoleBindings"`
	Count               int                      `json:"count"`
}

// ListRoleBindings handles GET /api/v1/rolebindings
func (h *RBACHandler) ListRoleBindings(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	rbList, err := h.k8sService.GetClientset().RbacV1().RoleBindings(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]RoleBindingInfo, 0, len(rbList.Items))
	for _, rb := range rbList.Items {
		subjects := make([]string, 0, len(rb.Subjects))
		for _, s := range rb.Subjects {
			subjects = append(subjects, s.Kind+":"+s.Name)
		}

		result = append(result, RoleBindingInfo{
			Name:      rb.Name,
			Namespace: rb.Namespace,
			RoleRef:   rb.RoleRef.Name,
			RoleKind:  rb.RoleRef.Kind,
			Subjects:  subjects,
			Age:       formatAge(rb.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListRoleBindingsResponse{
		RoleBindings: result,
		Namespace:    displayNs,
		Count:        len(result),
	})
}

// ListClusterRoleBindings handles GET /api/v1/clusterrolebindings
func (h *RBACHandler) ListClusterRoleBindings(c *gin.Context) {
	crbList, err := h.k8sService.GetClientset().RbacV1().ClusterRoleBindings().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]ClusterRoleBindingInfo, 0, len(crbList.Items))
	for _, crb := range crbList.Items {
		subjects := make([]string, 0, len(crb.Subjects))
		for _, s := range crb.Subjects {
			subjects = append(subjects, s.Kind+":"+s.Name)
		}

		result = append(result, ClusterRoleBindingInfo{
			Name:     crb.Name,
			RoleRef:  crb.RoleRef.Name,
			RoleKind: crb.RoleRef.Kind,
			Subjects: subjects,
			Age:      formatAge(crb.CreationTimestamp.Time),
		})
	}

	c.JSON(http.StatusOK, ListClusterRoleBindingsResponse{
		ClusterRoleBindings: result,
		Count:               len(result),
	})
}

// FormatRules returns a human-readable string of rules
func FormatRules(rules []PolicyRule) string {
	if len(rules) == 0 {
		return "No rules"
	}

	parts := make([]string, 0, len(rules))
	for _, r := range rules {
		verbs := strings.Join(r.Verbs, ", ")
		resources := strings.Join(r.Resources, ", ")
		parts = append(parts, "can "+verbs+" on "+resources)
	}

	return strings.Join(parts, "; ")
}

