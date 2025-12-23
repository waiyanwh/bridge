import { useState } from 'react'
import { RefreshCw, Search, AlertCircle, Box } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePods } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot, getPodStatusType } from '@/components/ui/status-dot'
import { TableEmptyState, EmptySearch } from '@/components/ui/table-empty-state'
import type { Pod } from '@/types'

export function PodsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const [searchQuery, setSearchQuery] = useState('')

    const { data, isLoading, isError, error, isFetching } = usePods(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pods', namespace] })
    }

    // Filter pods by search query
    const filteredPods = data?.pods.filter((pod: Pod) =>
        pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pod.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pod.status.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? []

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pods</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} pods${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
                            : 'Loading...'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search pods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Error State */}
            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                        <p className="font-medium text-destructive">Failed to load pods</p>
                        <p className="text-sm text-muted-foreground">{error?.message}</p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Pods Table */}
            {!isLoading && !isError && (
                <PodsTable
                    pods={filteredPods}
                    showNamespace={selectedNamespace === 'all'}
                    searchQuery={searchQuery}
                />
            )}
        </div>
    )
}

interface PodsTableProps {
    pods: Pod[]
    showNamespace?: boolean
    searchQuery?: string
}

function PodsTable({ pods, showNamespace = false, searchQuery }: PodsTableProps) {
    if (pods.length === 0) {
        if (searchQuery) {
            return <EmptySearch query={searchQuery} />
        }
        return (
            <TableEmptyState
                icon={Box}
                title="No pods found"
                description="There are no pods in this namespace, or they don't match your current filters."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        {showNamespace && <TableHead>Namespace</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Restarts</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pods.map((pod: Pod) => (
                        <TableRow key={`${pod.namespace || 'default'}/${pod.name}`} clickable>
                            {/* Name - monospace, PRIMARY color for high contrast */}
                            <TableCell className="font-mono text-sm text-foreground">
                                {pod.name}
                            </TableCell>
                            {/* Namespace (optional) - secondary color */}
                            {showNamespace && (
                                <TableCell className="text-sm text-muted-foreground">
                                    {pod.namespace || 'default'}
                                </TableCell>
                            )}
                            {/* Status - Dot Badge */}
                            <TableCell>
                                <StatusDot
                                    status={getPodStatusType(pod.status)}
                                    label={pod.status}
                                    withBackground
                                />
                            </TableCell>
                            {/* Restarts */}
                            <TableCell>
                                <span className={pod.restarts > 0 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}>
                                    {pod.restarts}
                                </span>
                            </TableCell>
                            {/* IP - monospace, secondary */}
                            <TableCell className="font-mono text-sm text-muted-foreground">
                                {pod.ip || '-'}
                            </TableCell>
                            {/* Age - secondary */}
                            <TableCell className="text-muted-foreground text-sm">
                                {pod.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
