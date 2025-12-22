import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Activity, Box, Layers, Settings, RefreshCw, ChevronLeft } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePods, useServices, useDeployments, useEvents, useResourceQuotas } from '@/hooks'
import { DeploymentsTable } from '@/components/deployments/DeploymentsTable'
import { ServicesTable } from '@/components/services/ServicesTable'
import { EventsTable } from '@/components/events/EventsTable'
import { DeploymentDetailSheet } from '@/components/DeploymentDetailSheet'
import { ServiceDetailSheet } from '@/components/ServiceDetailSheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import type { DeploymentInfo, ServiceInfo } from '@/api'

export function NamespaceDetailPage() {
    const navigate = useNavigate()
    const { namespace } = useParams<{ namespace: string }>()
    const ns = namespace || 'default'
    const queryClient = useQueryClient()

    // Data fetching
    const { data: podsData } = usePods(ns)
    const { data: deploymentsData } = useDeployments(ns)
    const { data: servicesData } = useServices(ns)
    const { data: eventsData } = useEvents(ns)
    const { data: quotaData } = useResourceQuotas(ns)

    // State
    const [activeTab, setActiveTab] = useState('workloads')
    const [selectedDeployment, setSelectedDeployment] = useState<DeploymentInfo | null>(null)
    const [deploymentSheetOpen, setDeploymentSheetOpen] = useState(false)
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null)
    const [serviceSheetOpen, setServiceSheetOpen] = useState(false)

    // Handlers
    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: [ns] })
    }

    const handleDeploymentClick = (d: DeploymentInfo) => {
        setSelectedDeployment(d)
        setDeploymentSheetOpen(true)
    }

    const handleServiceClick = (s: ServiceInfo) => {
        setSelectedService(s)
        setServiceSheetOpen(true)
    }

    // Calculations
    const runningPods = podsData?.pods.filter(p => p.status === 'Running').length || 0
    const totalPods = podsData?.count || 0
    const failedPods = podsData?.pods.filter(p => p.status !== 'Running' && p.status !== 'Pending' && p.status !== 'Succeeded').length || 0

    // We show all events but might want to highlight warnings in the Glance
    const warningEvents = eventsData?.events.filter(e => e.type === 'Warning') || []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/namespaces')}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight font-mono">{ns}</h1>
                        <Badge variant="outline" className="gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Active
                        </Badge>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Glance Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Workloads</CardTitle>
                        <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalPods}</div>
                        <p className="text-xs text-muted-foreground">
                            {runningPods} Running, {failedPods} Failed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Network</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{servicesData?.count || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            Services Active
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Events</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{eventsData?.count || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            {warningEvents.length} Warnings
                        </p>
                    </CardContent>
                </Card>

                {/* Resource Quota (if available) */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resource Quota</CardTitle>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {quotaData?.quotas && quotaData.quotas.length > 0 ? (
                            <div className="space-y-3 pt-1">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">CPU</span>
                                        <span>{Math.round(quotaData.quotas[0].cpuUsagePercent || 0)}%</span>
                                    </div>
                                    <Progress value={quotaData.quotas[0].cpuUsagePercent} className="h-1.5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Mem</span>
                                        <span>{Math.round(quotaData.quotas[0].memoryUsagePercent || 0)}%</span>
                                    </div>
                                    <Progress value={quotaData.quotas[0].memoryUsagePercent} className="h-1.5" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-[44px] items-center text-xs text-muted-foreground">
                                No quotas defined
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Lists */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="workloads">Top Workloads</TabsTrigger>
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="events">Recent Events</TabsTrigger>
                </TabsList>

                <TabsContent value="workloads" className="space-y-4">
                    <DeploymentsTable
                        deployments={deploymentsData?.deployments || []}
                        onRowClick={handleDeploymentClick}
                    />
                </TabsContent>

                <TabsContent value="services" className="space-y-4">
                    <ServicesTable
                        services={servicesData?.services || []}
                        onRowClick={handleServiceClick}
                        onForwardPort={() => { }} // Pass empty function or handle if needed
                    />
                </TabsContent>

                <TabsContent value="events" className="space-y-4">
                    <EventsTable events={eventsData?.events || []} />
                </TabsContent>
            </Tabs>

            <DeploymentDetailSheet
                deployment={selectedDeployment}
                open={deploymentSheetOpen}
                onOpenChange={setDeploymentSheetOpen}
            />

            <ServiceDetailSheet
                service={selectedService}
                open={serviceSheetOpen}
                onOpenChange={setServiceSheetOpen}
            />
        </div>
    )
}
