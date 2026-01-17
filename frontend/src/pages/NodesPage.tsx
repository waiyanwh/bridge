import { useState } from 'react'
import { RefreshCw, AlertCircle, Server } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNodes } from '@/hooks'
import { Button } from '@/components/ui/button'
import { NodeDetailSheet } from '@/components/nodes'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/tooltip'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot } from '@/components/ui/status-dot'
import type { NodeInfo, NodeTaint } from '@/types'

function getNodeStatusType(status: string): 'success' | 'error' | 'warning' | 'default' {
    if (status === 'Ready') return 'success'
    if (status === 'NotReady') return 'error'
    return 'default'
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
    }
    return `${(bytes / 1024).toFixed(0)} KB`
}

function formatCPU(millicores: number): string {
    if (millicores >= 1000) {
        return `${(millicores / 1000).toFixed(1)} cores`
    }
    return `${millicores}m`
}

// Format a taint for display
function formatTaint(taint: NodeTaint): string {
    if (taint.value) {
        return `${taint.key}=${taint.value}:${taint.effect}`
    }
    return `${taint.key}:${taint.effect}`
}

// Taints cell component with truncation and tooltip
function TaintsCell({ taints }: { taints: NodeTaint[] }) {
    if (!taints || taints.length === 0) {
        return <span className="text-muted-foreground text-sm">None</span>
    }

    const maxVisible = 2
    const visibleTaints = taints.slice(0, maxVisible)
    const hiddenTaints = taints.slice(maxVisible)
    const hasMore = hiddenTaints.length > 0

    return (
        <div className="flex flex-wrap items-center gap-1">
            {visibleTaints.map((taint, index) => (
                <Badge
                    key={`${taint.key}-${index}`}
                    variant="outline"
                    className="font-mono text-xs whitespace-nowrap"
                >
                    {formatTaint(taint)}
                </Badge>
            ))}
            {hasMore && (
                <Tooltip
                    content={
                        <div className="flex flex-col gap-1">
                            {hiddenTaints.map((taint, index) => (
                                <span key={`${taint.key}-${index}`} className="font-mono text-xs">
                                    {formatTaint(taint)}
                                </span>
                            ))}
                        </div>
                    }
                    side="bottom"
                >
                    <Badge
                        variant="secondary"
                        className="cursor-pointer text-xs"
                    >
                        +{hiddenTaints.length}
                    </Badge>
                </Tooltip>
            )}
        </div>
    )
}

export function NodesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, error, isFetching } = useNodes()

    const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['nodes'] })
    }

    const handleNodeClick = (node: NodeInfo) => {
        setSelectedNode(node)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Cluster Nodes</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} node${data.count !== 1 ? 's' : ''} in cluster` : 'Loading...'}
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
                        <p className="font-medium text-destructive">Failed to load nodes</p>
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

            {/* Nodes Table */}
            {!isLoading && !isError && data && data.nodes.length > 0 && (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Taints</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Version</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>Resources</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.nodes.map((node) => (
                                <TableRow
                                    key={node.name}
                                    clickable
                                    onClick={() => handleNodeClick(node)}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-mono font-medium">{node.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusDot
                                            status={getNodeStatusType(node.status)}
                                            label={node.status}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TaintsCell taints={node.taints} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{node.role}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                        {node.version}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {node.age}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground w-8">CPU</span>
                                                <Progress value={node.cpuUsagePercent} className="h-1.5 w-16" />
                                                <span>{formatCPU(node.cpuAllocatable)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground w-8">Mem</span>
                                                <Progress value={node.memoryUsagePercent} className="h-1.5 w-16" />
                                                <span>{formatBytes(node.memoryAllocatable)}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && data?.nodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">No nodes found in the cluster.</p>
                </div>
            )}

            {/* Detail Sheet */}
            <NodeDetailSheet
                node={selectedNode}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}
