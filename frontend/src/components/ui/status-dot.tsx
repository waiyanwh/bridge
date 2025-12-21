import { cn } from '@/lib/utils'

type StatusType = 'success' | 'warning' | 'error' | 'default'

interface StatusDotProps {
    status: StatusType
    label: string
    className?: string
}

const statusColors: Record<StatusType, string> = {
    success: '#22c55e', // green-500
    warning: '#f59e0b', // amber-500
    error: '#ef4444',   // red-500
    default: '#6b7280', // gray-500
}

export function StatusDot({ status, label, className }: StatusDotProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill={statusColors[status]} />
            </svg>
            <span className="text-sm">{label}</span>
        </div>
    )
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
