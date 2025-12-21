import { useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { ServiceDetailSheet } from '@/components/ServiceDetailSheet'
import { ServicesTable } from '@/components/services/ServicesTable'
import { ForwardPortDialog } from '@/components/tunnels'
import type { ServiceInfo } from '@/api'

export function ServicesPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useServices(namespace)

    // State for forward port dialog
    const [forwardDialogOpen, setForwardDialogOpen] = useState(false)
    const [serviceForPortForward, setServiceForPortForward] = useState<ServiceInfo | null>(null)

    // State for detail sheet
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['services', namespace] })
    }

    const handleForwardPort = (e: React.MouseEvent, service: ServiceInfo) => {
        e.stopPropagation() // Prevent row click
        setServiceForPortForward(service)
        setForwardDialogOpen(true)
    }

    const handleRowClick = (service: ServiceInfo) => {
        setSelectedService(service)
        setSheetOpen(true)
    }

    // Extract port numbers from service ports (e.g., "80/TCP" -> 80)
    const getPortNumbers = (ports: string[]): number[] => {
        return ports.map(p => {
            const match = p.match(/^(\d+)/)
            return match ? parseInt(match[1]) : 0
        }).filter(p => p > 0)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} services${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Services</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <ServicesTable
                    services={data.services}
                    onForwardPort={handleForwardPort}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Forward Port Dialog */}
            {serviceForPortForward && (
                <ForwardPortDialog
                    open={forwardDialogOpen}
                    onClose={() => {
                        setForwardDialogOpen(false)
                        setServiceForPortForward(null)
                    }}
                    namespace={serviceForPortForward.namespace}
                    resourceType="service"
                    resourceName={serviceForPortForward.name}
                    availablePorts={getPortNumbers(serviceForPortForward.ports)}
                />
            )}

            {/* Detail Sheet */}
            <ServiceDetailSheet
                service={selectedService}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}

