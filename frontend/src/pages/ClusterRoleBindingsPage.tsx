import { useState } from 'react'
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
import { TableEmptyState } from '@/components/ui/table-empty-state'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { ClusterRoleBindingInfo } from '@/api'

export function ClusterRoleBindingsPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = useClusterRoleBindings()

    const [selectedCRB, setSelectedCRB] = useState<ClusterRoleBindingInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
    }

    const handleRowClick = (crb: ClusterRoleBindingInfo) => {
        setSelectedCRB(crb)
        setSheetOpen(true)
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
                <ClusterRoleBindingsTable
                    clusterRoleBindings={data.clusterRoleBindings}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedCRB && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="clusterrolebindings"
                                resourceName={selectedCRB.name}
                                namespace=""
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <Link className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedCRB.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Cluster Scoped
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
                                                    {selectedCRB.roleKind}
                                                </Badge>
                                                <span className="font-mono text-xs text-muted-foreground">{selectedCRB.roleRef}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedCRB.age}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground text-sm block mb-2">Subjects</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedCRB.subjects.map((subject, i) => (
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

function ClusterRoleBindingsTable({ clusterRoleBindings, onRowClick }: { clusterRoleBindings: ClusterRoleBindingInfo[], onRowClick: (crb: ClusterRoleBindingInfo) => void }) {
    if (clusterRoleBindings.length === 0) {
        return (
            <TableEmptyState
                icon={Link}
                title="No Cluster Role Bindings found"
                description="There are no Cluster Role Bindings in the cluster."
            />
        )
    }

    return (
        <div className="rounded-lg border bg-card">
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
                        <TableRow
                            key={crb.name}
                            clickable
                            onClick={() => onRowClick(crb)}
                        >
                            {/* Name - monospace */}
                            <TableCell className="font-mono text-xs text-muted-foreground">
                                {crb.name}
                            </TableCell>
                            {/* Role */}
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                        {crb.roleKind}
                                    </Badge>
                                    <span className="font-mono text-xs text-muted-foreground">{crb.roleRef}</span>
                                </div>
                            </TableCell>
                            {/* Subjects */}
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
                            {/* Age */}
                            <TableCell className="text-muted-foreground text-sm">
                                {crb.age}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
