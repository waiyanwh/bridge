import { RefreshCw, AlertCircle, Clock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCronJobs } from '@/hooks'
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
import type { CronJobInfo } from '@/api'

export function CronJobsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useCronJobs(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['cronjobs', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">CronJobs</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} cronjobs${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load CronJobs</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <CronJobsTable cronJobs={data.cronJobs} />
            )}
        </div>
    )
}

function CronJobsTable({ cronJobs }: { cronJobs: CronJobInfo[] }) {
    if (cronJobs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No CronJobs found</p>
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
                        <TableHead>Schedule</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Suspend</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cronJobs.map((cj) => (
                        <TableRow key={`${cj.namespace}/${cj.name}`}>
                            <TableCell className="font-mono text-sm font-medium">{cj.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{cj.namespace}</TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {cj.schedule}
                                </code>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {cj.lastScheduleTime}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${cj.active > 0 ? 'bg-green-400' : 'bg-muted-foreground/30'}`} />
                                    <span className="text-sm">{cj.active}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {cj.suspend ? (
                                    <Badge variant="secondary" className="text-amber-400">Suspended</Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-green-400">Active</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{cj.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
