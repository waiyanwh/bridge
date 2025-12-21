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
import { EventsTable } from '@/components/events/EventsTable'
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

