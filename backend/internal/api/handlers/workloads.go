package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// WorkloadHandler handles workload-related HTTP requests
type WorkloadHandler struct {
	k8sService *k8s.Service
}

// NewWorkloadHandler creates a new WorkloadHandler
func NewWorkloadHandler(k8sService *k8s.Service) *WorkloadHandler {
	return &WorkloadHandler{
		k8sService: k8sService,
	}
}

// DeploymentInfo represents a Deployment
type DeploymentInfo struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	Replicas     string            `json:"replicas"` // "ready/desired"
	ReadyCount   int32             `json:"readyCount"`
	DesiredCount int32             `json:"desiredCount"`
	Images       []string          `json:"images"`
	Age          string            `json:"age"`
	Selector     map[string]string `json:"selector,omitempty"`
}

// StatefulSetInfo represents a StatefulSet
type StatefulSetInfo struct {
	Name         string   `json:"name"`
	Namespace    string   `json:"namespace"`
	Replicas     string   `json:"replicas"`
	ReadyCount   int32    `json:"readyCount"`
	DesiredCount int32    `json:"desiredCount"`
	Images       []string `json:"images"`
	Age          string   `json:"age"`
}

// DaemonSetInfo represents a DaemonSet
type DaemonSetInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Desired   int32    `json:"desired"`
	Current   int32    `json:"current"`
	Ready     int32    `json:"ready"`
	Available int32    `json:"available"`
	Images    []string `json:"images"`
	Age       string   `json:"age"`
}

// CronJobInfo represents a CronJob
type CronJobInfo struct {
	Name             string `json:"name"`
	Namespace        string `json:"namespace"`
	Schedule         string `json:"schedule"`
	LastScheduleTime string `json:"lastScheduleTime"`
	Suspend          bool   `json:"suspend"`
	Active           int    `json:"active"`
	Age              string `json:"age"`
}

// ListDeploymentsResponse response for listing deployments
type ListDeploymentsResponse struct {
	Deployments []DeploymentInfo `json:"deployments"`
	Namespace   string           `json:"namespace"`
	Count       int              `json:"count"`
}

// ListStatefulSetsResponse response for listing statefulsets
type ListStatefulSetsResponse struct {
	StatefulSets []StatefulSetInfo `json:"statefulSets"`
	Namespace    string            `json:"namespace"`
	Count        int               `json:"count"`
}

// ListDaemonSetsResponse response for listing daemonsets
type ListDaemonSetsResponse struct {
	DaemonSets []DaemonSetInfo `json:"daemonSets"`
	Namespace  string          `json:"namespace"`
	Count      int             `json:"count"`
}

// ListCronJobsResponse response for listing cronjobs
type ListCronJobsResponse struct {
	CronJobs  []CronJobInfo `json:"cronJobs"`
	Namespace string        `json:"namespace"`
	Count     int           `json:"count"`
}

// ListDeployments handles GET /api/v1/deployments
func (h *WorkloadHandler) ListDeployments(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	var deployments *metav1.PartialObjectMetadataList
	var err error

	listOpts := metav1.ListOptions{}

	if namespace == "" || namespace == "all" {
		clientset, err := h.k8sService.GetClientset()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, ErrorResponse{
				Error:   "CLIENT_NOT_READY",
				Message: err.Error(),
			})
			return
		}

		deploymentList, listErr := clientset.AppsV1().Deployments("").List(context.Background(), listOpts)
		if listErr != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "KUBERNETES_ERROR",
				Message: listErr.Error(),
			})
			return
		}

		result := make([]DeploymentInfo, 0, len(deploymentList.Items))
		for _, d := range deploymentList.Items {
			images := make([]string, 0)
			for _, container := range d.Spec.Template.Spec.Containers {
				images = append(images, container.Image)
			}

			result = append(result, DeploymentInfo{
				Name:         d.Name,
				Namespace:    d.Namespace,
				Replicas:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, *d.Spec.Replicas),
				ReadyCount:   d.Status.ReadyReplicas,
				DesiredCount: *d.Spec.Replicas,
				Images:       images,
				Age:          formatAge(d.CreationTimestamp.Time),
				Selector:     d.Spec.Selector.MatchLabels,
			})
		}

		c.JSON(http.StatusOK, ListDeploymentsResponse{
			Deployments: result,
			Namespace:   "all",
			Count:       len(result),
		})
		return
	}

	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	deploymentList, err := clientset.AppsV1().Deployments(namespace).List(context.Background(), listOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	_ = deployments // unused variable fix

	result := make([]DeploymentInfo, 0, len(deploymentList.Items))
	for _, d := range deploymentList.Items {
		images := make([]string, 0)
		for _, container := range d.Spec.Template.Spec.Containers {
			images = append(images, container.Image)
		}

		replicas := int32(0)
		if d.Spec.Replicas != nil {
			replicas = *d.Spec.Replicas
		}

		result = append(result, DeploymentInfo{
			Name:         d.Name,
			Namespace:    d.Namespace,
			Replicas:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, replicas),
			ReadyCount:   d.Status.ReadyReplicas,
			DesiredCount: replicas,
			Images:       images,
			Age:          formatAge(d.CreationTimestamp.Time),
			Selector:     d.Spec.Selector.MatchLabels,
		})
	}

	c.JSON(http.StatusOK, ListDeploymentsResponse{
		Deployments: result,
		Namespace:   namespace,
		Count:       len(result),
	})
}

// ListStatefulSets handles GET /api/v1/statefulsets
func (h *WorkloadHandler) ListStatefulSets(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	listOpts := metav1.ListOptions{}
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

	statefulSetList, err := clientset.AppsV1().StatefulSets(ns).List(context.Background(), listOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]StatefulSetInfo, 0, len(statefulSetList.Items))
	for _, s := range statefulSetList.Items {
		images := make([]string, 0)
		for _, container := range s.Spec.Template.Spec.Containers {
			images = append(images, container.Image)
		}

		replicas := int32(0)
		if s.Spec.Replicas != nil {
			replicas = *s.Spec.Replicas
		}

		result = append(result, StatefulSetInfo{
			Name:         s.Name,
			Namespace:    s.Namespace,
			Replicas:     fmt.Sprintf("%d/%d", s.Status.ReadyReplicas, replicas),
			ReadyCount:   s.Status.ReadyReplicas,
			DesiredCount: replicas,
			Images:       images,
			Age:          formatAge(s.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListStatefulSetsResponse{
		StatefulSets: result,
		Namespace:    displayNs,
		Count:        len(result),
	})
}

// ListDaemonSets handles GET /api/v1/daemonsets
func (h *WorkloadHandler) ListDaemonSets(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	listOpts := metav1.ListOptions{}
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

	daemonSetList, err := clientset.AppsV1().DaemonSets(ns).List(context.Background(), listOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]DaemonSetInfo, 0, len(daemonSetList.Items))
	for _, ds := range daemonSetList.Items {
		images := make([]string, 0)
		for _, container := range ds.Spec.Template.Spec.Containers {
			images = append(images, container.Image)
		}

		result = append(result, DaemonSetInfo{
			Name:      ds.Name,
			Namespace: ds.Namespace,
			Desired:   ds.Status.DesiredNumberScheduled,
			Current:   ds.Status.CurrentNumberScheduled,
			Ready:     ds.Status.NumberReady,
			Available: ds.Status.NumberAvailable,
			Images:    images,
			Age:       formatAge(ds.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListDaemonSetsResponse{
		DaemonSets: result,
		Namespace:  displayNs,
		Count:      len(result),
	})
}

// ListCronJobs handles GET /api/v1/cronjobs
func (h *WorkloadHandler) ListCronJobs(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")

	listOpts := metav1.ListOptions{}
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

	cronJobList, err := clientset.BatchV1().CronJobs(ns).List(context.Background(), listOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]CronJobInfo, 0, len(cronJobList.Items))
	for _, cj := range cronJobList.Items {
		lastSchedule := "Never"
		if cj.Status.LastScheduleTime != nil {
			lastSchedule = formatAge(cj.Status.LastScheduleTime.Time) + " ago"
		}

		suspend := false
		if cj.Spec.Suspend != nil {
			suspend = *cj.Spec.Suspend
		}

		result = append(result, CronJobInfo{
			Name:             cj.Name,
			Namespace:        cj.Namespace,
			Schedule:         cj.Spec.Schedule,
			LastScheduleTime: lastSchedule,
			Suspend:          suspend,
			Active:           len(cj.Status.Active),
			Age:              formatAge(cj.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListCronJobsResponse{
		CronJobs:  result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// formatAge formats a time duration as a human-readable string
func formatAge(t time.Time) string {
	duration := time.Since(t)

	if duration.Hours() >= 24*365 {
		years := int(duration.Hours() / (24 * 365))
		return fmt.Sprintf("%dy", years)
	}
	if duration.Hours() >= 24 {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
	if duration.Hours() >= 1 {
		hours := int(duration.Hours())
		return fmt.Sprintf("%dh", hours)
	}
	if duration.Minutes() >= 1 {
		minutes := int(duration.Minutes())
		return fmt.Sprintf("%dm", minutes)
	}
	return fmt.Sprintf("%ds", int(duration.Seconds()))
}
