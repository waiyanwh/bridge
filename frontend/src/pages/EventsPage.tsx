import { useState } from 'react'
import { RefreshCw, AlertCircle, Activity, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEvents } from '@/hooks'
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
import type { EventInfo } from '@/api'

export function EventsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useEvents(namespace)
    const [warningsOnly, setWarningsOnly] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['events', namespace] })
    }

    // Filter events
    const filteredEvents = data?.events.filter(event =>
        !warningsOnly || event.type === 'Warning'
    ) || []

    const warningCount = data?.events.filter(e => e.type === 'Warning').length || 0

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${filteredEvents.length} events${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
                            : 'Loading...'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={warningsOnly ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setWarningsOnly(!warningsOnly)}
                        className="gap-2"
                    >
                        <AlertTriangle className="h-4 w-4" />
                        {warningsOnly ? `Warnings (${warningCount})` : 'Show Warnings Only'}
                    </Button>
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

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">Failed to load Events</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <EventsTable events={filteredEvents} />
            )}
        </div>
    )
}

function EventsTable({ events }: { events: EventInfo[] }) {
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No events found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[140px]">Reason</TableHead>
                        <TableHead className="w-[200px]">Object</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-[100px]">Last Seen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, idx) => (
                        <TableRow
                            key={`${event.objectNs}/${event.objectName}-${event.reason}-${idx}`}
                            className={event.type === 'Warning' ? 'bg-red-500/5' : ''}
                        >
                            <TableCell>
                                {event.type === 'Warning' ? (
                                    <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                                        Warning
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        Normal
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="font-medium text-sm">{event.reason}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-mono text-sm">
                                        {event.objectKind}/{event.objectName}
                                    </span>
                                    {event.objectNs && (
                                        <span className="text-xs text-muted-foreground">
                                            {event.objectNs}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm max-w-md truncate" title={event.message}>
                                {event.message}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {event.lastSeenAge || '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
