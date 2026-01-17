import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    className?: string
    side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false)

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    }

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    className={cn(
                        'absolute z-50 px-3 py-2 text-sm rounded-md shadow-md',
                        'bg-popover text-popover-foreground border border-border',
                        'whitespace-nowrap animate-in fade-in-0 zoom-in-95',
                        positionClasses[side],
                        className
                    )}
                >
                    {content}
                </div>
            )}
        </div>
    )
}
