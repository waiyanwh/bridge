import { RefreshCw, AlertCircle, HardDrive } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePVCs } from '@/hooks'
import { useNamespaceStore } from '@/store'
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
import type { PVCInfo } from '@/api'

export function PVCsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = usePVCs(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pvcs', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Persistent Volume Claims</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} PVCs${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
                            : 'Loading...'}
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
                    <p className="text-destructive">Failed to load PVCs</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <PVCsTable pvcs={data.pvcs} />
            )}
        </div>
    )
}

function getStatusIndicator(status: string) {
    switch (status) {
        case 'Bound':
            return <span className="h-2 w-2 rounded-full bg-green-400" />
        case 'Pending':
            return <span className="h-2 w-2 rounded-full bg-amber-400" />
        case 'Lost':
            return <span className="h-2 w-2 rounded-full bg-red-400" />
        default:
            return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    }
}

function PVCsTable({ pvcs }: { pvcs: PVCInfo[] }) {
    if (pvcs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <HardDrive className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No PVCs found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Access Mode</TableHead>
                        <TableHead>Storage Class</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pvcs.map((pvc) => (
                        <TableRow key={`${pvc.namespace}/${pvc.name}`}>
                            <TableCell className="font-mono text-sm font-medium">{pvc.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{pvc.namespace}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {getStatusIndicator(pvc.status)}
                                    <span className="text-sm">{pvc.status}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {pvc.capacity || '-'}
                                </code>
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    {pvc.accessModes.map((mode, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                            {mode}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">
                                {pvc.storageClass || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                                {pvc.volumeName ? (
                                    <span className="font-mono text-sm text-blue-400 hover:underline cursor-pointer">
                                        {pvc.volumeName}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{pvc.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
