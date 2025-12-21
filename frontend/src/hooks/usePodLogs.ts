import { useState, useEffect, useRef, useCallback } from 'react'
import { getPodLogsWebSocketUrl } from '@/api'

interface UsePodLogsOptions {
    namespace: string
    podName: string
    container?: string
    enabled?: boolean
}

interface UsePodLogsResult {
    logs: string[]
    isConnected: boolean
    error: string | null
    clearLogs: () => void
}

export function usePodLogs({
    namespace,
    podName,
    container,
    enabled = true,
}: UsePodLogsOptions): UsePodLogsResult {
    const [logs, setLogs] = useState<string[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const wsRef = useRef<WebSocket | null>(null)

    const clearLogs = useCallback(() => {
        setLogs([])
    }, [])

    useEffect(() => {
        if (!enabled || !namespace || !podName) {
            return
        }

        const url = getPodLogsWebSocketUrl(namespace, podName, container)
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
            setError(null)
        }

        ws.onmessage = (event) => {
            const line = event.data as string
            setLogs((prev) => [...prev, line])
        }

        ws.onerror = () => {
            setError('WebSocket connection failed')
            setIsConnected(false)
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [namespace, podName, container, enabled])

    return { logs, isConnected, error, clearLogs }
}
