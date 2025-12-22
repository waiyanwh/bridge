import { useQuery } from '@tanstack/react-query'
import { fetchCRDGroups, fetchCustomResources } from '@/api'

export function useCRDGroups() {
    return useQuery({
        queryKey: ['crds'],
        queryFn: fetchCRDGroups,
        staleTime: 5 * 60 * 1000, // CRDs don't change often, cache for 5 minutes
    })
}

export function useCustomResources(
    group: string,
    version: string,
    resource: string,
    namespace?: string
) {
    return useQuery({
        queryKey: ['custom-resources', group, version, resource, namespace],
        queryFn: () => fetchCustomResources(group, version, resource, namespace),
        enabled: !!group && !!version && !!resource,
    })
}
