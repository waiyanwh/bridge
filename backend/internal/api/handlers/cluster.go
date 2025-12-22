package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterHandler handles cluster-wide resource requests
type ClusterHandler struct {
	k8sService *k8s.Service
}

// NewClusterHandler creates a new ClusterHandler
func NewClusterHandler(k8sService *k8s.Service) *ClusterHandler {
	return &ClusterHandler{
		k8sService: k8sService,
	}
}

// HPAInfo represents a HorizontalPodAutoscaler
type HPAInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	TargetRef       string `json:"targetRef"`
	TargetKind      string `json:"targetKind"`
	MinReplicas     int32  `json:"minReplicas"`
	MaxReplicas     int32  `json:"maxReplicas"`
	CurrentReplicas int32  `json:"currentReplicas"`
	DesiredReplicas int32  `json:"desiredReplicas"`
	Utilization     string `json:"utilization"`
	Age             string `json:"age"`
}

// EventInfo represents a Kubernetes Event
type EventInfo struct {
	Type            string `json:"type"`
	Reason          string `json:"reason"`
	ObjectKind      string `json:"objectKind"`
	ObjectName      string `json:"objectName"`
	ObjectNS        string `json:"objectNs"`
	Message         string `json:"message"`
	Count           int32  `json:"count"`
	FirstSeen       string `json:"firstSeen"`
	LastSeen        string `json:"lastSeen"`
	LastSeenAge     string `json:"lastSeenAge"`
	SourceComponent string `json:"sourceComponent"`
}

// ListHPAResponse response for listing HPAs
type ListHPAResponse struct {
	HPAs      []HPAInfo `json:"hpas"`
	Namespace string    `json:"namespace"`
	Count     int       `json:"count"`
}

// ListEventsResponse response for listing events
type ListEventsResponse struct {
	Events    []EventInfo `json:"events"`
	Namespace string      `json:"namespace"`
	Count     int         `json:"count"`
}

// ListHPA handles GET /api/v1/hpa
func (h *ClusterHandler) ListHPA(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	hpaList, err := clientset.AutoscalingV2().HorizontalPodAutoscalers(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]HPAInfo, 0, len(hpaList.Items))
	for _, hpa := range hpaList.Items {
		// Get min replicas
		minReplicas := int32(1)
		if hpa.Spec.MinReplicas != nil {
			minReplicas = *hpa.Spec.MinReplicas
		}

		// Get utilization info
		utilization := ""
		if len(hpa.Status.CurrentMetrics) > 0 {
			for _, metric := range hpa.Status.CurrentMetrics {
				if metric.Resource != nil && metric.Resource.Current.AverageUtilization != nil {
					current := *metric.Resource.Current.AverageUtilization
					// Find target for this resource
					for _, spec := range hpa.Spec.Metrics {
						if spec.Resource != nil && spec.Resource.Name == metric.Resource.Name {
							if spec.Resource.Target.AverageUtilization != nil {
								target := *spec.Resource.Target.AverageUtilization
								utilization = fmt.Sprintf("%d%% / %d%%", current, target)
								break
							}
						}
					}
					if utilization == "" {
						utilization = fmt.Sprintf("%d%%", current)
					}
					break
				}
			}
		}
		if utilization == "" {
			utilization = "-"
		}

		result = append(result, HPAInfo{
			Name:            hpa.Name,
			Namespace:       hpa.Namespace,
			TargetRef:       hpa.Spec.ScaleTargetRef.Name,
			TargetKind:      hpa.Spec.ScaleTargetRef.Kind,
			MinReplicas:     minReplicas,
			MaxReplicas:     hpa.Spec.MaxReplicas,
			CurrentReplicas: hpa.Status.CurrentReplicas,
			DesiredReplicas: hpa.Status.DesiredReplicas,
			Utilization:     utilization,
			Age:             formatAge(hpa.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListHPAResponse{
		HPAs:      result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// ListEvents handles GET /api/v1/events
func (h *ClusterHandler) ListEvents(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var ns string
	if namespace == "" || namespace == "all" {
		ns = ""
	} else {
		ns = namespace
	}

	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	eventList, err := clientset.CoreV1().Events(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Sort by LastTimestamp descending (newest first)
	sort.Slice(eventList.Items, func(i, j int) bool {
		ti := eventList.Items[i].LastTimestamp.Time
		tj := eventList.Items[j].LastTimestamp.Time
		// If LastTimestamp is zero, use EventTime
		if ti.IsZero() && eventList.Items[i].EventTime.Time.IsZero() == false {
			ti = eventList.Items[i].EventTime.Time
		}
		if tj.IsZero() && eventList.Items[j].EventTime.Time.IsZero() == false {
			tj = eventList.Items[j].EventTime.Time
		}
		return ti.After(tj)
	})

	result := make([]EventInfo, 0, len(eventList.Items))
	for _, event := range eventList.Items {
		// Get last seen time
		lastSeen := event.LastTimestamp.Time
		if lastSeen.IsZero() && !event.EventTime.Time.IsZero() {
			lastSeen = event.EventTime.Time
		}
		firstSeen := event.FirstTimestamp.Time
		if firstSeen.IsZero() {
			firstSeen = event.CreationTimestamp.Time
		}

		lastSeenAge := ""
		if !lastSeen.IsZero() {
			lastSeenAge = formatAge(lastSeen)
		}

		result = append(result, EventInfo{
			Type:            event.Type,
			Reason:          event.Reason,
			ObjectKind:      event.InvolvedObject.Kind,
			ObjectName:      event.InvolvedObject.Name,
			ObjectNS:        event.InvolvedObject.Namespace,
			Message:         event.Message,
			Count:           event.Count,
			FirstSeen:       formatAge(firstSeen),
			LastSeen:        lastSeen.Format("2006-01-02 15:04:05"),
			LastSeenAge:     lastSeenAge,
			SourceComponent: event.Source.Component,
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListEventsResponse{
		Events:    result,
		Namespace: displayNs,
		Count:     len(result),
	})
}
