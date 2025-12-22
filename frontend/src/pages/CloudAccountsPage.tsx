import { useState } from 'react'
import {
    Cloud,
    AlertCircle,
    Loader2,
    Server,
    Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { SSOAccountExplorer } from '@/components/SSOAccountExplorer'
import {
    useBridgeContextMappings,
    useDeleteContextMapping,
} from '@/hooks'

// Helper to extract a friendly cluster name from context/cluster string
function extractClusterName(clusterName: string): string {
    // Handle ARN format: arn:aws:eks:region:account:cluster/name
    const arnMatch = clusterName.match(/cluster\/([^/]+)$/)
    if (arnMatch) return arnMatch[1]

    // Handle other formats - just return the last part after any slashes
    const parts = clusterName.split('/')
    return parts[parts.length - 1] || clusterName
}

// Helper to extract a friendly context name
function extractContextDisplayName(contextName: string): string {
    // Handle ARN format: arn:aws:eks:region:account:cluster/name
    const arnMatch = contextName.match(/arn:aws:eks:([^:]+):([^:]+):cluster\/(.+)/)
    if (arnMatch) {
        return `${arnMatch[3]} (${arnMatch[1]})`
    }
    return contextName
}

function ContextMappingsPanel() {
    const { data: mappingsData, isLoading, error } = useBridgeContextMappings()
    const deleteMapping = useDeleteContextMapping()

    const handleDeleteMapping = async (contextName: string) => {
        try {
            await deleteMapping.mutateAsync(contextName)
            toast.success('Mapping deleted')
        } catch (err) {
            toast.error('Failed to delete mapping', {
                description: err instanceof Error ? err.message : 'Unknown error',
            })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading mappings...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-12 text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error.message}</span>
            </div>
        )
    }

    if (!mappingsData || mappingsData.mappings.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No context mappings configured.</p>
                <p className="text-sm mt-1">
                    Map AWS roles to your Kubernetes contexts from the SSO Sessions tab.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-zinc-800">
                        <TableHead className="text-muted-foreground font-medium">Context</TableHead>
                        <TableHead className="text-muted-foreground font-medium">Cluster</TableHead>
                        <TableHead className="text-muted-foreground font-medium">AWS Account</TableHead>
                        <TableHead className="text-muted-foreground font-medium">Role</TableHead>
                        <TableHead className="text-muted-foreground font-medium w-[80px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {mappingsData.mappings.map((mapping) => (
                        <TableRow
                            key={mapping.contextName}
                            className="border-zinc-800 hover:bg-zinc-900/50"
                        >
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-sm">
                                        {extractContextDisplayName(mapping.contextName)}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                                        {mapping.contextName}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {extractClusterName(mapping.clusterName || '')}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm">{mapping.accountName || mapping.accountId}</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {mapping.accountId}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="text-xs">
                                    {mapping.roleName}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteMapping(mapping.contextName)}
                                    disabled={deleteMapping.isPending}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export function CloudAccountsPage() {
    const [activeTab, setActiveTab] = useState('sessions')

    return (
        <div className="space-y-6 max-w-6xl mx-auto py-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Cloud className="h-6 w-6 text-orange-400" />
                    Cloud Accounts
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage AWS SSO sessions and map accounts to your Kubernetes clusters.
                </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="sessions" className="gap-2">
                        <Cloud className="h-4 w-4" />
                        SSO Sessions
                    </TabsTrigger>
                    <TabsTrigger value="mappings" className="gap-2">
                        <Server className="h-4 w-4" />
                        Context Mappings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions" className="mt-6">
                    <SSOAccountExplorer />
                </TabsContent>

                <TabsContent value="mappings" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Server className="h-5 w-5 text-muted-foreground" />
                                Context to AWS Role Mappings
                            </CardTitle>
                            <CardDescription>
                                View and manage how your Kubernetes contexts are mapped to AWS roles.
                                Bridge injects the necessary environment variables for seamless authentication.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ContextMappingsPanel />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Help Card */}
            <Card className="border-zinc-800 bg-zinc-900/30">
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">How Bridge Isolated Mode works</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>
                                    <strong>No pollution:</strong> Bridge manages SSO tokens in{' '}
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.bridge/</code>,
                                    not your global AWS config.
                                </li>
                                <li>
                                    <strong>Device Flow:</strong> Authenticate via the OAuth device authorization flow.
                                    Just copy the code and complete login in your browser.
                                </li>
                                <li>
                                    <strong>Account Tree:</strong> After login, Bridge discovers all accounts and roles
                                    you have access to.
                                </li>
                                <li>
                                    <strong>Seamless kubectl:</strong> When you map a role to a context, Bridge injects{' '}
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">AWS_CONFIG_FILE</code> to use
                                    its managed config.
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
