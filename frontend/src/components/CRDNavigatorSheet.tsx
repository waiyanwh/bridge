import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Puzzle, ChevronDown, ChevronRight, X } from 'lucide-react'
import {
    Sheet,
    SheetContent,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCRDGroups } from '@/hooks'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export function CRDNavigatorSheet() {
    const navigate = useNavigate()
    const { isCRDSheetOpen, closeCRDSheet } = useUIStore()
    const { data: crdGroups, isLoading } = useCRDGroups()

    const [searchQuery, setSearchQuery] = useState('')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Focus search input when sheet opens
    useEffect(() => {
        if (isCRDSheetOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus()
            }, 100)
        } else {
            // Reset state when closed
            setSearchQuery('')
        }
    }, [isCRDSheetOpen])

    // Filter groups and resources based on search query
    const filteredGroups = useMemo(() => {
        if (!crdGroups) return []
        if (!searchQuery.trim()) return crdGroups

        const query = searchQuery.toLowerCase()
        return crdGroups
            .map(group => {
                const groupMatches = group.group.toLowerCase().includes(query)
                const matchingResources = group.resources.filter(
                    r => r.kind.toLowerCase().includes(query) ||
                        r.name.toLowerCase().includes(query)
                )

                if (groupMatches) {
                    return group
                } else if (matchingResources.length > 0) {
                    return { ...group, resources: matchingResources }
                }
                return null
            })
            .filter((g): g is NonNullable<typeof g> => g !== null)
    }, [crdGroups, searchQuery])

    // Auto-expand all groups when searching
    useEffect(() => {
        if (searchQuery.trim()) {
            setExpandedGroups(new Set(filteredGroups.map(g => g.group)))
        }
    }, [searchQuery, filteredGroups])

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(group)) {
                next.delete(group)
            } else {
                next.add(group)
            }
            return next
        })
    }

    const handleResourceClick = (group: string, version: string, name: string) => {
        navigate(`/crds/${group}/${version}/${name}`)
        closeCRDSheet()
    }

    const totalResources = crdGroups?.reduce((sum, g) => sum + g.resources.length, 0) ?? 0

    return (
        <Sheet open={isCRDSheetOpen} onOpenChange={(open) => !open && closeCRDSheet()}>
            <SheetContent side="right" className="flex w-[450px] flex-col p-0 sm:max-w-[450px]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Puzzle className="h-5 w-5" />
                        <h2 className="text-lg font-semibold">Custom Resources</h2>
                        {crdGroups && (
                            <Badge variant="secondary" className="text-xs">
                                {totalResources}
                            </Badge>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={closeCRDSheet}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Search */}
                <div className="border-b border-border p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Search CRDs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Puzzle className="h-5 w-5 animate-pulse" />
                                <span>Loading CRDs...</span>
                            </div>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Puzzle className="h-8 w-8 mb-2 opacity-50" />
                            <p>{searchQuery ? 'No matching CRDs' : 'No CRDs found'}</p>
                        </div>
                    ) : (
                        <div>
                            {filteredGroups.map((group) => {
                                const isExpanded = expandedGroups.has(group.group)
                                return (
                                    <div key={group.group}>
                                        {/* Group Header */}
                                        <button
                                            onClick={() => toggleGroup(group.group)}
                                            className="flex w-full items-center justify-between px-4 py-2.5 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors border-b border-border/50"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="font-mono text-sm font-medium">
                                                    {group.group}
                                                </span>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {group.resources.length}
                                            </Badge>
                                        </button>

                                        {/* Resources */}
                                        {isExpanded && (
                                            <div>
                                                {group.resources.map((resource) => (
                                                    <button
                                                        key={resource.name}
                                                        onClick={() => handleResourceClick(group.group, resource.version, resource.name)}
                                                        className="flex w-full items-center justify-between px-4 py-2 pl-10 hover:bg-zinc-800/50 transition-colors border-b border-border/30"
                                                    >
                                                        <span className="font-medium text-sm">
                                                            {resource.kind}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-xs",
                                                                    resource.namespaced
                                                                        ? 'border-blue-500/40 text-blue-400'
                                                                        : 'border-purple-500/40 text-purple-400'
                                                                )}
                                                            >
                                                                {resource.namespaced ? 'NS' : 'Cluster'}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground font-mono">
                                                                {resource.version}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    {crdGroups && (
                        <span>{crdGroups.length} groups • {totalResources} resources</span>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
