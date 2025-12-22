import { useState } from 'react'
import { Server, Box, ScrollText, RefreshCw, Scale } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusDot } from '@/components/ui/status-dot'
import { AggregatedLogs } from './AggregatedLogs'

import { useQueryClient } from '@tanstack/react-query'
import { restartWorkload, scaleWorkload } from '@/api'
import { toast } from '@/components/ui/toast'
import type { DeploymentInfo } from '@/api'

interface DeploymentDetailSheetProps {
    deployment: DeploymentInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DeploymentDetailSheet({ deployment, open, onOpenChange }: DeploymentDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')

    const [isRestarting, setIsRestarting] = useState(false)
    const [showScalePopover, setShowScalePopover] = useState(false)
    const [newReplicas, setNewReplicas] = useState<number>(0)
    const [isScaling, setIsScaling] = useState(false)
    const queryClient = useQueryClient()

    if (!deployment) return null

    // Build the selector string from deployment's matchLabels
    const selectorString = deployment.selector
        ? Object.entries(deployment.selector).map(([k, v]) => `${k}=${v}`).join(',')
        : `app=${deployment.name}`

    const isHealthy = deployment.readyCount === deployment.desiredCount

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['deployments'] })
    }

    const handleRestart = async () => {
        if (!deployment) return

        setIsRestarting(true)
        toast.loading(`Restarting ${deployment.name}...`, { id: 'restart' })

        try {
            await restartWorkload('deployment', deployment.namespace, deployment.name)
            toast.success(`Rolling restart triggered for ${deployment.name}`, { id: 'restart' })
            queryClient.invalidateQueries({ queryKey: ['deployments'] })
        } catch (error) {
            toast.error(`Failed to restart: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'restart' })
        } finally {
            setIsRestarting(false)
        }
    }

    const handleScale = async () => {
        if (!deployment) return

        setIsScaling(true)
        toast.loading(`Scaling ${deployment.name} to ${newReplicas} replicas...`, { id: 'scale' })

        try {
            await scaleWorkload('deployment', deployment.namespace, deployment.name, newReplicas)
            toast.success(`Scaled ${deployment.name} to ${newReplicas} replicas`, { id: 'scale' })
            queryClient.invalidateQueries({ queryKey: ['deployments'] })
            setShowScalePopover(false)
        } catch (error) {
            toast.error(`Failed to scale: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'scale' })
        } finally {
            setIsScaling(false)
        }
    }

    const openScalePopover = () => {
        setNewReplicas(deployment.desiredCount)
        setShowScalePopover(true)
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {/* Header */}
                    <SheetHeader
                        className="border-b border-border px-6 py-4"
                        resourceKind="deployments"
                        resourceName={deployment.name}
                        namespace={deployment.namespace}
                        onYamlSuccess={handleYamlSuccess}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Server className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <SheetTitle className="font-mono text-base">
                                        {deployment.name}
                                    </SheetTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {deployment.namespace}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusDot
                                    status={isHealthy ? 'success' : 'warning'}
                                    label={deployment.replicas}
                                />
                            </div>
                        </div>
                    </SheetHeader>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/30">
                        {/* Scale Button with Popover */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={openScalePopover}
                                className="gap-2"
                            >
                                <Scale className="h-4 w-4" />
                                Scale
                            </Button>

                            {showScalePopover && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowScalePopover(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-2 z-50 w-64 p-4 bg-popover border border-border rounded-lg shadow-xl">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Current:</span>
                                                <span className="font-mono">{deployment.desiredCount}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">New:</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={newReplicas}
                                                    onChange={(e) => setNewReplicas(parseInt(e.target.value) || 0)}
                                                    className="w-20 h-8 text-center font-mono"
                                                />
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setNewReplicas(Math.max(0, newReplicas - 1))}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        -
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setNewReplicas(newReplicas + 1)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowScalePopover(false)}
                                                    className="flex-1"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={handleScale}
                                                    disabled={isScaling || newReplicas === deployment.desiredCount}
                                                    className="flex-1"
                                                >
                                                    {isScaling ? 'Scaling...' : 'Confirm'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

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
                                        {deployment.replicas}
                                    </span>
                                    <span className="text-muted-foreground">replicas ready</span>
                                </div>
                            </div>

                            {/* Container Images */}
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Container Images</h3>
                                <div className="flex flex-wrap gap-2">
                                    {deployment.images.map((image, idx) => (
                                        <Badge key={idx} variant="secondary" className="font-mono text-xs">
                                            {image}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Pod Selector */}
                            {deployment.selector && Object.keys(deployment.selector).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Pod Selector</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(deployment.selector).map(([k, v]) => (
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
                                <span>{deployment.age}</span>
                            </div>
                        </TabsContent>

                        {/* Logs Tab */}
                        <TabsContent value="logs" className="flex-1 overflow-hidden">
                            <AggregatedLogs
                                selector={selectorString}
                                namespace={deployment.namespace}
                            />
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>
        </>
    )
}
