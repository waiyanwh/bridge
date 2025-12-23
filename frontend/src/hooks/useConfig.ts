import { useQuery } from '@tanstack/react-query'
import { fetchConfigMaps, fetchSecrets, type ConfigMapsResponse, type SecretsResponse } from '@/api'

export function useConfigMaps(namespace: string = 'default') {
    return useQuery<ConfigMapsResponse, Error>({
        queryKey: ['configmaps', namespace],
        queryFn: () => fetchConfigMaps(namespace),
    })
}

export function useSecrets(namespace: string = 'default') {
    return useQuery<SecretsResponse, Error>({
        queryKey: ['secrets', namespace],
        queryFn: () => fetchSecrets(namespace),
    })
}
