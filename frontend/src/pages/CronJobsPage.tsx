import { useState } from 'react'
import { RefreshCw, AlertCircle, Clock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCronJobs } from '@/hooks'
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
import { StatusDot } from '@/components/ui/status-dot'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { CronJobInfo } from '@/api'

export function CronJobsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useCronJobs(namespace)

    const [selectedCronJob, setSelectedCronJob] = useState<CronJobInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['cronjobs', namespace] })
    }

    const handleRowClick = (cj: CronJobInfo) => {
        setSelectedCronJob(cj)
        setSheetOpen(true)
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
                <CronJobsTable
                    cronJobs={data.cronJobs}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedCronJob && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="cronjobs"
                                resourceName={selectedCronJob.name}
                                namespace={selectedCronJob.namespace}
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedCronJob.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedCronJob.namespace}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Schedule</span>
                                            <p className="font-mono">{selectedCronJob.schedule}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedCronJob.age}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Last Schedule</span>
                                            <p>{selectedCronJob.lastScheduleTime}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Active Jobs</span>
                                            <p>{selectedCronJob.active}</p>
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

function CronJobsTable({ cronJobs, onRowClick }: { cronJobs: CronJobInfo[], onRowClick: (cj: CronJobInfo) => void }) {
    if (cronJobs.length === 0) {
        return (
            <TableEmptyState
                icon={Clock}
                title="No CronJobs found"
                description="There are no CronJobs in this namespace."
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
                        <TableHead>Schedule</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cronJobs.map((cj) => (
                        <TableRow
                            key={`${cj.namespace}/${cj.name}`}
                            clickable
                            onClick={() => onRowClick(cj)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {cj.name}
                            </TableCell>
                            {/* Namespace */}
                            <TableCell className="text-sm text-muted-foreground">
                                {cj.namespace}
                            </TableCell>
                            {/* Schedule */}
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {cj.schedule}
                                </code>
                            </TableCell>
                            {/* Last Run */}
                            <TableCell className="text-sm text-muted-foreground">
                                {cj.lastScheduleTime || '-'}
                            </TableCell>
                            {/* Active - dot status */}
                            <TableCell>
                                <StatusDot
                                    status={cj.active > 0 ? 'success' : 'default'}
                                    label={String(cj.active)}
                                />
                            </TableCell>
                            {/* Suspend Status */}
                            <TableCell>
                                <StatusDot
                                    status={cj.suspend ? 'warning' : 'success'}
                                    label={cj.suspend ? 'Suspended' : 'Active'}
                                    withBackground
                                />
                            </TableCell>
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {cj.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
