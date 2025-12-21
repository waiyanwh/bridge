import { Network } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import type { IngressInfo } from '@/api'

interface IngressDetailSheetProps {
    ingress: IngressInfo | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function IngressDetailSheet({ ingress, open, onOpenChange }: IngressDetailSheetProps) {
    const queryClient = useQueryClient()

    if (!ingress) return null

    const handleYamlSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['ingresses'] })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[700px] flex-col p-0 sm:max-w-[700px]">
                <SheetHeader
                    className="border-b border-border px-6 py-4"
                    resourceKind="ingresses"
                    resourceName={ingress.name}
                    namespace={ingress.namespace}
                    onYamlSuccess={handleYamlSuccess}
                >
                    <div className="flex items-center gap-3">
                        <Network className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <SheetTitle className="font-mono text-base">
                                {ingress.name}
                            </SheetTitle>
                            <p className="text-xs text-muted-foreground">
                                {ingress.namespace}
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="p-6">
                    <div className="rounded-md bg-muted/30 p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Class</span>
                                <div>
                                    {ingress.class ? (
                                        <Badge variant="secondary">{ingress.class}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Age</span>
                                <p>{ingress.age}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-muted-foreground text-sm block mb-2">Hosts</span>
                            <div className="space-y-1">
                                {ingress.hosts.map((host, i) => (
                                    <div key={i} className="font-mono text-sm">{host}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
