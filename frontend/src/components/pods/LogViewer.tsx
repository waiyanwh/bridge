import { useEffect, useRef, useState } from 'react'
import { usePodLogs } from '@/hooks'
import { Wifi, WifiOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogViewerProps {
    namespace: string
    podName: string
    container?: string
}

export function LogViewer({ namespace, podName, container }: LogViewerProps) {
    const { logs, isConnected, error, clearLogs } = usePodLogs({
        namespace,
        podName,
        container,
        enabled: true,
    })

    const containerRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)

    // Auto-scroll to bottom when new logs arrive (if autoScroll is enabled)
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
    }, [logs, autoScroll])

    // Detect when user scrolls up to disable auto-scroll
    const handleScroll = () => {
        if (!containerRef.current) return

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

        setAutoScroll(isAtBottom)
    }

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    {!autoScroll && (
                        <span className="text-xs text-amber-400">
                            (Scroll paused)
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLogs}
                    className="h-7 gap-1.5 text-xs"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                </Button>
            </div>

            {/* Log container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className={cn(
                    'flex-1 overflow-auto bg-background p-3 font-mono text-sm',
                    'scrollbar-thin scrollbar-track-background scrollbar-thumb-muted'
                )}
            >
                {error && (
                    <div className="text-red-400">Error: {error}</div>
                )}
                {logs.length === 0 && !error && (
                    <div className="text-muted-foreground">Waiting for logs...</div>
                )}
                {logs.map((line, index) => (
                    <div
                        key={index}
                        className="whitespace-pre-wrap break-all text-green-400 leading-relaxed"
                    >
                        {line}
                    </div>
                ))}
            </div>

            {/* Jump to bottom button */}
            {!autoScroll && (
                <button
                    onClick={() => {
                        setAutoScroll(true)
                        if (containerRef.current) {
                            containerRef.current.scrollTop = containerRef.current.scrollHeight
                        }
                    }}
                    className="absolute bottom-4 right-4 rounded bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                    Jump to bottom
                </button>
            )}
        </div>
    )
}
