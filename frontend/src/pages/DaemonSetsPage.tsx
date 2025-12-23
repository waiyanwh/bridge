import { useState } from 'react'
import { RefreshCw, AlertCircle, Layers } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDaemonSets } from '@/hooks'
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
import { DaemonSetDetailSheet } from '@/components/DaemonSetDetailSheet'
import type { DaemonSetInfo } from '@/api'

export function DaemonSetsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useDaemonSets(namespace)

    const [selectedDaemonSet, setSelectedDaemonSet] = useState<DaemonSetInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['daemonsets', namespace] })
    }

    const handleRowClick = (ds: DaemonSetInfo) => {
        setSelectedDaemonSet(ds)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">DaemonSets</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} daemonsets${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load DaemonSets</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <DaemonSetsTable
                    daemonSets={data.daemonSets}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <DaemonSetDetailSheet
                daemonSet={selectedDaemonSet}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}

function DaemonSetsTable({ daemonSets, onRowClick }: { daemonSets: DaemonSetInfo[], onRowClick: (ds: DaemonSetInfo) => void }) {
    if (daemonSets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No DaemonSets found</p>
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
                        <TableHead>Desired</TableHead>
                        <TableHead>Ready</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {daemonSets.map((ds) => (
                        <TableRow
                            key={`${ds.namespace}/${ds.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(ds)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{ds.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{ds.namespace}</TableCell>
                            <TableCell>{ds.desired}</TableCell>
                            <TableCell>
                                <span className={
                                    ds.ready < ds.desired
                                        ? 'font-medium text-amber-400'
                                        : 'text-green-400'
                                }>
                                    {ds.ready}/{ds.desired}
                                </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                    {ds.images.map((image, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="secondary"
                                            className="font-mono text-xs truncate max-w-[250px]"
                                            title={image}
                                        >
                                            {image.split('/').pop()?.split('@')[0] || image}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{ds.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
