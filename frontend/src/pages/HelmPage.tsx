import { useState } from 'react'
import { RefreshCw, AlertCircle, Package, History, FileCode, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHelmReleases, useHelmRelease, useHelmReleaseValues, useHelmReleaseHistory } from '@/hooks'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { HelmReleaseInfo, HelmRevisionInfo } from '@/api'

export function HelmPage() {
    const queryClient = useQueryClient()
    const { selectedNamespace } = useNamespaceStore()
    const namespace = selectedNamespace === 'all' ? '' : selectedNamespace
    const { data, isLoading, isError, isFetching } = useHelmReleases(namespace)

    const [selectedRelease, setSelectedRelease] = useState<HelmReleaseInfo | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['helmReleases', namespace] })
    }

    const handleRowClick = (release: HelmReleaseInfo) => {
        setSelectedRelease(release)
        setSheetOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Helm Releases</h1>
                    <p className="text-sm text-muted-foreground">
                        {data
                            ? `${data.count} releases${selectedNamespace === 'all' ? ' across all namespaces' : ` in "${selectedNamespace}"`}`
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
                    <p className="text-destructive">Failed to load Helm releases</p>
                </div>
            )}

            {!isLoading && !isError && data && (
                <HelmReleasesTable
                    releases={data.releases}
                    onRowClick={handleRowClick}
                />
            )}

            {/* Detail Sheet */}
            {selectedRelease && (
                <HelmReleaseSheet
                    release={selectedRelease}
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                />
            )}
        </div>
    )
}

function getStatusBadge(status: string) {
    const lowerStatus = status.toLowerCase()

    if (lowerStatus === 'deployed') {
        return (
            <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-1">
                <CheckCircle className="h-3 w-3" />
                {status}
            </Badge>
        )
    }
    if (lowerStatus === 'failed') {
        return (
            <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 gap-1">
                <XCircle className="h-3 w-3" />
                {status}
            </Badge>
        )
    }
    if (lowerStatus === 'pending-install' || lowerStatus === 'pending-upgrade') {
        return (
            <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {status}
            </Badge>
        )
    }
    return <Badge variant="secondary">{status}</Badge>
}

interface HelmReleasesTableProps {
    releases: HelmReleaseInfo[]
    onRowClick: (release: HelmReleaseInfo) => void
}

function HelmReleasesTable({ releases, onRowClick }: HelmReleasesTableProps) {
    if (releases.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No Helm releases found</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Release Name</TableHead>
                        <TableHead>Namespace</TableHead>
                        <TableHead>Chart</TableHead>
                        <TableHead>App Version</TableHead>
                        <TableHead>Revision</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {releases.map((release) => (
                        <TableRow
                            key={`${release.namespace}/${release.name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onRowClick(release)}
                        >
                            <TableCell className="font-mono text-sm font-medium">{release.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{release.namespace}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <span className="text-sm">{release.chart}</span>
                                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                        {release.chartVersion}
                                    </code>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{release.appVersion || '-'}</TableCell>
                            <TableCell className="text-center">{release.revision}</TableCell>
                            <TableCell>{getStatusBadge(release.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{release.updated}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

interface HelmReleaseSheetProps {
    release: HelmReleaseInfo
    open: boolean
    onOpenChange: (open: boolean) => void
}

function HelmReleaseSheet({ release, open, onOpenChange }: HelmReleaseSheetProps) {
    const [activeTab, setActiveTab] = useState('overview')

    const { data: releaseDetail } = useHelmRelease(release.namespace, release.name, open)
    const { data: valuesData } = useHelmReleaseValues(release.namespace, release.name, open && activeTab === 'values')
    const { data: historyData } = useHelmReleaseHistory(release.namespace, release.name, open && activeTab === 'history')

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                {/* Header */}
                <SheetHeader className="border-b border-border px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <SheetTitle className="font-mono text-base">
                                    {release.name}
                                </SheetTitle>
                                <p className="text-xs text-muted-foreground">
                                    {release.namespace} • {release.chart}-{release.chartVersion}
                                </p>
                            </div>
                        </div>
                        {getStatusBadge(release.status)}
                    </div>
                </SheetHeader>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
                    <TabsList className="px-6">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="values" className="gap-1.5">
                            <FileCode className="h-3.5 w-3.5" />
                            Values
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-1.5">
                            <History className="h-3.5 w-3.5" />
                            History
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="overflow-auto p-6">
                        <div className="space-y-6">
                            {/* Release Info */}
                            <section>
                                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                                    Release Information
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Chart</span>
                                        <span className="font-mono">{release.chart}-{release.chartVersion}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">App Version</span>
                                        <span className="font-mono">{release.appVersion || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Revision</span>
                                        <span>{release.revision}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Last Updated</span>
                                        <span>{release.updated}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Notes */}
                            {releaseDetail?.notes && (
                                <section>
                                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                                        Release Notes
                                    </h3>
                                    <div className="rounded-md bg-muted p-4">
                                        <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                                            {releaseDetail.notes}
                                        </pre>
                                    </div>
                                </section>
                            )}
                        </div>
                    </TabsContent>

                    {/* Values Tab */}
                    <TabsContent value="values" className="flex-1 overflow-auto p-6">
                        <div className="h-full">
                            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                                User Supplied Values
                            </h3>
                            {valuesData ? (
                                <div className="rounded-md bg-zinc-900 border border-zinc-700 h-[500px] overflow-auto">
                                    <pre className="p-4 font-mono text-xs text-foreground whitespace-pre">
                                        {valuesData.values || '# No custom values supplied'}
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="overflow-auto p-6">
                        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                            Rollback History
                        </h3>
                        {historyData ? (
                            <HistoryTable history={historyData.history} />
                        ) : (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}

function HistoryTable({ history }: { history: HelmRevisionInfo[] }) {
    if (history.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No revision history available
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Revision</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Chart</TableHead>
                        <TableHead>Description</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history.map((rev) => (
                        <TableRow key={rev.revision}>
                            <TableCell className="font-mono">{rev.revision}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rev.updated}</TableCell>
                            <TableCell>{getStatusBadge(rev.status)}</TableCell>
                            <TableCell className="font-mono text-sm">{rev.chart}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {rev.description || '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
