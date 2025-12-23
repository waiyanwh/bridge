import { useState } from 'react'
import { RefreshCw, AlertCircle, Network } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useIngresses } from '@/hooks'
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
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { IngressDetailSheet } from '@/components/IngressDetailSheet'
import type { IngressInfo } from '@/api'

export function IngressesPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useIngresses(namespace)

    const [selectedIngress, setSelectedIngress] = useState<IngressInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['ingresses', namespace] })
    }

    const handleRowClick = (ing: IngressInfo) => {
        setSelectedIngress(ing)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Ingresses</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} ingresses${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Ingresses</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <IngressesTable
                    ingresses={data.ingresses}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <IngressDetailSheet
                ingress={selectedIngress}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}

function IngressesTable({ ingresses, onRowClick }: { ingresses: IngressInfo[], onRowClick: (ing: IngressInfo) => void }) {
    if (ingresses.length === 0) {
        return (
            <TableEmptyState
                icon={Network}
                title="No Ingresses found"
                description="There are no Ingresses in this namespace."
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
                        <TableHead>Class</TableHead>
                        <TableHead>Hosts</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ingresses.map((ing) => (
                        <TableRow
                            key={`${ing.namespace}/${ing.name}`}
                            clickable
                            onClick={() => onRowClick(ing)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {ing.name}
                            </TableCell>
                            {/* Namespace */}
                            <TableCell className="text-sm text-muted-foreground">
                                {ing.namespace}
                            </TableCell>
                            {/* Class */}
                            <TableCell>
                                {ing.class ? (
                                    <Badge variant="secondary">{ing.class}</Badge>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            {/* Hosts */}
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    {ing.hosts.length > 0 ? (
                                        ing.hosts.map((host, idx) => (
                                            <span key={idx} className="font-medium text-sm">
                                                {host}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-muted-foreground">*</span>
                                    )}
                                </div>
                            </TableCell>
                            {/* Address - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {ing.address || <span className="text-muted-foreground">Pending</span>}
                            </TableCell>
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {ing.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
