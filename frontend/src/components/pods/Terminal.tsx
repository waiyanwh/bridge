import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalProps {
    namespace: string
    podName: string
    container?: string
    command?: string
}

export function Terminal({ namespace, podName, container, command }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Send resize message to backend
    const sendResize = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
            const { cols, rows } = xtermRef.current
            wsRef.current.send(JSON.stringify({
                type: 'resize',
                cols,
                rows,
            }))
        }
    }, [])

    useEffect(() => {
        if (!terminalRef.current) return

        // Create terminal
        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            theme: {
                background: '#1a1b26',
                foreground: '#a9b1d6',
                cursor: '#c0caf5',
                cursorAccent: '#1a1b26',
                selectionBackground: '#33467c',
                black: '#32344a',
                red: '#f7768e',
                green: '#9ece6a',
                yellow: '#e0af68',
                blue: '#7aa2f7',
                magenta: '#ad8ee6',
                cyan: '#449dab',
                white: '#787c99',
                brightBlack: '#444b6a',
                brightRed: '#ff7a93',
                brightGreen: '#b9f27c',
                brightYellow: '#ff9e64',
                brightBlue: '#7da6ff',
                brightMagenta: '#bb9af7',
                brightCyan: '#0db9d7',
                brightWhite: '#acb0d0',
            },
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Connect WebSocket - don't pass command to let backend use bash
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        let wsUrl = `${protocol}//${host}/api/v1/exec?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(podName)}`
        if (container) {
            wsUrl += `&container=${encodeURIComponent(container)}`
        }
        if (command) {
            wsUrl += `&command=${encodeURIComponent(command)}`
        }

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
            setIsConnected(true)
            setError(null)
            term.focus()
            // Send initial size
            sendResize()
        }

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const text = new TextDecoder().decode(event.data)
                term.write(text)
            } else {
                term.write(event.data)
            }
        }

        ws.onerror = () => {
            setError('WebSocket connection failed')
            setIsConnected(false)
        }

        ws.onclose = () => {
            setIsConnected(false)
            term.write('\r\n\x1b[33mConnection closed\x1b[0m\r\n')
        }

        // Send input to WebSocket
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data)
            }
        })

        // Handle resize
        const handleResize = () => {
            fitAddon.fit()
            sendResize()
        }

        window.addEventListener('resize', handleResize)

        // Resize observer for container size changes
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit()
            sendResize()
        })
        resizeObserver.observe(terminalRef.current)

        return () => {
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
            ws.close()
            term.dispose()
        }
    }, [namespace, podName, container, command, sendResize])

    return (
        <div className="flex h-full flex-col">
            {/* Status bar */}
            <div className="flex items-center justify-between border-b border-border bg-[#1a1b26] px-3 py-1.5">
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-mono text-xs text-muted-foreground">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                    {container || 'default'} • {command || 'bash'}
                </span>
            </div>

            {/* Terminal container */}
            <div
                ref={terminalRef}
                className="flex-1 bg-[#1a1b26] p-2"
                style={{ minHeight: '300px' }}
            />

            {/* Error message */}
            {error && (
                <div className="border-t border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                </div>
            )}
        </div>
    )
}
