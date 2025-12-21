import { useState } from 'react'
import { Box, Tag, Server, RefreshCw, TerminalSquare, FileCode, Cable } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusDot, getPodStatusType } from '@/components/ui/status-dot'
import { LogViewer } from './LogViewer'
import { Terminal } from './Terminal'
import { YamlEditorDialog } from '@/components/YamlEditorDialog'
import { ForwardPortDialog } from '@/components/tunnels'
import { usePodDetail } from '@/hooks'
import { useQueryClient } from '@tanstack/react-query'
import type { Pod, ContainerInfo } from '@/types'

interface PodDetailSheetProps {
    pod: Pod | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PodDetailSheet({ pod, open, onOpenChange }: PodDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [yamlEditorOpen, setYamlEditorOpen] = useState(false)
    const [forwardPortOpen, setForwardPortOpen] = useState(false)
    const queryClient = useQueryClient()

    const { data: podDetail, isLoading } = usePodDetail(
        pod?.namespace ?? '',
        pod?.name ?? '',
        open && !!pod
    )

    if (!pod) return null

    const handleYamlSuccess = () => {
        // Refresh pod data after YAML change
        queryClient.invalidateQueries({ queryKey: ['pods'] })
        queryClient.invalidateQueries({ queryKey: ['podDetail', pod.namespace, pod.name] })
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {/* Header */}
                    <SheetHeader className="border-b border-border px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Box className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <SheetTitle className="font-mono text-base">
                                        {pod.name}
                                    </SheetTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {pod.namespace}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setForwardPortOpen(true)}
                                    className="gap-2"
                                >
                                    <Cable className="h-4 w-4" />
                                    Forward Port
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setYamlEditorOpen(true)}
                                    className="gap-2"
                                >
                                    <FileCode className="h-4 w-4" />
                                    Edit YAML
                                </Button>
                                <StatusDot
                                    status={getPodStatusType(pod.status)}
                                    label={pod.status}
                                />
                            </div>
                        </div>
                    </SheetHeader>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
                        <TabsList className="px-6">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="logs">Logs</TabsTrigger>
                            <TabsTrigger value="terminal" className="gap-1.5">
                                <TerminalSquare className="h-3.5 w-3.5" />
                                Terminal
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="overflow-auto p-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : podDetail ? (
                                <div className="space-y-6">
                                    {/* Metadata */}
                                    <section>
                                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                                            Metadata
                                        </h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Node</span>
                                                <span className="font-mono">{podDetail.node || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">IP</span>
                                                <span className="font-mono">{podDetail.ip || 'Pending'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Age</span>
                                                <span>{podDetail.age}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Restarts</span>
                                                <span className={podDetail.restarts > 0 ? 'text-amber-400' : ''}>
                                                    {podDetail.restarts}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Created</span>
                                                <span className="text-xs">
                                                    {new Date(podDetail.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Labels */}
                                    {podDetail.labels && Object.keys(podDetail.labels).length > 0 && (
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                <Tag className="h-4 w-4" />
                                                Labels
                                            </h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(podDetail.labels).map(([key, value]) => (
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

                                    {/* Containers */}
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                            <Server className="h-4 w-4" />
                                            Containers ({podDetail.containers.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {podDetail.containers.map((container: ContainerInfo) => (
                                                <div
                                                    key={container.name}
                                                    className="rounded-md border border-border p-3"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono text-sm font-medium">
                                                            {container.name}
                                                        </span>
                                                        <StatusDot
                                                            status={getPodStatusType(container.state)}
                                                            label={container.state}
                                                        />
                                                    </div>
                                                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                                                        {container.image}
                                                    </p>
                                                    {container.restartCount > 0 && (
                                                        <p className="mt-1 text-xs text-amber-400">
                                                            Restarts: {container.restartCount}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            ) : null}
                        </TabsContent>

                        {/* Logs Tab */}
                        <TabsContent value="logs" className="relative flex-1 overflow-hidden">
                            <LogViewer namespace={pod.namespace} podName={pod.name} />
                        </TabsContent>

                        {/* Terminal Tab */}
                        <TabsContent value="terminal" className="relative flex-1 overflow-hidden">
                            {activeTab === 'terminal' && (
                                <Terminal namespace={pod.namespace} podName={pod.name} />
                            )}
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>

            {/* YAML Editor Dialog */}
            <YamlEditorDialog
                open={yamlEditorOpen}
                onOpenChange={setYamlEditorOpen}
                resourceType="pod"
                namespace={pod.namespace}
                name={pod.name}
                onSuccess={handleYamlSuccess}
            />

            {/* Forward Port Dialog */}
            <ForwardPortDialog
                open={forwardPortOpen}
                onClose={() => setForwardPortOpen(false)}
                namespace={pod.namespace}
                resourceType="pod"
                resourceName={pod.name}
            />
        </>
    )
}
