import { useQuery } from '@tanstack/react-query'
import {
    fetchServices,
    fetchIngresses,
    fetchNetworkPolicies,
    type ServicesResponse,
    type IngressesResponse,
    type NetworkPoliciesResponse
} from '@/api'

export function useServices(namespace: string = 'default') {
    return useQuery<ServicesResponse, Error>({
        queryKey: ['services', namespace],
        queryFn: () => fetchServices(namespace),
        refetchInterval: 10000,
    })
}

export function useIngresses(namespace: string = 'default') {
    return useQuery<IngressesResponse, Error>({
        queryKey: ['ingresses', namespace],
        queryFn: () => fetchIngresses(namespace),
        refetchInterval: 10000,
    })
}

export function useNetworkPolicies(namespace: string = 'default') {
    return useQuery<NetworkPoliciesResponse, Error>({
        queryKey: ['networkpolicies', namespace],
        queryFn: () => fetchNetworkPolicies(namespace),
        refetchInterval: 10000,
    })
}
