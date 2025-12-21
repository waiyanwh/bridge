import { RefreshCw, AlertCircle, Database } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePVs } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { PVInfo } from '@/api'

export function PVsPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = usePVs()

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pvs'] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Persistent Volumes</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} PVs in cluster` : 'Loading...'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">Failed to load PVs</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <PVsTable pvs={data.pvs} />
            )}
        </div>
    )
}

function getStatusIndicator(status: string) {
    switch (status) {
        case 'Bound':
            return <span className="h-2 w-2 rounded-full bg-green-400" />
        case 'Available':
            return <span className="h-2 w-2 rounded-full bg-blue-400" />
        case 'Released':
            return <span className="h-2 w-2 rounded-full bg-amber-400" />
        case 'Failed':
            return <span className="h-2 w-2 rounded-full bg-red-400" />
        default:
            return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    }
}

function getReclaimPolicyBadge(policy: string) {
    switch (policy) {
        case 'Delete':
            return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">{policy}</Badge>
        case 'Retain':
            return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">{policy}</Badge>
        case 'Recycle':
            return <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">{policy}</Badge>
        default:
            return <Badge variant="secondary">{policy}</Badge>
    }
}

function PVsTable({ pvs }: { pvs: PVInfo[] }) {
    if (pvs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Database className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No PVs found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Access Modes</TableHead>
                        <TableHead>Reclaim Policy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Claim</TableHead>
                        <TableHead>Storage Class</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pvs.map((pv) => (
                        <TableRow key={pv.name}>
                            <TableCell className="font-mono text-sm font-medium">{pv.name}</TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {pv.capacity}
                                </code>
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    {pv.accessModes.map((mode, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                            {mode}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell>{getReclaimPolicyBadge(pv.reclaimPolicy)}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {getStatusIndicator(pv.status)}
                                    <span className="text-sm">{pv.status}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {pv.claim ? (
                                    <span className="font-mono text-sm text-blue-400">
                                        {pv.claim}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-sm">
                                {pv.storageClass || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{pv.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
