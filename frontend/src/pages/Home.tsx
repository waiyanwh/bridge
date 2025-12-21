import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Users,
    Clock,
    Layers,
    Shield,
    ExternalLink,
    BookOpen,
    ArrowRight,
    RefreshCw,
    Server,
    CheckCircle2,
    AlertTriangle,
    Activity,
    Box,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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

interface DashboardStats {
    clusterHealth: ClusterHealth
    namespaceCount: number
    accessStats: AccessStats
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

    const isHealthy = clusterHealth.status === 'Healthy'

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
                {/* Cluster Health */}
                <div className="rounded-lg border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Cluster Health</span>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`h-3 w-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
                            <div className={`absolute inset-0 h-3 w-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'} animate-ping opacity-75`} />
                        </div>
                        <span className={`text-2xl font-bold ${isHealthy ? 'text-green-400' : 'text-amber-400'}`}>
                            {clusterHealth.status}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {clusterHealth.readyNodes}/{clusterHealth.totalNodes} nodes ready
                    </p>
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

                {/* Namespaces */}
                <div className="rounded-lg border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Namespaces</span>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold">{namespaceCount}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Available namespaces
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
                    <CheckCircle2 className={`h-5 w-5 ${isHealthy ? 'text-green-400' : 'text-amber-400'}`} />
                    <h2 className="text-lg font-semibold">
                        {isHealthy ? 'All Systems Operational' : 'Some Systems Degraded'}
                    </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className="text-2xl font-bold">{clusterHealth.totalNodes}</div>
                        <div className="text-sm text-muted-foreground">Total Nodes</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className={`text-2xl font-bold ${clusterHealth.readyNodes === clusterHealth.totalNodes ? 'text-green-400' : 'text-amber-400'}`}>
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
