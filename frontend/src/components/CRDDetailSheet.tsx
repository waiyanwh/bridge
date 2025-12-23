import { useState } from 'react'
import { Info, Activity, Copy, Check, X, FileCode } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { YamlEditorDialog } from '@/components/YamlEditorDialog'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface CRDDetailSheetProps {
    resource: Record<string, unknown> | null
    open: boolean
    onOpenChange: (open: boolean) => void
    group: string
    version: string
    resourceType: string
    onRefresh?: () => void
}

export function CRDDetailSheet({
    resource,
    open,
    onOpenChange,
    group,
    version,
    resourceType,
}: CRDDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('summary')
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const [yamlDialogOpen, setYamlDialogOpen] = useState(false)

    if (!resource) return null

    const metadata = resource.metadata as Record<string, unknown> | undefined
    const spec = resource.spec as Record<string, unknown> | undefined
    const status = resource.status as Record<string, unknown> | undefined

    const name = (metadata?.name as string) || 'Unknown'
    const kind = (resource.kind as string) || resourceType
    const createdAt = metadata?.creationTimestamp as string | undefined
    const labels = metadata?.labels as Record<string, string> | undefined
    const annotations = metadata?.annotations as Record<string, string> | undefined

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const renderValue = (value: unknown, depth = 0): React.ReactNode => {
        if (value === null || value === undefined) {
            return <span className="text-muted-foreground">-</span>
        }
        if (typeof value === 'boolean') {
            return (
                <Badge variant={value ? 'success' : 'secondary'} className="text-xs">
                    {value ? 'true' : 'false'}
                </Badge>
            )
        }
        if (typeof value === 'number' || typeof value === 'string') {
            return <span className="font-mono text-sm break-all">{String(value)}</span>
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return <span className="text-muted-foreground text-sm">[]</span>
            }
            return (
                <div className="space-y-1">
                    {value.map((item, idx) => (
                        <div key={idx} className="text-sm">
                            {typeof item === 'object' ? (
                                <pre className="text-xs bg-muted/50 rounded px-2 py-1 overflow-x-auto">
                                    {JSON.stringify(item, null, 2)}
                                </pre>
                            ) : (
                                <span className="font-mono">{String(item)}</span>
                            )}
                        </div>
                    ))}
                </div>
            )
        }
        if (typeof value === 'object') {
            if (depth > 1) {
                return (
                    <pre className="text-xs bg-muted/50 rounded px-2 py-1 overflow-x-auto max-h-40">
                        {JSON.stringify(value, null, 2)}
                    </pre>
                )
            }
            const obj = value as Record<string, unknown>
            return (
                <div className="space-y-2 pl-2 border-l border-border/50">
                    {Object.entries(obj).map(([k, v]) => (
                        <div key={k}>
                            <span className="text-xs text-muted-foreground">{k}:</span>
                            <div className="mt-0.5">{renderValue(v, depth + 1)}</div>
                        </div>
                    ))}
                </div>
            )
        }
        return String(value)
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="flex w-[850px] max-w-4xl flex-col p-0 sm:max-w-4xl">
                    {/* Header - 2-row layout (shrink-0 prevents squishing) */}
                    <div className="shrink-0 border-b border-border px-6 py-4 space-y-1">
                        {/* Row 1: Name, Copy, Kind Badge ... Edit YAML, Close button */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SheetTitle className="text-xl font-bold">
                                    {name}
                                </SheetTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleCopy(name, 'name')}
                                >
                                    {copiedField === 'name' ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {kind}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setYamlDialogOpen(true)}
                                    title="Edit YAML"
                                >
                                    <FileCode className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onOpenChange(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {/* Row 2: group/version • Created age */}
                        <p className="text-sm text-muted-foreground">
                            {group}/{version}
                            {createdAt && (
                                <span> • Created {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
                            )}
                        </p>
                    </div>

                    {/* Tabs - flex-1 to fill remaining space, overflow-hidden to contain scrollable content */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="shrink-0 justify-start rounded-none border-b bg-transparent px-6 h-12">
                            <TabsTrigger
                                value="summary"
                                className={cn(
                                    "rounded-none border-b-2 border-transparent",
                                    activeTab === 'summary' && "border-primary"
                                )}
                            >
                                <Info className="h-4 w-4 mr-2" />
                                Summary
                            </TabsTrigger>
                            <TabsTrigger
                                value="events"
                                className={cn(
                                    "rounded-none border-b-2 border-transparent",
                                    activeTab === 'events' && "border-primary"
                                )}
                            >
                                <Activity className="h-4 w-4 mr-2" />
                                Events
                            </TabsTrigger>
                        </TabsList>

                        {/* Summary Tab */}
                        <TabsContent value="summary" className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Labels */}
                            {labels && Object.keys(labels).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Labels</h3>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(labels).map(([key, value]) => (
                                            <Badge key={key} variant="secondary" className="text-xs font-mono">
                                                {key}={value}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Annotations */}
                            {annotations && Object.keys(annotations).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Annotations</h3>
                                    <div className="space-y-1 text-xs">
                                        {Object.entries(annotations).slice(0, 10).map(([key, value]) => (
                                            <div key={key} className="flex gap-2">
                                                <span className="text-muted-foreground truncate max-w-[200px]">{key}:</span>
                                                <span className="font-mono truncate">{value}</span>
                                            </div>
                                        ))}
                                        {Object.keys(annotations).length > 10 && (
                                            <span className="text-muted-foreground">
                                                +{Object.keys(annotations).length - 10} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Status */}
                            {status && Object.keys(status).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Status</h3>
                                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                        {Object.entries(status).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-sm text-muted-foreground">{key}</span>
                                                <div className="mt-1">{renderValue(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Spec */}
                            {spec && Object.keys(spec).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Spec</h3>
                                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                        {Object.entries(spec).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-sm text-muted-foreground">{key}</span>
                                                <div className="mt-1">{renderValue(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Events Tab */}
                        <TabsContent value="events" className="flex-1 overflow-y-auto p-6">
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                                <Activity className="h-12 w-12" />
                                <p>Events for this resource are not yet implemented.</p>
                                <p className="text-xs">This feature requires additional backend API support.</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>

            {/* YAML Editor Dialog */}
            <YamlEditorDialog
                open={yamlDialogOpen}
                onOpenChange={setYamlDialogOpen}
                resourceType={resourceType}
                namespace={(resource?.metadata as Record<string, unknown>)?.namespace as string || '_'}
                name={name}
                group={group}
                version={version}
                onSuccess={() => setYamlDialogOpen(false)}
            />
        </>
    )
}
