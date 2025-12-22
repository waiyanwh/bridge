import { Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { DeploymentInfo } from '@/api'

interface DeploymentsTableProps {
    deployments: DeploymentInfo[]
    onRowClick: (d: DeploymentInfo) => void
}

export function DeploymentsTable({ deployments, onRowClick }: DeploymentsTableProps) {
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
                            className="cursor-pointer hover:bg-muted/50"
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
