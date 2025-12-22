package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/waiyan/bridge/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

var execUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// ExecHandler handles exec WebSocket connections
type ExecHandler struct {
	k8sService *k8s.Service
}

// NewExecHandler creates a new ExecHandler
func NewExecHandler(k8sService *k8s.Service) *ExecHandler {
	return &ExecHandler{
		k8sService: k8sService,
	}
}

// ResizeMessage represents a terminal resize message from the client
type ResizeMessage struct {
	Type string `json:"type"`
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

// TerminalSize implements remotecommand.TerminalSizeQueue
type TerminalSize struct {
	resizeChan chan *remotecommand.TerminalSize
}

func (t *TerminalSize) Next() *remotecommand.TerminalSize {
	size, ok := <-t.resizeChan
	if !ok {
		return nil
	}
	return size
}

// WebSocketReader wraps a websocket connection to implement io.Reader
type WebSocketReader struct {
	conn   *websocket.Conn
	mu     sync.Mutex
	sizeCh chan *remotecommand.TerminalSize
}

func (r *WebSocketReader) Read(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, message, err := r.conn.ReadMessage()
	if err != nil {
		return 0, err
	}

	// Check if it's a resize message
	var resizeMsg ResizeMessage
	if err := json.Unmarshal(message, &resizeMsg); err == nil && resizeMsg.Type == "resize" {
		// Send resize to channel
		select {
		case r.sizeCh <- &remotecommand.TerminalSize{
			Width:  resizeMsg.Cols,
			Height: resizeMsg.Rows,
		}:
		default:
		}
		// Return 0 bytes read, but no error - this isn't actual input
		return 0, nil
	}

	// Regular input
	copy(p, message)
	return len(message), nil
}

// WebSocketWriter wraps a websocket connection to implement io.Writer
type WebSocketWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (w *WebSocketWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	err := w.conn.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

// Exec handles GET /api/v1/exec WebSocket connection
// Query parameters: namespace, pod, container, command
func (h *ExecHandler) Exec(c *gin.Context) {
	namespace := c.Query("namespace")
	podName := c.Query("pod")
	container := c.Query("container")
	command := c.Query("command")

	if namespace == "" || podName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and pod are required"})
		return
	}

	// Upgrade to WebSocket
	conn, err := execUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	// Get the first container if not specified
	if container == "" {
		pod, err := h.k8sService.GetPod(c.Request.Context(), namespace, podName)
		if err != nil {
			h.sendError(conn, "Failed to get pod: "+err.Error())
			return
		}
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			h.sendError(conn, "No containers found in pod")
			return
		}
	}

	// Build command array - try shells in order of preference
	var cmdArray []string
	if command != "" {
		// If a specific command is provided, use it
		cmdArray = []string{command}
	} else {
		// Use /bin/sh -c to run a command that finds the best available shell
		// This tries bash first (best experience), then ash (Alpine), then falls back to sh
		cmdArray = []string{
			"/bin/sh", "-c",
			"if [ -x /bin/bash ]; then exec /bin/bash -l; elif [ -x /bin/ash ]; then exec /bin/ash; else exec /bin/sh; fi",
		}
	}

	// Create the exec request
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		h.sendError(conn, "Client not ready: "+err.Error())
		return
	}

	req := clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   cmdArray,
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	// Create SPDY executor
	config, err := h.k8sService.GetConfig()
	if err != nil {
		h.sendError(conn, "Config not ready: "+err.Error())
		return
	}

	exec, err := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
	if err != nil {
		h.sendError(conn, "Failed to create executor: "+err.Error())
		return
	}

	// Set up terminal size channel
	sizeCh := make(chan *remotecommand.TerminalSize, 1)
	defer close(sizeCh)

	// Send initial size
	sizeCh <- &remotecommand.TerminalSize{Width: 80, Height: 24}

	terminalSize := &TerminalSize{resizeChan: sizeCh}

	// Create readers/writers
	reader := &WebSocketReader{conn: conn, sizeCh: sizeCh}
	writer := &WebSocketWriter{conn: conn}

	// Create a done channel
	done := make(chan struct{})
	defer close(done)

	// Run the exec stream
	err = exec.StreamWithContext(c.Request.Context(), remotecommand.StreamOptions{
		Stdin:             reader,
		Stdout:            writer,
		Stderr:            writer,
		Tty:               true,
		TerminalSizeQueue: terminalSize,
	})

	if err != nil {
		log.Printf("Exec stream error: %v", err)
		h.sendError(conn, "Exec failed: "+err.Error())
	}
}

func (h *ExecHandler) sendError(conn *websocket.Conn, msg string) {
	conn.WriteMessage(websocket.TextMessage, []byte("\r\n\033[31mError: "+msg+"\033[0m\r\n"))
}

// Ensure interfaces are implemented
var _ io.Reader = (*WebSocketReader)(nil)
var _ io.Writer = (*WebSocketWriter)(nil)
