import { useQuery } from '@tanstack/react-query'
import { fetchPods, fetchPodDetail, fetchNamespaces, type NamespacesResponse } from '@/api'
import type { PodDetail, PodsResponse } from '@/types'

export function usePods(namespace: string = 'default') {
    return useQuery<PodsResponse, Error>({
        queryKey: ['pods', namespace],
        queryFn: () => fetchPods(namespace),
        refetchInterval: 10000,
    })
}

export function usePodDetail(namespace: string, name: string, enabled: boolean = true) {
    return useQuery<PodDetail, Error>({
        queryKey: ['podDetail', namespace, name],
        queryFn: () => fetchPodDetail(namespace, name),
        enabled: enabled && !!namespace && !!name,
        staleTime: 30000,
    })
}

export function useNamespaces() {
    return useQuery<NamespacesResponse, Error>({
        queryKey: ['namespaces'],
        queryFn: fetchNamespaces,
        staleTime: 60000, // 1 minute
        refetchOnMount: false,
    })
}
