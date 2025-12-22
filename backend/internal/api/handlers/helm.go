package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	"helm.sh/helm/v3/pkg/action"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/yaml"
)

// BridgeRESTClientGetter implements genericclioptions.RESTClientGetter
// This adapter allows Helm to use Bridge's authenticated config with SSO tokens
type BridgeRESTClientGetter struct {
	clientManager *k8s.ClientManager
	namespace     string
}

// ToRESTConfig returns the authenticated REST config from Bridge's ClientManager
// ⚡️ MAGIC: This returns the config with the injected SSO Bearer Token
func (b *BridgeRESTClientGetter) ToRESTConfig() (*rest.Config, error) {
	config := b.clientManager.GetConfig()
	if config == nil {
		return nil, fmt.Errorf("no REST config available from ClientManager")
	}
	// Return a copy to avoid mutations
	return rest.CopyConfig(config), nil
}

// ToDiscoveryClient returns a discovery client for the cluster
func (b *BridgeRESTClientGetter) ToDiscoveryClient() (discovery.CachedDiscoveryInterface, error) {
	config, err := b.ToRESTConfig()
	if err != nil {
		return nil, err
	}
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, err
	}
	return memory.NewMemCacheClient(discoveryClient), nil
}

// ToRESTMapper returns a RESTMapper for resource mapping
func (b *BridgeRESTClientGetter) ToRESTMapper() (meta.RESTMapper, error) {
	discoveryClient, err := b.ToDiscoveryClient()
	if err != nil {
		return nil, err
	}
	return restmapper.NewDeferredDiscoveryRESTMapper(discoveryClient), nil
}

// ToRawKubeConfigLoader returns nil - we don't need raw kubeconfig loading
// since we're using Bridge's managed config
func (b *BridgeRESTClientGetter) ToRawKubeConfigLoader() clientcmd.ClientConfig {
	return nil
}

// HelmHandler handles Helm-related HTTP requests
type HelmHandler struct {
	clientManager *k8s.ClientManager
}

// NewHelmHandler creates a new HelmHandler with the ClientManager for auth
func NewHelmHandler(clientManager *k8s.ClientManager) *HelmHandler {
	return &HelmHandler{
		clientManager: clientManager,
	}
}

// HelmReleaseInfo represents a Helm release
type HelmReleaseInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Revision     int    `json:"revision"`
	Status       string `json:"status"`
	Chart        string `json:"chart"`
	ChartVersion string `json:"chartVersion"`
	AppVersion   string `json:"appVersion"`
	Updated      string `json:"updated"`
	Notes        string `json:"notes,omitempty"`
}

// HelmReleaseDetail represents detailed release info
type HelmReleaseDetail struct {
	HelmReleaseInfo
	Values   map[string]interface{} `json:"values"`
	Manifest string                 `json:"manifest,omitempty"`
}

// HelmRevisionInfo represents a revision in release history
type HelmRevisionInfo struct {
	Revision    int    `json:"revision"`
	Updated     string `json:"updated"`
	Status      string `json:"status"`
	Chart       string `json:"chart"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
}

// ListReleasesResponse response for listing releases
type ListReleasesResponse struct {
	Releases []HelmReleaseInfo `json:"releases"`
	Count    int               `json:"count"`
}

// ReleaseValuesResponse response for getting release values
type ReleaseValuesResponse struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Values    string `json:"values"` // YAML string
}

// ReleaseHistoryResponse response for getting release history
type ReleaseHistoryResponse struct {
	Name      string             `json:"name"`
	Namespace string             `json:"namespace"`
	History   []HelmRevisionInfo `json:"history"`
}

func (h *HelmHandler) getActionConfig(namespace string) (*action.Configuration, error) {
	// ⚡️ Use Bridge's authenticated config instead of reading from ~/.kube/config
	getter := &BridgeRESTClientGetter{
		clientManager: h.clientManager,
		namespace:     namespace,
	}

	actionConfig := new(action.Configuration)

	// Initialize with OUR getter, not the default one
	// This ensures Helm uses Bridge's SSO token for authentication
	if err := actionConfig.Init(getter, namespace, "secret", func(format string, v ...interface{}) {
		// Log function - we can ignore or log
	}); err != nil {
		return nil, fmt.Errorf("failed to initialize Helm action config: %w", err)
	}

	return actionConfig, nil
}

// ListReleases handles GET /api/v1/helm/releases
func (h *HelmHandler) ListReleases(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "")

	// Empty namespace means all namespaces
	actionConfig, err := h.getActionConfig(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "HELM_ERROR",
			Message: err.Error(),
		})
		return
	}

	listAction := action.NewList(actionConfig)
	listAction.AllNamespaces = namespace == "" || namespace == "all"
	listAction.All = true // Include all statuses

	releases, err := listAction.Run()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "HELM_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]HelmReleaseInfo, 0, len(releases))
	for _, r := range releases {
		chartVersion := ""
		appVersion := ""
		chartName := ""

		if r.Chart != nil && r.Chart.Metadata != nil {
			chartName = r.Chart.Metadata.Name
			chartVersion = r.Chart.Metadata.Version
			appVersion = r.Chart.Metadata.AppVersion
		}

		result = append(result, HelmReleaseInfo{
			Name:         r.Name,
			Namespace:    r.Namespace,
			Revision:     r.Version,
			Status:       r.Info.Status.String(),
			Chart:        chartName,
			ChartVersion: chartVersion,
			AppVersion:   appVersion,
			Updated:      r.Info.LastDeployed.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, ListReleasesResponse{
		Releases: result,
		Count:    len(result),
	})
}

// GetRelease handles GET /api/v1/helm/releases/:namespace/:name
func (h *HelmHandler) GetRelease(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	actionConfig, err := h.getActionConfig(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "HELM_ERROR",
			Message: err.Error(),
		})
		return
	}

	getAction := action.NewGet(actionConfig)
	release, err := getAction.Run(name)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: err.Error(),
		})
		return
	}

	chartVersion := ""
	appVersion := ""
	chartName := ""

	if release.Chart != nil && release.Chart.Metadata != nil {
		chartName = release.Chart.Metadata.Name
		chartVersion = release.Chart.Metadata.Version
		appVersion = release.Chart.Metadata.AppVersion
	}

	notes := ""
	if release.Info != nil {
		notes = release.Info.Notes
	}

	c.JSON(http.StatusOK, HelmReleaseDetail{
		HelmReleaseInfo: HelmReleaseInfo{
			Name:         release.Name,
			Namespace:    release.Namespace,
			Revision:     release.Version,
			Status:       release.Info.Status.String(),
			Chart:        chartName,
			ChartVersion: chartVersion,
			AppVersion:   appVersion,
			Updated:      release.Info.LastDeployed.Format("2006-01-02 15:04:05"),
			Notes:        notes,
		},
		Values:   release.Config,
		Manifest: release.Manifest,
	})
}

// GetReleaseValues handles GET /api/v1/helm/releases/:namespace/:name/values
func (h *HelmHandler) GetReleaseValues(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	actionConfig, err := h.getActionConfig(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "HELM_ERROR",
			Message: err.Error(),
		})
		return
	}

	getAction := action.NewGetValues(actionConfig)
	getAction.AllValues = false // Only user-supplied values

	values, err := getAction.Run(name)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: err.Error(),
		})
		return
	}

	// Convert to YAML
	yamlBytes, err := yaml.Marshal(values)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "YAML_ERROR",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, ReleaseValuesResponse{
		Name:      name,
		Namespace: namespace,
		Values:    string(yamlBytes),
	})
}

// GetReleaseHistory handles GET /api/v1/helm/releases/:namespace/:name/history
func (h *HelmHandler) GetReleaseHistory(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	maxHistory := c.DefaultQuery("max", "10")

	max, err := strconv.Atoi(maxHistory)
	if err != nil {
		max = 10
	}

	actionConfig, err := h.getActionConfig(namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "HELM_ERROR",
			Message: err.Error(),
		})
		return
	}

	historyAction := action.NewHistory(actionConfig)
	historyAction.Max = max

	releases, err := historyAction.Run(name)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "NOT_FOUND",
			Message: err.Error(),
		})
		return
	}

	history := make([]HelmRevisionInfo, 0, len(releases))
	for _, r := range releases {
		chartName := ""
		appVersion := ""

		if r.Chart != nil && r.Chart.Metadata != nil {
			chartName = fmt.Sprintf("%s-%s", r.Chart.Metadata.Name, r.Chart.Metadata.Version)
			appVersion = r.Chart.Metadata.AppVersion
		}

		description := ""
		if r.Info != nil {
			description = r.Info.Description
		}

		history = append(history, HelmRevisionInfo{
			Revision:    r.Version,
			Updated:     r.Info.LastDeployed.Format("2006-01-02 15:04:05"),
			Status:      r.Info.Status.String(),
			Chart:       chartName,
			AppVersion:  appVersion,
			Description: description,
		})
	}

	c.JSON(http.StatusOK, ReleaseHistoryResponse{
		Name:      name,
		Namespace: namespace,
		History:   history,
	})
}
