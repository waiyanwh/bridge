import { useState } from 'react'
import { X, Cable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateTunnel } from '@/hooks'
import type { CreateTunnelRequest } from '@/api'

interface ForwardPortDialogProps {
    open: boolean
    onClose: () => void
    namespace: string
    resourceType: 'pod' | 'service'
    resourceName: string
    availablePorts?: number[]
}

export function ForwardPortDialog({
    open,
    onClose,
    namespace,
    resourceType,
    resourceName,
    availablePorts = []
}: ForwardPortDialogProps) {
    const [targetPort, setTargetPort] = useState(availablePorts[0]?.toString() || '')
    const [localPort, setLocalPort] = useState('')
    const createTunnel = useCreateTunnel()

    if (!open) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const req: CreateTunnelRequest = {
            namespace,
            resourceType,
            resourceName,
            targetPort: parseInt(targetPort),
            localPort: localPort ? parseInt(localPort) : undefined,
        }

        try {
            await createTunnel.mutateAsync(req)
            onClose()
        } catch (err) {
            // Error is handled by the mutation
            console.error('Failed to create tunnel:', err)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-96 p-6 z-[101]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Cable className="h-5 w-5 text-blue-400" />
                        <h3 className="font-semibold">Forward Port</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Resource info */}
                <div className="mb-4 p-3 bg-zinc-800 rounded-md">
                    <p className="text-sm text-muted-foreground">
                        Forwarding from <span className="text-foreground font-medium">{resourceType}</span>
                    </p>
                    <p className="font-mono text-sm">{resourceName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{namespace}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Target Port <span className="text-red-400">*</span>
                        </label>
                        {availablePorts.length > 0 ? (
                            <select
                                value={targetPort}
                                onChange={(e) => setTargetPort(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm"
                            >
                                {availablePorts.map((port) => (
                                    <option key={port} value={port}>
                                        {port}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <Input
                                type="number"
                                value={targetPort}
                                onChange={(e) => setTargetPort(e.target.value)}
                                placeholder="e.g., 8080"
                                required
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Local Port <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <Input
                            type="number"
                            value={localPort}
                            onChange={(e) => setLocalPort(e.target.value)}
                            placeholder="Auto-assign"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Leave empty to auto-assign an available port
                        </p>
                    </div>

                    {createTunnel.error && (
                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                            {createTunnel.error.message}
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!targetPort || createTunnel.isPending}
                        >
                            {createTunnel.isPending ? 'Creating...' : 'Start Forward'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
