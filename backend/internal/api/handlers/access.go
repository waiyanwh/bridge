package handlers

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	authv1 "k8s.io/api/authentication/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

// Bridge label constants
const (
	LabelManagedBy     = "app.kubernetes.io/managed-by"
	LabelAccessUser    = "bridge.io/access-user"
	LabelCreatedAt     = "bridge.io/created-at"
	AnnotationExpiresAt = "bridge.io/expires-at"
	ManagedByBridge    = "bridge"
)

// AccessHandler handles RBAC and access-related HTTP requests
type AccessHandler struct {
	k8sService *k8s.Service
}

// NewAccessHandler creates a new AccessHandler
func NewAccessHandler(k8sService *k8s.Service) *AccessHandler {
	return &AccessHandler{
		k8sService: k8sService,
	}
}

// Permissions defines the RBAC permissions for the generated kubeconfig
type Permissions struct {
	Resources []string `json:"resources"` // e.g., ["deployments", "pods", "secrets"]
	Verbs     []string `json:"verbs"`     // e.g., ["get", "list", "create", "update"]
}

// CreateBridgeAccessRequest represents a request to create bridge access
type CreateBridgeAccessRequest struct {
	UserLabel   string      `json:"userLabel"`   // e.g., "frontend-dev"
	Namespace   string      `json:"namespace"`   // Target namespace
	Permissions Permissions `json:"permissions"` // RBAC permissions
	Duration    string      `json:"duration"`    // e.g., "1h", "8h", "24h", "7d", or "0" for permanent
}

// CreateBridgeAccessResponse represents the response with the generated kubeconfig
type CreateBridgeAccessResponse struct {
	Kubeconfig     string `json:"kubeconfig"`
	ServiceAccount string `json:"serviceAccount"`
	Role           string `json:"role"`
	RoleBinding    string `json:"roleBinding"`
	ExpiresAt      string `json:"expiresAt,omitempty"` // Empty for permanent access
	Message        string `json:"message"`
}

// BridgeAccessUser represents a bridge-managed access user
type BridgeAccessUser struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	Username       string `json:"username"`
	CreatedAt      string `json:"createdAt"`
	ExpiresAt      string `json:"expiresAt,omitempty"` // Empty for permanent access
	ServiceAccount string `json:"serviceAccount"`
	Role           string `json:"role"`
	RoleBinding    string `json:"roleBinding"`
}

// ListBridgeAccessResponse represents the list of bridge access users
type ListBridgeAccessResponse struct {
	Users []BridgeAccessUser `json:"users"`
	Count int                `json:"count"`
}

// sanitizeName converts a string to a valid Kubernetes resource name
func sanitizeName(name string) string {
	// Convert to lowercase
	name = strings.ToLower(name)
	// Replace spaces and underscores with hyphens
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")
	// Remove any characters that aren't alphanumeric or hyphens
	reg := regexp.MustCompile("[^a-z0-9-]")
	name = reg.ReplaceAllString(name, "")
	// Remove leading/trailing hyphens
	name = strings.Trim(name, "-")
	// Limit length to 63 characters (K8s limit)
	if len(name) > 63 {
		name = name[:63]
	}
	return name
}

// getBridgeLabels returns the standard Bridge labels
func getBridgeLabels(username string) map[string]string {
	// Format timestamp without colons as they're invalid in labels
	// Use format: 2006-01-02T15-04-05Z (RFC3339 with dashes instead of colons)
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05Z")
	return map[string]string{
		LabelManagedBy:  ManagedByBridge,
		LabelAccessUser: sanitizeName(username), // Sanitize username for label safety
		LabelCreatedAt:  timestamp,
	}
}

// parseDuration converts a duration string (e.g., "1h", "8h", "24h", "7d") to time.Duration
// Returns 0 for "0" or empty string (permanent access)
func parseDuration(durationStr string) (time.Duration, error) {
	if durationStr == "" || durationStr == "0" {
		return 0, nil // Permanent access
	}
	
	// Handle days (not natively supported by time.ParseDuration)
	if strings.HasSuffix(durationStr, "d") {
		daysStr := strings.TrimSuffix(durationStr, "d")
		days, err := time.ParseDuration(daysStr + "h")
		if err != nil {
			return 0, fmt.Errorf("invalid duration: %s", durationStr)
		}
		// Convert hours to days (multiply by 24 since we parsed as hours)
		return days * 24, nil
	}
	
	return time.ParseDuration(durationStr)
}

// CreateAccess handles POST /api/v1/bridge/access
func (h *AccessHandler) CreateAccess(c *gin.Context) {
	var req CreateBridgeAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// Validate request
	if req.UserLabel == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "userLabel is required",
		})
		return
	}
	if req.Namespace == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace is required",
		})
		return
	}
	if len(req.Permissions.Resources) == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "at least one resource is required",
		})
		return
	}
	if len(req.Permissions.Verbs) == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "at least one verb is required",
		})
		return
	}

	// Parse duration
	duration, err := parseDuration(req.Duration)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_DURATION",
			Message: fmt.Sprintf("Invalid duration: %v", err),
		})
		return
	}
	isPermanent := duration == 0

	ctx := c.Request.Context()
	clientset := h.k8sService.GetClientset()
	
	// Sanitize the user label for use in resource names
	baseName := sanitizeName(req.UserLabel)
	saName := baseName + "-sa"
	roleName := baseName + "-role"
	bindingName := baseName + "-binding"
	secretName := baseName + "-token"

	// Get Bridge labels
	labels := getBridgeLabels(req.UserLabel)

	// Calculate expiration time (for annotations)
	var expiresAtStr string
	var annotations map[string]string
	if !isPermanent {
		expiresAt := time.Now().Add(duration)
		expiresAtStr = expiresAt.Format(time.RFC3339)
		annotations = map[string]string{
			AnnotationExpiresAt: expiresAtStr,
		}
	}

	// Step A: Create ServiceAccount
	sa := &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:        saName,
			Namespace:   req.Namespace,
			Labels:      labels,
			Annotations: annotations,
		},
	}
	
	_, err = clientset.CoreV1().ServiceAccounts(req.Namespace).Create(ctx, sa, metav1.CreateOptions{})
	if err != nil {
		// Check if already exists
		if !strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "CREATE_SA_FAILED",
				Message: fmt.Sprintf("Failed to create ServiceAccount: %v", err),
			})
			return
		}
	}

	// Step B: Create Role
	role := &rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{
			Name:        roleName,
			Namespace:   req.Namespace,
			Labels:      labels,
			Annotations: annotations,
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{"", "apps", "batch", "extensions"},
				Resources: req.Permissions.Resources,
				Verbs:     req.Permissions.Verbs,
			},
		},
	}

	_, err = clientset.RbacV1().Roles(req.Namespace).Create(ctx, role, metav1.CreateOptions{})
	if err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "CREATE_ROLE_FAILED",
				Message: fmt.Sprintf("Failed to create Role: %v", err),
			})
			return
		}
	}

	// Step C: Create RoleBinding
	roleBinding := &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:        bindingName,
			Namespace:   req.Namespace,
			Labels:      labels,
			Annotations: annotations,
		},
		Subjects: []rbacv1.Subject{
			{
				Kind:      "ServiceAccount",
				Name:      saName,
				Namespace: req.Namespace,
			},
		},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Kind:     "Role",
			Name:     roleName,
		},
	}

	_, err = clientset.RbacV1().RoleBindings(req.Namespace).Create(ctx, roleBinding, metav1.CreateOptions{})
	if err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "CREATE_ROLEBINDING_FAILED",
				Message: fmt.Sprintf("Failed to create RoleBinding: %v", err),
			})
			return
		}
	}

	var token, caCert string

	if isPermanent {
		// Step D (Permanent): Create token Secret for the ServiceAccount
		tokenSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: req.Namespace,
				Annotations: map[string]string{
					"kubernetes.io/service-account.name": saName,
				},
				Labels: labels,
			},
			Type: corev1.SecretTypeServiceAccountToken,
		}

		_, err = clientset.CoreV1().Secrets(req.Namespace).Create(ctx, tokenSecret, metav1.CreateOptions{})
		if err != nil {
			if !strings.Contains(err.Error(), "already exists") {
				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Error:   "CREATE_SECRET_FAILED",
					Message: fmt.Sprintf("Failed to create token Secret: %v", err),
				})
				return
			}
		}

		// Wait for the token to be populated
		for i := 0; i < 10; i++ {
			time.Sleep(500 * time.Millisecond)
			secret, err := clientset.CoreV1().Secrets(req.Namespace).Get(ctx, secretName, metav1.GetOptions{})
			if err != nil {
				continue
			}
			if t, ok := secret.Data["token"]; ok && len(t) > 0 {
				token = string(t)
			}
			if ca, ok := secret.Data["ca.crt"]; ok && len(ca) > 0 {
				caCert = string(ca)
			}
			if token != "" && caCert != "" {
				break
			}
		}

		if token == "" {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "TOKEN_NOT_READY",
				Message: "Token was not generated in time. The ServiceAccount may not be configured correctly.",
			})
			return
		}
	} else {
		// Step D (Temporary): Use TokenRequest API for ephemeral token
		expirationSeconds := int64(duration.Seconds())
		
		tokenRequest := &authv1.TokenRequest{
			Spec: authv1.TokenRequestSpec{
				ExpirationSeconds: &expirationSeconds,
			},
		}

		tokenResponse, err := clientset.CoreV1().ServiceAccounts(req.Namespace).CreateToken(
			ctx, saName, tokenRequest, metav1.CreateOptions{},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "TOKEN_REQUEST_FAILED",
				Message: fmt.Sprintf("Failed to create ephemeral token: %v", err),
			})
			return
		}
		token = tokenResponse.Status.Token

		// Get CA cert from cluster config
		caCert = string(h.k8sService.GetConfig().CAData)
		if caCert == "" {
			// Try to read from a secret in kube-system
			secret, err := clientset.CoreV1().Secrets("kube-system").Get(ctx, "default-token", metav1.GetOptions{})
			if err == nil {
				if ca, ok := secret.Data["ca.crt"]; ok {
					caCert = string(ca)
				}
			}
		}
	}

	// Step E: Construct Kubeconfig
	kubeconfig, err := h.constructKubeconfig(ctx, req.UserLabel, req.Namespace, token, caCert)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBECONFIG_FAILED",
			Message: fmt.Sprintf("Failed to construct kubeconfig: %v", err),
		})
		return
	}

	message := fmt.Sprintf("Successfully created Bridge access for '%s' in namespace '%s'", req.UserLabel, req.Namespace)
	if !isPermanent {
		message += fmt.Sprintf(" (expires in %s)", req.Duration)
	}

	c.JSON(http.StatusOK, CreateBridgeAccessResponse{
		Kubeconfig:     kubeconfig,
		ServiceAccount: saName,
		Role:           roleName,
		RoleBinding:    bindingName,
		ExpiresAt:      expiresAtStr,
		Message:        message,
	})
}

// ListAccess handles GET /api/v1/bridge/access
func (h *AccessHandler) ListAccess(c *gin.Context) {
	ctx := c.Request.Context()
	clientset := h.k8sService.GetClientset()

	// List all ServiceAccounts with Bridge label across all namespaces
	labelSelector := fmt.Sprintf("%s=%s", LabelManagedBy, ManagedByBridge)
	
	saList, err := clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LIST_FAILED",
			Message: fmt.Sprintf("Failed to list Bridge access users: %v", err),
		})
		return
	}

	users := make([]BridgeAccessUser, 0, len(saList.Items))
	for _, sa := range saList.Items {
		// Extract info from labels
		username := sa.Labels[LabelAccessUser]
		createdAt := sa.Labels[LabelCreatedAt]
		if createdAt == "" {
			createdAt = sa.CreationTimestamp.Format(time.RFC3339)
		}

		// Extract expiration from annotations
		expiresAt := ""
		if sa.Annotations != nil {
			expiresAt = sa.Annotations[AnnotationExpiresAt]
		}

		// Derive resource names from SA name
		baseName := strings.TrimSuffix(sa.Name, "-sa")

		users = append(users, BridgeAccessUser{
			Name:           baseName,
			Namespace:      sa.Namespace,
			Username:       username,
			CreatedAt:      createdAt,
			ExpiresAt:      expiresAt,
			ServiceAccount: sa.Name,
			Role:           baseName + "-role",
			RoleBinding:    baseName + "-binding",
		})
	}

	c.JSON(http.StatusOK, ListBridgeAccessResponse{
		Users: users,
		Count: len(users),
	})
}

// RevokeAccess handles DELETE /api/v1/bridge/access/:namespace/:name
func (h *AccessHandler) RevokeAccess(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace and name are required",
		})
		return
	}

	ctx := c.Request.Context()
	clientset := h.k8sService.GetClientset()

	// Derive resource names
	saName := name + "-sa"
	roleName := name + "-role"
	bindingName := name + "-binding"
	secretName := name + "-token"

	// Verify the SA has Bridge label before deleting
	sa, err := clientset.CoreV1().ServiceAccounts(namespace).Get(ctx, saName, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: fmt.Sprintf("Bridge access user '%s' not found in namespace '%s'", name, namespace),
		})
		return
	}

	if sa.Labels[LabelManagedBy] != ManagedByBridge {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error:   "NOT_BRIDGE_MANAGED",
			Message: "This ServiceAccount is not managed by Bridge and cannot be revoked",
		})
		return
	}

	// Delete all resources (ignore errors for individual deletions)
	var deleteErrors []string

	// Delete Secret
	if err := clientset.CoreV1().Secrets(namespace).Delete(ctx, secretName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			deleteErrors = append(deleteErrors, fmt.Sprintf("Secret: %v", err))
		}
	}

	// Delete RoleBinding
	if err := clientset.RbacV1().RoleBindings(namespace).Delete(ctx, bindingName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			deleteErrors = append(deleteErrors, fmt.Sprintf("RoleBinding: %v", err))
		}
	}

	// Delete Role
	if err := clientset.RbacV1().Roles(namespace).Delete(ctx, roleName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			deleteErrors = append(deleteErrors, fmt.Sprintf("Role: %v", err))
		}
	}

	// Delete ServiceAccount
	if err := clientset.CoreV1().ServiceAccounts(namespace).Delete(ctx, saName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			deleteErrors = append(deleteErrors, fmt.Sprintf("ServiceAccount: %v", err))
		}
	}

	if len(deleteErrors) > 0 {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PARTIAL_DELETE",
			Message: fmt.Sprintf("Some resources could not be deleted: %s", strings.Join(deleteErrors, "; ")),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Successfully revoked Bridge access for '%s' in namespace '%s'", name, namespace),
	})
}

// constructKubeconfig builds a kubeconfig YAML string
func (h *AccessHandler) constructKubeconfig(ctx context.Context, userLabel, namespace, token, caCert string) (string, error) {
	// Get the cluster server URL from the current config
	serverURL := h.k8sService.GetConfig().Host

	// Base64 encode the CA certificate (kubeconfig expects base64 encoded data)
	caCertBase64 := base64.StdEncoding.EncodeToString([]byte(caCert))

	// Build kubeconfig structure
	kubeconfig := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Config",
		"clusters": []map[string]interface{}{
			{
				"name": "cluster",
				"cluster": map[string]interface{}{
					"server":                     serverURL,
					"certificate-authority-data": caCertBase64,
				},
			},
		},
		"users": []map[string]interface{}{
			{
				"name": userLabel,
				"user": map[string]interface{}{
					"token": token,
				},
			},
		},
		"contexts": []map[string]interface{}{
			{
				"name": fmt.Sprintf("%s@cluster", userLabel),
				"context": map[string]interface{}{
					"cluster":   "cluster",
					"user":      userLabel,
					"namespace": namespace,
				},
			},
		},
		"current-context": fmt.Sprintf("%s@cluster", userLabel),
	}

	// Convert to YAML
	yamlBytes, err := yaml.Marshal(kubeconfig)
	if err != nil {
		return "", err
	}

	return string(yamlBytes), nil
}

// Legacy endpoint - keeping for backward compatibility
// GenerateKubeconfig handles POST /api/v1/access/generate
func (h *AccessHandler) GenerateKubeconfig(c *gin.Context) {
	h.CreateAccess(c)
}

// GetKubeconfigResponse represents the response for GetKubeconfig
type GetKubeconfigResponse struct {
	Kubeconfig string `json:"kubeconfig"`
	ExpiresAt  string `json:"expiresAt,omitempty"`
	Username   string `json:"username"`
	Namespace  string `json:"namespace"`
}

// GetKubeconfig handles GET /api/v1/bridge/access/:namespace/:name/kubeconfig
// Regenerates the kubeconfig for an existing service account
func (h *AccessHandler) GetKubeconfig(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "namespace and name are required",
		})
		return
	}

	ctx := c.Request.Context()
	clientset := h.k8sService.GetClientset()

	// Derive resource names
	saName := name + "-sa"
	secretName := name + "-token"

	// Verify the SA exists and has Bridge label
	sa, err := clientset.CoreV1().ServiceAccounts(namespace).Get(ctx, saName, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: fmt.Sprintf("Bridge access user '%s' not found in namespace '%s'", name, namespace),
		})
		return
	}

	if sa.Labels[LabelManagedBy] != ManagedByBridge {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Error:   "NOT_BRIDGE_MANAGED",
			Message: "This ServiceAccount is not managed by Bridge",
		})
		return
	}

	// Get username and expiration info
	username := sa.Labels[LabelAccessUser]
	expiresAt := ""
	if sa.Annotations != nil {
		expiresAt = sa.Annotations[AnnotationExpiresAt]
	}

	// Check if expired
	if expiresAt != "" {
		expiryTime, err := time.Parse(time.RFC3339, expiresAt)
		if err == nil && time.Now().After(expiryTime) {
			c.JSON(http.StatusGone, ErrorResponse{
				Error:   "TOKEN_EXPIRED",
				Message: "This access token has expired and is no longer valid",
			})
			return
		}
	}

	var token string
	var caCert string

	// Try to get the token from the Secret (for permanent access)
	secret, err := clientset.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err == nil {
		// Secret exists - use the stored token
		if t, ok := secret.Data["token"]; ok && len(t) > 0 {
			token = string(t)
		}
		if ca, ok := secret.Data["ca.crt"]; ok && len(ca) > 0 {
			caCert = string(ca)
		}
	}

	// If no secret token found, generate a new ephemeral token
	if token == "" {
		// For temporary access, generate a new ephemeral token
		// Use remaining time or default to 1 hour
		var expirationSeconds int64 = 3600 // Default 1 hour

		if expiresAt != "" {
			expiryTime, err := time.Parse(time.RFC3339, expiresAt)
			if err == nil {
				remaining := time.Until(expiryTime).Seconds()
				if remaining > 0 {
					expirationSeconds = int64(remaining)
				}
			}
		}

		tokenRequest := &authv1.TokenRequest{
			Spec: authv1.TokenRequestSpec{
				ExpirationSeconds: &expirationSeconds,
			},
		}

		tokenResponse, err := clientset.CoreV1().ServiceAccounts(namespace).CreateToken(
			ctx, saName, tokenRequest, metav1.CreateOptions{},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "TOKEN_REQUEST_FAILED",
				Message: fmt.Sprintf("Failed to generate ephemeral token: %v", err),
			})
			return
		}
		token = tokenResponse.Status.Token
	}

	// Get CA cert if not already retrieved
	if caCert == "" {
		caCert = string(h.k8sService.GetConfig().CAData)
	}

	// Construct the kubeconfig
	kubeconfig, err := h.constructKubeconfig(ctx, username, namespace, token, caCert)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBECONFIG_FAILED",
			Message: fmt.Sprintf("Failed to construct kubeconfig: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, GetKubeconfigResponse{
		Kubeconfig: kubeconfig,
		ExpiresAt:  expiresAt,
		Username:   username,
		Namespace:  namespace,
	})
}
