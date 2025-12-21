import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    ConnectionMode,
    Panel,
} from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNamespaceStore } from '@/store'
import { IngressNode, ServiceNode, DeploymentNode, PodNode } from './TopologyNodes'

const API_BASE = '/api/v1'

// Custom node types
const nodeTypes = {
    ingress: IngressNode,
    service: ServiceNode,
    deployment: DeploymentNode,
    pod: PodNode,
}

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const nodeWidth = 200
const nodeHeight = 80

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 50 })

    nodes.forEach((node) => {
        const height = node.type === 'pod' ? 50 : nodeHeight
        dagreGraph.setNode(node.id, { width: nodeWidth, height })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        const height = node.type === 'pod' ? 50 : nodeHeight
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - height / 2,
            },
        }
    })

    return { nodes: layoutedNodes, edges }
}

interface TopologyData {
    nodes: Array<{
        id: string
        type: string
        position: { x: number; y: number }
        data: Record<string, unknown>
    }>
    edges: Array<{
        id: string
        source: string
        target: string
        type?: string
        animated?: boolean
    }>
}

interface TopologyMapProps {
    onNodeClick?: (node: Node) => void
}

export function TopologyMap({ onNodeClick }: TopologyMapProps) {
    const { selectedNamespace } = useNamespaceStore()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTopology = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_BASE}/bridge/topology?namespace=${selectedNamespace}`)
            if (!response.ok) throw new Error('Failed to fetch topology')

            const data: TopologyData = await response.json()

            // Convert to ReactFlow format
            const flowNodes: Node[] = data.nodes.map((n) => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data,
            }))

            const flowEdges: Edge[] = data.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: e.type || 'smoothstep',
                animated: e.animated || false,
                style: { stroke: '#6b7280', strokeWidth: 2 },
            }))

            // Apply dagre layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                flowNodes,
                flowEdges
            )

            setNodes(layoutedNodes)
            setEdges(layoutedEdges)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setIsLoading(false)
        }
    }, [selectedNamespace, setNodes, setEdges])

    useEffect(() => {
        fetchTopology()
    }, [fetchTopology])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-400">{error}</p>
                <Button onClick={fetchTopology} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        )
    }

    if (nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
                <p>No resources found in namespace {selectedNamespace}</p>
                <Button onClick={fetchTopology} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>
        )
    }

    return (
        <div className="h-[600px] w-full rounded-lg border border-zinc-800 bg-zinc-950">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={2}
                onNodeClick={(_, node) => onNodeClick?.(node)}
            >
                <Background color="#27272a" gap={20} />
                <Controls className="bg-zinc-900 border-zinc-700 [&>button]:bg-zinc-800 [&>button]:border-zinc-700 [&>button]:text-zinc-300 [&>button:hover]:bg-zinc-700" />
                <MiniMap
                    nodeColor={(node) => {
                        switch (node.type) {
                            case 'ingress': return '#8b5cf6'
                            case 'service': return '#3b82f6'
                            case 'deployment': return '#22c55e'
                            case 'pod': return '#6b7280'
                            default: return '#6b7280'
                        }
                    }}
                    className="bg-zinc-900 border-zinc-700"
                />
                <Panel position="top-right">
                    <Button onClick={fetchTopology} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </Panel>
            </ReactFlow>
        </div>
    )
}
