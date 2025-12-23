import { RefreshCw, AlertCircle, Box } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePods } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot, getPodStatusType } from '@/components/ui/status-dot'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import type { Pod } from '@/types'

export function PodsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace

    const { data, isLoading, isError, error, isFetching } = usePods(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pods', namespace] })
    }

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
            {!isLoading && !isError && data && (
                <PodsTable
                    pods={data.pods}
                    showNamespace={selectedNamespace === 'all'}
                />
            )}
        </div>
    )
}

interface PodsTableProps {
    pods: Pod[]
    showNamespace?: boolean
}

function PodsTable({ pods, showNamespace = false }: PodsTableProps) {
    if (pods.length === 0) {
        return (
            <TableEmptyState
                icon={Box}
                title="No pods found"
                description="There are no pods in this namespace."
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
                            {/* Status - Dot Badge with background */}
                            <TableCell>
                                <StatusDot
                                    status={getPodStatusType(pod.status)}
                                    label={pod.status}
                                    withBackground
                                />
                            </TableCell>
                            {/* Restarts */}
                            <TableCell>
                                <span className={pod.restarts > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}>
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
