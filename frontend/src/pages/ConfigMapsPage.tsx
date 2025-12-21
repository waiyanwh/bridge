import { useState } from 'react'
import { RefreshCw, AlertCircle, FileText, ChevronDown, ChevronRight, Copy, Check, FileCode, Link2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useConfigMaps } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { fetchConfigMap, type ConfigMapDetailResponse, type ResourceReference } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { YamlEditorDialog } from '@/components/YamlEditorDialog'
import type { ConfigMapInfo } from '@/types'

export function ConfigMapsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useConfigMaps(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['configmaps', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">ConfigMaps</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} configmaps${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
                            : 'Loading...'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {isError && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-destructive">Failed to load ConfigMaps</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <ConfigMapsList configMaps={data.configMaps} onRefresh={handleRefresh} />
            )}
        </div>
    )
}

function ConfigMapsList({ configMaps, onRefresh }: { configMaps: ConfigMapInfo[]; onRefresh: () => void }) {
    const [expandedCm, setExpandedCm] = useState<string | null>(null)
    const [cmDetail, setCmDetail] = useState<ConfigMapDetailResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [editingCm, setEditingCm] = useState<ConfigMapInfo | null>(null)

    const handleExpand = async (cm: ConfigMapInfo) => {
        if (expandedCm === cm.name) {
            setExpandedCm(null)
            setCmDetail(null)
            return
        }

        setIsLoading(true)
        try {
            const detail = await fetchConfigMap(cm.namespace, cm.name)
            setCmDetail(detail)
            setExpandedCm(cm.name)
        } catch (error) {
            console.error('Failed to fetch configmap:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCopy = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value)
        setCopiedKey(key)
        setTimeout(() => setCopiedKey(null), 2000)
    }

    const handleEdit = (e: React.MouseEvent, cm: ConfigMapInfo) => {
        e.stopPropagation()
        setEditingCm(cm)
    }

    if (configMaps.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No ConfigMaps found</p>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-2">
                {configMaps.map((cm) => (
                    <div key={`${cm.namespace}/${cm.name}`} className="rounded-md border">
                        {/* ConfigMap Header */}
                        <div
                            className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50"
                            onClick={() => handleExpand(cm)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedCm === cm.name ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-mono text-sm font-medium">{cm.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {cm.namespace} • {cm.keys.length} key{cm.keys.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden flex-wrap gap-1 md:flex">
                                    {cm.keys.slice(0, 3).map((key) => (
                                        <Badge key={key} variant="secondary" className="font-mono text-xs">
                                            {key}
                                        </Badge>
                                    ))}
                                    {cm.keys.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                            +{cm.keys.length - 3} more
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-xs text-muted-foreground">{cm.age}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleEdit(e, cm)}
                                    className="gap-1"
                                >
                                    <FileCode className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                            </div>
                        </div>

                        {/* Expanded Data */}
                        {expandedCm === cm.name && (
                            <div className="border-t bg-muted/30 p-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                ) : cmDetail ? (
                                    <div className="space-y-4">
                                        {/* Data Section */}
                                        <div className="space-y-3">
                                            {Object.entries(cmDetail.data || {}).map(([key, value]) => (
                                                <div key={key} className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-mono text-xs font-medium text-muted-foreground">{key}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCopy(key, value)
                                                            }}
                                                            className="h-6 px-2"
                                                        >
                                                            {copiedKey === key ? (
                                                                <Check className="h-3 w-3 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                    <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono text-sm">
                                                        {value}
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Used By Section */}
                                        <UsedBySection references={cmDetail.referencedBy} />
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No data</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* YAML Editor Dialog */}
            {editingCm && (
                <YamlEditorDialog
                    open={!!editingCm}
                    onOpenChange={(open) => !open && setEditingCm(null)}
                    resourceType="configmap"
                    namespace={editingCm.namespace}
                    name={editingCm.name}
                    onSuccess={onRefresh}
                />
            )}
        </>
    )
}

function UsedBySection({ references }: { references: ResourceReference[] }) {
    if (!references || references.length === 0) {
        return (
            <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Used By</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">No active references found</p>
            </div>
        )
    }

    return (
        <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Used By ({references.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {references.map((ref, idx) => (
                    <Badge
                        key={`${ref.kind}-${ref.name}-${idx}`}
                        className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer"
                    >
                        {ref.kind}/{ref.name}
                    </Badge>
                ))}
            </div>
        </div>
    )
}
