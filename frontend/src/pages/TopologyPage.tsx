import { TopologyMap } from '@/components/TopologyMap'
import { useNamespaceStore } from '@/store'

export function TopologyPage() {
    const { selectedNamespace } = useNamespaceStore()

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Topology Map</h1>
                <p className="text-sm text-muted-foreground">
                    Visualize resource relationships in <span className="font-medium text-foreground">{selectedNamespace === 'all' ? 'all namespaces' : `"${selectedNamespace}"`}</span>
                </p>
            </div>

            {/* Topology Map */}
            <TopologyMap />
        </div>
    )
}
