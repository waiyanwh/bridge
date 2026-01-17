import { useQuery } from '@tanstack/react-query'
import {
    fetchHPAs,
    fetchEvents,
    type HPAResponse,
    type EventsResponse
} from '@/api'

export function useHPAs(namespace: string = 'default') {
    return useQuery<HPAResponse, Error>({
        queryKey: ['hpas', namespace],
        queryFn: () => fetchHPAs(namespace),
    })
}

export function useEvents(namespace: string = 'default', fieldSelector?: string) {
    return useQuery<EventsResponse, Error>({
        queryKey: ['events', namespace, fieldSelector],
        queryFn: () => fetchEvents(namespace, fieldSelector),
    })
}
