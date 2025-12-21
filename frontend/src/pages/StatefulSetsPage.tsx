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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
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
        if (selectedStatefulSet) {
            // Re-fetch logic if we had full detail view, currently list refresh is enough for now
        }
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
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedStatefulSet && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="statefulsets"
                                resourceName={selectedStatefulSet.name}
                                namespace={selectedStatefulSet.namespace}
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Database className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedStatefulSet.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedStatefulSet.namespace}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Replicas</span>
                                            <p className="font-mono">{selectedStatefulSet.readyCount} / {selectedStatefulSet.desiredCount}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedStatefulSet.age}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground text-sm block mb-2">Images</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedStatefulSet.images.map((img, i) => (
                                                <Badge key={i} variant="secondary" className="font-mono text-xs">
                                                    {img}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function StatefulSetsTable({ statefulSets, onRowClick }: { statefulSets: StatefulSetInfo[], onRowClick: (sts: StatefulSetInfo) => void }) {
    if (statefulSets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Database className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No StatefulSets found</p>
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
                        <TableHead>Replicas</TableHead>
                        <TableHead>Images</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {statefulSets.map((s) => (
                        <TableRow
                            key={`${s.namespace}/${s.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(s)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{s.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{s.namespace}</TableCell>
                            <TableCell>
                                <span className={
                                    s.readyCount < s.desiredCount
                                        ? 'font-medium text-amber-400'
                                        : 'text-green-400'
                                }>
                                    {s.replicas}
                                </span>
                            </TableCell>
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
                            <TableCell className="text-muted-foreground">{s.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
