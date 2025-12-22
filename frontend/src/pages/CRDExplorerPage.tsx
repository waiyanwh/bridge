import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Puzzle, RefreshCw, AlertCircle, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCRDGroups } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function CRDExplorerPage() {
    const queryClient = useQueryClient()
    const { data: crdGroups, isLoading, isError, isFetching, error } = useCRDGroups()
    const [searchQuery, setSearchQuery] = useState('')

    // Track expanded groups - initialize all as expanded
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

    // Initialize all groups as expanded when data loads
    useEffect(() => {
        if (crdGroups && Object.keys(expandedGroups).length === 0) {
            const allExpanded: Record<string, boolean> = {}
            crdGroups.forEach(g => { allExpanded[g.group] = true })
            setExpandedGroups(allExpanded)
        }
    }, [crdGroups, expandedGroups])

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['crds'] })
    }

    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }))
    }

    const expandAll = () => {
        if (!filteredGroups) return
        const allExpanded: Record<string, boolean> = {}
        filteredGroups.forEach(g => { allExpanded[g.group] = true })
        setExpandedGroups(allExpanded)
    }

    const collapseAll = () => {
        if (!filteredGroups) return
        const allCollapsed: Record<string, boolean> = {}
        filteredGroups.forEach(g => { allCollapsed[g.group] = false })
        setExpandedGroups(allCollapsed)
    }

    // Check if all groups are currently expanded
    const allExpanded = useMemo(() => {
        if (!crdGroups) return false
        return crdGroups.every(g => expandedGroups[g.group])
    }, [crdGroups, expandedGroups])

    // Filter groups and resources based on search query
    const filteredGroups = useMemo(() => {
        if (!crdGroups) return []
        if (!searchQuery.trim()) return crdGroups

        const query = searchQuery.toLowerCase()
        return crdGroups
            .map(group => {
                // Check if group name matches
                const groupMatches = group.group.toLowerCase().includes(query)

                // Filter resources that match
                const matchingResources = group.resources.filter(
                    r => r.kind.toLowerCase().includes(query) ||
                        r.name.toLowerCase().includes(query)
                )

                // Include group if name matches or has matching resources
                if (groupMatches) {
                    return group // Return full group if name matches
                } else if (matchingResources.length > 0) {
                    return { ...group, resources: matchingResources }
                }
                return null
            })
            .filter((g): g is NonNullable<typeof g> => g !== null)
    }, [crdGroups, searchQuery])

    // Auto-expand all groups when searching
    useEffect(() => {
        if (searchQuery.trim() && filteredGroups.length > 0) {
            const expanded: Record<string, boolean> = { ...expandedGroups }
            filteredGroups.forEach(g => { expanded[g.group] = true })
            setExpandedGroups(expanded)
        }
    }, [searchQuery, filteredGroups])

    const totalResources = crdGroups?.reduce((sum, g) => sum + g.resources.length, 0) ?? 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
                        <Puzzle className="h-7 w-7" />
                        Custom Resources
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Browse and manage Custom Resource Definitions in your cluster
                        {crdGroups && (
                            <span className="ml-2">
                                • {crdGroups.length} groups, {totalResources} resources
                            </span>
                        )}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="gap-2 shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Search Bar and Expand/Collapse controls */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search CRDs by group or resource name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {filteredGroups.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={allExpanded ? collapseAll : expandAll}
                        className="gap-2 shrink-0"
                    >
                        <ChevronsUpDown className="h-4 w-4" />
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                    </Button>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Discovering CRDs...</span>
                </div>
            )}

            {/* Error State */}
            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">
                        {error instanceof Error ? error.message : 'Failed to load CRDs'}
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && filteredGroups.length === 0 && (
                <div className="text-center py-12">
                    <Puzzle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                        {searchQuery ? 'No CRDs match your search' : 'No Custom Resource Definitions found'}
                    </p>
                </div>
            )}

            {/* CRD Groups List */}
            {!isLoading && !isError && filteredGroups.length > 0 && (
                <div className="space-y-2">
                    {filteredGroups.map((group) => {
                        const isExpanded = expandedGroups[group.group] ?? true

                        return (
                            <div key={group.group} className="border border-border rounded-lg overflow-hidden">
                                {/* Collapsible Group Header */}
                                <button
                                    onClick={() => toggleGroup(group.group)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3",
                                        "bg-zinc-800/50 hover:bg-zinc-800 transition-colors",
                                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <ChevronRight
                                            className={cn(
                                                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                                isExpanded && "rotate-90"
                                            )}
                                        />
                                        <span className="font-mono text-sm font-medium text-foreground">
                                            {group.group}
                                        </span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {group.resources.length} {group.resources.length === 1 ? 'resource' : 'resources'}
                                    </Badge>
                                </button>

                                {/* Collapsible Resource Rows */}
                                {isExpanded && (
                                    <div className="border-t border-border/50">
                                        {group.resources.map((resource, resourceIndex) => (
                                            <Link
                                                key={resource.name}
                                                to={`/crds/${group.group}/${resource.version}/${resource.name}`}
                                                className={cn(
                                                    "flex items-center px-4 py-3 pl-10",
                                                    "hover:bg-zinc-800/50 transition-colors cursor-pointer",
                                                    resourceIndex < group.resources.length - 1 && "border-b border-border/30"
                                                )}
                                            >
                                                {/* Left: Kind and Name */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-foreground">
                                                            {resource.kind}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {resource.name}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Middle: Scope Badge */}
                                                <div className="flex items-center gap-3 mr-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-xs",
                                                            resource.namespaced
                                                                ? 'border-blue-500/50 text-blue-400'
                                                                : 'border-purple-500/50 text-purple-400'
                                                        )}
                                                    >
                                                        {resource.namespaced ? 'Namespaced' : 'Cluster'}
                                                    </Badge>
                                                </div>

                                                {/* Right: Version */}
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {resource.version}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}


