import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
    value: string
    onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

interface TabsProps {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
    className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn('flex flex-col', className)}>{children}</div>
        </TabsContext.Provider>
    )
}

interface TabsListProps {
    children: React.ReactNode
    className?: string
}

export function TabsList({ children, className }: TabsListProps) {
    return (
        <div
            className={cn(
                'inline-flex h-9 items-center justify-start border-b border-border',
                className
            )}
        >
            {children}
        </div>
    )
}

interface TabsTriggerProps {
    value: string
    children: React.ReactNode
    className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error('TabsTrigger must be used within Tabs')

    const isActive = context.value === value

    return (
        <button
            onClick={() => context.onValueChange(value)}
            className={cn(
                'inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors',
                'border-b-2 -mb-px',
                isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                className
            )}
        >
            {children}
        </button>
    )
}

interface TabsContentProps {
    value: string
    children: React.ReactNode
    className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error('TabsContent must be used within Tabs')

    if (context.value !== value) return null

    return <div className={cn('flex-1', className)}>{children}</div>
}
