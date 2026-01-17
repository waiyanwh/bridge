import { Activity } from 'lucide-react'
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
import type { EventInfo } from '@/api'

interface EventsTableProps {
    events: EventInfo[]
}

export function EventsTable({ events }: EventsTableProps) {
    if (events.length === 0) {
        return (
            <TableEmptyState
                icon={Activity}
                title="No events found"
                description="No events have been recorded in this namespace."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
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
                            {/* Type - Dot Badge */}
                            <TableCell>
                                <StatusDot
                                    status={event.type === 'Warning' ? 'error' : 'default'}
                                    label={event.type}
                                    withBackground
                                />
                            </TableCell>
                            {/* Reason */}
                            <TableCell className="font-medium text-sm">
                                {event.reason}
                            </TableCell>
                            {/* Object - monospace */}
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {event.objectKind}/{event.objectName}
                                    </span>
                                    {event.objectNs && (
                                        <span className="text-xs text-muted-foreground/60">
                                            {event.objectNs}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            {/* Message */}
                            <TableCell className="text-sm whitespace-normal break-words">
                                {event.message}
                            </TableCell>
                            {/* Last Seen */}
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
