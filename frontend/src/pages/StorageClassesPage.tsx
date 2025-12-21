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
import type { StorageClassInfo } from '@/api'

export function StorageClassesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = useStorageClasses()

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['storageclasses'] })
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
                <StorageClassesTable storageClasses={data.storageClasses} />
            )}
        </div>
    )
}

function StorageClassesTable({ storageClasses }: { storageClasses: StorageClassInfo[] }) {
    if (storageClasses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Storage Classes found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
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
                        <TableRow key={sc.name}>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-medium">{sc.name}</span>
                                    {sc.isDefault && (
                                        <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 gap-1">
                                            <Star className="h-3 w-3" />
                                            Default
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {sc.provisioner}
                                </code>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    className={
                                        sc.reclaimPolicy === 'Delete'
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                    }
                                >
                                    {sc.reclaimPolicy}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                                {sc.volumeBinding || '-'}
                            </TableCell>
                            <TableCell>
                                {sc.allowExpansion ? (
                                    <Check className="h-4 w-4 text-green-400" />
                                ) : (
                                    <X className="h-4 w-4 text-muted-foreground/50" />
                                )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{sc.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
