import { Layers, Cable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot } from '@/components/ui/status-dot'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import type { ServiceInfo } from '@/api'

interface ServicesTableProps {
    services: ServiceInfo[]
    onForwardPort?: (e: React.MouseEvent, service: ServiceInfo) => void
    onRowClick: (service: ServiceInfo) => void
}

export function ServicesTable({ services, onForwardPort, onRowClick }: ServicesTableProps) {
    if (services.length === 0) {
        return (
            <TableEmptyState
                icon={Layers}
                title="No services found"
                description="There are no services in this namespace."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Cluster IP</TableHead>
                        <TableHead>Ports</TableHead>
                        <TableHead>Age</TableHead>
                        {onForwardPort && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.map((svc) => (
                        <TableRow
                            key={`${svc.namespace}/${svc.name}`}
                            clickable
                            onClick={() => onRowClick(svc)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {svc.name}
                            </TableCell>
                            {/* Namespace */}
                            <TableCell className="text-sm text-muted-foreground">
                                {svc.namespace}
                            </TableCell>
                            {/* Type - dot badge */}
                            <TableCell>
                                <StatusDot
                                    status={getServiceTypeStatus(svc.type)}
                                    label={svc.type}
                                    withBackground
                                />
                            </TableCell>
                            {/* Cluster IP - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {svc.clusterIP}
                            </TableCell>
                            {/* Ports */}
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
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {svc.age}
                            </TableCell>
                            {/* Forward button */}
                            {onForwardPort && (
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => onForwardPort(e, svc)}
                                        className="gap-1.5"
                                    >
                                        <Cable className="h-4 w-4" />
                                        Forward
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function getServiceTypeStatus(type: string): 'success' | 'warning' | 'info' | 'default' {
    switch (type) {
        case 'LoadBalancer':
            return 'info'
        case 'NodePort':
            return 'warning'
        case 'ClusterIP':
            return 'default'
        case 'ExternalName':
            return 'warning'
        default:
            return 'default'
    }
}
