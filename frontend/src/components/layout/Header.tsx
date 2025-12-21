import { useState, useRef, useEffect } from 'react'
import { Server, ChevronDown, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNamespaces } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
    context?: string
    clusterName?: string
}

export function Header({
    context = 'docker-desktop',
    clusterName = 'local-cluster',
}: HeaderProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const { data: namespacesData, isLoading, refetch } = useNamespaces()
    const { selectedNamespace, setNamespace } = useNamespaceStore()
    const { showSystemNamespaces } = useSettings()

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectNamespace = (ns: string) => {
        setNamespace(ns)
        setDropdownOpen(false)
    }

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            {/* Left side - Context and Cluster info */}
            <div className="flex items-center gap-6">
                {/* Cluster Info */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Context:</span>
                        <span className="text-sm font-medium text-foreground">{context}</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Cluster:</span>
                        <span className="text-sm font-medium text-foreground">{clusterName}</span>
                    </div>
                </div>

                {/* Namespace Selector */}
                <div className="relative" ref={dropdownRef}>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-xs">
                            ns
                        </Badge>
                        <span className="text-sm">{selectedNamespace}</span>
                        {isLoading ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                            <ChevronDown className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                dropdownOpen && "rotate-180"
                            )} />
                        )}
                    </Button>

                    {/* Dropdown */}
                    {dropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[300px] overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                            {/* All Namespaces option */}
                            <button
                                className={cn(
                                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                                    selectedNamespace === 'all' && "bg-accent"
                                )}
                                onClick={() => handleSelectNamespace('all')}
                            >
                                <span className="font-medium">All Namespaces</span>
                                {selectedNamespace === 'all' && <Check className="h-4 w-4" />}
                            </button>

                            <div className="my-1 h-px bg-border" />

                            {/* Namespace list */}
                            {namespacesData?.namespaces
                                .filter(ns => showSystemNamespaces || !['kube-system', 'kube-public', 'kube-node-lease'].includes(ns))
                                .map((ns) => (
                                    <button
                                        key={ns}
                                        className={cn(
                                            "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                                            selectedNamespace === ns && "bg-accent"
                                        )}
                                        onClick={() => handleSelectNamespace(ns)}
                                    >
                                        <span className="font-mono">{ns}</span>
                                        {selectedNamespace === ns && <Check className="h-4 w-4" />}
                                    </button>
                                ))}

                            {!namespacesData && !isLoading && (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    Failed to load namespaces
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => refetch()}
                                        className="mt-2 w-full"
                                    >
                                        Retry
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-3">
                <Badge variant="success" className="gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Connected
                </Badge>
            </div>
        </header>
    )
}
