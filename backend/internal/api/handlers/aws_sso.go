package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/aws"
	"github.com/waiyan/bridge/internal/aws/eks"
	"github.com/waiyan/bridge/internal/k8s"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// AWSSSOHandler handles AWS SSO operations using the isolated (Leapp-style) approach
type AWSSSOHandler struct {
	k8sService *k8s.Service
	ssoClient  *aws.SSOClient
}

// NewAWSSSOHandler creates a new AWSSSOHandler
func NewAWSSSOHandler(k8sService *k8s.Service) *AWSSSOHandler {
	return &AWSSSOHandler{
		k8sService: k8sService,
		ssoClient:  aws.NewSSOClient(),
	}
}

// ================== Request/Response Types ==================

// StartDeviceAuthRequest is the request for starting device authorization
type StartDeviceAuthRequest struct {
	StartUrl string `json:"startUrl" binding:"required"`
	Region   string `json:"region" binding:"required"`
}

// DeviceAuthResponse is returned after starting device authorization
type DeviceAuthResponse struct {
	UserCode                string `json:"userCode"`
	VerificationUri         string `json:"verificationUri"`
	VerificationUriComplete string `json:"verificationUriComplete"`
	ExpiresIn               int32  `json:"expiresIn"`
	Interval                int32  `json:"interval"`
	DeviceCode              string `json:"deviceCode"`
	ClientId                string `json:"clientId"`
	ClientSecret            string `json:"clientSecret"`
}

// CompleteAuthRequest is the request for completing device authorization
type CompleteAuthRequest struct {
	StartUrl     string `json:"startUrl" binding:"required"`
	Region       string `json:"region" binding:"required"`
	DeviceCode   string `json:"deviceCode" binding:"required"`
	ClientId     string `json:"clientId" binding:"required"`
	ClientSecret string `json:"clientSecret" binding:"required"`
}

// TokenResponse is returned after successful authorization
type TokenResponse struct {
	Success     bool      `json:"success"`
	Message     string    `json:"message"`
	ExpiresAt   time.Time `json:"expiresAt"`
	AccessToken string    `json:"accessToken,omitempty"` // Only for internal use
}

// AddSessionRequest is the request for adding a new SSO session
type AddSessionRequest struct {
	SessionName string `json:"sessionName" binding:"required"`
	StartUrl    string `json:"startUrl" binding:"required"`
	Region      string `json:"region" binding:"required"`
}

// SessionResponse represents an SSO session
type SessionResponse struct {
	Name        string                 `json:"name"`
	StartUrl    string                 `json:"startUrl"`
	Region      string                 `json:"region"`
	IsLoggedIn  bool                   `json:"isLoggedIn"`
	TokenExpiry *time.Time             `json:"tokenExpiry,omitempty"`
	LastSynced  *time.Time             `json:"lastSynced,omitempty"`
	Accounts    []AccountWithRolesResp `json:"accounts,omitempty"`
}

// AccountWithRolesResp represents an account with its roles
type AccountWithRolesResp struct {
	AccountId   string   `json:"accountId"`
	AccountName string   `json:"accountName"`
	Email       string   `json:"email,omitempty"`
	Roles       []string `json:"roles"`
}

// SessionsListResponse is the response for listing sessions
type SessionsListResponse struct {
	Sessions []SessionResponse `json:"sessions"`
	Count    int               `json:"count"`
}

// MapContextRequest is the request for mapping a context to an AWS role
type MapContextRequest struct {
	ContextName string `json:"contextName" binding:"required"`
	SessionName string `json:"sessionName" binding:"required"`
	AccountId   string `json:"accountId" binding:"required"`
	RoleName    string `json:"roleName" binding:"required"`
}

// ContextMappingResponse represents a context mapping
type ContextMappingResponse struct {
	ContextName string    `json:"contextName"`
	ClusterName string    `json:"clusterName"`
	SessionName string    `json:"sessionName"`
	AccountId   string    `json:"accountId"`
	AccountName string    `json:"accountName,omitempty"`
	RoleName    string    `json:"roleName"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ContextMappingsResponse is the response for listing context mappings
type ContextMappingsResponse struct {
	Mappings []ContextMappingResponse `json:"mappings"`
	Count    int                      `json:"count"`
}

// ================== Handlers ==================

// StartDeviceAuth handles POST /api/v1/aws/sso/device/start
// Initiates the device authorization flow
func (h *AWSSSOHandler) StartDeviceAuth(c *gin.Context) {
	var req StartDeviceAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	result, err := h.ssoClient.StartDeviceAuthorization(ctx, req.StartUrl, req.Region)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "DEVICE_AUTH_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, DeviceAuthResponse{
		UserCode:                result.UserCode,
		VerificationUri:         result.VerificationUri,
		VerificationUriComplete: result.VerificationUriComplete,
		ExpiresIn:               result.ExpiresIn,
		Interval:                result.Interval,
		DeviceCode:              result.DeviceCode,
		ClientId:                result.ClientId,
		ClientSecret:            result.ClientSecret,
	})
}

// CompleteDeviceAuth handles POST /api/v1/aws/sso/device/complete
// Completes the device authorization by polling for the token
func (h *AWSSSOHandler) CompleteDeviceAuth(c *gin.Context) {
	var req CompleteAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// Use a longer timeout for polling
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Minute)
	defer cancel()

	result, err := h.ssoClient.PollForToken(
		ctx,
		req.DeviceCode,
		req.ClientId,
		req.ClientSecret,
		req.Region,
		req.StartUrl,
		5,   // interval
		300, // expiresIn (5 minutes)
	)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "TOKEN_CREATION_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, TokenResponse{
		Success:   true,
		Message:   "Successfully authenticated",
		ExpiresAt: result.ExpiresAt,
	})
}

// CheckAuthStatus handles GET /api/v1/aws/sso/device/status
// Checks if device authorization is complete (non-blocking)
func (h *AWSSSOHandler) CheckAuthStatus(c *gin.Context) {
	startUrl := c.Query("startUrl")
	if startUrl == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "startUrl is required",
		})
		return
	}

	status, err := h.ssoClient.GetSessionStatus(startUrl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "STATUS_CHECK_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"isLoggedIn":  status.IsLoggedIn,
		"tokenExpiry": status.TokenExpiry,
	})
}

// AddSession handles POST /api/v1/aws/sso/sessions
// Adds a new SSO session and syncs its accounts
func (h *AWSSSOHandler) AddSession(c *gin.Context) {
	var req AddSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	session, err := h.ssoClient.SyncSession(ctx, req.SessionName, req.StartUrl, req.Region)
	if err != nil {
		// Check if it's a login required error
		if isLoginRequiredError(err) {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "SSO_LOGIN_REQUIRED",
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SYNC_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Generate Bridge config file
	if err := h.ssoClient.GenerateBridgeConfig(c.Request.Context()); err != nil {
		// Non-fatal, just log
		fmt.Printf("Warning: failed to generate Bridge config: %v\n", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       fmt.Sprintf("Session '%s' added with %d accounts", req.SessionName, len(session.Accounts)),
		"accountsCount": len(session.Accounts),
	})
}

// ListSessions handles GET /api/v1/aws/sso/sessions
// Lists all SSO sessions with their accounts
func (h *AWSSSOHandler) ListSessions(c *gin.Context) {
	sessions, err := h.ssoClient.ListSessions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LIST_SESSIONS_FAILED",
			Message: err.Error(),
		})
		return
	}

	var response []SessionResponse
	for _, s := range sessions {
		// Check login status
		status, _ := h.ssoClient.GetSessionStatus(s.StartUrl)

		var accounts []AccountWithRolesResp
		for _, acc := range s.Accounts {
			accounts = append(accounts, AccountWithRolesResp{
				AccountId:   acc.AccountId,
				AccountName: acc.AccountName,
				Email:       acc.EmailAddr,
				Roles:       acc.Roles,
			})
		}

		var tokenExpiry *time.Time
		var lastSynced *time.Time
		if !s.TokenExpiry.IsZero() {
			tokenExpiry = &s.TokenExpiry
		}
		if !s.LastSynced.IsZero() {
			lastSynced = &s.LastSynced
		}

		response = append(response, SessionResponse{
			Name:        s.Name,
			StartUrl:    s.StartUrl,
			Region:      s.Region,
			IsLoggedIn:  status != nil && status.IsLoggedIn,
			TokenExpiry: tokenExpiry,
			LastSynced:  lastSynced,
			Accounts:    accounts,
		})
	}

	c.JSON(http.StatusOK, SessionsListResponse{
		Sessions: response,
		Count:    len(response),
	})
}

// SyncSession handles POST /api/v1/aws/sso/sessions/:name/sync
// Re-syncs accounts for an existing session
func (h *AWSSSOHandler) SyncSession(c *gin.Context) {
	sessionName := c.Param("name")
	if sessionName == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Session name is required",
		})
		return
	}

	// Get existing session to retrieve startUrl and region
	existingSession, err := h.ssoClient.GetSession(sessionName)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "SESSION_NOT_FOUND",
			Message: fmt.Sprintf("Session '%s' not found", sessionName),
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	session, err := h.ssoClient.SyncSession(ctx, sessionName, existingSession.StartUrl, existingSession.Region)
	if err != nil {
		if isLoginRequiredError(err) {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "SSO_LOGIN_REQUIRED",
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SYNC_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Regenerate Bridge config
	h.ssoClient.GenerateBridgeConfig(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       fmt.Sprintf("Session '%s' synced with %d accounts", sessionName, len(session.Accounts)),
		"accountsCount": len(session.Accounts),
	})
}

// DeleteSession handles DELETE /api/v1/aws/sso/sessions/:name
// Removes an SSO session
func (h *AWSSSOHandler) DeleteSession(c *gin.Context) {
	sessionName := c.Param("name")
	if sessionName == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Session name is required",
		})
		return
	}

	if err := h.ssoClient.DeleteSession(sessionName); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "DELETE_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Regenerate Bridge config
	h.ssoClient.GenerateBridgeConfig(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Session '%s' deleted", sessionName),
	})
}

// MapContext handles POST /api/v1/aws/sso/context-mapping
// Maps a Kubernetes context to an AWS SSO role
func (h *AWSSSOHandler) MapContext(c *gin.Context) {
	var req MapContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// Get session to retrieve startUrl and region
	session, err := h.ssoClient.GetSession(req.SessionName)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "SESSION_NOT_FOUND",
			Message: fmt.Sprintf("Session '%s' not found", req.SessionName),
		})
		return
	}

	// Store the mapping
	storage := aws.NewStorage()
	mapping := aws.ContextMapping{
		ContextName: req.ContextName,
		SessionName: req.SessionName,
		AccountId:   req.AccountId,
		RoleName:    req.RoleName,
		StartUrl:    session.StartUrl,
		Region:      session.Region,
	}

	if err := storage.SetContextMapping(mapping); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "MAPPING_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Update kubeconfig to use Bridge's config
	if err := h.updateKubeconfigForBridge(req.ContextName, session); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBECONFIG_UPDATE_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Context '%s' mapped to %s/%s", req.ContextName, req.AccountId, req.RoleName),
	})
}

// ListContextMappings handles GET /api/v1/aws/sso/context-mappings
// Lists all context to AWS role mappings
func (h *AWSSSOHandler) ListContextMappings(c *gin.Context) {
	storage := aws.NewStorage()
	mappings, err := storage.GetContextMappings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LIST_MAPPINGS_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Get cluster names from kubeconfig
	manager := h.k8sService.GetManager()
	contexts, _ := manager.ListContexts()
	contextToCluster := make(map[string]string)
	for _, ctx := range contexts {
		contextToCluster[ctx.Name] = ctx.Cluster
	}

	// Get account names from sessions
	sessions, _ := h.ssoClient.ListSessions()
	accountNames := make(map[string]string)
	for _, s := range sessions {
		for _, acc := range s.Accounts {
			accountNames[acc.AccountId] = acc.AccountName
		}
	}

	var response []ContextMappingResponse
	for _, m := range mappings.Mappings {
		response = append(response, ContextMappingResponse{
			ContextName: m.ContextName,
			ClusterName: contextToCluster[m.ContextName],
			SessionName: m.SessionName,
			AccountId:   m.AccountId,
			AccountName: accountNames[m.AccountId],
			RoleName:    m.RoleName,
			UpdatedAt:   m.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, ContextMappingsResponse{
		Mappings: response,
		Count:    len(response),
	})
}

// DeleteContextMapping handles DELETE /api/v1/aws/sso/context-mapping/*contextName
// Removes a context mapping
// Uses wildcard (*) to handle context names containing slashes (e.g., ARNs like arn:aws:eks:region:account:cluster/name)
func (h *AWSSSOHandler) DeleteContextMapping(c *gin.Context) {
	contextName := c.Param("contextName")
	// Gin wildcard parameters include the leading slash, so strip it
	if strings.HasPrefix(contextName, "/") {
		contextName = contextName[1:]
	}

	if contextName == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Context name is required",
		})
		return
	}

	storage := aws.NewStorage()
	if err := storage.DeleteContextMapping(contextName); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "DELETE_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Mapping for context '%s' deleted", contextName),
	})
}

// updateKubeconfigForBridge updates the kubeconfig to use Bridge's managed config
func (h *AWSSSOHandler) updateKubeconfigForBridge(contextName string, session *aws.SSOSession) error {
	kubeconfigPath := getKubeconfigPath()

	// Create backup
	if err := createBackup(kubeconfigPath); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	// Load kubeconfig
	config, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	// Find the context
	ctx, exists := config.Contexts[contextName]
	if !exists {
		return fmt.Errorf("context '%s' not found", contextName)
	}

	// Find the user
	user, exists := config.AuthInfos[ctx.AuthInfo]
	if !exists {
		return fmt.Errorf("user '%s' not found", ctx.AuthInfo)
	}

	// Check if this user has exec config
	if user.Exec == nil {
		return fmt.Errorf("user '%s' does not have exec config", ctx.AuthInfo)
	}

	// Update exec env to use Bridge's config
	bridgeConfigPath := aws.GetBridgeConfigPath()

	// Remove old AWS_PROFILE and AWS_CONFIG_FILE if present
	var newEnv []api.ExecEnvVar
	for _, env := range user.Exec.Env {
		if env.Name != "AWS_PROFILE" && env.Name != "AWS_CONFIG_FILE" && env.Name != "AWS_SSO_SESSION" {
			newEnv = append(newEnv, env)
		}
	}

	// Add Bridge-managed env vars
	newEnv = append(newEnv, api.ExecEnvVar{
		Name:  "AWS_CONFIG_FILE",
		Value: bridgeConfigPath,
	})
	newEnv = append(newEnv, api.ExecEnvVar{
		Name:  "AWS_SSO_SESSION",
		Value: session.Name,
	})

	user.Exec.Env = newEnv

	// Write back
	return clientcmd.WriteToFile(*config, kubeconfigPath)
}

// Helper to check for login required errors
func isLoginRequiredError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "no valid token") ||
		strings.Contains(errStr, "token expired") ||
		strings.Contains(errStr, "login") ||
		strings.Contains(errStr, "UnauthorizedException")
}

// GetBridgeConfigPath returns the path to Bridge's managed AWS config
func GetBridgeConfigPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".bridge", "aws", "config")
}

// GenerateEKSTokenRequest is the request body for generating an EKS token
type GenerateEKSTokenRequest struct {
	SessionName string `json:"sessionName" binding:"required"`
	AccountID   string `json:"accountId" binding:"required"`
	RoleName    string `json:"roleName" binding:"required"`
	ClusterName string `json:"clusterName" binding:"required"`
	Region      string `json:"region" binding:"required"`
}

// GenerateEKSToken handles POST /api/v1/aws/sso/eks-token
// Generates a native EKS bearer token without needing aws-iam-authenticator
func (h *AWSSSOHandler) GenerateEKSToken(c *gin.Context) {
	var req GenerateEKSTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// Get credentials from Bridge's SSO storage
	creds, profileName, err := h.ssoClient.GenerateProfileCredentials(
		c.Request.Context(),
		req.SessionName,
		req.AccountID,
		req.RoleName,
	)
	if err != nil {
		if isLoginRequiredError(err) {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "SSO_LOGIN_REQUIRED",
				Message: "Please login to AWS SSO first",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "CREDENTIAL_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Generate native EKS token
	token, expiresAt, err := generateEKSTokenNative(
		c.Request.Context(),
		creds.AccessKeyId,
		creds.SecretAccessKey,
		creds.SessionToken,
		req.ClusterName,
		req.Region,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "TOKEN_GENERATION_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":       token,
		"expiresAt":   expiresAt,
		"profileName": profileName,
	})
}

// generateEKSTokenNative uses the native EKS token generator
func generateEKSTokenNative(ctx context.Context, accessKeyID, secretAccessKey, sessionToken, clusterName, region string) (string, time.Time, error) {
	return eks.GenerateTokenForContext(ctx, accessKeyID, secretAccessKey, sessionToken, clusterName, region)
}

// DebugContextAuth handles GET /api/v1/aws/sso/debug/:contextName
// Returns detailed debugging information for a specific context's auth setup
func (h *AWSSSOHandler) DebugContextAuth(c *gin.Context) {
	contextName := c.Param("contextName")
	// Gin wildcard parameters include the leading slash, so strip it
	if strings.HasPrefix(contextName, "/") {
		contextName = contextName[1:]
	}

	if contextName == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "MISSING_CONTEXT",
			Message: "Context name is required",
		})
		return
	}

	storage := aws.NewStorage()
	debug := make(map[string]interface{})

	// 1. Check context mapping
	mapping, mappingErr := storage.GetContextMapping(contextName)
	if mappingErr != nil {
		debug["contextMapping"] = map[string]interface{}{
			"found": false,
			"error": mappingErr.Error(),
		}
	} else {
		debug["contextMapping"] = map[string]interface{}{
			"found":       true,
			"sessionName": mapping.SessionName,
			"accountId":   mapping.AccountId,
			"roleName":    mapping.RoleName,
			"region":      mapping.Region,
			"startUrl":    mapping.StartUrl,
			"updatedAt":   mapping.UpdatedAt,
		}

		// 2. Check session
		session, sessionErr := storage.GetSession(mapping.SessionName)
		if sessionErr != nil {
			debug["session"] = map[string]interface{}{
				"found": false,
				"error": sessionErr.Error(),
			}
		} else {
			debug["session"] = map[string]interface{}{
				"found":         true,
				"name":          session.Name,
				"startUrl":      session.StartUrl,
				"region":        session.Region,
				"lastSynced":    session.LastSynced,
				"tokenExpiry":   session.TokenExpiry,
				"accountsCount": len(session.Accounts),
			}
		}

		// 3. Check token
		token, tokenErr := storage.GetToken(mapping.StartUrl)
		if tokenErr != nil {
			debug["token"] = map[string]interface{}{
				"found": false,
				"error": tokenErr.Error(),
			}
		} else {
			isExpired := token.ExpiresAt.Before(time.Now())
			debug["token"] = map[string]interface{}{
				"found":     true,
				"expiresAt": token.ExpiresAt,
				"isExpired": isExpired,
				"tokenType": token.TokenType,
				"region":    token.Region,
				"startUrl":  token.StartUrl,
				// Don't expose actual token
				"hasAccessToken": token.AccessToken != "",
			}

			// 4. If token is valid, try to get credentials
			if !isExpired {
				creds, profileName, credsErr := h.ssoClient.GenerateProfileCredentials(
					c.Request.Context(),
					mapping.SessionName,
					mapping.AccountId,
					mapping.RoleName,
				)
				if credsErr != nil {
					debug["credentials"] = map[string]interface{}{
						"fetched": false,
						"error":   credsErr.Error(),
					}
				} else {
					debug["credentials"] = map[string]interface{}{
						"fetched":     true,
						"profileName": profileName,
						"accessKeyId": creds.AccessKeyId[:10] + "...",
						"expiration":  creds.Expiration,
						"isExpired":   creds.Expiration.Before(time.Now()),
					}

					// 5. Try to extract cluster name and generate token
					kubeconfigPath := os.Getenv("KUBECONFIG")
					if kubeconfigPath == "" {
						homeDir, _ := os.UserHomeDir()
						kubeconfigPath = filepath.Join(homeDir, ".kube", "config")
					}

					config, loadErr := clientcmd.LoadFromFile(kubeconfigPath)
					if loadErr != nil {
						debug["clusterExtraction"] = map[string]interface{}{
							"error": "Failed to load kubeconfig: " + loadErr.Error(),
						}
					} else {
						ctx, exists := config.Contexts[contextName]
						if !exists {
							debug["clusterExtraction"] = map[string]interface{}{
								"error": "Context not found in kubeconfig",
							}
						} else {
							clusterRef := ctx.Cluster
							clusterName := ""

							// Try ARN extraction
							if cn, err := eks.ExtractClusterNameFromARN(clusterRef); err == nil {
								clusterName = cn
							} else if strings.Contains(clusterRef, "/") {
								parts := strings.Split(clusterRef, "/")
								clusterName = parts[len(parts)-1]
							} else {
								clusterName = clusterRef
							}

							var serverURL string
							if cluster, ok := config.Clusters[clusterRef]; ok {
								serverURL = cluster.Server
							}

							debug["clusterExtraction"] = map[string]interface{}{
								"clusterRef":  clusterRef,
								"clusterName": clusterName,
								"serverURL":   serverURL,
							}

							// 6. Try to generate EKS token
							eksToken, eksExpiry, eksErr := eks.GenerateTokenForContext(
								c.Request.Context(),
								creds.AccessKeyId,
								creds.SecretAccessKey,
								creds.SessionToken,
								clusterName,
								mapping.Region,
							)
							if eksErr != nil {
								debug["eksToken"] = map[string]interface{}{
									"generated": false,
									"error":     eksErr.Error(),
								}
							} else {
								// Validate the token
								validationErr := eks.ValidateToken(eksToken)
								debug["eksToken"] = map[string]interface{}{
									"generated":   true,
									"expiresAt":   eksExpiry,
									"tokenLength": len(eksToken),
									"tokenPrefix": eksToken[:30] + "...",
									"isValid":     validationErr == nil,
									"validationError": func() string {
										if validationErr != nil {
											return validationErr.Error()
										}
										return ""
									}(),
								}

								// Extract region from token for verification
								tokenRegion, _ := eks.GetTokenRegion(eksToken)
								debug["eksToken"].(map[string]interface{})["tokenRegion"] = tokenRegion
							}
						}
					}
				}
			}
		}
	}

	// List all mappings for reference
	allMappings, _ := storage.GetContextMappings()
	mappingNames := make([]string, 0)
	if allMappings != nil {
		for _, m := range allMappings.Mappings {
			mappingNames = append(mappingNames, m.ContextName)
		}
	}
	debug["allMappedContexts"] = mappingNames

	c.JSON(http.StatusOK, debug)
}
