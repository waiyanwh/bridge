import { Activity } from 'lucide-react'
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

interface EventsTableProps {
    events: EventInfo[]
}

export function EventsTable({ events }: EventsTableProps) {
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
