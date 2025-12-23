import { useQuery } from '@tanstack/react-query'
import {
    fetchServiceAccounts,
    fetchRoles,
    fetchClusterRoles,
    fetchRoleBindings,
    fetchClusterRoleBindings,
    type ServiceAccountsResponse,
    type RolesResponse,
    type ClusterRolesResponse,
    type RoleBindingsResponse,
    type ClusterRoleBindingsResponse
} from '@/api'

export function useServiceAccounts(namespace: string = 'default') {
    return useQuery<ServiceAccountsResponse, Error>({
        queryKey: ['serviceaccounts', namespace],
        queryFn: () => fetchServiceAccounts(namespace),
    })
}

export function useRoles(namespace: string = 'default') {
    return useQuery<RolesResponse, Error>({
        queryKey: ['roles', namespace],
        queryFn: () => fetchRoles(namespace),
    })
}

export function useRoleBindings(namespace: string = 'default') {
    return useQuery<RoleBindingsResponse, Error>({
        queryKey: ['rolebindings', namespace],
        queryFn: () => fetchRoleBindings(namespace),
    })
}

export function useClusterRoles() {
    return useQuery<ClusterRolesResponse, Error>({
        queryKey: ['clusterroles'],
        queryFn: fetchClusterRoles,
    })
}

export function useClusterRoleBindings() {
    return useQuery<ClusterRoleBindingsResponse, Error>({
        queryKey: ['clusterrolebindings'],
        queryFn: fetchClusterRoleBindings,
    })
}
