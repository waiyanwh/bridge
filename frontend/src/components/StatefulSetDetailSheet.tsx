import { useState } from 'react'
import { Database, Box, ScrollText, RefreshCw } from 'lucide-react'
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
import type { StatefulSetInfo } from '@/api'

interface StatefulSetDetailSheetProps {
    statefulSet: StatefulSetInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StatefulSetDetailSheet({ statefulSet, open, onOpenChange }: StatefulSetDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [isRestarting, setIsRestarting] = useState(false)
    const queryClient = useQueryClient()

    if (!statefulSet) return null

    // Build the selector string from statefulset's matchLabels
    const selectorString = statefulSet.selector
        ? Object.entries(statefulSet.selector).map(([k, v]) => `${k}=${v}`).join(',')
        : `app=${statefulSet.name}`

    const isHealthy = statefulSet.readyCount === statefulSet.desiredCount

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
    }

    const handleRestart = async () => {
        if (!statefulSet) return

        setIsRestarting(true)
        toast.loading(`Restarting ${statefulSet.name}...`, { id: 'restart' })

        try {
            await restartWorkload('statefulset', statefulSet.namespace, statefulSet.name)
            toast.success(`Rolling restart triggered for ${statefulSet.name}`, { id: 'restart' })
            queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
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
                    resourceKind="statefulsets"
                    resourceName={statefulSet.name}
                    namespace={statefulSet.namespace}
                    onYamlSuccess={handleYamlSuccess}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <SheetTitle className="font-mono text-base">
                                    {statefulSet.name}
                                </SheetTitle>
                                <p className="text-xs text-muted-foreground">
                                    {statefulSet.namespace}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusDot
                                status={isHealthy ? 'success' : 'warning'}
                                label={statefulSet.replicas}
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
                                    {statefulSet.replicas}
                                </span>
                                <span className="text-muted-foreground">replicas ready</span>
                            </div>
                        </div>

                        {/* Container Images */}
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Container Images</h3>
                            <div className="flex flex-wrap gap-2">
                                {statefulSet.images.map((image, idx) => (
                                    <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                        {image}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Pod Selector */}
                        {statefulSet.selector && Object.keys(statefulSet.selector).length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Pod Selector</h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(statefulSet.selector).map(([k, v]) => (
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
                            <span>{statefulSet.age}</span>
                        </div>
                    </TabsContent>

                    {/* Logs Tab */}
                    <TabsContent value="logs" className="flex-1 overflow-hidden">
                        <AggregatedLogs
                            selector={selectorString}
                            namespace={statefulSet.namespace}
                            resourceType="statefulset"
                            resourceName={statefulSet.name}
                        />
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}
