import { useQuery } from '@tanstack/react-query'
import {
    fetchDeployments,
    fetchStatefulSets,
    fetchDaemonSets,
    fetchCronJobs,
    type DeploymentsResponse,
    type StatefulSetsResponse,
    type DaemonSetsResponse,
    type CronJobsResponse
} from '@/api'

export function useDeployments(namespace: string = 'default') {
    return useQuery<DeploymentsResponse, Error>({
        queryKey: ['deployments', namespace],
        queryFn: () => fetchDeployments(namespace),
        refetchInterval: 10000,
    })
}

export function useStatefulSets(namespace: string = 'default') {
    return useQuery<StatefulSetsResponse, Error>({
        queryKey: ['statefulsets', namespace],
        queryFn: () => fetchStatefulSets(namespace),
        refetchInterval: 10000,
    })
}

export function useDaemonSets(namespace: string = 'default') {
    return useQuery<DaemonSetsResponse, Error>({
        queryKey: ['daemonsets', namespace],
        queryFn: () => fetchDaemonSets(namespace),
        refetchInterval: 10000,
    })
}

export function useCronJobs(namespace: string = 'default') {
    return useQuery<CronJobsResponse, Error>({
        queryKey: ['cronjobs', namespace],
        queryFn: () => fetchCronJobs(namespace),
        refetchInterval: 10000,
    })
}
