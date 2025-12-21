import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    fetchTunnels,
    createTunnel,
    deleteTunnel,
    type TunnelsResponse,
    type TunnelInfo,
    type CreateTunnelRequest
} from '@/api'

export function useTunnels() {
    return useQuery<TunnelsResponse, Error>({
        queryKey: ['tunnels'],
        queryFn: fetchTunnels,
        refetchInterval: 5000, // Check tunnel status frequently
    })
}

export function useCreateTunnel() {
    const queryClient = useQueryClient()

    return useMutation<TunnelInfo, Error, CreateTunnelRequest>({
        mutationFn: createTunnel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tunnels'] })
        },
    })
}

export function useDeleteTunnel() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string>({
        mutationFn: deleteTunnel,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tunnels'] })
        },
    })
}
