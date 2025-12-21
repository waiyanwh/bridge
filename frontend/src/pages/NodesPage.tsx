import { useState } from 'react'
import { RefreshCw, AlertCircle, Server } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNodes } from '@/hooks'
import { Button } from '@/components/ui/button'
import { NodeCard } from '@/components/nodes'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { NodeInfo } from '@/types'

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

            {/* Nodes Grid */}
            {!isLoading && !isError && data && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {data.nodes.map((node) => (
                        <NodeCard
                            key={node.name}
                            node={node}
                            onClick={() => handleNodeClick(node)}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && data?.nodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">No nodes found in the cluster.</p>
                </div>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedNode && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="nodes"
                                resourceName={selectedNode.name}
                                namespace="" // Cluster-scoped
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Server className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <SheetTitle className="font-mono text-base">
                                                {selectedNode.name}
                                            </SheetTitle>
                                            <Badge variant={selectedNode.status === 'Ready' ? 'success' : 'error'}>
                                                {selectedNode.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedNode.role} • {selectedNode.version}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-6">
                                    {/* System Info */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-3 text-muted-foreground">System Info</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">OS Image</span>
                                                <p className="font-medium text-xs truncate" title={selectedNode.osImage}>
                                                    {selectedNode.osImage}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Kernel</span>
                                                <p className="font-medium text-xs">{selectedNode.kernelVersion}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Container Runtime</span>
                                                <p className="font-medium text-xs truncate" title={selectedNode.containerRuntime}>
                                                    {selectedNode.containerRuntime}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Architecture</span>
                                                <p className="font-medium text-xs">{selectedNode.architecture}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Age</span>
                                                <p className="font-medium text-xs">{selectedNode.age}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Pod Count</span>
                                                <p className="font-medium text-xs">{selectedNode.podCount}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resources */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Resources</h4>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span>CPU usage</span>
                                                    <span>{selectedNode.cpuUsagePercent}%</span>
                                                </div>
                                                <Progress value={selectedNode.cpuUsagePercent} className="h-2" />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{formatCPU(selectedNode.cpuAllocatable)} allocatable</span>
                                                    <span>{formatCPU(selectedNode.cpuCapacity)} total</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span>Memory usage</span>
                                                    <span>{selectedNode.memoryUsagePercent}%</span>
                                                </div>
                                                <Progress value={selectedNode.memoryUsagePercent} className="h-2" />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{formatBytes(selectedNode.memoryAllocatable)} allocatable</span>
                                                    <span>{formatBytes(selectedNode.memoryCapacity)} total</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
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
