import { Server, Cpu, HardDrive, Box } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { NodeInfo } from '@/types'

interface NodeCardProps {
    node: NodeInfo
    onClick?: () => void
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

export function NodeCard({ node, onClick }: NodeCardProps) {
    const isReady = node.status === 'Ready'

    return (
        <Card
            className={`transition-all hover:border-muted-foreground/30 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="font-mono text-sm font-medium">{node.name}</h3>
                            <p className="text-xs text-muted-foreground">
                                {node.role} • {node.version}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isReady ? 'success' : 'error'}>
                        {node.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* CPU Usage */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>CPU</span>
                        </div>
                        <span className="font-mono text-xs">
                            {node.cpuUsagePercent}%
                        </span>
                    </div>
                    <Progress value={node.cpuUsagePercent} />
                    <p className="text-xs text-muted-foreground">
                        {formatCPU(node.cpuAllocatable)} allocatable of {formatCPU(node.cpuCapacity)}
                    </p>
                </div>

                {/* Memory Usage */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <HardDrive className="h-3.5 w-3.5" />
                            <span>Memory</span>
                        </div>
                        <span className="font-mono text-xs">
                            {node.memoryUsagePercent}%
                        </span>
                    </div>
                    <Progress value={node.memoryUsagePercent} />
                    <p className="text-xs text-muted-foreground">
                        {formatBytes(node.memoryAllocatable)} allocatable of {formatBytes(node.memoryCapacity)}
                    </p>
                </div>

                {/* Pod Count */}
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Box className="h-3.5 w-3.5" />
                        <span>Pods</span>
                    </div>
                    <span className="font-medium">{node.podCount}</span>
                </div>

                {/* Age */}
                <div className="text-xs text-muted-foreground">
                    Age: {node.age}
                </div>
            </CardContent>
        </Card>
    )
}
