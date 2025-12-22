import { useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDeployments } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { DeploymentDetailSheet } from '@/components/DeploymentDetailSheet'
import { DeploymentsTable } from '@/components/deployments/DeploymentsTable'
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

