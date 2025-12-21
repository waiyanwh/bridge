package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ConfigHandler handles ConfigMap and Secret related HTTP requests
type ConfigHandler struct {
	k8sService *k8s.Service
}

// NewConfigHandler creates a new ConfigHandler
func NewConfigHandler(k8sService *k8s.Service) *ConfigHandler {
	return &ConfigHandler{
		k8sService: k8sService,
	}
}

// ResourceReference represents a resource that references a ConfigMap/Secret
type ResourceReference struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// SecretReveal represents revealed secret data
type SecretReveal struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Data      map[string]string `json:"data"`
}

// ConfigMapDetailResponse response for getting a configmap with references
type ConfigMapDetailResponse struct {
	k8s.ConfigMapInfo
	ReferencedBy []ResourceReference `json:"referencedBy"`
}

// SecretDetailResponse response for getting a secret with references
type SecretDetailResponse struct {
	Name         string              `json:"name"`
	Namespace    string              `json:"namespace"`
	Type         string              `json:"type"`
	Keys         []string            `json:"keys"`
	Age          string              `json:"age"`
	ReferencedBy []ResourceReference `json:"referencedBy"`
}

// ListConfigMapsResponse response for listing configmaps
type ListConfigMapsResponse struct {
	ConfigMaps []k8s.ConfigMapInfo `json:"configMaps"`
	Namespace  string              `json:"namespace"`
	Count      int                 `json:"count"`
}

// ListSecretsResponse response for listing secrets
type ListSecretsResponse struct {
	Secrets   []k8s.SecretInfo `json:"secrets"`
	Namespace string           `json:"namespace"`
	Count     int              `json:"count"`
}

// ListConfigMaps handles GET /api/v1/configmaps
func (h *ConfigHandler) ListConfigMaps(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	configMaps, err := h.k8sService.ListConfigMaps(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ListConfigMapsResponse{
		ConfigMaps: configMaps,
		Namespace:  namespace,
		Count:      len(configMaps),
	})
}

// GetConfigMap handles GET /api/v1/configmaps/:namespace/:name
func (h *ConfigHandler) GetConfigMap(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	configMap, err := h.k8sService.GetConfigMap(c.Request.Context(), namespace, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Find references
	references := h.findConfigMapReferences(c.Request.Context(), namespace, name)

	c.JSON(http.StatusOK, ConfigMapDetailResponse{
		ConfigMapInfo: *configMap,
		ReferencedBy:  references,
	})
}

// GetSecret handles GET /api/v1/secrets/:namespace/:name (metadata only, with references)
func (h *ConfigHandler) GetSecret(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	secrets, err := h.k8sService.ListSecrets(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Find the specific secret
	var secretInfo *k8s.SecretInfo
	for _, s := range secrets {
		if s.Name == name {
			secretInfo = &s
			break
		}
	}

	if secretInfo == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: "Secret not found",
		})
		return
	}

	// Find references
	references := h.findSecretReferences(c.Request.Context(), namespace, name)

	c.JSON(http.StatusOK, SecretDetailResponse{
		Name:         secretInfo.Name,
		Namespace:    secretInfo.Namespace,
		Type:         secretInfo.Type,
		Keys:         secretInfo.Keys,
		Age:          secretInfo.Age,
		ReferencedBy: references,
	})
}

// ListSecrets handles GET /api/v1/secrets
// Security: Does NOT return secret data, only metadata
func (h *ConfigHandler) ListSecrets(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	secrets, err := h.k8sService.ListSecrets(c.Request.Context(), namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ListSecretsResponse{
		Secrets:   secrets,
		Namespace: namespace,
		Count:     len(secrets),
	})
}

// RevealSecret handles GET /api/v1/secrets/:namespace/:name/reveal
// Security: Explicitly reveals secret data - should be protected/audited
func (h *ConfigHandler) RevealSecret(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	secret, err := h.k8sService.GetSecret(c.Request.Context(), namespace, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Decode data (already stored as raw bytes in K8s API, not base64 when using client-go)
	decodedData := make(map[string]string)
	for key, value := range secret.Data {
		decodedData[key] = string(value)
	}

	c.JSON(http.StatusOK, SecretReveal{
		Name:      name,
		Namespace: namespace,
		Data:      decodedData,
	})
}

// findConfigMapReferences finds all resources that reference a ConfigMap
func (h *ConfigHandler) findConfigMapReferences(ctx context.Context, namespace, configMapName string) []ResourceReference {
	references := []ResourceReference{}
	clientset := h.k8sService.GetClientset()

	// Check Pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if h.podSpecReferencesConfigMap(&pod.Spec, configMapName) {
				references = append(references, ResourceReference{
					Kind:      "Pod",
					Name:      pod.Name,
					Namespace: pod.Namespace,
				})
			}
		}
	}

	// Check Deployments
	deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, deploy := range deployments.Items {
			if h.podSpecReferencesConfigMap(&deploy.Spec.Template.Spec, configMapName) {
				references = append(references, ResourceReference{
					Kind:      "Deployment",
					Name:      deploy.Name,
					Namespace: deploy.Namespace,
				})
			}
		}
	}

	// Check StatefulSets
	statefulsets, err := clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range statefulsets.Items {
			if h.podSpecReferencesConfigMap(&sts.Spec.Template.Spec, configMapName) {
				references = append(references, ResourceReference{
					Kind:      "StatefulSet",
					Name:      sts.Name,
					Namespace: sts.Namespace,
				})
			}
		}
	}

	// Check DaemonSets
	daemonsets, err := clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range daemonsets.Items {
			if h.podSpecReferencesConfigMap(&ds.Spec.Template.Spec, configMapName) {
				references = append(references, ResourceReference{
					Kind:      "DaemonSet",
					Name:      ds.Name,
					Namespace: ds.Namespace,
				})
			}
		}
	}

	return references
}

// findSecretReferences finds all resources that reference a Secret
func (h *ConfigHandler) findSecretReferences(ctx context.Context, namespace, secretName string) []ResourceReference {
	references := []ResourceReference{}
	clientset := h.k8sService.GetClientset()

	// Check Pods
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, pod := range pods.Items {
			if h.podSpecReferencesSecret(&pod.Spec, secretName) {
				references = append(references, ResourceReference{
					Kind:      "Pod",
					Name:      pod.Name,
					Namespace: pod.Namespace,
				})
			}
		}
	}

	// Check Deployments
	deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, deploy := range deployments.Items {
			if h.podSpecReferencesSecret(&deploy.Spec.Template.Spec, secretName) {
				references = append(references, ResourceReference{
					Kind:      "Deployment",
					Name:      deploy.Name,
					Namespace: deploy.Namespace,
				})
			}
		}
	}

	// Check StatefulSets
	statefulsets, err := clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range statefulsets.Items {
			if h.podSpecReferencesSecret(&sts.Spec.Template.Spec, secretName) {
				references = append(references, ResourceReference{
					Kind:      "StatefulSet",
					Name:      sts.Name,
					Namespace: sts.Namespace,
				})
			}
		}
	}

	// Check DaemonSets
	daemonsets, err := clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range daemonsets.Items {
			if h.podSpecReferencesSecret(&ds.Spec.Template.Spec, secretName) {
				references = append(references, ResourceReference{
					Kind:      "DaemonSet",
					Name:      ds.Name,
					Namespace: ds.Namespace,
				})
			}
		}
	}

	// Check ServiceAccounts (imagePullSecrets, secrets)
	serviceaccounts, err := clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, sa := range serviceaccounts.Items {
			found := false
			for _, s := range sa.Secrets {
				if s.Name == secretName {
					found = true
					break
				}
			}
			for _, ips := range sa.ImagePullSecrets {
				if ips.Name == secretName {
					found = true
					break
				}
			}
			if found {
				references = append(references, ResourceReference{
					Kind:      "ServiceAccount",
					Name:      sa.Name,
					Namespace: sa.Namespace,
				})
			}
		}
	}

	return references
}

func (h *ConfigHandler) podSpecReferencesConfigMap(spec *corev1.PodSpec, configMapName string) bool {
	// Check volumes
	for _, vol := range spec.Volumes {
		if vol.ConfigMap != nil && vol.ConfigMap.Name == configMapName {
			return true
		}
		if vol.Projected != nil {
			for _, src := range vol.Projected.Sources {
				if src.ConfigMap != nil && src.ConfigMap.Name == configMapName {
					return true
				}
			}
		}
	}

	// Check containers
	allContainers := append(spec.Containers, spec.InitContainers...)
	for _, container := range allContainers {
		// Check env
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.ConfigMapKeyRef != nil {
				if env.ValueFrom.ConfigMapKeyRef.Name == configMapName {
					return true
				}
			}
		}
		// Check envFrom
		for _, envFrom := range container.EnvFrom {
			if envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name == configMapName {
				return true
			}
		}
	}

	return false
}

func (h *ConfigHandler) podSpecReferencesSecret(spec *corev1.PodSpec, secretName string) bool {
	// Check volumes
	for _, vol := range spec.Volumes {
		if vol.Secret != nil && vol.Secret.SecretName == secretName {
			return true
		}
		if vol.Projected != nil {
			for _, src := range vol.Projected.Sources {
				if src.Secret != nil && src.Secret.Name == secretName {
					return true
				}
			}
		}
	}

	// Check imagePullSecrets
	for _, ips := range spec.ImagePullSecrets {
		if ips.Name == secretName {
			return true
		}
	}

	// Check containers
	allContainers := append(spec.Containers, spec.InitContainers...)
	for _, container := range allContainers {
		// Check env
		for _, env := range container.Env {
			if env.ValueFrom != nil && env.ValueFrom.SecretKeyRef != nil {
				if env.ValueFrom.SecretKeyRef.Name == secretName {
					return true
				}
			}
		}
		// Check envFrom
		for _, envFrom := range container.EnvFrom {
			if envFrom.SecretRef != nil && envFrom.SecretRef.Name == secretName {
				return true
			}
		}
	}

	return false
}
