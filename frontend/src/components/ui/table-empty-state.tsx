import * as React from 'react'
import { LucideIcon, Inbox, Search, FileQuestion, Database, Server, Box } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableEmptyStateProps {
    /** Icon to display (defaults to Inbox) */
    icon?: LucideIcon
    /** Main title text */
    title: string
    /** Description text below the title */
    description?: string
    /** Optional action button */
    action?: React.ReactNode
    /** Additional className for the container */
    className?: string
}

/**
 * Empty state component for tables with a nice icon illustration.
 * Use this when a table has no data to display.
 */
export function TableEmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className,
}: TableEmptyStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-8",
            className
        )}>
            {/* Icon with subtle background */}
            <div className="rounded-full bg-muted/50 p-4 mb-4">
                <Icon className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h3 className="text-base font-medium text-foreground mb-1">
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {description}
                </p>
            )}

            {/* Optional action */}
            {action && (
                <div className="mt-4">
                    {action}
                </div>
            )}
        </div>
    )
}

// Pre-configured empty states for common resources
export function EmptyPods({ className }: { className?: string }) {
    return (
        <TableEmptyState
            icon={Box}
            title="No pods found"
            description="There are no pods in this namespace, or they don't match your current filters."
            className={className}
        />
    )
}

export function EmptyDeployments({ className }: { className?: string }) {
    return (
        <TableEmptyState
            icon={Server}
            title="No deployments found"
            description="There are no deployments in this namespace."
            className={className}
        />
    )
}

export function EmptySearch({ query, className }: { query?: string; className?: string }) {
    return (
        <TableEmptyState
            icon={Search}
            title="No results found"
            description={query ? `No results match "${query}". Try adjusting your search.` : "No results match your search."}
            className={className}
        />
    )
}

export function EmptyData({ className, resourceType = "data" }: { className?: string; resourceType?: string }) {
    return (
        <TableEmptyState
            icon={Database}
            title={`No ${resourceType}`}
            description={`There is no ${resourceType} to display.`}
            className={className}
        />
    )
}

export function EmptyUnknown({ className }: { className?: string }) {
    return (
        <TableEmptyState
            icon={FileQuestion}
            title="Nothing here"
            description="There's no content to display."
            className={className}
        />
    )
}
