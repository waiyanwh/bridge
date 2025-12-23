import { useState, useEffect } from 'react'
import { useSettings } from '@/context/SettingsContext'

/**
 * Custom hook that returns a smart refetch interval value.
 * 
 * Features:
 * - Returns false (disabled) when document is hidden (tab unfocused/minimized)
 * - Returns false when refresh interval setting is 0 (disabled)
 * - Returns the configured interval when document is visible and setting > 0
 * 
 * This prevents unnecessary API polling when the app is in the background.
 */
export function useSmartRefetchInterval(): number | false {
    const { refreshInterval } = useSettings()
    const [isVisible, setIsVisible] = useState(!document.hidden)

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden)
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    // Only poll if:
    // 1. The refresh interval setting is > 0 (not disabled)
    // 2. The document is visible (tab is focused)
    if (refreshInterval > 0 && isVisible) {
        return refreshInterval
    }

    return false
}
