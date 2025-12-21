import { useState } from 'react'
import { RefreshCw, AlertCircle, Eye, EyeOff, Copy, Check, Lock, FileCode, Link2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useSecrets } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { revealSecret, fetchSecret, type SecretDetailResponse, type ResourceReference } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { YamlEditorDialog } from '@/components/YamlEditorDialog'
import type { SecretInfo } from '@/types'

export function SecretsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useSecrets(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['secrets', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} secrets${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Secrets</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <SecretsTable secrets={data.secrets} onRefresh={handleRefresh} />
            )}
        </div>
    )
}

function SecretsTable({ secrets, onRefresh }: { secrets: SecretInfo[]; onRefresh: () => void }) {
    const [expandedSecret, setExpandedSecret] = useState<string | null>(null)
    const [revealedData, setRevealedData] = useState<Record<string, string> | null>(null)
    const [secretDetail, setSecretDetail] = useState<SecretDetailResponse | null>(null)
    const [isRevealing, setIsRevealing] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [editingSecret, setEditingSecret] = useState<SecretInfo | null>(null)

    const handleReveal = async (secret: SecretInfo) => {
        if (expandedSecret === secret.name) {
            setExpandedSecret(null)
            setRevealedData(null)
            setSecretDetail(null)
            return
        }

        setIsRevealing(true)
        try {
            // Fetch both revealed data and references in parallel
            const [revealed, detail] = await Promise.all([
                revealSecret(secret.namespace, secret.name),
                fetchSecret(secret.namespace, secret.name)
            ])
            setRevealedData(revealed.data)
            setSecretDetail(detail)
            setExpandedSecret(secret.name)
        } catch (error) {
            console.error('Failed to reveal secret:', error)
        } finally {
            setIsRevealing(false)
        }
    }

    const handleCopy = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value)
        setCopiedKey(key)
        setTimeout(() => setCopiedKey(null), 2000)
    }

    const handleEdit = (e: React.MouseEvent, secret: SecretInfo) => {
        e.stopPropagation()
        setEditingSecret(secret)
    }

    if (secrets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Secrets found</p>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-2">
                {secrets.map((secret) => (
                    <div key={`${secret.namespace}/${secret.name}`} className="rounded-md border">
                        {/* Secret Header */}
                        <div
                            className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50"
                            onClick={() => handleReveal(secret)}
                        >
                            <div className="flex items-center gap-3">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="font-mono text-sm font-medium">{secret.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {secret.namespace} • {secret.type} • {secret.keys.length} key{secret.keys.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{secret.age}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleEdit(e, secret)}
                                    className="gap-1"
                                >
                                    <FileCode className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isRevealing}
                                >
                                    {expandedSecret === secret.name ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Revealed Data */}
                        {expandedSecret === secret.name && revealedData && (
                            <div className="border-t bg-muted/30 p-4">
                                <div className="space-y-4">
                                    {/* Secret Data */}
                                    <div className="space-y-2">
                                        {Object.entries(revealedData).map(([key, value]) => (
                                            <div key={key} className="flex items-start gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <p className="font-mono text-xs text-muted-foreground">{key}</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="flex-1 break-all rounded bg-background px-2 py-1 font-mono text-sm">
                                                            {value}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCopy(key, value)
                                                            }}
                                                        >
                                                            {copiedKey === key ? (
                                                                <Check className="h-4 w-4 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Used By Section */}
                                    {secretDetail && (
                                        <UsedBySection references={secretDetail.referencedBy} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* YAML Editor Dialog */}
            {editingSecret && (
                <YamlEditorDialog
                    open={!!editingSecret}
                    onOpenChange={(open) => !open && setEditingSecret(null)}
                    resourceType="secret"
                    namespace={editingSecret.namespace}
                    name={editingSecret.name}
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
