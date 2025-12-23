import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot } from '@/components/ui/status-dot'
import { EmptyDeployments } from '@/components/ui/table-empty-state'
import type { DeploymentInfo } from '@/api'

interface DeploymentsTableProps {
    deployments: DeploymentInfo[]
    onRowClick: (d: DeploymentInfo) => void
}

export function DeploymentsTable({ deployments, onRowClick }: DeploymentsTableProps) {
    if (deployments.length === 0) {
        return <EmptyDeployments />
    }

    return (
        <div className="rounded-lg border bg-card">
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
                    {deployments.map((d) => {
                        const isHealthy = d.readyCount >= d.desiredCount
                        return (
                            <TableRow
                                key={`${d.namespace}/${d.name}`}
                                clickable
                                onClick={() => onRowClick(d)}
                            >
                                {/* Name - monospace */}
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {d.name}
                                </TableCell>
                                {/* Namespace */}
                                <TableCell className="text-sm text-muted-foreground">
                                    {d.namespace}
                                </TableCell>
                                {/* Replicas - dot status */}
                                <TableCell>
                                    <StatusDot
                                        status={isHealthy ? 'success' : 'warning'}
                                        label={d.replicas}
                                        withBackground
                                    />
                                </TableCell>
                                {/* Images */}
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
                                {/* Age */}
                                <TableCell className="text-muted-foreground text-sm">
                                    {d.age}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
