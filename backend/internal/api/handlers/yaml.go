package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/yaml"
)

// YAMLHandler handles YAML view/edit requests
type YAMLHandler struct {
	k8sService    *k8s.Service
	dynamicClient dynamic.Interface
}

// NewYAMLHandler creates a new YAMLHandler
func NewYAMLHandler(k8sService *k8s.Service) (*YAMLHandler, error) {
	config, err := k8sService.GetConfig()
	if err != nil {
		return nil, err
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	return &YAMLHandler{
		k8sService:    k8sService,
		dynamicClient: dynamicClient,
	}, nil
}

// GetYAMLResponse represents the YAML response
type GetYAMLResponse struct {
	YAML         string `json:"yaml"`
	ResourceType string `json:"resourceType"`
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
}

// ApplyYAMLRequest represents the request to apply YAML
type ApplyYAMLRequest struct {
	YAML string `json:"yaml"`
}

// getGVR returns the GroupVersionResource for a resource type
func getGVR(resourceType string) (schema.GroupVersionResource, bool) {
	resourceMap := map[string]schema.GroupVersionResource{
		// Workloads
		"pods":         {Group: "", Version: "v1", Resource: "pods"},
		"pod":          {Group: "", Version: "v1", Resource: "pods"},
		"deployments":  {Group: "apps", Version: "v1", Resource: "deployments"},
		"deployment":   {Group: "apps", Version: "v1", Resource: "deployments"},
		"statefulsets": {Group: "apps", Version: "v1", Resource: "statefulsets"},
		"statefulset":  {Group: "apps", Version: "v1", Resource: "statefulsets"},
		"daemonsets":   {Group: "apps", Version: "v1", Resource: "daemonsets"},
		"daemonset":    {Group: "apps", Version: "v1", Resource: "daemonsets"},
		"replicasets":  {Group: "apps", Version: "v1", Resource: "replicasets"},
		"replicaset":   {Group: "apps", Version: "v1", Resource: "replicasets"},
		"cronjobs":     {Group: "batch", Version: "v1", Resource: "cronjobs"},
		"cronjob":      {Group: "batch", Version: "v1", Resource: "cronjobs"},
		"jobs":         {Group: "batch", Version: "v1", Resource: "jobs"},
		"job":          {Group: "batch", Version: "v1", Resource: "jobs"},

		// Network
		"services":        {Group: "", Version: "v1", Resource: "services"},
		"service":         {Group: "", Version: "v1", Resource: "services"},
		"ingresses":       {Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"},
		"ingress":         {Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"},
		"networkpolicies": {Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"},
		"networkpolicy":   {Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"},

		// Storage
		"persistentvolumeclaims": {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
		"persistentvolumeclaim":  {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
		"pvc":                    {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
		"persistentvolumes":      {Group: "", Version: "v1", Resource: "persistentvolumes"},
		"persistentvolume":       {Group: "", Version: "v1", Resource: "persistentvolumes"},
		"pv":                     {Group: "", Version: "v1", Resource: "persistentvolumes"},
		"storageclasses":         {Group: "storage.k8s.io", Version: "v1", Resource: "storageclasses"},
		"storageclass":           {Group: "storage.k8s.io", Version: "v1", Resource: "storageclasses"},

		// Configuration
		"configmaps": {Group: "", Version: "v1", Resource: "configmaps"},
		"configmap":  {Group: "", Version: "v1", Resource: "configmaps"},
		"secrets":    {Group: "", Version: "v1", Resource: "secrets"},
		"secret":     {Group: "", Version: "v1", Resource: "secrets"},

		// Access
		"serviceaccounts":     {Group: "", Version: "v1", Resource: "serviceaccounts"},
		"serviceaccount":      {Group: "", Version: "v1", Resource: "serviceaccounts"},
		"roles":               {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"},
		"role":                {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"},
		"rolebindings":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"},
		"rolebinding":         {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"},
		"clusterroles":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"},
		"clusterrole":         {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"},
		"clusterrolebindings": {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"},
		"clusterrolebinding":  {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"},

		// Cluster
		"nodes":      {Group: "", Version: "v1", Resource: "nodes"},
		"node":       {Group: "", Version: "v1", Resource: "nodes"},
		"namespaces": {Group: "", Version: "v1", Resource: "namespaces"},
		"namespace":  {Group: "", Version: "v1", Resource: "namespaces"},
	}

	gvr, ok := resourceMap[strings.ToLower(resourceType)]
	return gvr, ok
}

// isNamespaced returns whether a resource type is namespaced
func isNamespaced(resourceType string) bool {
	clusterScoped := map[string]bool{
		"nodes":               true,
		"node":                true,
		"namespaces":          true,
		"namespace":           true,
		"persistentvolumes":   true,
		"persistentvolume":    true,
		"pv":                  true,
		"storageclasses":      true,
		"storageclass":        true,
		"clusterroles":        true,
		"clusterrole":         true,
		"clusterrolebindings": true,
		"clusterrolebinding":  true,
	}
	return !clusterScoped[strings.ToLower(resourceType)]
}

// GetYAML handles GET /api/v1/yaml/:resourceType/:namespace/:name
func (h *YAMLHandler) GetYAML(c *gin.Context) {
	resourceType := c.Param("resourceType")
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Check for CRD group/version query params
	group := c.Query("group")
	version := c.Query("version")

	var gvr schema.GroupVersionResource
	var namespaced bool

	if group != "" && version != "" {
		// CRD resource - use dynamic GVR from query params
		gvr = schema.GroupVersionResource{
			Group:    group,
			Version:  version,
			Resource: resourceType,
		}
		// For CRDs, we need to determine if namespaced - assume namespaced if namespace provided
		namespaced = namespace != "" && namespace != "_"
	} else {
		// Standard resource - use static mapping
		var ok bool
		gvr, ok = getGVR(resourceType)
		if !ok {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_RESOURCE_TYPE",
				Message: "Unsupported resource type: " + resourceType,
			})
			return
		}
		namespaced = isNamespaced(resourceType)
	}

	var resource *unstructured.Unstructured
	var err error

	if namespaced && namespace != "" && namespace != "_" {
		resource, err = h.dynamicClient.Resource(gvr).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	} else {
		resource, err = h.dynamicClient.Resource(gvr).Get(context.Background(), name, metav1.GetOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Remove managedFields and other noisy metadata
	unstructured.RemoveNestedField(resource.Object, "metadata", "managedFields")
	unstructured.RemoveNestedField(resource.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(resource.Object, "metadata", "uid")
	unstructured.RemoveNestedField(resource.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(resource.Object, "metadata", "generation")

	// Convert to YAML
	yamlBytes, err := yaml.Marshal(resource.Object)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "YAML_ERROR",
			Message: "Failed to convert resource to YAML: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, GetYAMLResponse{
		YAML:         string(yamlBytes),
		ResourceType: resourceType,
		Name:         name,
		Namespace:    namespace,
	})
}

// ApplyYAML handles PUT /api/v1/yaml/:resourceType/:namespace/:name
func (h *YAMLHandler) ApplyYAML(c *gin.Context) {
	resourceType := c.Param("resourceType")
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Check for CRD group/version query params
	group := c.Query("group")
	version := c.Query("version")

	var req ApplyYAMLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Invalid request body: " + err.Error(),
		})
		return
	}

	var gvr schema.GroupVersionResource
	var namespaced bool

	if group != "" && version != "" {
		// CRD resource - use dynamic GVR from query params
		gvr = schema.GroupVersionResource{
			Group:    group,
			Version:  version,
			Resource: resourceType,
		}
		namespaced = namespace != "" && namespace != "_"
	} else {
		// Standard resource - use static mapping
		var ok bool
		gvr, ok = getGVR(resourceType)
		if !ok {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_RESOURCE_TYPE",
				Message: "Unsupported resource type: " + resourceType,
			})
			return
		}
		namespaced = isNamespaced(resourceType)
	}

	// Parse YAML to unstructured
	var obj map[string]interface{}
	if err := yaml.Unmarshal([]byte(req.YAML), &obj); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "YAML_ERROR",
			Message: "Invalid YAML: " + err.Error(),
		})
		return
	}

	// Get current resource to get resourceVersion
	var currentResource *unstructured.Unstructured
	var err error

	if namespaced && namespace != "" && namespace != "_" {
		currentResource, err = h.dynamicClient.Resource(gvr).Namespace(namespace).Get(context.Background(), name, metav1.GetOptions{})
	} else {
		currentResource, err = h.dynamicClient.Resource(gvr).Get(context.Background(), name, metav1.GetOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: "Failed to get current resource: " + err.Error(),
		})
		return
	}

	// Set resourceVersion for update
	metadata, ok := obj["metadata"].(map[string]interface{})
	if !ok {
		metadata = make(map[string]interface{})
		obj["metadata"] = metadata
	}
	metadata["resourceVersion"] = currentResource.GetResourceVersion()
	metadata["name"] = name
	if namespaced {
		metadata["namespace"] = namespace
	}

	resource := &unstructured.Unstructured{Object: obj}

	// Update the resource
	var updatedResource *unstructured.Unstructured
	if namespaced && namespace != "" && namespace != "_" {
		updatedResource, err = h.dynamicClient.Resource(gvr).Namespace(namespace).Update(context.Background(), resource, metav1.UpdateOptions{})
	} else {
		updatedResource, err = h.dynamicClient.Resource(gvr).Update(context.Background(), resource, metav1.UpdateOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: "Failed to update resource: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Resource updated successfully",
		"name":    updatedResource.GetName(),
	})
}
