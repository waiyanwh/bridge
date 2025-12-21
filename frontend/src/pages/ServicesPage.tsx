import { useState } from 'react'
import { RefreshCw, AlertCircle, Layers, Cable } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks'
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
import { ForwardPortDialog } from '@/components/tunnels'
import type { ServiceInfo } from '@/api'

export function ServicesPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useServices(namespace)

    // State for forward port dialog
    const [forwardDialogOpen, setForwardDialogOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['services', namespace] })
    }

    const handleForwardPort = (service: ServiceInfo) => {
        setSelectedService(service)
        setForwardDialogOpen(true)
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
                />
            )}

            {/* Forward Port Dialog */}
            {selectedService && (
                <ForwardPortDialog
                    open={forwardDialogOpen}
                    onClose={() => {
                        setForwardDialogOpen(false)
                        setSelectedService(null)
                    }}
                    namespace={selectedService.namespace}
                    resourceType="service"
                    resourceName={selectedService.name}
                    availablePorts={getPortNumbers(selectedService.ports)}
                />
            )}
        </div>
    )
}

function getServiceTypeBadge(type: string) {
    switch (type) {
        case 'LoadBalancer':
            return <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">{type}</Badge>
        case 'NodePort':
            return <Badge className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">{type}</Badge>
        case 'ClusterIP':
            return <Badge variant="secondary">{type}</Badge>
        case 'ExternalName':
            return <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">{type}</Badge>
        default:
            return <Badge variant="secondary">{type}</Badge>
    }
}

interface ServicesTableProps {
    services: ServiceInfo[]
    onForwardPort: (service: ServiceInfo) => void
}

function ServicesTable({ services, onForwardPort }: ServicesTableProps) {
    if (services.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Services found</p>
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
                        <TableHead>Type</TableHead>
                        <TableHead>Cluster IP</TableHead>
                        <TableHead>Ports</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.map((svc) => (
                        <TableRow key={`${svc.namespace}/${svc.name}`}>
                            <TableCell className="font-mono text-sm font-medium">{svc.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{svc.namespace}</TableCell>
                            <TableCell>{getServiceTypeBadge(svc.type)}</TableCell>
                            <TableCell className="font-mono text-sm">{svc.clusterIP}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {svc.ports.map((port, idx) => (
                                        <code
                                            key={idx}
                                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                                        >
                                            {port}
                                        </code>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{svc.age}</TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onForwardPort(svc)}
                                    className="gap-1.5"
                                >
                                    <Cable className="h-4 w-4" />
                                    Forward
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
