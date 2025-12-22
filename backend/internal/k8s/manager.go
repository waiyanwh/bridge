package k8s

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/waiyan/bridge/internal/aws"
	"github.com/waiyan/bridge/internal/aws/eks"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// ContextInfo represents information about a kubeconfig context
type ContextInfo struct {
	Name      string `json:"name"`
	Cluster   string `json:"cluster"`
	User      string `json:"user"`
	Namespace string `json:"namespace"`
	IsCurrent bool   `json:"isCurrent"`
}

// ClientManager manages dynamic switching between Kubernetes contexts
type ClientManager struct {
	mu             sync.RWMutex
	clientset      *kubernetes.Clientset
	config         *rest.Config
	currentContext string
	kubeconfigPath string
	rawConfig      *api.Config

	// AWS SSO integration for native EKS authentication
	ssoClient  *aws.SSOClient
	ssoStorage *aws.Storage

	// Cached EKS token info for current context
	cachedToken       string
	cachedTokenExpiry time.Time

	// Callback for notifying when context changes (for WebSocket cleanup)
	onContextChange func()
}

// NewClientManager creates a new ClientManager
func NewClientManager() (*ClientManager, error) {
	cm := &ClientManager{
		// Initialize AWS SSO client for native EKS authentication
		ssoClient:  aws.NewSSOClient(),
		ssoStorage: aws.NewStorage(),
	}

	// Find kubeconfig path
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get user home directory: %w", err)
		}
		kubeconfig = filepath.Join(homeDir, ".kube", "config")
	}
	cm.kubeconfigPath = kubeconfig

	// Load the initial config
	if err := cm.loadConfig(""); err != nil {
		return nil, err
	}

	return cm, nil
}

// loadConfig loads/reloads the kubeconfig using the specified context
// If contextName is empty, uses the current-context from kubeconfig
func (cm *ClientManager) loadConfig(contextName string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Check if kubeconfig file exists
	if _, err := os.Stat(cm.kubeconfigPath); os.IsNotExist(err) {
		return fmt.Errorf("kubeconfig not found at %s", cm.kubeconfigPath)
	}

	// Load raw kubeconfig
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: cm.kubeconfigPath}
	configOverrides := &clientcmd.ConfigOverrides{}

	if contextName != "" {
		configOverrides.CurrentContext = contextName
	}

	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

	// Get raw config for context listing
	rawConfig, err := kubeConfig.RawConfig()
	if err != nil {
		return fmt.Errorf("failed to load raw kubeconfig: %w", err)
	}
	cm.rawConfig = &rawConfig

	// Determine current context
	if contextName != "" {
		cm.currentContext = contextName
	} else {
		cm.currentContext = rawConfig.CurrentContext
	}

	// Build REST config
	config, err := kubeConfig.ClientConfig()
	if err != nil {
		return fmt.Errorf("failed to build config for context '%s': %w", cm.currentContext, err)
	}

	// ⚡️ CHECK FOR SSO MAPPING - Native EKS Authentication
	// If this context is mapped to an AWS SSO role, generate a native EKS token
	if cm.ssoStorage != nil {
		if mapping, err := cm.ssoStorage.GetContextMapping(cm.currentContext); err == nil {
			log.Printf("[ClientManager] Found SSO mapping for context '%s' -> %s/%s",
				cm.currentContext, mapping.AccountId, mapping.RoleName)

			// Extract cluster name from the context/cluster ARN
			clusterName := cm.extractClusterName(cm.currentContext, &rawConfig)

			if clusterName != "" {
				// Try to generate native EKS token
				token, expiry, err := cm.generateNativeEKSToken(context.Background(), mapping, clusterName)
				if err != nil {
					log.Printf("[ClientManager] Warning: Failed to generate native EKS token: %v (falling back to kubeconfig)", err)
				} else {
					log.Printf("[ClientManager] ⚡️ Using native EKS token (expires: %s)", expiry.Format(time.RFC3339))

					// ⚡️ OVERRIDE: Remove the 'Exec' provider (stop it from calling 'aws-iam-authenticator')
					config.ExecProvider = nil

					// ⚡️ INJECT: Set the Bearer Token directly
					config.BearerToken = token

					// Cache the token
					cm.cachedToken = token
					cm.cachedTokenExpiry = expiry
				}
			}
		}
	}

	cm.config = config

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset for context '%s': %w", cm.currentContext, err)
	}
	cm.clientset = clientset

	log.Printf("[ClientManager] Loaded context: %s (cluster: %s)", cm.currentContext, config.Host)

	return nil
}

// generateNativeEKSToken generates an EKS bearer token using native AWS SDK
// This bypasses the need for aws-iam-authenticator binary
func (cm *ClientManager) generateNativeEKSToken(ctx context.Context, mapping *aws.ContextMapping, clusterName string) (string, time.Time, error) {
	log.Printf("[ClientManager] generateNativeEKSToken: starting...")
	log.Printf("[ClientManager] generateNativeEKSToken: sessionName=%s, accountId=%s, roleName=%s, region=%s, cluster=%s",
		mapping.SessionName, mapping.AccountId, mapping.RoleName, mapping.Region, clusterName)

	if cm.ssoClient == nil {
		return "", time.Time{}, fmt.Errorf("SSO client not initialized")
	}

	// Get role credentials from SSO
	log.Printf("[ClientManager] generateNativeEKSToken: fetching role credentials...")
	creds, profileName, err := cm.ssoClient.GenerateProfileCredentials(ctx, mapping.SessionName, mapping.AccountId, mapping.RoleName)
	if err != nil {
		log.Printf("[ClientManager] generateNativeEKSToken: ERROR getting SSO credentials: %v", err)
		return "", time.Time{}, fmt.Errorf("failed to get SSO credentials: %w", err)
	}
	log.Printf("[ClientManager] generateNativeEKSToken: got credentials (profile=%s, accessKey=%s..., expires=%s)",
		profileName, creds.AccessKeyId[:10], creds.Expiration.Format(time.RFC3339))

	// Generate native EKS token
	log.Printf("[ClientManager] generateNativeEKSToken: generating EKS token for cluster=%s, region=%s", clusterName, mapping.Region)
	token, expiry, err := eks.GenerateTokenForContext(
		ctx,
		creds.AccessKeyId,
		creds.SecretAccessKey,
		creds.SessionToken,
		clusterName,
		mapping.Region,
	)
	if err != nil {
		log.Printf("[ClientManager] generateNativeEKSToken: ERROR generating token: %v", err)
		return "", time.Time{}, fmt.Errorf("failed to generate EKS token: %w", err)
	}

	log.Printf("[ClientManager] generateNativeEKSToken: SUCCESS! token length=%d, expires=%s", len(token), expiry.Format(time.RFC3339))
	return token, expiry, nil
}

// extractClusterName extracts the EKS cluster name from context/cluster info
func (cm *ClientManager) extractClusterName(contextName string, rawConfig *api.Config) string {
	log.Printf("[ClientManager] extractClusterName: contextName=%s", contextName)

	// First, try to get it from the cluster ARN in the context
	if ctx, exists := rawConfig.Contexts[contextName]; exists {
		clusterRef := ctx.Cluster
		log.Printf("[ClientManager] extractClusterName: clusterRef=%s", clusterRef)

		// Try to extract from ARN format: arn:aws:eks:region:account:cluster/cluster-name
		if clusterName, err := eks.ExtractClusterNameFromARN(clusterRef); err == nil {
			log.Printf("[ClientManager] extractClusterName: extracted from ARN: %s", clusterName)
			return clusterName
		}

		// Try to get from cluster config
		if cluster, exists := rawConfig.Clusters[clusterRef]; exists {
			log.Printf("[ClientManager] extractClusterName: cluster server=%s", cluster.Server)

			// Check if the server URL is an EKS URL
			// Format: https://<id>.gr7.<region>.eks.amazonaws.com
			if strings.Contains(cluster.Server, ".eks.amazonaws.com") {
				// Try to extract cluster name from ARN in context name
				// Common format: arn:aws:eks:region:account:cluster/cluster-name
				if strings.Contains(contextName, "/") {
					parts := strings.Split(contextName, "/")
					if len(parts) > 0 {
						lastPart := parts[len(parts)-1]
						log.Printf("[ClientManager] extractClusterName: extracted from context name: %s", lastPart)
						return lastPart
					}
				}

				// Try clusterRef if it's not an ARN
				if !strings.HasPrefix(clusterRef, "arn:") {
					log.Printf("[ClientManager] extractClusterName: using clusterRef directly: %s", clusterRef)
					return clusterRef
				}
			}
		}

		// Fallback: try to extract from clusterRef if it contains a cluster name
		if strings.Contains(clusterRef, "/") {
			parts := strings.Split(clusterRef, "/")
			lastPart := parts[len(parts)-1]
			log.Printf("[ClientManager] extractClusterName: fallback from clusterRef: %s", lastPart)
			return lastPart
		}

		log.Printf("[ClientManager] extractClusterName: final fallback using clusterRef: %s", clusterRef)
		return clusterRef
	}

	log.Printf("[ClientManager] extractClusterName: context not found!")
	return ""
}

// RefreshTokenIfNeeded checks if the cached token is about to expire and refreshes it
func (cm *ClientManager) RefreshTokenIfNeeded() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Check if we have a cached token and if it's about to expire (within 2 minutes)
	if cm.cachedToken != "" && time.Now().Add(2*time.Minute).After(cm.cachedTokenExpiry) {
		log.Printf("[ClientManager] Token expiring soon, refreshing...")

		// Get the mapping for current context
		mapping, err := cm.ssoStorage.GetContextMapping(cm.currentContext)
		if err != nil {
			return fmt.Errorf("no mapping found for context refresh: %w", err)
		}

		clusterName := cm.extractClusterName(cm.currentContext, cm.rawConfig)
		if clusterName == "" {
			return fmt.Errorf("could not determine cluster name for token refresh")
		}

		token, expiry, err := cm.generateNativeEKSToken(context.Background(), mapping, clusterName)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}

		// Update the config and cache
		cm.config.BearerToken = token
		cm.cachedToken = token
		cm.cachedTokenExpiry = expiry

		// Recreate clientset with new token
		clientset, err := kubernetes.NewForConfig(cm.config)
		if err != nil {
			return fmt.Errorf("failed to recreate clientset: %w", err)
		}
		cm.clientset = clientset

		log.Printf("[ClientManager] Token refreshed successfully (expires: %s)", expiry.Format(time.RFC3339))
	}

	return nil
}

// IsUsingNativeAuth returns true if the current context is using native EKS authentication
func (cm *ClientManager) IsUsingNativeAuth() bool {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.cachedToken != ""
}

// GetTokenExpiry returns when the current native token expires (if using native auth)
func (cm *ClientManager) GetTokenExpiry() time.Time {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.cachedTokenExpiry
}

// GetClientset returns the current Kubernetes clientset
func (cm *ClientManager) GetClientset() *kubernetes.Clientset {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.clientset
}

// GetConfig returns the current REST config
func (cm *ClientManager) GetConfig() *rest.Config {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.config
}

// GetCurrentContext returns the name of the current context
func (cm *ClientManager) GetCurrentContext() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.currentContext
}

// ListContexts returns all available contexts from kubeconfig
func (cm *ClientManager) ListContexts() ([]ContextInfo, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	if cm.rawConfig == nil {
		return nil, fmt.Errorf("kubeconfig not loaded")
	}

	contexts := make([]ContextInfo, 0, len(cm.rawConfig.Contexts))
	for name, ctx := range cm.rawConfig.Contexts {
		contexts = append(contexts, ContextInfo{
			Name:      name,
			Cluster:   ctx.Cluster,
			User:      ctx.AuthInfo,
			Namespace: ctx.Namespace,
			IsCurrent: name == cm.currentContext,
		})
	}

	return contexts, nil
}

// SwitchContext switches to a different kubeconfig context
func (cm *ClientManager) SwitchContext(contextName string) error {
	// Validate context exists
	cm.mu.RLock()
	if cm.rawConfig == nil {
		cm.mu.RUnlock()
		return fmt.Errorf("kubeconfig not loaded")
	}
	if _, exists := cm.rawConfig.Contexts[contextName]; !exists {
		cm.mu.RUnlock()
		return fmt.Errorf("context '%s' not found in kubeconfig", contextName)
	}
	cm.mu.RUnlock()

	// Notify listeners before switching (for WebSocket cleanup)
	if cm.onContextChange != nil {
		cm.onContextChange()
	}

	// Reload config with new context
	if err := cm.loadConfig(contextName); err != nil {
		return err
	}

	log.Printf("[ClientManager] Switched to context: %s", contextName)
	return nil
}

// SetOnContextChange sets a callback to be called before context change
// This is useful for closing WebSockets gracefully
func (cm *ClientManager) SetOnContextChange(fn func()) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.onContextChange = fn
}

// GetClusterInfo returns information about the current cluster
// Returns: contextName, clusterName, serverURL
func (cm *ClientManager) GetClusterInfo() (string, string, string) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	serverURL := ""
	clusterName := ""

	if cm.config != nil {
		serverURL = cm.config.Host
	}

	// Look up the cluster name from the context
	if cm.rawConfig != nil && cm.currentContext != "" {
		if ctx, exists := cm.rawConfig.Contexts[cm.currentContext]; exists {
			clusterName = ctx.Cluster
		}
	}

	// Fallback for cluster name
	if clusterName == "" {
		clusterName = "In-Cluster"
	}

	return cm.currentContext, clusterName, serverURL
}
