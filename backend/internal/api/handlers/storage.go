package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// StorageHandler handles storage-related HTTP requests
type StorageHandler struct {
	k8sService *k8s.Service
}

// NewStorageHandler creates a new StorageHandler
func NewStorageHandler(k8sService *k8s.Service) *StorageHandler {
	return &StorageHandler{
		k8sService: k8sService,
	}
}

// PVCInfo represents a PersistentVolumeClaim
type PVCInfo struct {
	Name         string   `json:"name"`
	Namespace    string   `json:"namespace"`
	Status       string   `json:"status"`
	Capacity     string   `json:"capacity"`
	AccessModes  []string `json:"accessModes"`
	StorageClass string   `json:"storageClass"`
	VolumeName   string   `json:"volumeName"`
	Age          string   `json:"age"`
}

// PVInfo represents a PersistentVolume
type PVInfo struct {
	Name          string   `json:"name"`
	Capacity      string   `json:"capacity"`
	AccessModes   []string `json:"accessModes"`
	ReclaimPolicy string   `json:"reclaimPolicy"`
	Status        string   `json:"status"`
	Claim         string   `json:"claim"`
	StorageClass  string   `json:"storageClass"`
	Age           string   `json:"age"`
}

// StorageClassInfo represents a StorageClass
type StorageClassInfo struct {
	Name           string `json:"name"`
	Provisioner    string `json:"provisioner"`
	ReclaimPolicy  string `json:"reclaimPolicy"`
	VolumeBinding  string `json:"volumeBinding"`
	AllowExpansion bool   `json:"allowExpansion"`
	IsDefault      bool   `json:"isDefault"`
	Age            string `json:"age"`
}

// ListPVCsResponse response for listing PVCs
type ListPVCsResponse struct {
	PVCs      []PVCInfo `json:"pvcs"`
	Namespace string    `json:"namespace"`
	Count     int       `json:"count"`
}

// ListPVsResponse response for listing PVs
type ListPVsResponse struct {
	PVs   []PVInfo `json:"pvs"`
	Count int      `json:"count"`
}

// ListStorageClassesResponse response for listing storage classes
type ListStorageClassesResponse struct {
	StorageClasses []StorageClassInfo `json:"storageClasses"`
	Count          int                `json:"count"`
}

// ListPVCs handles GET /api/v1/pvcs
func (h *StorageHandler) ListPVCs(c *gin.Context) {
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

	pvcList, err := clientset.CoreV1().PersistentVolumeClaims(ns).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]PVCInfo, 0, len(pvcList.Items))
	for _, pvc := range pvcList.Items {
		// Get capacity
		capacity := ""
		if pvc.Status.Capacity != nil {
			if qty, ok := pvc.Status.Capacity["storage"]; ok {
				capacity = qty.String()
			}
		}
		// Fallback to requested capacity if status capacity not available
		if capacity == "" && pvc.Spec.Resources.Requests != nil {
			if qty, ok := pvc.Spec.Resources.Requests["storage"]; ok {
				capacity = qty.String()
			}
		}

		// Get access modes
		accessModes := make([]string, 0, len(pvc.Spec.AccessModes))
		for _, mode := range pvc.Spec.AccessModes {
			switch mode {
			case "ReadWriteOnce":
				accessModes = append(accessModes, "RWO")
			case "ReadOnlyMany":
				accessModes = append(accessModes, "ROX")
			case "ReadWriteMany":
				accessModes = append(accessModes, "RWX")
			case "ReadWriteOncePod":
				accessModes = append(accessModes, "RWOP")
			default:
				accessModes = append(accessModes, string(mode))
			}
		}

		// Get storage class
		storageClass := ""
		if pvc.Spec.StorageClassName != nil {
			storageClass = *pvc.Spec.StorageClassName
		}

		result = append(result, PVCInfo{
			Name:         pvc.Name,
			Namespace:    pvc.Namespace,
			Status:       string(pvc.Status.Phase),
			Capacity:     capacity,
			AccessModes:  accessModes,
			StorageClass: storageClass,
			VolumeName:   pvc.Spec.VolumeName,
			Age:          formatAge(pvc.CreationTimestamp.Time),
		})
	}

	displayNs := namespace
	if namespace == "" {
		displayNs = "all"
	}

	c.JSON(http.StatusOK, ListPVCsResponse{
		PVCs:      result,
		Namespace: displayNs,
		Count:     len(result),
	})
}

// ListPVs handles GET /api/v1/pvs
func (h *StorageHandler) ListPVs(c *gin.Context) {
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	pvList, err := clientset.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]PVInfo, 0, len(pvList.Items))
	for _, pv := range pvList.Items {
		// Get capacity
		capacity := ""
		if pv.Spec.Capacity != nil {
			if qty, ok := pv.Spec.Capacity["storage"]; ok {
				capacity = qty.String()
			}
		}

		// Get access modes
		accessModes := make([]string, 0, len(pv.Spec.AccessModes))
		for _, mode := range pv.Spec.AccessModes {
			switch mode {
			case "ReadWriteOnce":
				accessModes = append(accessModes, "RWO")
			case "ReadOnlyMany":
				accessModes = append(accessModes, "ROX")
			case "ReadWriteMany":
				accessModes = append(accessModes, "RWX")
			case "ReadWriteOncePod":
				accessModes = append(accessModes, "RWOP")
			default:
				accessModes = append(accessModes, string(mode))
			}
		}

		// Get claim reference
		claim := ""
		if pv.Spec.ClaimRef != nil {
			claim = pv.Spec.ClaimRef.Namespace + "/" + pv.Spec.ClaimRef.Name
		}

		result = append(result, PVInfo{
			Name:          pv.Name,
			Capacity:      capacity,
			AccessModes:   accessModes,
			ReclaimPolicy: string(pv.Spec.PersistentVolumeReclaimPolicy),
			Status:        string(pv.Status.Phase),
			Claim:         claim,
			StorageClass:  pv.Spec.StorageClassName,
			Age:           formatAge(pv.CreationTimestamp.Time),
		})
	}

	c.JSON(http.StatusOK, ListPVsResponse{
		PVs:   result,
		Count: len(result),
	})
}

// ListStorageClasses handles GET /api/v1/storageclasses
func (h *StorageHandler) ListStorageClasses(c *gin.Context) {
	clientset, err := h.k8sService.GetClientset()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "CLIENT_NOT_READY",
			Message: err.Error(),
		})
		return
	}

	scList, err := clientset.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "KUBERNETES_ERROR",
			Message: err.Error(),
		})
		return
	}

	result := make([]StorageClassInfo, 0, len(scList.Items))
	for _, sc := range scList.Items {
		// Get reclaim policy
		reclaimPolicy := ""
		if sc.ReclaimPolicy != nil {
			reclaimPolicy = string(*sc.ReclaimPolicy)
		}

		// Get volume binding mode
		volumeBinding := ""
		if sc.VolumeBindingMode != nil {
			volumeBinding = string(*sc.VolumeBindingMode)
		}

		// Check if default
		isDefault := false
		if val, ok := sc.Annotations["storageclass.kubernetes.io/is-default-class"]; ok {
			isDefault = strings.ToLower(val) == "true"
		}

		// Allow expansion
		allowExpansion := false
		if sc.AllowVolumeExpansion != nil {
			allowExpansion = *sc.AllowVolumeExpansion
		}

		result = append(result, StorageClassInfo{
			Name:           sc.Name,
			Provisioner:    sc.Provisioner,
			ReclaimPolicy:  reclaimPolicy,
			VolumeBinding:  volumeBinding,
			AllowExpansion: allowExpansion,
			IsDefault:      isDefault,
			Age:            formatAge(sc.CreationTimestamp.Time),
		})
	}

	c.JSON(http.StatusOK, ListStorageClassesResponse{
		StorageClasses: result,
		Count:          len(result),
	})
}
