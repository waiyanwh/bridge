import { useState } from 'react'
import { RefreshCw, AlertCircle, Shield, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useClusterRoles } from '@/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { ClusterRoleInfo, PolicyRule } from '@/api'

export function ClusterRolesPage() {
    const queryClient = useQueryClient()
    const { data, isLoading, isError, isFetching } = useClusterRoles()
    const [selectedRole, setSelectedRole] = useState<ClusterRoleInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['clusterroles'] })
    }

    const handleSelectRole = (role: ClusterRoleInfo) => {
        setSelectedRole(role)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Cluster Roles</h1>
                    <p className="text-sm text-muted-foreground">
                        {data ? `${data.count} cluster roles` : 'Loading...'}
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
                    <p className="text-destructive">Failed to load Cluster Roles</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <ClusterRolesTable clusterRoles={data.clusterRoles} onSelectRole={handleSelectRole} />
            )}

            {/* Rules Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[500px] flex-col p-0 sm:max-w-[500px]">
                    {selectedRole && (
                        <>
                            <SheetHeader className="border-b border-border px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedRole.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Cluster Role (global)
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            {/* Rules */}
                            <div className="flex-1 overflow-auto p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-muted-foreground">Policy Rules</h3>
                                    <Badge variant="secondary">
                                        {selectedRole.rules.length} rule{selectedRole.rules.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>

                                {selectedRole.rules.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No rules defined</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedRole.rules.map((rule, idx) => (
                                            <RuleCard key={idx} rule={rule} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function ClusterRolesTable({ clusterRoles, onSelectRole }: { clusterRoles: ClusterRoleInfo[]; onSelectRole: (role: ClusterRoleInfo) => void }) {
    if (clusterRoles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Cluster Roles found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Rules</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clusterRoles.map((role) => (
                        <TableRow
                            key={role.name}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onSelectRole(role)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{role.name}</TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {role.rules.length} rule{role.rules.length !== 1 ? 's' : ''}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{role.age}</TableCell>
                            <TableCell>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function RuleCard({ rule }: { rule: PolicyRule }) {
    const verbStr = rule.verbs.join(', ')
    const resourceStr = rule.resources.join(', ')
    const apiGroupStr = rule.apiGroups.filter(g => g !== '').join(', ') || 'core'

    return (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted-foreground">can</span>
                <span className="font-medium text-green-400">{verbStr}</span>
                <span className="text-muted-foreground">on</span>
                <span className="font-medium text-blue-400">{resourceStr}</span>
            </div>
            <div className="text-xs text-muted-foreground">
                API Group: <code className="bg-muted px-1 rounded">{apiGroupStr}</code>
            </div>
        </div>
    )
}
