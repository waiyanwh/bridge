import { useQuery } from '@tanstack/react-query'
import {
    fetchPVCs,
    fetchPVs,
    fetchStorageClasses,
    type PVCsResponse,
    type PVsResponse,
    type StorageClassesResponse
} from '@/api'

export function usePVCs(namespace: string = 'default') {
    return useQuery<PVCsResponse, Error>({
        queryKey: ['pvcs', namespace],
        queryFn: () => fetchPVCs(namespace),
    })
}

export function usePVs() {
    return useQuery<PVsResponse, Error>({
        queryKey: ['pvs'],
        queryFn: fetchPVs,
    })
}

export function useStorageClasses() {
    return useQuery<StorageClassesResponse, Error>({
        queryKey: ['storageclasses'],
        queryFn: fetchStorageClasses,
    })
}
