import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    fetchAWSProfiles,
    fetchContextAWSMappings,
    setContextAWSProfile,
    triggerSSOLogin,
    fetchSSOSessions,
    syncSSOAccounts,
    triggerSSOSessionLogin,
    // Bridge-managed (isolated) APIs
    startDeviceAuth,
    completeDeviceAuth,
    checkAuthStatus,
    fetchBridgeSessions,
    addBridgeSession,
    syncBridgeSession,
    deleteBridgeSession,
    fetchBridgeContextMappings,
    mapContextToRole,
    deleteContextMapping,
    type AWSProfilesResponse,
    type ContextAWSMappingsResponse,
    type SSOSessionsResponse,
    type SSOSyncRequest,
    type SSOSessionLoginRequest,
    type DeviceAuthRequest,
    type CompleteAuthRequest,
    type BridgeSessionsResponse,
    type AddSessionRequest,
    type BridgeContextMappingsResponse,
    type ContextMappingRequest,
} from '@/api'

// ================== Legacy hooks (backward compatibility) ==================

export function useAWSProfiles() {
    return useQuery<AWSProfilesResponse, Error>({
        queryKey: ['aws-profiles'],
        queryFn: fetchAWSProfiles,
        staleTime: 60000, // Profiles don't change often
    })
}

export function useContextAWSMappings() {
    return useQuery<ContextAWSMappingsResponse, Error>({
        queryKey: ['context-aws-mappings'],
        queryFn: fetchContextAWSMappings,
        refetchInterval: false, // No auto-refresh needed
    })
}

export function useSetContextAWSProfile() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ contextName, awsProfile }: { contextName: string; awsProfile: string }) =>
            setContextAWSProfile(contextName, awsProfile),
        onSuccess: () => {
            // Invalidate mappings to refresh the data
            queryClient.invalidateQueries({ queryKey: ['context-aws-mappings'] })
        },
    })
}

export function useSSOLogin() {
    return useMutation({
        mutationFn: (profile: string) => triggerSSOLogin(profile),
    })
}

export function useSSOSessions() {
    return useQuery<SSOSessionsResponse, Error>({
        queryKey: ['sso-sessions'],
        queryFn: fetchSSOSessions,
        staleTime: 60000,
    })
}

export function useSyncSSOAccounts() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (req?: SSOSyncRequest) => syncSSOAccounts(req),
        onSuccess: () => {
            // Invalidate profiles to refresh the list
            queryClient.invalidateQueries({ queryKey: ['aws-profiles'] })
        },
    })
}

export function useSSOSessionLogin() {
    return useMutation({
        mutationFn: (req: SSOSessionLoginRequest) => triggerSSOSessionLogin(req),
    })
}

// ================== Bridge-Managed (Isolated Mode) hooks ==================

export function useStartDeviceAuth() {
    return useMutation({
        mutationFn: (req: DeviceAuthRequest) => startDeviceAuth(req),
    })
}

export function useCompleteDeviceAuth() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (req: CompleteAuthRequest) => completeDeviceAuth(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] })
        },
    })
}

export function useCheckAuthStatus(startUrl: string, enabled: boolean = false) {
    return useQuery({
        queryKey: ['auth-status', startUrl],
        queryFn: () => checkAuthStatus(startUrl),
        enabled,
        refetchInterval: enabled ? 3000 : false, // Poll every 3 seconds when enabled
    })
}

export function useBridgeSessions() {
    return useQuery<BridgeSessionsResponse, Error>({
        queryKey: ['bridge-sessions'],
        queryFn: fetchBridgeSessions,
        staleTime: 30000,
    })
}

export function useAddBridgeSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (req: AddSessionRequest) => addBridgeSession(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] })
        },
    })
}

export function useSyncBridgeSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (sessionName: string) => syncBridgeSession(sessionName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] })
        },
    })
}

export function useDeleteBridgeSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (sessionName: string) => deleteBridgeSession(sessionName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] })
        },
    })
}

export function useBridgeContextMappings() {
    return useQuery<BridgeContextMappingsResponse, Error>({
        queryKey: ['bridge-context-mappings'],
        queryFn: fetchBridgeContextMappings,
        staleTime: 30000,
    })
}

export function useMapContextToRole() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (req: ContextMappingRequest) => mapContextToRole(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-context-mappings'] })
        },
    })
}

export function useDeleteContextMapping() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (contextName: string) => deleteContextMapping(contextName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bridge-context-mappings'] })
        },
    })
}

