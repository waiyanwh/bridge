import { cn } from '@/lib/utils'

type StatusType = 'success' | 'warning' | 'error' | 'default' | 'info'

interface StatusDotProps {
    status: StatusType
    label: string
    className?: string
    /** Show with background wrapper (pill style) */
    withBackground?: boolean
}

// Dot colors for each status
const dotColors: Record<StatusType, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    default: 'bg-zinc-400',
}

// Text colors for each status (darker for light theme visibility)
const textColors: Record<StatusType, string> = {
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-red-700 dark:text-red-400',
    info: 'text-blue-700 dark:text-blue-400',
    default: 'text-muted-foreground',
}

// Background colors for pill style (higher opacity for visibility)
const bgColors: Record<StatusType, string> = {
    success: 'bg-emerald-100 dark:bg-emerald-500/20',
    warning: 'bg-amber-100 dark:bg-amber-500/20',
    error: 'bg-red-100 dark:bg-red-500/20',
    info: 'bg-blue-100 dark:bg-blue-500/20',
    default: 'bg-muted',
}

export function StatusDot({ status, label, className, withBackground = false }: StatusDotProps) {
    const content = (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Dot */}
            <div className={cn('h-2 w-2 rounded-full shrink-0', dotColors[status])} />
            {/* Label */}
            <span className={cn('text-sm font-medium', withBackground ? textColors[status] : 'text-foreground')}>
                {label}
            </span>
        </div>
    )

    if (withBackground) {
        return (
            <div className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                bgColors[status]
            )}>
                {content}
            </div>
        )
    }

    return content
}

// Helper to convert pod status to StatusType
export function getPodStatusType(status: string): StatusType {
    const normalized = status.toLowerCase()

    if (normalized === 'running' || normalized === 'succeeded' || normalized === 'completed') {
        return 'success'
    }
    if (normalized === 'pending' || normalized === 'terminating' || normalized.includes('init')) {
        return 'warning'
    }
    if (
        normalized === 'failed' ||
        normalized === 'error' ||
        normalized.includes('error') ||
        normalized === 'crashloopbackoff' ||
        normalized === 'imagepullbackoff'
    ) {
        return 'error'
    }

    return 'default'
}
