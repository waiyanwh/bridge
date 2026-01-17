import { useState } from 'react'
import { Server, Tag, Shield, HardDrive, RefreshCw } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { StatusDot } from '@/components/ui/status-dot'
import { useQueryClient } from '@tanstack/react-query'
import type { NodeInfo } from '@/types'

interface NodeDetailSheetProps {
    node: NodeInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

function getNodeStatusType(status: string): 'success' | 'error' | 'warning' | 'default' {
    if (status === 'Ready') return 'success'
    if (status === 'NotReady') return 'error'
    return 'default'
}

function getConditionStatusType(status: string): 'success' | 'error' | 'warning' | 'default' {
    if (status === 'True') return 'success'
    if (status === 'False') return 'error'
    return 'warning'
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

export function NodeDetailSheet({ node, open, onOpenChange }: NodeDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const queryClient = useQueryClient()

    if (!node) return null

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['nodes'] })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                {/* Header */}
                <SheetHeader
                    className="border-b border-border px-6 py-4"
                    resourceKind="nodes"
                    resourceName={node.name}
                    namespace=""
                    onYamlSuccess={handleYamlSuccess}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Server className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <SheetTitle className="font-mono text-base">
                                    {node.name}
                                </SheetTitle>
                                <p className="text-xs text-muted-foreground">
                                    {node.role} • {node.version}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusDot
                                status={getNodeStatusType(node.status)}
                                label={node.status}
                            />
                        </div>
                    </div>
                </SheetHeader>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
                    <TabsList className="px-6">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="taints">Taints</TabsTrigger>
                        <TabsTrigger value="resources">Resources</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="overflow-auto p-6">
                        <div className="space-y-6">
                            {/* System Info */}
                            <section>
                                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                                    System Info
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">OS Image</span>
                                        <span className="font-mono text-xs truncate max-w-[300px]" title={node.osImage}>
                                            {node.osImage}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Kernel</span>
                                        <span className="font-mono text-xs">{node.kernelVersion}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Container Runtime</span>
                                        <span className="font-mono text-xs truncate max-w-[300px]" title={node.containerRuntime}>
                                            {node.containerRuntime}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Architecture</span>
                                        <span className="font-mono text-xs">{node.architecture}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Age</span>
                                        <span>{node.age}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pod Count</span>
                                        <span>{node.podCount}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Labels */}
                            {node.labels && Object.keys(node.labels).length > 0 && (
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <Tag className="h-4 w-4" />
                                        Labels ({Object.keys(node.labels).length})
                                    </h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(node.labels).map(([key, value]) => (
                                            <Badge
                                                key={key}
                                                variant="secondary"
                                                className="font-mono text-xs"
                                            >
                                                {key}={value}
                                            </Badge>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Conditions */}
                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <RefreshCw className="h-4 w-4" />
                                    Conditions ({node.conditions?.length || 0})
                                </h3>
                                {node.conditions && node.conditions.length > 0 ? (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {node.conditions.map((condition) => (
                                                    <TableRow key={condition.type}>
                                                        <TableCell className="font-medium">
                                                            {condition.type}
                                                        </TableCell>
                                                        <TableCell>
                                                            <StatusDot
                                                                status={getConditionStatusType(condition.status)}
                                                                label={condition.status}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {condition.reason || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No conditions</p>
                                )}
                            </section>
                        </div>
                    </TabsContent>

                    {/* Taints Tab */}
                    <TabsContent value="taints" className="overflow-auto p-6">
                        <section>
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Shield className="h-4 w-4" />
                                Taints ({node.taints?.length || 0})
                            </h3>
                            {node.taints && node.taints.length > 0 ? (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Key</TableHead>
                                                <TableHead>Value</TableHead>
                                                <TableHead>Effect</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {node.taints.map((taint, index) => (
                                                <TableRow key={`${taint.key}-${index}`}>
                                                    <TableCell className="font-mono text-sm">
                                                        {taint.key}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                                        {taint.value || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {taint.effect}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="rounded-md border border-dashed p-8 text-center">
                                    <Shield className="mx-auto h-8 w-8 text-muted-foreground/50" />
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        No taints configured on this node
                                    </p>
                                </div>
                            )}
                        </section>
                    </TabsContent>

                    {/* Resources Tab */}
                    <TabsContent value="resources" className="overflow-auto p-6">
                        <div className="space-y-6">
                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <HardDrive className="h-4 w-4" />
                                    Resource Allocation
                                </h3>
                                <div className="space-y-6">
                                    {/* CPU */}
                                    <div className="rounded-md border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">CPU</span>
                                            <span className="text-sm text-muted-foreground">
                                                {node.cpuUsagePercent}% used
                                            </span>
                                        </div>
                                        <Progress value={node.cpuUsagePercent} className="h-2" />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Capacity</span>
                                                <p className="font-mono">{formatCPU(node.cpuCapacity)}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Allocatable</span>
                                                <p className="font-mono">{formatCPU(node.cpuAllocatable)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Memory */}
                                    <div className="rounded-md border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">Memory</span>
                                            <span className="text-sm text-muted-foreground">
                                                {node.memoryUsagePercent}% used
                                            </span>
                                        </div>
                                        <Progress value={node.memoryUsagePercent} className="h-2" />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Capacity</span>
                                                <p className="font-mono">{formatBytes(node.memoryCapacity)}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Allocatable</span>
                                                <p className="font-mono">{formatBytes(node.memoryAllocatable)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pods */}
                                    <div className="rounded-md border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">Pods</span>
                                            <span className="text-sm text-muted-foreground">
                                                {node.podCount} running
                                            </span>
                                        </div>
                                        <Progress
                                            value={node.podsAllocatable > 0 ? (node.podCount / node.podsAllocatable) * 100 : 0}
                                            className="h-2"
                                        />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Capacity</span>
                                                <p className="font-mono">{node.podsCapacity} pods</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Allocatable</span>
                                                <p className="font-mono">{node.podsAllocatable} pods</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}
