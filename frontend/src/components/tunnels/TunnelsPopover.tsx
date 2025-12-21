import { useState } from 'react'
import { Cable, Trash2, ExternalLink, X } from 'lucide-react'
import { useTunnels, useDeleteTunnel } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TunnelInfo } from '@/api'

interface TunnelsPopoverProps {
    open: boolean
    onClose: () => void
}

export function TunnelsPopover({ open, onClose }: TunnelsPopoverProps) {
    const { data, isLoading } = useTunnels()
    const deleteTunnel = useDeleteTunnel()

    if (!open) return null

    const tunnels = data?.tunnels || []
    const activeTunnels = tunnels.filter(t => t.status === 'Active')

    const handleDelete = (id: string) => {
        deleteTunnel.mutate(id)
    }

    const handleOpenUrl = (url: string) => {
        window.open(url, '_blank')
    }

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Popover positioned near bottom-left */}
            <div
                className="absolute left-20 bottom-20 w-96 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Cable className="h-5 w-5 text-blue-400" />
                        <h3 className="font-semibold">Port Forwards</h3>
                        {activeTunnels.length > 0 && (
                            <Badge className="bg-green-500/20 text-green-400">
                                {activeTunnels.length} active
                            </Badge>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="max-h-80 overflow-y-auto p-2">
                    {isLoading && (
                        <div className="text-center py-4 text-muted-foreground">
                            Loading...
                        </div>
                    )}

                    {!isLoading && tunnels.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Cable className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No active tunnels</p>
                            <p className="text-xs mt-1">Forward ports from Pod or Service views</p>
                        </div>
                    )}

                    {tunnels.map((tunnel) => (
                        <TunnelItem
                            key={tunnel.id}
                            tunnel={tunnel}
                            onDelete={handleDelete}
                            onOpenUrl={handleOpenUrl}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

interface TunnelItemProps {
    tunnel: TunnelInfo
    onDelete: (id: string) => void
    onOpenUrl: (url: string) => void
}

function TunnelItem({ tunnel, onDelete, onOpenUrl }: TunnelItemProps) {
    const isActive = tunnel.status === 'Active'

    return (
        <div
            className={cn(
                'rounded-md p-3 mb-1',
                isActive ? 'bg-zinc-800' : 'bg-zinc-800/50'
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                isActive ? 'bg-green-400' : 'bg-red-400'
                            )}
                        />
                        <span className="font-mono text-sm font-medium truncate">
                            {tunnel.resourceName}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                            {tunnel.resourceType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {tunnel.namespace}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <code className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded">
                            :{tunnel.targetPort} → :{tunnel.localPort}
                        </code>
                        {isActive && (
                            <button
                                onClick={() => onOpenUrl(tunnel.url)}
                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                                localhost:{tunnel.localPort}
                                <ExternalLink className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    {tunnel.errorMsg && (
                        <p className="text-xs text-red-400 mt-1">{tunnel.errorMsg}</p>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(tunnel.id)}
                    className="text-muted-foreground hover:text-red-400"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

// Sidebar button component
export function TunnelsButton() {
    const [open, setOpen] = useState(false)
    const { data } = useTunnels()

    const activeTunnels = data?.tunnels.filter(t => t.status === 'Active').length || 0

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                    'text-muted-foreground hover:bg-zinc-800 hover:text-foreground',
                    'focus:outline-none relative'
                )}
            >
                <Cable className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">
                    Tunnels
                </span>
                {activeTunnels > 0 && (
                    <span className="absolute right-2 h-5 w-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center">
                        {activeTunnels}
                    </span>
                )}
            </button>
            <TunnelsPopover open={open} onClose={() => setOpen(false)} />
        </>
    )
}

// Compact version for collapsed sidebar
export function TunnelsButtonCompact() {
    const [open, setOpen] = useState(false)
    const { data } = useTunnels()

    const activeTunnels = data?.tunnels.filter(t => t.status === 'Active').length || 0

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    'flex w-full items-center justify-center rounded-md px-3 py-2.5 transition-colors',
                    'text-muted-foreground hover:bg-zinc-800 hover:text-foreground',
                    'focus:outline-none relative'
                )}
            >
                <Cable className="h-5 w-5" />
                {activeTunnels > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center">
                        {activeTunnels}
                    </span>
                )}
            </button>
            <TunnelsPopover open={open} onClose={() => setOpen(false)} />
        </>
    )
}
