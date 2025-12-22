package k8s

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

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

	// Callback for notifying when context changes (for WebSocket cleanup)
	onContextChange func()
}

// NewClientManager creates a new ClientManager
func NewClientManager() (*ClientManager, error) {
	cm := &ClientManager{}

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
