import { useState } from 'react'
import { RefreshCw, AlertCircle, User } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useServiceAccounts } from '@/hooks'
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import type { ServiceAccountInfo } from '@/api'

export function ServiceAccountsPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useServiceAccounts(namespace)

    const [selectedSA, setSelectedSA] = useState<ServiceAccountInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['serviceaccounts', namespace] })
    }

    const handleRowClick = (sa: ServiceAccountInfo) => {
        setSelectedSA(sa)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Service Accounts</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} service accounts${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Service Accounts</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <ServiceAccountsTable
                    serviceAccounts={data.serviceAccounts}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                    {selectedSA && (
                        <>
                            <SheetHeader
                                className="border-b border-border px-6 py-4"
                                resourceKind="serviceaccounts"
                                resourceName={selectedSA.name}
                                namespace={selectedSA.namespace}
                                onYamlSuccess={handleRefresh}
                            >
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <SheetTitle className="font-mono text-base">
                                            {selectedSA.name}
                                        </SheetTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedSA.namespace}
                                        </p>
                                    </div>
                                </div>
                            </SheetHeader>

                            <div className="p-6">
                                <div className="rounded-md bg-muted/30 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Secrets</span>
                                            <div>
                                                <Badge variant="secondary">
                                                    {selectedSA.secretsCount} secret{selectedSA.secretsCount !== 1 ? 's' : ''}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Age</span>
                                            <p>{selectedSA.age}</p>
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

function ServiceAccountsTable({ serviceAccounts, onRowClick }: { serviceAccounts: ServiceAccountInfo[], onRowClick: (sa: ServiceAccountInfo) => void }) {
    if (serviceAccounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <User className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Service Accounts found</p>
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
                        <TableHead>Secrets</TableHead>
                        <TableHead>Age</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {serviceAccounts.map((sa) => (
                        <TableRow
                            key={`${sa.namespace}/${sa.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(sa)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{sa.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{sa.namespace}</TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {sa.secretsCount} secret{sa.secretsCount !== 1 ? 's' : ''}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{sa.age}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
