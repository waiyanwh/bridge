package handlers

import (
	"context"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
)

// CRDHandler handles CRD discovery and dynamic resource operations
// Uses lazy client creation to ensure it always uses the current authenticated config
type CRDHandler struct {
	k8sService *k8s.Service
}

// NewCRDHandler creates a new CRDHandler
// Clients are created lazily on each request using the current authenticated config
func NewCRDHandler(k8sService *k8s.Service) *CRDHandler {
	return &CRDHandler{k8sService: k8sService}
}

// getDiscoveryClient creates a discovery client using the current authenticated config
func (h *CRDHandler) getDiscoveryClient() (discovery.DiscoveryInterface, error) {
	config, err := h.k8sService.GetConfig()
	if err != nil {
		return nil, err
	}
	return discovery.NewDiscoveryClientForConfig(config)
}

// getDynamicClient creates a dynamic client using the current authenticated config
func (h *CRDHandler) getDynamicClient() (dynamic.Interface, error) {
	config, err := h.k8sService.GetConfig()
	if err != nil {
		return nil, err
	}
	return dynamic.NewForConfig(config)
}

// getAPIExtClient creates an API extensions client using the current authenticated config
func (h *CRDHandler) getAPIExtClient() (apiextensionsclient.Interface, error) {
	config, err := h.k8sService.GetConfig()
	if err != nil {
		return nil, err
	}
	return apiextensionsclient.NewForConfig(config)
}

// CRDResource represents a single resource type with its version
type CRDResource struct {
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	Version    string `json:"version"`
	Namespaced bool   `json:"namespaced"`
}

// CRDGroup represents an API group with its resources (deduplicated by group name)
type CRDGroup struct {
	Group     string        `json:"group"`
	Resources []CRDResource `json:"resources"`
}

// PrinterColumn for dynamic table rendering
type PrinterColumn struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	JSONPath    string `json:"jsonPath"`
	Description string `json:"description,omitempty"`
	Priority    int32  `json:"priority,omitempty"`
}

// CustomResourcesResponse for dynamic listing
type CustomResourcesResponse struct {
	Columns   []PrinterColumn          `json:"columns"`
	Items     []map[string]interface{} `json:"items"`
	Namespace string                   `json:"namespace,omitempty"`
	Count     int                      `json:"count"`
}

// coreGroups are the built-in Kubernetes API groups we handle with dedicated pages
// or that have non-standard resources (like metrics aggregated APIs)
var coreGroups = map[string]bool{
	"":                             true, // core/v1
	"apps":                         true,
	"batch":                        true,
	"networking.k8s.io":            true,
	"storage.k8s.io":               true,
	"rbac.authorization.k8s.io":    true,
	"autoscaling":                  true,
	"policy":                       true,
	"coordination.k8s.io":          true,
	"discovery.k8s.io":             true,
	"events.k8s.io":                true,
	"node.k8s.io":                  true,
	"scheduling.k8s.io":            true,
	"admissionregistration.k8s.io": true,
	"apiextensions.k8s.io":         true,
	"apiregistration.k8s.io":       true,
	"authentication.k8s.io":        true,
	"authorization.k8s.io":         true,
	"certificates.k8s.io":          true,
	"flowcontrol.apiserver.k8s.io": true,
	// Metrics aggregated APIs - these have non-standard resources that can't be listed normally
	"metrics.k8s.io":            true,
	"metrics.eks.amazonaws.com": true,
}

// ListCRDGroups handles GET /api/v1/crds
func (h *CRDHandler) ListCRDGroups(c *gin.Context) {
	// Get discovery client using current authenticated config
	discoveryClient, err := h.getDiscoveryClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "CLIENT_ERROR",
			Message: "Failed to create discovery client: " + err.Error(),
		})
		return
	}

	// Get all API resources
	_, apiResourceLists, err := discoveryClient.ServerGroupsAndResources()
	if err != nil {
		// Partial results are still useful
		if apiResourceLists == nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "DISCOVERY_ERROR",
				Message: "Failed to discover API resources: " + err.Error(),
			})
			return
		}
	}

	// Group resources by API group name (not version)
	// Key: group name, Value: CRDGroup with all resources across versions
	groupMap := make(map[string]*CRDGroup)
	// Track seen resources to avoid duplicates (key: group/name)
	seenResources := make(map[string]bool)

	for _, apiResourceList := range apiResourceLists {
		if apiResourceList == nil {
			continue
		}

		// Parse GroupVersion
		gv, err := schema.ParseGroupVersion(apiResourceList.GroupVersion)
		if err != nil {
			continue
		}

		// Skip core groups
		if coreGroups[gv.Group] {
			continue
		}

		// Create or get group by GROUP NAME only (not version)
		group, exists := groupMap[gv.Group]
		if !exists {
			group = &CRDGroup{
				Group:     gv.Group,
				Resources: []CRDResource{},
			}
			groupMap[gv.Group] = group
		}

		// Add resources (skip subresources like status, scale)
		for _, apiResource := range apiResourceList.APIResources {
			// Skip subresources (they contain "/")
			if strings.Contains(apiResource.Name, "/") {
				continue
			}

			// Deduplicate: prefer first version seen (usually stable)
			resourceKey := gv.Group + "/" + apiResource.Name
			if seenResources[resourceKey] {
				continue
			}
			seenResources[resourceKey] = true

			group.Resources = append(group.Resources, CRDResource{
				Kind:       apiResource.Kind,
				Name:       apiResource.Name,
				Version:    gv.Version,
				Namespaced: apiResource.Namespaced,
			})
		}
	}

	// Convert map to sorted slice
	groups := make([]CRDGroup, 0, len(groupMap))
	for _, group := range groupMap {
		if len(group.Resources) > 0 {
			// Sort resources by kind
			sort.Slice(group.Resources, func(i, j int) bool {
				return group.Resources[i].Kind < group.Resources[j].Kind
			})
			groups = append(groups, *group)
		}
	}

	// Sort groups by name
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Group < groups[j].Group
	})

	c.JSON(http.StatusOK, groups)
}

// ListCustomResources handles GET /api/v1/custom/:group/:version/:resource
func (h *CRDHandler) ListCustomResources(c *gin.Context) {
	group := c.Param("group")
	version := c.Param("version")
	resource := c.Param("resource")
	namespace := c.Query("namespace")

	// Get clients using current authenticated config
	dynamicClient, err := h.getDynamicClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "CLIENT_ERROR",
			Message: "Failed to create dynamic client: " + err.Error(),
		})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	// Check if resource is namespaced using discovery API (works for all APIs, not just CRDs)
	isNamespaced := h.isResourceNamespaced(group, version, resource)

	// Get printer columns from CRD definition (optional, for pretty display)
	columns := h.getPrinterColumns(group, version, resource, isNamespaced)

	// Get resources
	var list *unstructured.UnstructuredList

	// For cluster-scoped resources, ignore namespace parameter
	if !isNamespaced {
		list, err = dynamicClient.Resource(gvr).List(context.Background(), metav1.ListOptions{})
		namespace = "" // Clear namespace for response
	} else if namespace != "" {
		list, err = dynamicClient.Resource(gvr).Namespace(namespace).List(context.Background(), metav1.ListOptions{})
	} else {
		list, err = dynamicClient.Resource(gvr).List(context.Background(), metav1.ListOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: "Failed to list resources: " + err.Error(),
		})
		return
	}

	// Convert items to generic maps
	items := make([]map[string]interface{}, 0, len(list.Items))
	for _, item := range list.Items {
		items = append(items, item.Object)
	}

	c.JSON(http.StatusOK, CustomResourcesResponse{
		Columns:   columns,
		Items:     items,
		Namespace: namespace,
		Count:     len(items),
	})
}

// isResourceNamespaced checks if a resource is namespaced using discovery API
func (h *CRDHandler) isResourceNamespaced(group, version, resource string) bool {
	gv := group + "/" + version
	if group == "" {
		gv = version
	}

	discoveryClient, err := h.getDiscoveryClient()
	if err != nil {
		return true // Default to namespaced on error
	}

	resourceList, err := discoveryClient.ServerResourcesForGroupVersion(gv)
	if err != nil {
		return true // Default to namespaced on error
	}

	for _, apiResource := range resourceList.APIResources {
		if apiResource.Name == resource {
			return apiResource.Namespaced
		}
	}

	return true // Default to namespaced if not found
}

// getPrinterColumns fetches additionalPrinterColumns from CRD definition
func (h *CRDHandler) getPrinterColumns(group, version, resource string, isNamespaced bool) []PrinterColumn {
	// Default columns
	defaultColumns := []PrinterColumn{
		{Name: "Name", Type: "string", JSONPath: ".metadata.name"},
	}
	if isNamespaced {
		defaultColumns = append(defaultColumns, PrinterColumn{
			Name: "Namespace", Type: "string", JSONPath: ".metadata.namespace",
		})
	}
	defaultColumns = append(defaultColumns, PrinterColumn{
		Name: "Age", Type: "date", JSONPath: ".metadata.creationTimestamp",
	})

	// Try to find CRD for additionalPrinterColumns
	apiextClient, err := h.getAPIExtClient()
	if err != nil {
		return defaultColumns
	}

	crdName := resource + "." + group
	crd, err := apiextClient.ApiextensionsV1().CustomResourceDefinitions().Get(
		context.Background(),
		crdName,
		metav1.GetOptions{},
	)
	if err != nil {
		return defaultColumns
	}

	// Find the matching version
	var versionSpec *apiextensionsv1.CustomResourceDefinitionVersion
	for i := range crd.Spec.Versions {
		if crd.Spec.Versions[i].Name == version {
			versionSpec = &crd.Spec.Versions[i]
			break
		}
	}

	if versionSpec == nil || len(versionSpec.AdditionalPrinterColumns) == 0 {
		return defaultColumns
	}

	// Build columns from additionalPrinterColumns
	columns := []PrinterColumn{
		{Name: "Name", Type: "string", JSONPath: ".metadata.name"},
	}

	// Add Namespace column only for namespaced resources
	if isNamespaced {
		columns = append(columns, PrinterColumn{
			Name: "Namespace", Type: "string", JSONPath: ".metadata.namespace",
		})
	}

	for _, col := range versionSpec.AdditionalPrinterColumns {
		columns = append(columns, PrinterColumn{
			Name:        col.Name,
			Type:        col.Type,
			JSONPath:    col.JSONPath,
			Description: col.Description,
			Priority:    col.Priority,
		})
	}

	// Add Age at the end if not already present
	hasAge := false
	for _, col := range columns {
		if col.Name == "Age" {
			hasAge = true
			break
		}
	}
	if !hasAge {
		columns = append(columns, PrinterColumn{
			Name:     "Age",
			Type:     "date",
			JSONPath: ".metadata.creationTimestamp",
		})
	}

	return columns
}
