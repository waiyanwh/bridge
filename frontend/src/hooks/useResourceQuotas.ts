import { useQuery } from '@tanstack/react-query'
import { fetchResourceQuotas, type ResourceQuotasResponse } from '@/api'

export function useResourceQuotas(namespace: string) {
    return useQuery<ResourceQuotasResponse, Error>({
        queryKey: ['resourcequotas', namespace],
        queryFn: () => fetchResourceQuotas(namespace),
        enabled: !!namespace,
    })
}
