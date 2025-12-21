import React, { createContext, useContext, useState, useEffect } from 'react'

interface SettingsContextType {
    refreshInterval: number
    setRefreshInterval: (interval: number) => void
    showSystemNamespaces: boolean
    setShowSystemNamespaces: (show: boolean) => void
    tableDensity: 'compact' | 'normal'
    setTableDensity: (density: 'compact' | 'normal') => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    // Load initial values from localStorage or defaults
    const [refreshInterval, setRefreshIntervalState] = useState(() => {
        const saved = localStorage.getItem('bridge_refreshInterval')
        return saved ? parseInt(saved, 10) : 10000
    })

    const [showSystemNamespaces, setShowSystemNamespacesState] = useState(() => {
        const saved = localStorage.getItem('bridge_showSystemNamespaces')
        return saved === 'true'
    })

    const [tableDensity, setTableDensityState] = useState<'compact' | 'normal'>(() => {
        const saved = localStorage.getItem('bridge_tableDensity')
        return (saved === 'compact' || saved === 'normal') ? saved : 'normal'
    })

    // Auto-save effects
    useEffect(() => {
        localStorage.setItem('bridge_refreshInterval', refreshInterval.toString())
    }, [refreshInterval])

    useEffect(() => {
        localStorage.setItem('bridge_showSystemNamespaces', showSystemNamespaces.toString())
    }, [showSystemNamespaces])

    useEffect(() => {
        localStorage.setItem('bridge_tableDensity', tableDensity.toString())
    }, [tableDensity])

    // Wrappers to update state
    const setRefreshInterval = (val: number) => setRefreshIntervalState(val)
    const setShowSystemNamespaces = (val: boolean) => setShowSystemNamespacesState(val)
    const setTableDensity = (val: 'compact' | 'normal') => setTableDensityState(val)

    return (
        <SettingsContext.Provider value={{
            refreshInterval,
            setRefreshInterval,
            showSystemNamespaces,
            setShowSystemNamespaces,
            tableDensity,
            setTableDensity,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
