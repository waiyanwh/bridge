package api

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/api/handlers"
	"github.com/waiyan/bridge/internal/k8s"
	"github.com/waiyan/bridge/internal/tunnel"
)

// SetupRoutes configures all API routes
func SetupRoutes(router *gin.Engine, k8sService *k8s.Service) {
	// Create handlers
	podHandler := handlers.NewPodHandler(k8sService)
	logsHandler := handlers.NewLogsHandler(k8sService)
	nodeHandler := handlers.NewNodeHandler(k8sService)
	execHandler := handlers.NewExecHandler(k8sService)
	configHandler := handlers.NewConfigHandler(k8sService)
	namespaceHandler := handlers.NewNamespaceHandler(k8sService)
	workloadHandler := handlers.NewWorkloadHandler(k8sService)
	networkHandler := handlers.NewNetworkHandler(k8sService)
	storageHandler := handlers.NewStorageHandler(k8sService)
	rbacHandler := handlers.NewRBACHandler(k8sService)
	clusterHandler := handlers.NewClusterHandler(k8sService)
	helmHandler := handlers.NewHelmHandler(k8sService.GetManager())
	accessHandler := handlers.NewAccessHandler(k8sService)
	contextHandler := handlers.NewContextHandler(k8sService)
	topologyHandler := handlers.NewTopologyHandler(k8sService)
	workloadActionsHandler := handlers.NewWorkloadActionsHandler(k8sService)
	dashboardHandler := handlers.NewDashboardHandler(k8sService)

	// Create tunnel manager and handler (uses lazy client access)
	tunnelManager := tunnel.NewManager(k8sService)
	tunnelHandler := handlers.NewTunnelHandler(tunnelManager)

	yamlHandler, err := handlers.NewYAMLHandler(k8sService)
	if err != nil {
		log.Printf("Warning: Failed to create YAML handler: %v", err)
	}

	crdHandler := handlers.NewCRDHandler(k8sService)

	awsHandler := handlers.NewAWSHandler(k8sService)
	awsSSOHandler := handlers.NewAWSSSOHandler(k8sService)

	// API v1 group
	v1 := router.Group("/api/v1")
	{
		// Context endpoints (cluster switching)
		v1.GET("/contexts", contextHandler.ListContexts)
		v1.GET("/contexts/current", contextHandler.GetCurrentContext)
		v1.POST("/contexts/switch", contextHandler.SwitchContext)

		// Namespace endpoints
		v1.GET("/namespaces", namespaceHandler.ListNamespaces)

		// Pod endpoints
		v1.GET("/pods", podHandler.ListPods)
		v1.GET("/pods/:namespace/:name", podHandler.GetPod)

		// WebSocket endpoints
		v1.GET("/pods/:namespace/:name/logs", logsHandler.StreamLogs)
		v1.GET("/logs/stream", logsHandler.StreamAggregatedLogs)
		v1.GET("/exec", execHandler.Exec)

		// Node endpoints
		v1.GET("/nodes", nodeHandler.ListNodes)

		// Workload endpoints
		v1.GET("/deployments", workloadHandler.ListDeployments)
		v1.GET("/statefulsets", workloadHandler.ListStatefulSets)
		v1.GET("/daemonsets", workloadHandler.ListDaemonSets)
		v1.GET("/cronjobs", workloadHandler.ListCronJobs)

		// Workload actions (write operations)
		v1.POST("/workloads/:kind/:namespace/:name/restart", workloadActionsHandler.RestartWorkload)
		v1.POST("/workloads/:kind/:namespace/:name/scale", workloadActionsHandler.ScaleWorkload)
		v1.POST("/cronjobs/:namespace/:name/suspend", workloadActionsHandler.SuspendCronJob)

		// Network endpoints
		v1.GET("/services", networkHandler.ListServices)
		v1.GET("/ingresses", networkHandler.ListIngresses)
		v1.GET("/networkpolicies", networkHandler.ListNetworkPolicies)

		// Storage endpoints
		v1.GET("/pvcs", storageHandler.ListPVCs)
		v1.GET("/pvs", storageHandler.ListPVs)
		v1.GET("/storageclasses", storageHandler.ListStorageClasses)

		// RBAC endpoints
		v1.GET("/serviceaccounts", rbacHandler.ListServiceAccounts)
		v1.GET("/roles", rbacHandler.ListRoles)
		v1.GET("/rolebindings", rbacHandler.ListRoleBindings)
		v1.GET("/clusterroles", rbacHandler.ListClusterRoles)
		v1.GET("/clusterrolebindings", rbacHandler.ListClusterRoleBindings)

		// Cluster endpoints
		v1.GET("/hpa", clusterHandler.ListHPA)
		v1.GET("/events", clusterHandler.ListEvents)

		// Tunnel endpoints (port forwarding)
		v1.POST("/tunnels", tunnelHandler.CreateTunnel)
		v1.GET("/tunnels", tunnelHandler.ListTunnels)
		v1.GET("/tunnels/:id", tunnelHandler.GetTunnel)
		v1.DELETE("/tunnels/:id", tunnelHandler.DeleteTunnel)

		// Helm endpoints
		v1.GET("/helm/releases", helmHandler.ListReleases)
		v1.GET("/helm/releases/:namespace/:name", helmHandler.GetRelease)
		v1.GET("/helm/releases/:namespace/:name/values", helmHandler.GetReleaseValues)
		v1.GET("/helm/releases/:namespace/:name/history", helmHandler.GetReleaseHistory)

		// ConfigMap endpoints
		v1.GET("/configmaps", configHandler.ListConfigMaps)
		v1.GET("/configmaps/:namespace/:name", configHandler.GetConfigMap)

		// Secret endpoints (secure: list only shows metadata)
		v1.GET("/secrets", configHandler.ListSecrets)
		v1.GET("/secrets/:namespace/:name", configHandler.GetSecret)
		v1.GET("/secrets/:namespace/:name/reveal", configHandler.RevealSecret)

		// YAML endpoints (generic resource editing)
		if yamlHandler != nil {
			v1.GET("/yaml/:resourceType/:namespace/:name", yamlHandler.GetYAML)
			v1.PUT("/yaml/:resourceType/:namespace/:name", yamlHandler.ApplyYAML)
		}

		// Legacy access endpoint (backward compatibility)
		v1.POST("/access/generate", accessHandler.GenerateKubeconfig)

		// Bridge access lifecycle endpoints
		v1.POST("/bridge/access", accessHandler.CreateAccess)
		v1.GET("/bridge/access", accessHandler.ListAccess)
		v1.GET("/bridge/access/:namespace/:name/kubeconfig", accessHandler.GetKubeconfig)
		v1.DELETE("/bridge/access/:namespace/:name", accessHandler.RevokeAccess)

		// Topology endpoint
		v1.GET("/bridge/topology", topologyHandler.GetTopology)

		// Dashboard endpoints
		v1.GET("/dashboard/stats", dashboardHandler.GetStats)

		// Resource Quotas
		v1.GET("/resourcequotas/:namespace", namespaceHandler.GetResourceQuotas)

		// CRD endpoints (Custom Resource Definitions)
		v1.GET("/crds", crdHandler.ListCRDGroups)
		v1.GET("/custom/:group/:version/:resource", crdHandler.ListCustomResources)

		// AWS profile endpoints (legacy - for backward compatibility)
		v1.GET("/aws/profiles", awsHandler.ListAWSProfiles)
		v1.POST("/aws/sso-login", awsHandler.SSOLogin)

		// AWS SSO sync endpoints (legacy)
		v1.GET("/aws/sso/sessions", awsHandler.ListSSOSessions)
		v1.POST("/aws/sso/sync", awsHandler.SyncSSOAccounts)
		v1.POST("/aws/sso/login", awsHandler.SSOLoginWithSession)

		// System/context AWS profile mapping (legacy)
		v1.GET("/system/context/aws-mappings", awsHandler.ListContextAWSMappings)
		v1.POST("/system/context/aws-profile", awsHandler.SetContextAWSProfile)

		// AWS SSO Isolated Mode (Leapp-style) - new endpoints
		// Device authorization flow
		v1.POST("/aws/sso/device/start", awsSSOHandler.StartDeviceAuth)
		v1.POST("/aws/sso/device/complete", awsSSOHandler.CompleteDeviceAuth)
		v1.GET("/aws/sso/device/status", awsSSOHandler.CheckAuthStatus)

		// Session management (Bridge-managed, isolated from ~/.aws/config)
		v1.GET("/aws/sso/bridge/sessions", awsSSOHandler.ListSessions)
		v1.POST("/aws/sso/bridge/sessions", awsSSOHandler.AddSession)
		v1.POST("/aws/sso/bridge/sessions/:name/sync", awsSSOHandler.SyncSession)
		v1.DELETE("/aws/sso/bridge/sessions/:name", awsSSOHandler.DeleteSession)

		// Context to AWS role mapping (Bridge-managed)
		v1.GET("/aws/sso/bridge/context-mappings", awsSSOHandler.ListContextMappings)
		v1.POST("/aws/sso/bridge/context-mapping", awsSSOHandler.MapContext)
		// Use wildcard (*) to capture context names containing slashes (e.g., ARNs)
		v1.DELETE("/aws/sso/bridge/context-mapping/*contextName", awsSSOHandler.DeleteContextMapping)

		// Native EKS token generation (bypasses aws-iam-authenticator)
		v1.POST("/aws/sso/eks-token", awsSSOHandler.GenerateEKSToken)

		// Debug endpoint for troubleshooting auth issues
		// Use wildcard (*) to capture context names containing slashes (e.g., ARNs)
		v1.GET("/aws/sso/debug/*contextName", awsSSOHandler.DebugContextAuth)
	}

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
}
