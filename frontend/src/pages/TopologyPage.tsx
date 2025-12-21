import { useState } from 'react'
import { TopologyMap } from '@/components/TopologyMap'
import { useNamespaceStore } from '@/store'
import type { Node } from 'reactflow'

// Import Detail Sheets
import { PodDetailSheet } from '@/components/pods/PodDetailSheet'
import { DeploymentDetailSheet } from '@/components/DeploymentDetailSheet'
import { ServiceDetailSheet } from '@/components/ServiceDetailSheet'
import { IngressDetailSheet } from '@/components/IngressDetailSheet'

// Type adapters to match what the sheets expect
import type { Pod, DeploymentInfo, ServiceInfo, IngressInfo } from '@/api'

export function TopologyPage() {
    const { selectedNamespace } = useNamespaceStore()

    // State for selected resources
    const [selectedPod, setSelectedPod] = useState<Pod | null>(null)
    const [selectedDeployment, setSelectedDeployment] = useState<DeploymentInfo | null>(null)
    const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null)
    const [selectedIngress, setSelectedIngress] = useState<IngressInfo | null>(null)

    // Open states
    const [podSheetOpen, setPodSheetOpen] = useState(false)
    const [deploymentSheetOpen, setDeploymentSheetOpen] = useState(false)
    const [serviceSheetOpen, setServiceSheetOpen] = useState(false)
    const [ingressSheetOpen, setIngressSheetOpen] = useState(false)

    const handleNodeClick = (node: Node) => {
        const { kind, name, namespace, ...rest } = node.data

        switch (kind) {
            case 'Pod':
                setSelectedPod({ name, namespace, ...rest } as any) // Cast simplified data to Pod (sheet will fetch full data)
                setPodSheetOpen(true)
                break
            case 'Deployment':
                setSelectedDeployment({ name, namespace, ...rest } as any)
                setDeploymentSheetOpen(true)
                break
            case 'Service':
                setSelectedService({ name, namespace, ...rest } as any)
                setServiceSheetOpen(true)
                break
            case 'Ingress':
                setSelectedIngress({ name, namespace, ...rest } as any)
                setIngressSheetOpen(true)
                break
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Topology Map</h1>
                <p className="text-sm text-muted-foreground">
                    Visualize resource relationships in <span className="font-medium text-foreground">{selectedNamespace === 'all' ? 'all namespaces' : `"${selectedNamespace}"`}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Click on nodes to view details and edit YAML.
                </p>
            </div>

            {/* Topology Map */}
            <TopologyMap onNodeClick={handleNodeClick} />

            {/* Detail Sheets */}
            <PodDetailSheet
                pod={selectedPod}
                open={podSheetOpen}
                onOpenChange={setPodSheetOpen}
            />

            <DeploymentDetailSheet
                deployment={selectedDeployment}
                open={deploymentSheetOpen}
                onOpenChange={setDeploymentSheetOpen}
            />

            <ServiceDetailSheet
                service={selectedService}
                open={serviceSheetOpen}
                onOpenChange={setServiceSheetOpen}
            />

            <IngressDetailSheet
                ingress={selectedIngress}
                open={ingressSheetOpen}
                onOpenChange={setIngressSheetOpen}
            />
        </div>
    )
}
