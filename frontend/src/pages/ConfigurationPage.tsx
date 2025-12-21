import { useState } from 'react'
import { RefreshCw, AlertCircle, Eye, EyeOff, Copy, Check, FileText, Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useConfigMaps, useSecrets } from '@/hooks'
import { revealSecret } from '@/api'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { SecretInfo, ConfigMapInfo } from '@/types'

export function ConfigurationPage() {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState('configmaps')

    const { data: configMapsData, isLoading: cmLoading, isError: cmError, isFetching: cmFetching } = useConfigMaps()
    const { data: secretsData, isLoading: secLoading, isError: secError, isFetching: secFetching } = useSecrets()

    const handleRefresh = () => {
        if (activeTab === 'configmaps') {
            queryClient.invalidateQueries({ queryKey: ['configmaps'] })
        } else {
            queryClient.invalidateQueries({ queryKey: ['secrets'] })
        }
    }

    const isFetching = activeTab === 'configmaps' ? cmFetching : secFetching

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage ConfigMaps and Secrets
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

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="configmaps" className="gap-2">
                        <FileText className="h-4 w-4" />
                        ConfigMaps
                        {configMapsData && (
                            <Badge variant="secondary" className="ml-1">
                                {configMapsData.count}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="secrets" className="gap-2">
                        <Lock className="h-4 w-4" />
                        Secrets
                        {secretsData && (
                            <Badge variant="secondary" className="ml-1">
                                {secretsData.count}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ConfigMaps Tab */}
                <TabsContent value="configmaps" className="mt-4">
                    {cmLoading && (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {cmError && (
                        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            <p className="text-destructive">Failed to load ConfigMaps</p>
                        </div>
                    )}
                    {!cmLoading && !cmError && configMapsData && (
                        <ConfigMapsTable configMaps={configMapsData.configMaps} />
                    )}
                </TabsContent>

                {/* Secrets Tab */}
                <TabsContent value="secrets" className="mt-4">
                    {secLoading && (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {secError && (
                        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            <p className="text-destructive">Failed to load Secrets</p>
                        </div>
                    )}
                    {!secLoading && !secError && secretsData && (
                        <SecretsTable secrets={secretsData.secrets} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ConfigMaps Table Component
function ConfigMapsTable({ configMaps }: { configMaps: ConfigMapInfo[] }) {
    if (configMaps.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No ConfigMaps found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Keys</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {configMaps.map((cm) => (
                        <TableRow key={cm.name}>
                            <TableCell className="font-mono text-sm">{cm.name}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {cm.keys.map((key) => (
                                        <Badge key={key} variant="secondary" className="font-mono text-xs">
                                            {key}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{cm.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

// Secrets Table Component with reveal functionality
function SecretsTable({ secrets }: { secrets: SecretInfo[] }) {
    const [expandedSecret, setExpandedSecret] = useState<string | null>(null)
    const [revealedData, setRevealedData] = useState<Record<string, string> | null>(null)
    const [isRevealing, setIsRevealing] = useState(false)
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

    const handleReveal = async (secret: SecretInfo) => {
        if (expandedSecret === secret.name) {
            setExpandedSecret(null)
            setRevealedData(null)
            return
        }

        setIsRevealing(true)
        try {
            const data = await revealSecret(secret.namespace, secret.name)
            setRevealedData(data.data)
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

    if (secrets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Secrets found</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {secrets.map((secret) => (
                <div key={secret.name} className="rounded-md border">
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
                                    {secret.type} • {secret.keys.length} key{secret.keys.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{secret.age}</span>
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
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
