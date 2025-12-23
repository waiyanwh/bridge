import { useState } from 'react'
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
import { StatusDot } from '@/components/ui/status-dot'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { PVInfo } from '@/api'

export function PVsPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = usePVs()

    const [selectedPV, setSelectedPV] = useState<PVInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pvs'] })
    }

    const handleRowClick = (pv: PVInfo) => {
        setSelectedPV(pv)
        setSheetOpen(true)
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
                <PVsTable
                    pvs={data.pvs}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedPV && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="persistentvolumes"
                                resourceName={selectedPV.name}
                                namespace=""
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Database className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedPV.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Cluster Scoped
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Status</span>
                                            <div className="mt-1">
                                                <StatusDot
                                                    status={getPVStatusType(selectedPV.status)}
                                                    label={selectedPV.status}
                                                    withBackground
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Capacity</span>
                                            <p className="font-mono">{selectedPV.capacity}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Reclaim Policy</span>
                                            <div className="mt-1">
                                                <StatusDot
                                                    status={getReclaimPolicyStatus(selectedPV.reclaimPolicy)}
                                                    label={selectedPV.reclaimPolicy}
                                                    withBackground
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Storage Class</span>
                                            <p>{selectedPV.storageClass || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Claim</span>
                                            <p className="font-mono text-xs text-muted-foreground">{selectedPV.claim || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedPV.age}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground text-sm block mb-2">Access Modes</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedPV.accessModes.map((mode, i) => (
                                                <Badge key={i} variant="secondary" className="font-mono text-xs">
                                                    {mode}
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

function getPVStatusType(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
    switch (status) {
        case 'Bound':
            return 'success'
        case 'Available':
            return 'info'
        case 'Released':
            return 'warning'
        case 'Failed':
            return 'error'
        default:
            return 'default'
    }
}

function getReclaimPolicyStatus(policy: string): 'success' | 'warning' | 'error' | 'default' {
    switch (policy) {
        case 'Delete':
            return 'error'
        case 'Retain':
            return 'success'
        case 'Recycle':
            return 'warning'
        default:
            return 'default'
    }
}

function PVsTable({ pvs, onRowClick }: { pvs: PVInfo[], onRowClick: (pv: PVInfo) => void }) {
    if (pvs.length === 0) {
        return (
            <TableEmptyState
                icon={Database}
                title="No Persistent Volumes found"
                description="There are no Persistent Volumes in the cluster."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
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
                        <TableRow
                            key={pv.name}
                            clickable
                            onClick={() => onRowClick(pv)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {pv.name}
                            </TableCell>
                            {/* Capacity */}
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {pv.capacity}
                                </code>
                            </TableCell>
                            {/* Access Modes */}
                            <TableCell>
                                <div className="flex gap-1">
                                    {pv.accessModes.map((mode, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                            {mode}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            {/* Reclaim Policy - dot badge */}
                            <TableCell>
                                <StatusDot
                                    status={getReclaimPolicyStatus(pv.reclaimPolicy)}
                                    label={pv.reclaimPolicy}
                                    withBackground
                                />
                            </TableCell>
                            {/* Status - dot badge */}
                            <TableCell>
                                <StatusDot
                                    status={getPVStatusType(pv.status)}
                                    label={pv.status}
                                    withBackground
                                />
                            </TableCell>
                            {/* Claim - monospace */}
                            <TableCell>
                                {pv.claim ? (
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {pv.claim}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            {/* Storage Class */}
                            <TableCell className="text-sm">
                                {pv.storageClass || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {pv.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
