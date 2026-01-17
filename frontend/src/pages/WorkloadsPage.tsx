import { useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePods } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusDot, getPodStatusType } from '@/components/ui/status-dot'
import { PodDetailSheet } from '@/components/pods'
import type { Pod } from '@/types'

// Get badge variant for priority class
function getPriorityVariant(priorityClassName?: string): 'destructive' | 'secondary' | 'outline' {
    if (!priorityClassName) return 'outline'
    const lower = priorityClassName.toLowerCase()
    if (lower.includes('high') || lower.includes('critical')) return 'destructive'
    return 'secondary'
}

// Helper to parse age strings for sorting (e.g., "2d", "4h", "30m", "10s")
function parseAgeToSeconds(age: string): number {
    const match = age.match(/^(\d+)([dhms])$/)
    if (!match) return 0
    const value = parseInt(match[1], 10)
    const unit = match[2]
    switch (unit) {
        case 'd': return value * 86400
        case 'h': return value * 3600
        case 'm': return value * 60
        case 's': return value
        default: return 0
    }
}

const columns: Column<Pod>[] = [
    {
        key: 'name',
        header: 'Name',
        width: '22%',
        sortable: true,
        className: 'font-mono',
        render: (pod) => (
            <span className="font-mono text-sm">{pod.name}</span>
        ),
    },
    {
        key: 'namespace',
        header: 'Namespace',
        width: '10%',
        sortable: true,
        render: (pod) => (
            <span className="text-sm text-muted-foreground">{pod.namespace}</span>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        width: '10%',
        sortable: true,
        render: (pod) => (
            <StatusDot status={getPodStatusType(pod.status)} label={pod.status} />
        ),
    },
    {
        key: 'priority',
        header: 'Priority',
        width: '12%',
        sortable: true,
        sortingFn: (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        render: (pod) => {
            if (!pod.priorityClassName) {
                return <span className="text-muted-foreground text-sm">-</span>
            }
            return (
                <Tooltip content={`Priority: ${pod.priority ?? 0}`}>
                    <Badge variant={getPriorityVariant(pod.priorityClassName)} className="text-xs">
                        {pod.priorityClassName}
                    </Badge>
                </Tooltip>
            )
        },
    },
    {
        key: 'node',
        header: 'Node',
        width: '12%',
        sortable: true,
        render: (pod) => (
            <span className="text-sm text-muted-foreground">{pod.node || '-'}</span>
        ),
    },
    {
        key: 'restarts',
        header: 'Restarts',
        width: '7%',
        align: 'center',
        sortable: true,
        render: (pod) => (
            <span className={pod.restarts > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                {pod.restarts}
            </span>
        ),
    },
    {
        key: 'age',
        header: 'Age',
        width: '7%',
        sortable: true,
        sortingFn: (a, b) => parseAgeToSeconds(b.age) - parseAgeToSeconds(a.age),
        render: (pod) => (
            <span className="text-muted-foreground">{pod.age}</span>
        ),
    },
    {
        key: 'ip',
        header: 'IP',
        width: '12%',
        sortable: true,
        className: 'font-mono',
        render: (pod) => (
            <span className="font-mono text-sm text-muted-foreground">{pod.ip}</span>
        ),
    },
]

export function WorkloadsPage() {
    const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()

    // Use "all" to list all namespaces, convert to empty string for API
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, error, isFetching } = usePods(namespace)

    const handleRowClick = (pod: Pod) => {
        setSelectedPod(pod)
        setSheetOpen(true)
    }

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pods', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pods</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} pods${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
                            : 'Loading...'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <kbd className="hidden rounded bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline-block">
                        ⌘K
                    </kbd>
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
            </div>

            {/* Error State */}
            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                        <p className="font-medium text-destructive">Failed to load pods</p>
                        <p className="text-sm text-muted-foreground">{error?.message}</p>
                    </div>
                </div>
            )}

            {/* Data Table */}
            {!isError && (
                <DataTable
                    data={data?.pods ?? []}
                    columns={columns}
                    keyExtractor={(pod) => `${pod.namespace}/${pod.name}`}
                    searchKey="name"
                    searchPlaceholder="Search by pod name..."
                    isLoading={isLoading}
                    emptyMessage="No pods found in this namespace."
                    onRowClick={handleRowClick}
                />
            )}

            {/* Pod Detail Sheet */}
            <PodDetailSheet
                pod={selectedPod}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}
