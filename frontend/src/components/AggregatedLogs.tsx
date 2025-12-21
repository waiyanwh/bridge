import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, AlertCircle, Play, Pause, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogLine {
    pod: string
    container: string
    message: string
    timestamp?: string
}

interface InitMessage {
    type: 'init'
    pods: string[]
    count: number
}

// Color palette for different pods
const podColors = [
    'text-blue-400',
    'text-purple-400',
    'text-pink-400',
    'text-cyan-400',
    'text-emerald-400',
    'text-amber-400',
    'text-rose-400',
    'text-indigo-400',
    'text-teal-400',
    'text-orange-400',
]

interface AggregatedLogsProps {
    selector: string
    namespace: string
}

export function AggregatedLogs({ selector, namespace }: AggregatedLogsProps) {
    const [logs, setLogs] = useState<LogLine[]>([])
    const [pods, setPods] = useState<string[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const podColorMap = useRef<Map<string, string>>(new Map())
    const pendingLogs = useRef<LogLine[]>([])
    const isPausedRef = useRef(false)

    // Keep ref in sync with state
    useEffect(() => {
        isPausedRef.current = isPaused
    }, [isPaused])

    // Get or assign a color for a pod
    const getPodColor = useCallback((podName: string) => {
        if (!podColorMap.current.has(podName)) {
            const colorIndex = podColorMap.current.size % podColors.length
            podColorMap.current.set(podName, podColors[colorIndex])
        }
        return podColorMap.current.get(podName) || 'text-gray-400'
    }, [])

    // Connect to WebSocket
    useEffect(() => {
        if (!selector) return

        // Flag to track if this effect is still active (for React Strict Mode)
        let isActive = true

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/api/v1/logs/stream?selector=${encodeURIComponent(selector)}&namespace=${encodeURIComponent(namespace)}`

        console.log('[AggregatedLogs] Connecting to:', wsUrl)

        // Close any existing connection first
        if (wsRef.current) {
            console.log('[AggregatedLogs] Closing existing connection')
            wsRef.current.close()
        }

        setIsConnecting(true)
        setError(null)
        setLogs([])
        setPods([])
        podColorMap.current.clear()

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            if (!isActive) return
            console.log('[AggregatedLogs] Connected!')
            setIsConnected(true)
            setIsConnecting(false)
            setError(null) // Clear any previous error
        }

        ws.onmessage = (event) => {
            if (!isActive) return
            try {
                const data = JSON.parse(event.data)

                // Handle init message
                if (data.type === 'init') {
                    const initMsg = data as InitMessage
                    console.log('[AggregatedLogs] Init message, pods:', initMsg.pods)
                    setPods(initMsg.pods)
                    return
                }

                // Handle log line
                const logLine = data as LogLine

                if (isPausedRef.current) {
                    pendingLogs.current.push(logLine)
                } else {
                    setLogs(prev => {
                        const newLogs = [...prev, logLine]
                        // Keep only last 1000 lines
                        if (newLogs.length > 1000) {
                            return newLogs.slice(-1000)
                        }
                        return newLogs
                    })
                }
            } catch {
                // Handle plain text error messages
                console.log('[AggregatedLogs] Received:', event.data)
                if (event.data.startsWith('ERROR:')) {
                    setError(event.data)
                }
            }
        }

        ws.onerror = (event) => {
            // Only set error if this effect is still active (not cleaned up by strict mode)
            if (!isActive) return
            console.error('[AggregatedLogs] WebSocket error:', event)
            setError('WebSocket connection failed')
            setIsConnected(false)
            setIsConnecting(false)
        }

        ws.onclose = (event) => {
            if (!isActive) return
            console.log('[AggregatedLogs] Connection closed:', event.code, event.reason)
            setIsConnected(false)
            setIsConnecting(false)
        }

        return () => {
            console.log('[AggregatedLogs] Cleanup, closing connection')
            isActive = false
            ws.close()
        }
    }, [selector, namespace]) // Removed isPaused - use ref instead

    // Auto-scroll to bottom
    useEffect(() => {
        if (!isPaused && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, isPaused])

    // Resume: flush pending logs
    const handleResume = () => {
        setIsPaused(false)
        if (pendingLogs.current.length > 0) {
            setLogs(prev => [...prev, ...pendingLogs.current].slice(-1000))
            pendingLogs.current = []
        }
    }

    const handleClear = () => {
        setLogs([])
    }

    if (isConnecting) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Connecting to log stream...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="text-red-400">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-2 w-2 rounded-full",
                        isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    )} />
                    <span className="text-sm text-muted-foreground">
                        Streaming from {pods.length} pod{pods.length !== 1 ? 's' : ''}
                    </span>
                    {isPaused && (
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400">
                            Paused ({pendingLogs.current.length} pending)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-7 text-xs"
                    >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={isPaused ? handleResume : () => setIsPaused(true)}
                        className="h-7 text-xs"
                    >
                        {isPaused ? (
                            <>
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                            </>
                        ) : (
                            <>
                                <Pause className="h-3 w-3 mr-1" />
                                Pause
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Pod legend */}
            {pods.length > 1 && (
                <div className="flex flex-wrap gap-2 p-2 border-b border-zinc-800 bg-zinc-900/30">
                    {pods.map(pod => (
                        <span
                            key={pod}
                            className={cn("text-xs font-mono px-2 py-0.5 rounded bg-zinc-800", getPodColor(pod))}
                        >
                            {pod}
                        </span>
                    ))}
                </div>
            )}

            {/* Log content */}
            <div className="flex-1 overflow-auto bg-zinc-950 font-mono text-xs p-3">
                {logs.length === 0 ? (
                    <div className="text-muted-foreground text-center py-8">
                        Waiting for logs...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="flex gap-2 hover:bg-zinc-900/50 py-0.5">
                            {pods.length > 1 && (
                                <span className={cn("shrink-0 w-[200px] truncate", getPodColor(log.pod))}>
                                    [{log.pod}]
                                </span>
                            )}
                            <span className="text-foreground whitespace-pre-wrap break-all">
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>
        </div>
    )
}
