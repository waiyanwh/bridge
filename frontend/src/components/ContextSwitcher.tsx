import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, Check, Server, AlertCircle, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = '/api/v1'

interface ContextInfo {
    name: string
    cluster: string
    user: string
    namespace: string
    isCurrent: boolean
}

interface ContextState {
    contexts: ContextInfo[]
    currentContext: string
    currentCluster: string
    currentServer: string
    isLoading: boolean
    isSwitching: boolean
    error: string | null
}

export function ContextSwitcher({ isExpanded }: { isExpanded: boolean }) {
    const [state, setState] = useState<ContextState>({
        contexts: [],
        currentContext: '',
        currentCluster: '',
        currentServer: '',
        isLoading: true,
        isSwitching: false,
        error: null,
    })
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)

    const fetchContexts = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/contexts`)
            if (!response.ok) throw new Error('Failed to fetch contexts')
            const data = await response.json()
            setState(prev => ({
                ...prev,
                contexts: data.contexts || [],
                currentContext: data.currentContext,
                currentCluster: data.currentCluster,
                currentServer: data.currentServer,
                isLoading: false,
                error: null,
            }))
        } catch (err) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            }))
        }
    }, [])

    useEffect(() => {
        fetchContexts()
    }, [fetchContexts])

    // Clear search when dropdown closes and focus input when opens
    useEffect(() => {
        if (isOpen) {
            // Focus the search input after a small delay to ensure it's rendered
            setTimeout(() => {
                searchInputRef.current?.focus()
            }, 50)
        } else {
            setSearchQuery('')
        }
    }, [isOpen])

    // Keyboard shortcut: Cmd+Shift+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleSwitch = async (contextName: string) => {
        if (contextName === state.currentContext) {
            setIsOpen(false)
            return
        }

        setState(prev => ({ ...prev, isSwitching: true }))

        try {
            const response = await fetch(`${API_BASE}/contexts/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contextName }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Failed to switch context')
            }

            // Refresh contexts to get updated state
            await fetchContexts()
            setIsOpen(false)

            // Reload the page to refresh all data
            window.location.reload()
        } catch (err) {
            setState(prev => ({
                ...prev,
                isSwitching: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            }))
        }
    }

    // Filter contexts based on search query
    const filteredContexts = state.contexts.filter(ctx => {
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase()
        return ctx.name.toLowerCase().includes(query) ||
            ctx.cluster.toLowerCase().includes(query)
    })

    if (state.isLoading) {
        return (
            <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isExpanded && <span className="text-xs">Loading...</span>}
                </div>
            </div>
        )
    }

    if (state.error) {
        return (
            <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    {isExpanded && <span className="text-xs truncate">{state.error}</span>}
                </div>
            </div>
        )
    }

    // Display cluster name from API (not context name)
    const displayName = state.currentCluster || state.currentContext || 'Unknown'
    const contextName = state.currentContext || ''

    return (
        <div className="relative">
            {/* Switching Overlay */}
            {state.isSwitching && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <Loader2 className="h-10 w-10 animate-spin" />
                        <span className="text-lg font-medium">Switching cluster...</span>
                    </div>
                </div>
            )}

            {/* Context Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                    "hover:bg-zinc-800/50 text-left",
                    isOpen && "bg-zinc-800/50"
                )}
            >
                <div className="h-8 w-8 shrink-0 rounded-md bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Server className="h-4 w-4 text-emerald-400" />
                </div>
                {isExpanded && (
                    <>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{contextName}</div>
                        </div>
                        <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isOpen && "rotate-180"
                        )} />
                    </>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className={cn(
                        "absolute z-50 mt-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden",
                        isExpanded ? "left-0 right-0" : "left-full ml-2 top-0 w-72"
                    )}>
                        {/* Header */}
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-zinc-800">
                            Switch Cluster <span className="text-muted-foreground/50">⌘⇧K</span>
                        </div>

                        {/* Search Input - Sticky */}
                        <div className="sticky top-0 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search clusters..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                                />
                            </div>
                        </div>

                        {/* Context List */}
                        <div className="max-h-60 overflow-y-auto py-1">
                            {filteredContexts.length === 0 ? (
                                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                    No clusters found
                                </div>
                            ) : (
                                filteredContexts.map(ctx => (
                                    <button
                                        key={ctx.name}
                                        onClick={() => handleSwitch(ctx.name)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                                            "hover:bg-zinc-800",
                                            ctx.isCurrent && "bg-zinc-800/50"
                                        )}
                                    >
                                        <div className="w-4 h-4 flex items-center justify-center">
                                            {ctx.isCurrent && <Check className="h-4 w-4 text-emerald-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "text-sm font-medium truncate",
                                                ctx.isCurrent && "text-emerald-400"
                                            )}>
                                                {ctx.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {ctx.cluster}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
