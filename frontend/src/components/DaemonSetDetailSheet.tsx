import { useState } from 'react'
import { Layers, Box, ScrollText, RefreshCw } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/ui/status-dot'
import { AggregatedLogs } from '@/components/AggregatedLogs'

import { useQueryClient } from '@tanstack/react-query'
import { restartWorkload } from '@/api'
import { toast } from '@/components/ui/toast'
import type { DaemonSetInfo } from '@/api'

interface DaemonSetDetailSheetProps {
    daemonSet: DaemonSetInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DaemonSetDetailSheet({ daemonSet, open, onOpenChange }: DaemonSetDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [isRestarting, setIsRestarting] = useState(false)
    const queryClient = useQueryClient()

    if (!daemonSet) return null

    // Build the selector string from daemonset's matchLabels
    const selectorString = daemonSet.selector
        ? Object.entries(daemonSet.selector).map(([k, v]) => `${k}=${v}`).join(',')
        : `app=${daemonSet.name}`

    const isHealthy = daemonSet.ready === daemonSet.desired

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
    }

    const handleRestart = async () => {
        if (!daemonSet) return

        setIsRestarting(true)
        toast.loading(`Restarting ${daemonSet.name}...`, { id: 'restart' })

        try {
            await restartWorkload('daemonset', daemonSet.namespace, daemonSet.name)
            toast.success(`Rolling restart triggered for ${daemonSet.name}`, { id: 'restart' })
            queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
        } catch (error) {
            toast.error(`Failed to restart: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'restart' })
        } finally {
            setIsRestarting(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                {/* Header */}
                <SheetHeader
                    className="border-b border-border px-6 py-4"
                    resourceKind="daemonsets"
                    resourceName={daemonSet.name}
                    namespace={daemonSet.namespace}
                    onYamlSuccess={handleYamlSuccess}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Layers className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <SheetTitle className="font-mono text-base">
                                    {daemonSet.name}
                                </SheetTitle>
                                <p className="text-xs text-muted-foreground">
                                    {daemonSet.namespace}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusDot
                                status={isHealthy ? 'success' : 'warning'}
                                label={`${daemonSet.ready}/${daemonSet.desired}`}
                            />
                        </div>
                    </div>
                </SheetHeader>

                {/* Action Bar */}
                <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/30">
                    {/* Restart Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRestart}
                        disabled={isRestarting}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} />
                        Restart
                    </Button>

                    <div className="flex-1" />
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
                    <TabsList className="px-6">
                        <TabsTrigger value="overview" className="gap-1.5">
                            <Box className="h-3.5 w-3.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="gap-1.5">
                            <ScrollText className="h-3.5 w-3.5" />
                            Logs
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="flex-1 overflow-auto p-6 space-y-6">
                        {/* Status */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
                            <div className="flex items-center gap-3">
                                <span className={`text-2xl font-bold ${isHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {daemonSet.ready}/{daemonSet.desired}
                                </span>
                                <span className="text-muted-foreground">pods ready</span>
                            </div>
                        </div>

                        {/* Node Selector (if available) */}
                        {daemonSet.nodeSelector && Object.keys(daemonSet.nodeSelector).length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Node Selector</h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(daemonSet.nodeSelector).map(([k, v]) => (
                                        <Badge key={k} variant="outline" className="font-mono text-xs">
                                            {k}={v}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Container Images */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Container Images</h3>
                            <div className="flex flex-wrap gap-2">
                                {daemonSet.images.map((image, idx) => (
                                    <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                        {image}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Pod Selector */}
                        {daemonSet.selector && Object.keys(daemonSet.selector).length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Pod Selector</h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(daemonSet.selector).map(([k, v]) => (
                                        <Badge key={k} variant="outline" className="font-mono text-xs">
                                            {k}={v}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Age */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Age</h3>
                            <span>{daemonSet.age}</span>
                        </div>
                    </TabsContent>

                    {/* Logs Tab */}
                    <TabsContent value="logs" className="flex-1 overflow-hidden">
                        <AggregatedLogs
                            selector={selectorString}
                            namespace={daemonSet.namespace}
                            resourceType="daemonset"
                            resourceName={daemonSet.name}
                        />
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}
