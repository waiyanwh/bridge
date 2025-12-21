import { useState } from 'react'
import { RefreshCw, AlertCircle, Activity } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHPAs } from '@/hooks'
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
import type { HPAInfo } from '@/api'

export function HPAPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useHPAs(namespace)

    const [selectedHPA, setSelectedHPA] = useState<HPAInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['hpas', namespace] })
    }

    const handleRowClick = (hpa: HPAInfo) => {
        setSelectedHPA(hpa)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Horizontal Pod Autoscalers</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} HPAs${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load HPAs</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <HPATable
                    hpas={data.hpas}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedHPA && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="horizontalpodautoscalers"
                                resourceName={selectedHPA.name}
                                namespace={selectedHPA.namespace}
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Activity className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedHPA.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedHPA.namespace}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Target</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-xs">
                                                    {selectedHPA.targetKind}
                                                </Badge>
                                                <span className="font-mono text-xs text-blue-400">{selectedHPA.targetRef}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedHPA.age}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Metrics</h4>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground text-xs">Replicas (Cur/Des)</span>
                                                <p className="font-mono">
                                                    <span className={selectedHPA.currentReplicas === selectedHPA.desiredReplicas ? 'text-green-400' : 'text-amber-400'}>
                                                        {selectedHPA.currentReplicas}
                                                    </span>
                                                    <span className="text-muted-foreground"> / {selectedHPA.desiredReplicas}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">Min / Max</span>
                                                <p className="font-mono">{selectedHPA.minReplicas} / {selectedHPA.maxReplicas}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">Utilization</span>
                                                <p className="font-mono">{selectedHPA.utilization}</p>
                                            </div>
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

function HPATable({ hpas, onRowClick }: { hpas: HPAInfo[], onRowClick: (hpa: HPAInfo) => void }) {
    if (hpas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No HPAs found</p>
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
                        <TableHead>Target</TableHead>
                        <TableHead>Min/Max</TableHead>
                        <TableHead>Replicas</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {hpas.map((hpa) => (
                        <TableRow
                            key={`${hpa.namespace}/${hpa.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(hpa)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{hpa.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{hpa.namespace}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {hpa.targetKind}
                                    </Badge>
                                    <span className="font-mono text-sm">{hpa.targetRef}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {hpa.minReplicas} / {hpa.maxReplicas}
                                </code>
                            </TableCell>
                            <TableCell>
                                <span className={
                                    hpa.currentReplicas === hpa.desiredReplicas
                                        ? 'text-green-400'
                                        : 'text-amber-400'
                                }>
                                    {hpa.currentReplicas}
                                </span>
                                <span className="text-muted-foreground"> / {hpa.desiredReplicas}</span>
                            </TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {hpa.utilization}
                                </code>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{hpa.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
