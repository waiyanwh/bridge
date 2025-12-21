import { cn } from '@/lib/utils'

interface ProgressProps {
    value: number
    max?: number
    className?: string
    indicatorClassName?: string
}

export function Progress({
    value,
    max = 100,
    className,
    indicatorClassName,
}: ProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    // Determine color based on value
    const getColorClass = () => {
        if (percentage >= 90) return 'bg-red-500'
        if (percentage >= 80) return 'bg-amber-500'
        return 'bg-muted-foreground/50'
    }

    return (
        <div
            className={cn(
                'relative h-2 w-full overflow-hidden rounded-full bg-muted',
                className
            )}
        >
            <div
                className={cn(
                    'h-full transition-all duration-300 ease-out',
                    getColorClass(),
                    indicatorClassName
                )}
                style={{ width: `${percentage}%` }}
            />
        </div>
    )
}
