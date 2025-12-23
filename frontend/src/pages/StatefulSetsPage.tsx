import { useState } from 'react'
import { RefreshCw, AlertCircle, Database } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useStatefulSets } from '@/hooks'
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
import { StatusDot } from '@/components/ui/status-dot'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { StatefulSetDetailSheet } from '@/components/StatefulSetDetailSheet'
import type { StatefulSetInfo } from '@/api'

export function StatefulSetsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useStatefulSets(namespace)

    const [selectedStatefulSet, setSelectedStatefulSet] = useState<StatefulSetInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['statefulsets', namespace] })
    }

    const handleRowClick = (sts: StatefulSetInfo) => {
        setSelectedStatefulSet(sts)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">StatefulSets</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} statefulsets${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load StatefulSets</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <StatefulSetsTable
                    statefulSets={data.statefulSets}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <StatefulSetDetailSheet
                statefulSet={selectedStatefulSet}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}

function StatefulSetsTable({ statefulSets, onRowClick }: { statefulSets: StatefulSetInfo[], onRowClick: (sts: StatefulSetInfo) => void }) {
    if (statefulSets.length === 0) {
        return (
            <TableEmptyState
                icon={Database}
                title="No StatefulSets found"
                description="There are no StatefulSets in this namespace."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Replicas</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {statefulSets.map((s) => {
                        const isHealthy = s.readyCount >= s.desiredCount
                        return (
                            <TableRow
                                key={`${s.namespace}/${s.name}`}
                                clickable
                                onClick={() => onRowClick(s)}
                            >
                                {/* Name - monospace */}
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {s.name}
                                </TableCell>
                                {/* Namespace */}
                                <TableCell className="text-sm text-muted-foreground">
                                    {s.namespace}
                                </TableCell>
                                {/* Replicas - dot status */}
                                <TableCell>
                                    <StatusDot
                                        status={isHealthy ? 'success' : 'warning'}
                                        label={s.replicas}
                                        withBackground
                                    />
                                </TableCell>
                                {/* Images */}
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                                        {s.images.map((image, idx) => (
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
                                {/* Age */}
                                <TableCell className="text-muted-foreground text-sm">
                                    {s.age}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
