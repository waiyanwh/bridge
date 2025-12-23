import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings } from '@/context/SettingsContext'

/**
 * GlobalQueryConfig sets the default refetchInterval for all queries based on:
 * 1. The refresh interval from settings
 * 2. Whether the document is visible (stops polling when tab is hidden)
 */
export function GlobalQueryConfig() {
    const queryClient = useQueryClient()
    const { refreshInterval } = useSettings()
    const [isVisible, setIsVisible] = useState(!document.hidden)

    // Track document visibility
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden)
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    // Update default options when settings or visibility changes
    useEffect(() => {
        // Only poll if interval is > 0 AND document is visible
        const effectiveInterval = refreshInterval > 0 && isVisible ? refreshInterval : false

        queryClient.setDefaultOptions({
            queries: {
                refetchInterval: effectiveInterval,
            },
        })
    }, [refreshInterval, isVisible, queryClient])

    return null
}
