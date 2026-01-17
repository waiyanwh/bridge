import { useState } from 'react'
import { Box, Tag, Server, RefreshCw, TerminalSquare, Gauge, Settings, Activity } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

import { StatusDot, getPodStatusType } from '@/components/ui/status-dot'
import { LogViewer } from './LogViewer'
import { Terminal } from './Terminal'


import { usePodDetail, useEvents } from '@/hooks'
import { useQueryClient } from '@tanstack/react-query'
import type { Pod, ContainerInfo } from '@/types'
import { EventsTable } from '@/components/events/EventsTable'

interface PodDetailSheetProps {
    pod: Pod | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PodDetailSheet({ pod, open, onOpenChange }: PodDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')


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
                    <SheetHeader
                        className="border-b border-border px-6 py-4"
                        resourceKind="pod"
                        resourceName={pod.name}
                        namespace={pod.namespace}
                        onYamlSuccess={handleYamlSuccess}
                    >
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
                            <TabsTrigger value="scheduling" className="gap-1.5">
                                <Settings className="h-3.5 w-3.5" />
                                Scheduling
                            </TabsTrigger>
                            <TabsTrigger value="events" className="gap-1.5">
                                <Activity className="h-3.5 w-3.5" />
                                Events
                            </TabsTrigger>
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

                                    {/* Scheduling */}
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                            <Gauge className="h-4 w-4" />
                                            Scheduling
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-md border p-3">
                                                <span className="text-xs text-muted-foreground">QoS Class</span>
                                                <p className="font-medium text-sm mt-1">
                                                    <Badge variant={
                                                        pod.qosClass === 'Guaranteed' ? 'success' :
                                                            pod.qosClass === 'Burstable' ? 'warning' : 'secondary'
                                                    }>
                                                        {pod.qosClass || 'Unknown'}
                                                    </Badge>
                                                </p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <span className="text-xs text-muted-foreground">Scheduler</span>
                                                <p className="font-mono text-sm mt-1">
                                                    {pod.schedulerName || 'default-scheduler'}
                                                </p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <span className="text-xs text-muted-foreground">Priority Class</span>
                                                <p className="font-mono text-sm mt-1">
                                                    {pod.priorityClassName || '-'}
                                                </p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <span className="text-xs text-muted-foreground">Priority Value</span>
                                                <p className="font-mono text-sm mt-1">
                                                    {pod.priority ?? 0}
                                                </p>
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

                        {/* Scheduling Tab */}
                        <TabsContent value="scheduling" className="overflow-auto p-6">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : podDetail ? (
                                <div className="space-y-6">
                                    {/* Node Selector */}
                                    <section className="rounded-lg border p-4">
                                        <h3 className="mb-3 text-sm font-medium">Node Selector</h3>
                                        {podDetail.nodeSelector && Object.keys(podDetail.nodeSelector).length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(podDetail.nodeSelector).map(([key, value]) => (
                                                    <Badge key={key} variant="secondary" className="font-mono text-xs">
                                                        {key}={value}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No node selector defined. Pod can run on any node.</p>
                                        )}
                                    </section>

                                    {/* Tolerations */}
                                    <section className="rounded-lg border p-4">
                                        <h3 className="mb-3 text-sm font-medium">Tolerations</h3>
                                        {podDetail.tolerations && podDetail.tolerations.length > 0 ? (
                                            <div className="space-y-2">
                                                {podDetail.tolerations.map((t, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                        <Badge variant="outline" className="font-mono text-xs">
                                                            {t.key || '*'}{t.operator === 'Exists' ? '' : `=${t.value || ''}`}:{t.effect || 'All'}
                                                        </Badge>
                                                        {t.tolerationSeconds && (
                                                            <span className="text-xs text-muted-foreground">
                                                                for {t.tolerationSeconds}s
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No tolerations defined.</p>
                                        )}
                                    </section>

                                    {/* Node Affinity */}
                                    {podDetail.affinity?.nodeAffinity && (
                                        <section className="rounded-lg border p-4">
                                            <h3 className="mb-3 text-sm font-medium">Node Affinity</h3>
                                            {podDetail.affinity.nodeAffinity.required && podDetail.affinity.nodeAffinity.required.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="mb-2 text-xs font-medium text-destructive uppercase">Required</p>
                                                    <div className="space-y-1">
                                                        {podDetail.affinity.nodeAffinity.required.map((term, i) => (
                                                            term.matchExpressions?.map((expr, j) => (
                                                                <div key={`${i}-${j}`} className="text-sm font-mono bg-destructive/10 px-2 py-1 rounded">
                                                                    {expr.key} {expr.operator} [{expr.values?.join(', ')}]
                                                                </div>
                                                            ))
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {podDetail.affinity.nodeAffinity.preferred && podDetail.affinity.nodeAffinity.preferred.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-medium text-blue-500 uppercase">Preferred</p>
                                                    <div className="space-y-1">
                                                        {podDetail.affinity.nodeAffinity.preferred.map((term, i) => (
                                                            term.matchExpressions?.map((expr, j) => (
                                                                <div key={`${i}-${j}`} className="text-sm font-mono bg-blue-500/10 px-2 py-1 rounded flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">weight: {term.weight}</span>
                                                                    {expr.key} {expr.operator} [{expr.values?.join(', ')}]
                                                                </div>
                                                            ))
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {/* Pod Affinity */}
                                    {podDetail.affinity?.podAffinity && ((podDetail.affinity.podAffinity.required?.length ?? 0) > 0 || (podDetail.affinity.podAffinity.preferred?.length ?? 0) > 0) && (
                                        <section className="rounded-lg border p-4 border-green-500/30">
                                            <h3 className="mb-3 text-sm font-medium text-green-500">Pod Affinity (Attract)</h3>
                                            {podDetail.affinity.podAffinity.required?.map((term, i) => (
                                                <div key={i} className="text-sm mb-2">
                                                    <Badge variant="destructive" className="mr-2">Required</Badge>
                                                    <span className="font-mono">topologyKey: {term.topologyKey}</span>
                                                    {term.labelSelector && (
                                                        <div className="ml-4 mt-1 text-xs text-muted-foreground">
                                                            labels: {Object.entries(term.labelSelector).map(([k, v]) => `${k}=${v}`).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {podDetail.affinity.podAffinity.preferred?.map((term, i) => (
                                                <div key={i} className="text-sm mb-2">
                                                    <Badge variant="secondary" className="mr-2">Preferred (w:{term.weight})</Badge>
                                                    <span className="font-mono">topologyKey: {term.topologyKey}</span>
                                                </div>
                                            ))}
                                        </section>
                                    )}

                                    {/* Pod Anti-Affinity */}
                                    {podDetail.affinity?.podAntiAffinity && ((podDetail.affinity.podAntiAffinity.required?.length ?? 0) > 0 || (podDetail.affinity.podAntiAffinity.preferred?.length ?? 0) > 0) && (
                                        <section className="rounded-lg border p-4 border-red-500/30">
                                            <h3 className="mb-3 text-sm font-medium text-red-500">Pod Anti-Affinity (Repel)</h3>
                                            {podDetail.affinity.podAntiAffinity.required?.map((term, i) => (
                                                <div key={i} className="text-sm mb-2">
                                                    <Badge variant="destructive" className="mr-2">Required</Badge>
                                                    <span className="font-mono">topologyKey: {term.topologyKey}</span>
                                                    {term.labelSelector && (
                                                        <div className="ml-4 mt-1 text-xs text-muted-foreground">
                                                            labels: {Object.entries(term.labelSelector).map(([k, v]) => `${k}=${v}`).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {podDetail.affinity.podAntiAffinity.preferred?.map((term, i) => (
                                                <div key={i} className="text-sm mb-2">
                                                    <Badge variant="secondary" className="mr-2">Preferred (w:{term.weight})</Badge>
                                                    <span className="font-mono">topologyKey: {term.topologyKey}</span>
                                                </div>
                                            ))}
                                        </section>
                                    )}

                                    {/* Topology Spread Constraints */}
                                    <section className="rounded-lg border p-4">
                                        <h3 className="mb-3 text-sm font-medium">Topology Spread Constraints</h3>
                                        {podDetail.topologySpreadConstraints && podDetail.topologySpreadConstraints.length > 0 ? (
                                            <div className="space-y-3">
                                                {podDetail.topologySpreadConstraints.map((tsc, i) => (
                                                    <div key={i} className="bg-muted/50 p-3 rounded-md">
                                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                                            <div>
                                                                <span className="text-xs text-muted-foreground">Topology Key</span>
                                                                <p className="font-mono">{tsc.topologyKey}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-muted-foreground">Max Skew</span>
                                                                <p className="font-mono">{tsc.maxSkew}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-muted-foreground">When Unsatisfiable</span>
                                                                <Badge variant={tsc.whenUnsatisfiable === 'DoNotSchedule' ? 'destructive' : 'secondary'}>
                                                                    {tsc.whenUnsatisfiable}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        {tsc.labelSelector && Object.keys(tsc.labelSelector).length > 0 && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                Selector: {Object.entries(tsc.labelSelector).map(([k, v]) => `${k}=${v}`).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No topology spread constraints defined.</p>
                                        )}
                                    </section>

                                    {/* Priority & Scheduler */}
                                    <section className="rounded-lg border p-4">
                                        <h3 className="mb-3 text-sm font-medium">Priority & Scheduler</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-xs text-muted-foreground">Priority Class</span>
                                                <p className="font-mono">{podDetail.priorityClassName || '-'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Priority Value</span>
                                                <p className="font-mono">{podDetail.priority ?? 0}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Scheduler</span>
                                                <p className="font-mono">{podDetail.schedulerName || 'default-scheduler'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">QoS Class</span>
                                                <Badge variant={
                                                    podDetail.qosClass === 'Guaranteed' ? 'success' :
                                                        podDetail.qosClass === 'Burstable' ? 'warning' : 'secondary'
                                                }>
                                                    {podDetail.qosClass || 'Unknown'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            ) : null}
                        </TabsContent>

                        {/* Events Tab */}
                        <TabsContent value="events" className="overflow-auto p-6">
                            {pod && <PodEvents pod={pod} />}
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
        </>
    )
}

function PodEvents({ pod }: { pod: Pod }) {
    const { data, isLoading } = useEvents(pod.namespace, `involvedObject.name=${pod.name}`)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return <EventsTable events={data?.events || []} />
}
