import { useQuery } from '@tanstack/react-query'
import {
    fetchHelmReleases,
    fetchHelmRelease,
    fetchHelmReleaseValues,
    fetchHelmReleaseHistory,
    type HelmReleasesResponse,
    type HelmReleaseDetail,
    type HelmValuesResponse,
    type HelmHistoryResponse
} from '@/api'

export function useHelmReleases(namespace: string = '') {
    return useQuery<HelmReleasesResponse, Error>({
        queryKey: ['helmReleases', namespace],
        queryFn: () => fetchHelmReleases(namespace),
    })
}

export function useHelmRelease(namespace: string, name: string, enabled: boolean = true) {
    return useQuery<HelmReleaseDetail, Error>({
        queryKey: ['helmRelease', namespace, name],
        queryFn: () => fetchHelmRelease(namespace, name),
        enabled: enabled && !!namespace && !!name,
    })
}

export function useHelmReleaseValues(namespace: string, name: string, enabled: boolean = true) {
    return useQuery<HelmValuesResponse, Error>({
        queryKey: ['helmReleaseValues', namespace, name],
        queryFn: () => fetchHelmReleaseValues(namespace, name),
        enabled: enabled && !!namespace && !!name,
    })
}

export function useHelmReleaseHistory(namespace: string, name: string, enabled: boolean = true) {
    return useQuery<HelmHistoryResponse, Error>({
        queryKey: ['helmReleaseHistory', namespace, name],
        queryFn: () => fetchHelmReleaseHistory(namespace, name),
        enabled: enabled && !!namespace && !!name,
    })
}
