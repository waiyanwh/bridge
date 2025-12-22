import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Users,
    Clock,
    Shield,
    ExternalLink,
    BookOpen,
    ArrowRight,
    RefreshCw,
    Server,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Activity,
    Box,
    Cpu,
    WifiOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceGauge } from '@/components/dashboard/ResourceGauge'

type ClusterStatus = 'healthy' | 'degraded' | 'disconnected' | 'unknown'

const API_BASE = '/api/v1'

interface ClusterHealth {
    status: string
    totalNodes: number
    readyNodes: number
    notReady: number
}

interface AccessStats {
    activeUsers: number
    expiringSoon: number
    permanent: number
}

interface ResourceUsage {
    usage: string
    capacity: string
    percentage: number
}

interface DashboardStats {
    clusterHealth: ClusterHealth
    namespaceCount: number
    accessStats: AccessStats
    cpu?: ResourceUsage
    memory?: ResourceUsage
}

export function Home() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Load dashboard stats
    useEffect(() => {
        const loadStats = async () => {
            try {
                const response = await fetch(`${API_BASE}/dashboard/stats`)
                const data = await response.json()
                if (response.ok) {
                    setStats(data)
                } else {
                    setError(data.message || 'Failed to load dashboard stats')
                }
            } catch (err) {
                console.error('Failed to load dashboard stats:', err)
                setError('Failed to connect to server')
            } finally {
                setIsLoading(false)
            }
        }
        loadStats()

        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000)
        return () => clearInterval(interval)
    }, [])

    // Extract stats with defaults
    const clusterHealth = stats?.clusterHealth || { status: 'Unknown', totalNodes: 0, readyNodes: 0, notReady: 0 }
    const accessStats = stats?.accessStats || { activeUsers: 0, expiringSoon: 0, permanent: 0 }
    const namespaceCount = stats?.namespaceCount || 0

    // Determine actual cluster status - 0 nodes means disconnected/unreachable
    const getClusterStatus = (): ClusterStatus => {
        if (error) return 'disconnected'
        if (clusterHealth.totalNodes === 0) return 'disconnected'
        if (clusterHealth.status === 'Healthy') return 'healthy'
        if (clusterHealth.status === 'Degraded') return 'degraded'
        return 'unknown'
    }
    
    const clusterStatus = getClusterStatus()
    const isDisconnected = clusterStatus === 'disconnected'
    const isDegraded = clusterStatus === 'degraded'
    
    // Display text for cluster status
    const getStatusText = () => {
        switch (clusterStatus) {
            case 'healthy': return 'Healthy'
            case 'degraded': return 'Degraded'
            case 'disconnected': return 'Disconnected'
            default: return 'Unknown'
        }
    }
    
    // Status color classes
    const getStatusColor = () => {
        switch (clusterStatus) {
            case 'healthy': return 'text-green-400'
            case 'degraded': return 'text-amber-400'
            case 'disconnected': return 'text-red-400'
            default: return 'text-muted-foreground'
        }
    }
    
    const getDotColor = () => {
        switch (clusterStatus) {
            case 'healthy': return 'bg-green-500'
            case 'degraded': return 'bg-amber-500'
            case 'disconnected': return 'bg-red-500'
            default: return 'bg-zinc-500'
        }
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Mission Control
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Bridge cluster access overview
                    </p>
                </div>
                {isLoading && (
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cluster Health & Resources */}
                <div className="rounded-lg border bg-card p-4 space-y-3 col-span-1 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Cluster Status</span>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Health Status */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className={`h-3 w-3 rounded-full ${getDotColor()}`} />
                                    {!isDisconnected && (
                                        <div className={`absolute inset-0 h-3 w-3 rounded-full ${getDotColor()} animate-ping opacity-75`} />
                                    )}
                                </div>
                                <span className={`text-2xl font-bold ${getStatusColor()}`}>
                                    {getStatusText()}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isDisconnected 
                                    ? 'Unable to reach cluster' 
                                    : `${clusterHealth.readyNodes}/${clusterHealth.totalNodes} nodes ready`
                                }
                            </p>
                        </div>

                        {/* Resource Gauges */}
                        <div className="flex justify-end gap-2 border-l pl-4 border-white/5">
                            {stats?.cpu && stats?.memory ? (
                                <>
                                    <ResourceGauge
                                        label="CPU"
                                        value={stats.cpu.percentage}
                                        usage={stats.cpu.usage}
                                        capacity={stats.cpu.capacity}
                                    />
                                    <ResourceGauge
                                        label="Memory"
                                        value={stats.memory.percentage}
                                        usage={stats.memory.usage}
                                        capacity={stats.memory.capacity}
                                    />
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground/50 text-xs h-full w-full">
                                    <Cpu className="h-6 w-6 mb-1 opacity-50" />
                                    <span>Metrics not available</span>
                                    {/* <span className="text-[10px] opacity-40">(Install Metrics Server)</span> */}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Access */}
                <div className="rounded-lg border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Active Access</span>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold">{accessStats.activeUsers}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Users with active kubeconfig
                    </p>
                </div>

                {/* Expiring Soon */}
                <div className="rounded-lg border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Expiring Soon</span>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-3xl font-bold ${accessStats.expiringSoon > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                            {accessStats.expiringSoon}
                        </span>
                        {accessStats.expiringSoon > 0 && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                                &lt; 24h
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Tokens expiring within 24 hours
                    </p>
                </div>
            </div>

            {/* Quick Actions Section */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Grant Access Card */}
                    <Link to="/team-access" className="block">
                        <div className="rounded-lg border bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 p-6 h-full hover:border-indigo-500/50 transition-colors cursor-pointer group">
                            <div className="flex flex-col h-full">
                                <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 w-fit mb-4">
                                    <Shield className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="font-semibold text-lg group-hover:text-indigo-400 transition-colors">
                                    Grant New Access
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 flex-1">
                                    Create RBAC-scoped kubeconfig tokens for team members
                                </p>
                                <div className="flex items-center text-sm text-indigo-400 gap-1 mt-4">
                                    <span>Open Access Control</span>
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Explore Workloads Card */}
                    <Link to="/pods" className="block">
                        <div className="rounded-lg border bg-card p-6 h-full hover:border-cyan-500/50 transition-colors cursor-pointer group">
                            <div className="flex flex-col h-full">
                                <div className="p-3 rounded-lg bg-zinc-800 w-fit mb-4">
                                    <Box className="h-6 w-6 text-cyan-400" />
                                </div>
                                <h3 className="font-semibold text-lg group-hover:text-cyan-400 transition-colors">
                                    Explore Workloads
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 flex-1">
                                    View pods, deployments, and services across namespaces
                                </p>
                                <div className="flex items-center text-sm text-cyan-400 gap-1 mt-4">
                                    <span>View Pods</span>
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Topology Map Card */}
                    <Link to="/topology" className="block">
                        <div className="rounded-lg border bg-card p-6 h-full hover:border-purple-500/50 transition-colors cursor-pointer group">
                            <div className="flex flex-col h-full">
                                <div className="p-3 rounded-lg bg-zinc-800 w-fit mb-4">
                                    <Activity className="h-6 w-6 text-purple-400" />
                                </div>
                                <h3 className="font-semibold text-lg group-hover:text-purple-400 transition-colors">
                                    Topology Map
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 flex-1">
                                    Visualize cluster resources and their relationships
                                </p>
                                <div className="flex items-center text-sm text-purple-400 gap-1 mt-4">
                                    <span>View Map</span>
                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Documentation Card */}
                    <div className="rounded-lg border bg-card p-6 h-full hover:border-emerald-500/50 transition-colors cursor-pointer group">
                        <div className="flex flex-col h-full">
                            <div className="p-3 rounded-lg bg-zinc-800 w-fit mb-4">
                                <BookOpen className="h-6 w-6 text-emerald-400" />
                            </div>
                            <h3 className="font-semibold text-lg group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                                Documentation
                                <ExternalLink className="h-4 w-4" />
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 flex-1">
                                Learn about Bridge features and best practices
                            </p>
                            <div className="flex items-center text-sm text-emerald-400 gap-1 mt-4">
                                <span>Read Docs</span>
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cluster Status Summary */}
            <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    {isDisconnected ? (
                        <WifiOff className="h-5 w-5 text-red-400" />
                    ) : isDegraded ? (
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                    ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                    )}
                    <h2 className="text-lg font-semibold">
                        {isDisconnected 
                            ? 'Cluster Unreachable' 
                            : isDegraded 
                                ? 'Some Systems Degraded' 
                                : 'All Systems Operational'
                        }
                    </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className={`text-2xl font-bold ${isDisconnected ? 'text-red-400' : ''}`}>
                            {clusterHealth.totalNodes}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Nodes</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className={`text-2xl font-bold ${
                            isDisconnected 
                                ? 'text-red-400' 
                                : clusterHealth.readyNodes === clusterHealth.totalNodes 
                                    ? 'text-green-400' 
                                    : 'text-amber-400'
                        }`}>
                            {clusterHealth.readyNodes}
                        </div>
                        <div className="text-sm text-muted-foreground">Ready Nodes</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className="text-2xl font-bold">{accessStats.activeUsers}</div>
                        <div className="text-sm text-muted-foreground">Active Users</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className="text-2xl font-bold">{namespaceCount}</div>
                        <div className="text-sm text-muted-foreground">Namespaces</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
