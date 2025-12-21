import { useNavigate } from 'react-router-dom'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNamespaces } from '@/hooks'
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

export function NamespacesPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { data, isLoading, isError, refetch } = useNamespaces()

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['namespaces'] })
    }

    const handleRowClick = (ns: string) => {
        navigate(`/namespaces/${ns}`)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
                <p className="text-destructive">Failed to load namespaces</p>
                <Button onClick={() => refetch()}>Retry</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Namespaces</h1>
                    <p className="text-sm text-muted-foreground">
                        {data?.count || 0} namespaces found
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            {/* We don't have age/labels in the simple list API yet, just strings. 
                                We might want to upgrade getNamespaces API later to return object details.
                                For now, list names. 
                            */}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data?.namespaces.map((ns) => (
                            <TableRow
                                key={ns}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleRowClick(ns)}
                            >
                                <TableCell className="font-mono font-medium">
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                        {ns}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">Active</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">View Details</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
