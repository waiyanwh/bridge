import { RefreshCw, AlertCircle, Link } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRoleBindings } from '@/hooks'
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
import type { RoleBindingInfo } from '@/api'

export function RoleBindingsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useRoleBindings(namespace)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['rolebindings', namespace] })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Role Bindings</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} role bindings${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Role Bindings</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <RoleBindingsTable roleBindings={data.roleBindings} />
            )}
        </div>
    )
}

function RoleBindingsTable({ roleBindings }: { roleBindings: RoleBindingInfo[] }) {
    if (roleBindings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Link className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Role Bindings found</p>
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
                        <TableHead>Role</TableHead>
                        <TableHead>Subjects</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {roleBindings.map((rb) => (
                        <TableRow key={`${rb.namespace}/${rb.name}`}>
                            <TableCell className="font-mono text-sm font-medium">{rb.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rb.namespace}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {rb.roleKind}
                                    </Badge>
                                    <span className="font-mono text-sm text-blue-400">{rb.roleRef}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                    {rb.subjects.slice(0, 3).map((subject, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                            {subject}
                                        </Badge>
                                    ))}
                                    {rb.subjects.length > 3 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{rb.subjects.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{rb.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
