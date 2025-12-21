import * as React from 'react'
import { useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, Box, Server, Layers, Settings, X, HardDrive, FileText, Lock, Database, Network, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNamespaces } from '@/hooks'
import { useNamespaceStore } from '@/store'

interface CommandPaletteProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface CommandItem {
    id: string
    label: string
    icon: React.ElementType
    path: string
    keywords?: string[]
}

const navigationItems: CommandItem[] = [
    { id: 'pods', label: 'Pods', icon: Box, path: '/pods', keywords: ['workloads', 'containers'] },
    { id: 'deployments', label: 'Deployments', icon: Server, path: '/deployments', keywords: ['workloads', 'replicas'] },
    { id: 'services', label: 'Services', icon: Layers, path: '/services', keywords: ['networking', 'load balancer'] },
    { id: 'nodes', label: 'Nodes', icon: HardDrive, path: '/nodes', keywords: ['cluster', 'machines', 'servers'] },
    { id: 'configmaps', label: 'ConfigMaps', icon: FileText, path: '/configmaps', keywords: ['config', 'configuration', 'env'] },
    { id: 'secrets', label: 'Secrets', icon: Lock, path: '/secrets', keywords: ['credentials', 'passwords', 'keys'] },
    { id: 'pvcs', label: 'PVCs', icon: Database, path: '/pvcs', keywords: ['storage', 'volumes', 'persistent'] },
    { id: 'ingresses', label: 'Ingresses', icon: Network, path: '/ingresses', keywords: ['routes', 'hosts', 'networking'] },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', keywords: ['preferences'] },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const [search, setSearch] = React.useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const navigate = useNavigate()
    const location = useLocation()

    // Data for namespaces
    const { data: nsData } = useNamespaces()
    const { setNamespace } = useNamespaceStore()

    // Focus input when palette opens
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                inputRef.current?.focus()
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [open])

    // Handle keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onOpenChange(!open)
            }
            if (e.key === 'Escape') {
                onOpenChange(false)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [open, onOpenChange])

    const handleSelect = useCallback((path: string) => {
        onOpenChange(false)
        setSearch('')
        navigate(path)
    }, [onOpenChange, navigate])

    const handleNamespaceSelect = useCallback((ns: string) => {
        onOpenChange(false)
        setSearch('')
        setNamespace(ns)
        navigate(`/namespaces/${ns}`)
    }, [onOpenChange, setNamespace, navigate])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />

            {/* Command palette */}
            <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2">
                <CommandPrimitive
                    className="rounded-lg border border-border bg-background shadow-2xl"
                    loop
                >
                    {/* Search input */}
                    <div className="flex items-center border-b border-border px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <CommandPrimitive.Input
                            ref={inputRef}
                            value={search}
                            onValueChange={setSearch}
                            placeholder="Type a command or search..."
                            className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            autoFocus
                        />
                        <button
                            onClick={() => onOpenChange(false)}
                            className="ml-2 rounded p-1 hover:bg-muted"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Command list */}
                    <CommandPrimitive.List className="max-h-[300px] overflow-y-auto p-2">
                        <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </CommandPrimitive.Empty>

                        <CommandPrimitive.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            {navigationItems.map((item) => (
                                <CommandPrimitive.Item
                                    key={item.id}
                                    value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                                    onSelect={() => handleSelect(item.path)}
                                    className={cn(
                                        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
                                        'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                                        'hover:bg-accent hover:text-accent-foreground',
                                        location.pathname === item.path && 'bg-muted'
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                    {location.pathname === item.path && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            Current
                                        </span>
                                    )}
                                </CommandPrimitive.Item>
                            ))}
                        </CommandPrimitive.Group>

                        {nsData && nsData.namespaces.length > 0 && (
                            <>
                                <CommandPrimitive.Separator className="my-1 h-px bg-border" />
                                <CommandPrimitive.Group heading="Switch Namespace" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                    {nsData.namespaces.map((ns) => (
                                        <CommandPrimitive.Item
                                            key={ns}
                                            value={`namespace ${ns}`}
                                            onSelect={() => handleNamespaceSelect(ns)}
                                            className={cn(
                                                'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
                                                'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                                                'hover:bg-accent hover:text-accent-foreground'
                                            )}
                                        >
                                            <Circle className="h-3 w-3" />
                                            <span>{ns}</span>
                                        </CommandPrimitive.Item>
                                    ))}
                                </CommandPrimitive.Group>
                            </>
                        )}
                    </CommandPrimitive.List>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd>
                            <span>Navigate</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd>
                            <span>Select</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Esc</kbd>
                            <span>Close</span>
                        </div>
                    </div>
                </CommandPrimitive>
            </div>
        </div>
    )
}

