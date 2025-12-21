import { Layers } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import type { ServiceInfo } from '@/api'

interface ServiceDetailSheetProps {
    service: ServiceInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ServiceDetailSheet({ service, open, onOpenChange }: ServiceDetailSheetProps) {
    const queryClient = useQueryClient()

    if (!service) return null

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['services'] })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                <SheetHeader
                    className="border-b border-border px-6 py-4"
                    resourceKind="services"
                    resourceName={service.name}
                    namespace={service.namespace}
                    onYamlSuccess={handleYamlSuccess}
                >
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <SheetTitle className="font-mono text-base">
                                {service.name}
                            </SheetTitle>
                            <p className="text-xs text-muted-foreground">
                                {service.namespace}
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="p-6">
                    <div className="rounded-md bg-muted/30 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Type</span>
                                <div>{getServiceTypeBadge(service.type)}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Cluster IP</span>
                                <p className="font-mono">{service.clusterIP}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Age</span>
                                <p>{service.age}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-muted-foreground text-sm block mb-2">Ports</span>
                            <div className="flex flex-wrap gap-2">
                                {service.ports.map((port, i) => (
                                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                                        {port}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function getServiceTypeBadge(type: string) {
    switch (type) {
        case 'LoadBalancer':
            return <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">{type}</Badge>
        case 'NodePort':
            return <Badge className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">{type}</Badge>
        case 'ClusterIP':
            return <Badge variant="secondary">{type}</Badge>
        case 'ExternalName':
            return <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">{type}</Badge>
        default:
            return <Badge variant="secondary">{type}</Badge>
    }
}
