import { RefreshCw, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNodes } from '@/hooks'
import { Button } from '@/components/ui/button'
import { NodeCard } from '@/components/nodes'

export function NodesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, error, isFetching } = useNodes()

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['nodes'] })
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
                        <NodeCard key={node.name} node={node} />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && data?.nodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">No nodes found in the cluster.</p>
                </div>
            )}
        </div>
    )
}
