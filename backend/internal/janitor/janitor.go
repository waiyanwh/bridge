package janitor

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// LabelManagedBy is the label used to identify Bridge-managed resources
	LabelManagedBy = "app.kubernetes.io/managed-by"
	// ManagedByBridge is the value for the managed-by label
	ManagedByBridge = "bridge"
	// AnnotationExpiresAt is the annotation used to store expiration time
	AnnotationExpiresAt = "bridge.io/expires-at"
)

// Janitor periodically cleans up expired Bridge access resources
type Janitor struct {
	k8sService *k8s.Service
	interval   time.Duration
	stopCh     chan struct{}
}

// New creates a new Janitor instance
func New(k8sService *k8s.Service, interval time.Duration) *Janitor {
	return &Janitor{
		k8sService: k8sService,
		interval:   interval,
		stopCh:     make(chan struct{}),
	}
}

// Start begins the cleanup loop in a goroutine
func (j *Janitor) Start() {
	go j.run()
	log.Printf("[Janitor] Started with cleanup interval of %s", j.interval)
}

// Stop signals the janitor to stop
func (j *Janitor) Stop() {
	close(j.stopCh)
	log.Println("[Janitor] Stopped")
}

func (j *Janitor) run() {
	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	// Run cleanup immediately on start
	j.cleanup()

	for {
		select {
		case <-ticker.C:
			j.cleanup()
		case <-j.stopCh:
			return
		}
	}
}

func (j *Janitor) cleanup() {
	ctx := context.Background()
	clientset := j.k8sService.GetClientset()

	// List all ServiceAccounts with Bridge label across all namespaces
	labelSelector := LabelManagedBy + "=" + ManagedByBridge

	saList, err := clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		log.Printf("[Janitor] Error listing ServiceAccounts: %v", err)
		return
	}

	now := time.Now()
	cleanedUp := 0

	for _, sa := range saList.Items {
		// Check for expires-at annotation
		if sa.Annotations == nil {
			continue
		}
		expiresAtStr, ok := sa.Annotations[AnnotationExpiresAt]
		if !ok || expiresAtStr == "" {
			continue // No expiration, skip
		}

		// Parse expiration time
		expiresAt, err := time.Parse(time.RFC3339, expiresAtStr)
		if err != nil {
			log.Printf("[Janitor] Invalid expires-at annotation for %s/%s: %v", sa.Namespace, sa.Name, err)
			continue
		}

		// Check if expired
		if expiresAt.After(now) {
			continue // Not expired yet
		}

		// Expired! Clean up resources
		log.Printf("[Janitor] Cleaning up expired access for %s (expired at %s)", sa.Name, expiresAtStr)
		j.revokeAccess(ctx, sa.Namespace, sa.Name)
		cleanedUp++
	}

	if cleanedUp > 0 {
		log.Printf("[Janitor] Cleaned up %d expired access(es)", cleanedUp)
	}
}

func (j *Janitor) revokeAccess(ctx context.Context, namespace, saName string) {
	clientset := j.k8sService.GetClientset()

	// Derive resource names from SA name
	baseName := strings.TrimSuffix(saName, "-sa")
	roleName := baseName + "-role"
	bindingName := baseName + "-binding"
	secretName := baseName + "-token"

	// Delete Secret (ignore not found errors)
	if err := clientset.CoreV1().Secrets(namespace).Delete(ctx, secretName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			log.Printf("[Janitor] Error deleting Secret %s/%s: %v", namespace, secretName, err)
		}
	}

	// Delete RoleBinding
	if err := clientset.RbacV1().RoleBindings(namespace).Delete(ctx, bindingName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			log.Printf("[Janitor] Error deleting RoleBinding %s/%s: %v", namespace, bindingName, err)
		}
	}

	// Delete Role
	if err := clientset.RbacV1().Roles(namespace).Delete(ctx, roleName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			log.Printf("[Janitor] Error deleting Role %s/%s: %v", namespace, roleName, err)
		}
	}

	// Delete ServiceAccount
	if err := clientset.CoreV1().ServiceAccounts(namespace).Delete(ctx, saName, metav1.DeleteOptions{}); err != nil {
		if !strings.Contains(err.Error(), "not found") {
			log.Printf("[Janitor] Error deleting ServiceAccount %s/%s: %v", namespace, saName, err)
		}
	}

	log.Printf("[Janitor] Successfully cleaned up resources for %s/%s", namespace, saName)
}
