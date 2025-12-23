import { useState } from 'react'
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
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { RoleBindingInfo } from '@/api'

export function RoleBindingsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useRoleBindings(namespace)

    const [selectedRB, setSelectedRB] = useState<RoleBindingInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['rolebindings', namespace] })
    }

    const handleRowClick = (rb: RoleBindingInfo) => {
        setSelectedRB(rb)
        setSheetOpen(true)
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
                <RoleBindingsTable
                    roleBindings={data.roleBindings}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedRB && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="rolebindings"
                                resourceName={selectedRB.name}
                                namespace={selectedRB.namespace}
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Link className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedRB.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedRB.namespace}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Role</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-xs">
                                                    {selectedRB.roleKind}
                                                </Badge>
                                                <span className="font-mono text-xs text-muted-foreground">{selectedRB.roleRef}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedRB.age}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground text-sm block mb-2">Subjects</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRB.subjects.map((subject, i) => (
                                                <Badge key={i} variant="outline" className="font-mono text-xs">
                                                    {subject}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function RoleBindingsTable({ roleBindings, onRowClick }: { roleBindings: RoleBindingInfo[], onRowClick: (rb: RoleBindingInfo) => void }) {
    if (roleBindings.length === 0) {
        return (
            <TableEmptyState
                icon={Link}
                title="No Role Bindings found"
                description="There are no Role Bindings in this namespace."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
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
                        <TableRow
                            key={`${rb.namespace}/${rb.name}`}
                            clickable
                            onClick={() => onRowClick(rb)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {rb.name}
                            </TableCell>
                            {/* Namespace */}
                            <TableCell className="text-sm text-muted-foreground">
                                {rb.namespace}
                            </TableCell>
                            {/* Role */}
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {rb.roleKind}
                                    </Badge>
                                    <span className="font-mono text-xs text-muted-foreground">{rb.roleRef}</span>
                                </div>
                            </TableCell>
                            {/* Subjects */}
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
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {rb.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
