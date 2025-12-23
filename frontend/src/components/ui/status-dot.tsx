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
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    error: 'bg-red-400',
    info: 'bg-blue-400',
    default: 'bg-zinc-400',
}

// Text colors for each status
const textColors: Record<StatusType, string> = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    info: 'text-blue-400',
    default: 'text-muted-foreground',
}

// Background colors for pill style (low opacity)
const bgColors: Record<StatusType, string> = {
    success: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    error: 'bg-red-500/10',
    info: 'bg-blue-500/10',
    default: 'bg-muted/50',
}

export function StatusDot({ status, label, className, withBackground = false }: StatusDotProps) {
    const content = (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Dot */}
            <div className={cn('h-2 w-2 rounded-full', dotColors[status])} />
            {/* Label */}
            <span className={cn('text-sm', withBackground ? textColors[status] : 'text-foreground')}>
                {label}
            </span>
        </div>
    )

    if (withBackground) {
        return (
            <div className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1',
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
