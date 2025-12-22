package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/api"
	"github.com/waiyan/bridge/internal/janitor"
	"github.com/waiyan/bridge/internal/k8s"
)

//go:embed dist/*
var frontendFS embed.FS

func main() {
	// Initialize Kubernetes ClientManager (supports dynamic context switching)
	// Uses lazy connection: if SSO token is expired, app still starts and will retry on first request
	clientManager, err := k8s.NewClientManager()
	if err != nil {
		// Only fatal errors (e.g., no kubeconfig file) will reach here
		log.Printf("ERROR: Failed to initialize Kubernetes client: %v", err)
		log.Printf("Hint: Ensure your kubeconfig is available at ~/.kube/config or set KUBECONFIG environment variable")
		os.Exit(1)
	}

	// Log cluster info if available (may be empty if connection failed)
	contextName, clusterName, serverURL := clientManager.GetClusterInfo()
	if serverURL != "" {
		log.Printf("Successfully connected to Kubernetes cluster: %s (context: %s, server: %s)", clusterName, contextName, serverURL)
	} else {
		log.Printf("⚠️ Kubernetes client initialized but not connected (will connect on first request)")
	}

	// Create K8s service wrapper
	k8sService := k8s.NewService(clientManager)

	// Start the Janitor (cleanup worker) - runs every 10 minutes
	accessJanitor := janitor.New(k8sService, 10*time.Minute)
	accessJanitor.Start()

	// Initialize Gin router
	router := gin.Default()

	// Setup API routes
	api.SetupRoutes(router, k8sService)

	// Serve embedded frontend (SPA)
	setupFrontend(router)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Bridge on http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// setupFrontend configures the router to serve the embedded frontend SPA
func setupFrontend(router *gin.Engine) {
	// Get the dist subdirectory from embedded filesystem
	distFS, err := fs.Sub(frontendFS, "dist")
	if err != nil {
		log.Printf("Warning: Frontend assets not embedded (run 'npm run build' in frontend first): %v", err)
		return
	}

	// Create a file server for the embedded filesystem
	fileServer := http.FileServer(http.FS(distFS))

	// Serve the frontend for all non-API routes
	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Don't serve frontend for API routes or WebSocket
		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/ws/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}

		// Try to serve the file directly
		// Remove leading slash for file lookup
		filePath := strings.TrimPrefix(path, "/")
		if filePath == "" {
			filePath = "index.html"
		}

		// Check if file exists in the embedded fs
		if file, err := distFS.Open(filePath); err == nil {
			file.Close()
			// Serve the actual file
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		// For SPA: serve index.html for all other routes
		indexFile, err := distFS.Open("index.html")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Frontend not found"})
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		http.ServeContent(c.Writer, c.Request, "index.html", stat.ModTime(), indexFile.(interface{ io.ReadSeeker }).(io.ReadSeeker))
	})

	log.Println("Frontend embedded and serving from /")
}
