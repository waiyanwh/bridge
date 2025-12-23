import { useQuery } from '@tanstack/react-query'
import { fetchNodes, type NodesResponse } from '@/api'

export function useNodes() {
    return useQuery<NodesResponse, Error>({
        queryKey: ['nodes'],
        queryFn: fetchNodes,
    })
}
