import { RefreshCw, AlertCircle, Link } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useClusterRoleBindings } from '@/hooks'
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
import type { ClusterRoleBindingInfo } from '@/api'

export function ClusterRoleBindingsPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = useClusterRoleBindings()

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Cluster Role Bindings</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} cluster role bindings` : 'Loading...'}
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
                    <p className="text-destructive">Failed to load Cluster Role Bindings</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <ClusterRoleBindingsTable clusterRoleBindings={data.clusterRoleBindings} />
            )}
        </div>
    )
}

function ClusterRoleBindingsTable({ clusterRoleBindings }: { clusterRoleBindings: ClusterRoleBindingInfo[] }) {
    if (clusterRoleBindings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Link className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Cluster Role Bindings found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subjects</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clusterRoleBindings.map((crb) => (
                        <TableRow key={crb.name}>
                            <TableCell className="font-mono text-sm font-medium">{crb.name}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {crb.roleKind}
                                    </Badge>
                                    <span className="font-mono text-sm text-blue-400">{crb.roleRef}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                    {crb.subjects.slice(0, 3).map((subject, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                            {subject}
                                        </Badge>
                                    ))}
                                    {crb.subjects.length > 3 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{crb.subjects.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{crb.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
