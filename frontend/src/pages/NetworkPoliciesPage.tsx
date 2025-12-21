import { RefreshCw, AlertCircle, Shield } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkPolicies } from '@/hooks'
import { useNamespaceStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { NetworkPolicyInfo } from '@/api'

export function NetworkPoliciesPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useNetworkPolicies(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['networkpolicies', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Network Policies</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} policies${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Network Policies</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <NetworkPoliciesTable policies={data.networkPolicies} />
            )}
        </div>
    )
}

function NetworkPoliciesTable({ policies }: { policies: NetworkPolicyInfo[] }) {
    if (policies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Network Policies found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Pod Selector</TableHead>
                        <TableHead>Policy Types</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {policies.map((np) => (
                        <TableRow key={`${np.namespace}/${np.name}`}>
                            <TableCell className="font-mono text-sm font-medium">{np.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{np.namespace}</TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    {np.podSelector}
                                </code>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {np.policyTypes.map((type, idx) => (
                                        <Badge
                                            key={idx}
                                            className={
                                                type === 'Ingress'
                                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                    : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                            }
                                        >
                                            {type}
                                        </Badge>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{np.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
