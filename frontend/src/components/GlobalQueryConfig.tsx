import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings } from '@/context/SettingsContext'

export function GlobalQueryConfig() {
    const queryClient = useQueryClient()
    const { refreshInterval } = useSettings()

    useEffect(() => {
        // Update default options for all queries
        queryClient.setDefaultOptions({
            queries: {
                refetchInterval: refreshInterval,
                // If interval is 0 (off), refetchInterval will be 0 which disables it
            },
        })
    }, [refreshInterval, queryClient])

    return null
}
