import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RefreshCw, AlertCircle, ChevronLeft } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomResources } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { CRDDetailSheet } from '@/components/CRDDetailSheet'
import { formatDistanceToNow } from 'date-fns'

// Evaluate a JSONPath expression on an object
function evaluateJSONPath(obj: Record<string, unknown>, jsonPath: string): string {
    try {
        // Simple JSONPath evaluator for common patterns
        // Supports: .metadata.name, .spec.replicas, etc.
        const path = jsonPath.replace(/^\./, '').split('.')
        let current: unknown = obj

        for (const key of path) {
            if (current === null || current === undefined) {
                return '-'
            }
            if (typeof current !== 'object') {
                return String(current)
            }
            current = (current as Record<string, unknown>)[key]
        }

        if (current === null || current === undefined) {
            return '-'
        }

        return String(current)
    } catch {
        return '-'
    }
}

// Format cell value based on column type
function formatCellValue(value: string, type: string): string {
    if (value === '-') return value

    if (type === 'date') {
        try {
            const date = new Date(value)
            return formatDistanceToNow(date, { addSuffix: true })
        } catch {
            return value
        }
    }

    return value
}

export function CRDListPage() {
    const navigate = useNavigate()
    const { group, version, resource } = useParams<{
        group: string
        version: string
        resource: string
    }>()
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? undefined : selectedNamespace

    const { data, isLoading, isError, isFetching, error } = useCustomResources(
        group || '',
        version || '',
        resource || '',
        namespace
    )

    // Detail sheet state
    const [detailSheetOpen, setDetailSheetOpen] = useState(false)
    const [detailResource, setDetailResource] = useState<Record<string, unknown> | null>(null)

    const handleRefresh = () => {
        queryClient.invalidateQueries({
            queryKey: ['custom-resources', group, version, resource, namespace]
        })
    }

    const handleRowClick = (item: Record<string, unknown>) => {
        setDetailResource(item)
        setDetailSheetOpen(true)
    }

    const getResourceName = (item: Record<string, unknown>): string => {
        const metadata = item.metadata as Record<string, unknown> | undefined
        return (metadata?.name as string) || 'Unknown'
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/crds')}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight capitalize">
                            {resource}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {group}/{version}
                            </span>
                            {data && (
                                <span className="ml-2">
                                    {data.count} {data.count === 1 ? 'resource' : 'resources'}
                                    {namespace ? ` in "${namespace}"` : ' across all namespaces'}
                                </span>
                            )}
                        </p>
                    </div>
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

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Error State */}
            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">
                        {error instanceof Error ? error.message : 'Failed to load resources'}
                    </p>
                </div>
            )}

            {/* Data Table */}
            {!isLoading && !isError && data && (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {data.columns.map((col) => (
                                    <TableHead key={col.name}>{col.name}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={data.columns.length + 1}
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        No resources found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.items.map((item, idx) => (
                                    <TableRow
                                        key={getResourceName(item) + '-' + idx}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleRowClick(item)}
                                    >
                                        {data.columns.map((col) => (
                                            <TableCell key={col.name} className="font-mono text-sm">
                                                {formatCellValue(
                                                    evaluateJSONPath(item, col.jsonPath),
                                                    col.type
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* CRD Detail Sheet */}
            <CRDDetailSheet
                resource={detailResource}
                open={detailSheetOpen}
                onOpenChange={setDetailSheetOpen}
                group={group || ''}
                version={version || ''}
                resourceType={resource || ''}
                onRefresh={handleRefresh}
            />
        </div>
    )
}

