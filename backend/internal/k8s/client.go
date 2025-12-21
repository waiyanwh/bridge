package k8s

import (
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client holds both the Kubernetes clientset and the REST config
type Client struct {
	Clientset *kubernetes.Clientset
	Config    *rest.Config
}

// NewClient initializes a Kubernetes client.
// It first tries in-cluster config, then falls back to kubeconfig from user's home directory.
func NewClient() (*Client, error) {
	// Try in-cluster config first (for running inside K8s)
	config, err := rest.InClusterConfig()
	if err == nil {
		clientset, err := kubernetes.NewForConfig(config)
		if err != nil {
			return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
		}
		return &Client{Clientset: clientset, Config: config}, nil
	}

	// Fall back to kubeconfig from home directory
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get user home directory: %w", err)
		}
		kubeconfig = filepath.Join(homeDir, ".kube", "config")
	}

	// Check if kubeconfig file exists
	if _, err := os.Stat(kubeconfig); os.IsNotExist(err) {
		return nil, fmt.Errorf("kubeconfig not found at %s: please ensure kubectl is configured", kubeconfig)
	}

	// Build config from kubeconfig file
	config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from kubeconfig at %s: %w", kubeconfig, err)
	}

	// Create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	return &Client{Clientset: clientset, Config: config}, nil
}
