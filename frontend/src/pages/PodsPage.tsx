import { useState } from 'react'
import { RefreshCw, Search, AlertCircle } from 'lucide-react'
import { usePods } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { Pod } from '@/types'

// Get badge variant based on pod status
function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'secondary' {
    const normalizedStatus = status.toLowerCase()

    if (normalizedStatus === 'running') return 'success'
    if (normalizedStatus === 'pending' || normalizedStatus.includes('init')) return 'warning'
    if (
        normalizedStatus === 'failed' ||
        normalizedStatus === 'error' ||
        normalizedStatus.includes('error') ||
        normalizedStatus === 'crashloopbackoff' ||
        normalizedStatus === 'imagepullbackoff'
    ) {
        return 'error'
    }
    if (normalizedStatus === 'succeeded' || normalizedStatus === 'completed') return 'success'
    if (normalizedStatus === 'terminating') return 'warning'

    return 'secondary'
}

export function PodsPage() {
    const [namespace] = useState('default')
    const [searchQuery, setSearchQuery] = useState('')

    const { data, isLoading, isError, error, refetch, isFetching } = usePods(namespace)

    // Filter pods by search query
    const filteredPods = data?.pods.filter((pod: Pod) =>
        pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pod.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pod.status.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? []

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pods</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} pods in namespace "${data.namespace}"` : 'Loading pods...'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search pods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Error State */}
            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                        <p className="font-medium text-destructive">Failed to load pods</p>
                        <p className="text-sm text-muted-foreground">{error?.message}</p>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Pods Table */}
            {!isLoading && !isError && (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">Restarts</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>IP</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPods.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {searchQuery ? 'No pods match your search.' : 'No pods found in this namespace.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPods.map((pod: Pod) => (
                                    <TableRow key={pod.name} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell className="font-mono text-sm">{pod.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(pod.status)}>{pod.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={pod.restarts > 0 ? 'text-yellow-400' : ''}>
                                                {pod.restarts}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{pod.age}</TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">
                                            {pod.ip}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
