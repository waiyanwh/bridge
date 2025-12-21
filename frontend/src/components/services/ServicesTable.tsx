import { Layers, Cable } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { ServiceInfo } from '@/api'

interface ServicesTableProps {
    services: ServiceInfo[]
    onForwardPort?: (e: React.MouseEvent, service: ServiceInfo) => void
    onRowClick: (service: ServiceInfo) => void
}

export function ServicesTable({ services, onForwardPort, onRowClick }: ServicesTableProps) {
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
                        {onForwardPort && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {services.map((svc) => (
                        <TableRow
                            key={`${svc.namespace}/${svc.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(svc)}
                        >
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
