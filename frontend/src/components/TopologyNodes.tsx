import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Globe, Server, Box, Container } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ingress Node - Purple border
export const IngressNode = memo(({ data }: NodeProps) => {
    return (
        <div className={cn(
            "px-4 py-3 rounded-lg border-2 bg-zinc-900 shadow-lg min-w-[180px]",
            "border-violet-500/50 hover:border-violet-500"
        )}>
            <Handle type="source" position={Position.Bottom} className="!bg-violet-500" />

            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-violet-500/20">
                    <Globe className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs text-violet-400 font-medium">Ingress</div>
                    <div className="text-sm font-semibold text-foreground truncate">
                        {data.label as string}
                    </div>
                </div>
            </div>

            {data.hosts && (data.hosts as string[]).length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground truncate">
                    {(data.hosts as string[]).join(', ')}
                </div>
            )}
        </div>
    )
})
IngressNode.displayName = 'IngressNode'

// Service Node - Blue border
export const ServiceNode = memo(({ data }: NodeProps) => {
    return (
        <div className={cn(
            "px-4 py-3 rounded-lg border-2 bg-zinc-900 shadow-lg min-w-[180px]",
            "border-blue-500/50 hover:border-blue-500"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />

            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/20">
                    <Server className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs text-blue-400 font-medium">Service</div>
                    <div className="text-sm font-semibold text-foreground truncate">
                        {data.label as string}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800">
                    {data.type as string}
                </span>
                {data.clusterIP && (
                    <span className="truncate">{data.clusterIP as string}</span>
                )}
            </div>
        </div>
    )
})
ServiceNode.displayName = 'ServiceNode'

// Deployment Node - Green border
export const DeploymentNode = memo(({ data }: NodeProps) => {
    const replicas = (data.replicas as number) || 0
    const ready = (data.ready as number) || 0
    const isHealthy = ready === replicas && replicas > 0

    return (
        <div className={cn(
            "px-4 py-3 rounded-lg border-2 bg-zinc-900 shadow-lg min-w-[180px]",
            "border-emerald-500/50 hover:border-emerald-500"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-emerald-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />

            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/20">
                    <Box className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs text-emerald-400 font-medium">Deployment</div>
                    <div className="text-sm font-semibold text-foreground truncate">
                        {data.label as string}
                    </div>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                )}>
                    {ready}/{replicas} ready
                </span>
            </div>
        </div>
    )
})
DeploymentNode.displayName = 'DeploymentNode'

// Pod Node - Smaller, circle-like
export const PodNode = memo(({ data }: NodeProps) => {
    const status = data.status as string
    const isRunning = status === 'Running'
    const isPending = status === 'Pending' || status === 'ContainerCreating'

    return (
        <div className={cn(
            "px-3 py-2 rounded-lg border bg-zinc-900 shadow-md min-w-[140px]",
            isRunning ? "border-zinc-600" : isPending ? "border-amber-500/50" : "border-red-500/50"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-zinc-500" />

            <div className="flex items-center gap-2">
                <div className={cn(
                    "p-1 rounded-full",
                    isRunning ? "bg-emerald-500/20" : isPending ? "bg-amber-500/20" : "bg-red-500/20"
                )}>
                    <Container className={cn(
                        "h-3 w-3",
                        isRunning ? "text-emerald-400" : isPending ? "text-amber-400" : "text-red-400"
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                        {data.label as string}
                    </div>
                    <div className={cn(
                        "text-[10px]",
                        isRunning ? "text-emerald-400" : isPending ? "text-amber-400" : "text-red-400"
                    )}>
                        {status}
                    </div>
                </div>
            </div>
        </div>
    )
})
PodNode.displayName = 'PodNode'
