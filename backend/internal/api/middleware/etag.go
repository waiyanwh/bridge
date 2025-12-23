package middleware

import (
	"bytes"
	"crypto/md5"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// etagResponseWriter intercepts the response to calculate ETag
type etagResponseWriter struct {
	gin.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (w *etagResponseWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *etagResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
}

// ETag middleware implements HTTP ETag caching to reduce bandwidth.
// It calculates an MD5 hash of the response body and returns 304 Not Modified
// if the client's If-None-Match header matches the calculated ETag.
//
// This middleware should NOT be applied to:
// - WebSocket endpoints (they don't return regular HTTP responses)
// - Non-GET requests (ETags are primarily for cacheable GET responses)
func ETag() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only apply to GET requests
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		// Skip WebSocket upgrade requests
		if strings.ToLower(c.GetHeader("Upgrade")) == "websocket" {
			c.Next()
			return
		}

		// Skip known WebSocket/streaming endpoints by path
		path := c.Request.URL.Path
		if strings.Contains(path, "/logs") ||
			strings.Contains(path, "/exec") ||
			strings.Contains(path, "/stream") {
			c.Next()
			return
		}

		// Create a custom response writer to capture the response
		blw := &etagResponseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBufferString(""),
			statusCode:     http.StatusOK,
		}
		c.Writer = blw

		// Process the request
		c.Next()

		// Skip ETag for error responses or empty bodies
		if blw.statusCode >= 400 || blw.body.Len() == 0 {
			// Write original response
			blw.ResponseWriter.WriteHeader(blw.statusCode)
			blw.ResponseWriter.Write(blw.body.Bytes())
			return
		}

		// Calculate ETag from response body
		hash := md5.Sum(blw.body.Bytes())
		etag := fmt.Sprintf("\"%x\"", hash)

		// Check If-None-Match header from client
		clientETag := c.GetHeader("If-None-Match")
		if clientETag == etag {
			// Data hasn't changed - return 304 Not Modified with no body
			c.Writer = blw.ResponseWriter
			c.Header("ETag", etag)
			c.Header("Cache-Control", "private, must-revalidate")
			c.AbortWithStatus(http.StatusNotModified)
			return
		}

		// Data has changed - set ETag header and write the response
		blw.ResponseWriter.Header().Set("ETag", etag)
		blw.ResponseWriter.Header().Set("Cache-Control", "private, must-revalidate")
		blw.ResponseWriter.WriteHeader(blw.statusCode)
		blw.ResponseWriter.Write(blw.body.Bytes())
	}
}
