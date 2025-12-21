import { useState } from 'react'
import { RefreshCw, AlertCircle, Server } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDeployments } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { DeploymentDetailSheet } from '@/components/DeploymentDetailSheet'
import type { DeploymentInfo } from '@/api'

export function DeploymentsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useDeployments(namespace)

    const [selectedDeployment, setSelectedDeployment] = useState<DeploymentInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['deployments', namespace] })
    }

    const handleRowClick = (deployment: DeploymentInfo) => {
        setSelectedDeployment(deployment)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} deployments${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">Failed to load Deployments</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <DeploymentsTable
                    deployments={data.deployments}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Deployment Detail Sheet */}
            <DeploymentDetailSheet
                deployment={selectedDeployment}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}

function DeploymentsTable({
    deployments,
    onRowClick
}: {
    deployments: DeploymentInfo[]
    onRowClick: (d: DeploymentInfo) => void
}) {
    if (deployments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Server className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Deployments found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Replicas</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deployments.map((d) => (
                        <TableRow
                            key={`${d.namespace}/${d.name}`}
                            className="cursor-pointer hover:bg-zinc-800/50"
                            onClick={() => onRowClick(d)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{d.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{d.namespace}</TableCell>
                            <TableCell>
                                <span className={
                                    d.readyCount < d.desiredCount
                                        ? 'font-medium text-amber-400'
                                        : 'text-green-400'
                                }>
                                    {d.replicas}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                    {d.images.map((image, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="font-mono text-xs truncate max-w-[250px]"
                                            title={image}
                                        >
                                            {image.split('/').pop()?.split('@')[0] || image}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{d.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
