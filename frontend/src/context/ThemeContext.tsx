import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'bridge'

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'bridge_theme'
const DEFAULT_THEME: Theme = 'bridge'

// Apply theme class to the HTML element
function applyTheme(theme: Theme) {
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-bridge')

    // Add the new theme class
    root.classList.add(`theme-${theme}`)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Initialize theme from localStorage or default
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
        if (saved && ['light', 'dark', 'bridge'].includes(saved)) {
            return saved
        }
        return DEFAULT_THEME
    })

    // Apply theme on mount and when it changes
    useEffect(() => {
        applyTheme(theme)
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    }, [theme])

    // Memoized setter
    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
