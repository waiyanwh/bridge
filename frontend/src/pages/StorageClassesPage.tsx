import { useState } from 'react'
import { RefreshCw, AlertCircle, Layers, Check, X, Star } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useStorageClasses } from '@/hooks'
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
import type { StorageClassInfo } from '@/api'

export function StorageClassesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = useStorageClasses()

    const [selectedStorageClass, setSelectedStorageClass] = useState<StorageClassInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['storageclasses'] })
    }

    const handleRowClick = (sc: StorageClassInfo) => {
        setSelectedStorageClass(sc)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Storage Classes</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} storage classes in cluster` : 'Loading...'}
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
                    <p className="text-destructive">Failed to load Storage Classes</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <StorageClassesTable
                    storageClasses={data.storageClasses}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedStorageClass && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="storageclasses"
                                resourceName={selectedStorageClass.name}
                                namespace=""
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <SheetTitle className="font-mono text-base">
                                                {selectedStorageClass.name}
                                            </SheetTitle>
                                            {selectedStorageClass.isDefault && (
                                                <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 gap-1 h-5 text-xs">
                                                    <Star className="h-3 w-3" />
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
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
                                            <span className="text-muted-foreground">Provisioner</span>
                                            <code className="block mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs w-fit">
                                                {selectedStorageClass.provisioner}
                                            </code>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Reclaim Policy</span>
                                            <div className="mt-1">
                                                <StatusDot
                                                    status={selectedStorageClass.reclaimPolicy === 'Delete' ? 'error' : 'success'}
                                                    label={selectedStorageClass.reclaimPolicy}
                                                    withBackground
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Volume Binding</span>
                                            <p>{selectedStorageClass.volumeBinding || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Allow Expansion</span>
                                            <div className="mt-1">
                                                {selectedStorageClass.allowExpansion ? (
                                                    <div className="flex items-center gap-1 text-emerald-500">
                                                        <Check className="h-4 w-4" />
                                                        <span>Yes</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <X className="h-4 w-4" />
                                                        <span>No</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedStorageClass.age}</p>
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

function StorageClassesTable({ storageClasses, onRowClick }: { storageClasses: StorageClassInfo[], onRowClick: (sc: StorageClassInfo) => void }) {
    if (storageClasses.length === 0) {
        return (
            <TableEmptyState
                icon={Layers}
                title="No Storage Classes found"
                description="There are no Storage Classes in the cluster."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Provisioner</TableHead>
                        <TableHead>Reclaim Policy</TableHead>
                        <TableHead>Volume Binding</TableHead>
                        <TableHead>Expansion</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {storageClasses.map((sc) => (
                        <TableRow
                            key={sc.name}
                            clickable
                            onClick={() => onRowClick(sc)}
                        >
                            {/* Name with default badge */}
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">{sc.name}</span>
                                    {sc.isDefault && (
                                        <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 gap-1">
                                            <Star className="h-3 w-3" />
                                            Default
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            {/* Provisioner */}
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {sc.provisioner}
                                </code>
                            </TableCell>
                            {/* Reclaim Policy - dot badge */}
                            <TableCell>
                                <StatusDot
                                    status={sc.reclaimPolicy === 'Delete' ? 'error' : 'success'}
                                    label={sc.reclaimPolicy}
                                    withBackground
                                />
                            </TableCell>
                            {/* Volume Binding */}
                            <TableCell className="text-sm">
                                {sc.volumeBinding || '-'}
                            </TableCell>
                            {/* Expansion */}
                            <TableCell>
                                {sc.allowExpansion ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                    <X className="h-4 w-4 text-muted-foreground/50" />
                                )}
                            </TableCell>
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {sc.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
