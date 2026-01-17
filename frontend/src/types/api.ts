// Pod information from the backend API
export interface Pod {
    name: string
    namespace: string
    status: string
    restarts: number
    age: string
    ip: string
    node: string
    priorityClassName?: string
    priority?: number
    schedulerName?: string
    qosClass?: string
}

// Container information
export interface ContainerInfo {
    name: string
    image: string
    ready: boolean
    restartCount: number
    state: string
}

// Label selector requirement
export interface LabelSelectorRequirement {
    key: string
    operator: string
    values?: string[]
}

// Pod toleration
export interface PodToleration {
    key?: string
    operator?: string
    value?: string
    effect?: string
    tolerationSeconds?: number
}

// Topology spread constraint
export interface TopologySpreadConstraint {
    maxSkew: number
    topologyKey: string
    whenUnsatisfiable: string
    labelSelector?: Record<string, string>
}

// Affinity term for node affinity
export interface AffinityTerm {
    matchExpressions?: LabelSelectorRequirement[]
    weight?: number
}

// Pod affinity term
export interface PodAffinityTerm {
    topologyKey: string
    labelSelector?: Record<string, string>
    matchExpressions?: LabelSelectorRequirement[]
    namespaces?: string[]
    weight?: number
}

// Node affinity rules
export interface NodeAffinityRules {
    required?: AffinityTerm[]
    preferred?: AffinityTerm[]
}

// Pod affinity rules
export interface AffinityRules {
    required?: PodAffinityTerm[]
    preferred?: PodAffinityTerm[]
}

// Pod affinity configuration
export interface PodAffinity {
    nodeAffinity?: NodeAffinityRules
    podAffinity?: AffinityRules
    podAntiAffinity?: AffinityRules
}

// Detailed pod information
export interface PodDetail {
    name: string
    namespace: string
    status: string
    ip: string
    node: string
    createdAt: string
    age: string
    labels: Record<string, string>
    annotations: Record<string, string>
    containers: ContainerInfo[]
    restarts: number
    nodeSelector?: Record<string, string>
    tolerations?: PodToleration[]
    topologySpreadConstraints?: TopologySpreadConstraint[]
    affinity?: PodAffinity
    priorityClassName?: string
    priority?: number
    schedulerName?: string
    qosClass?: string
}

// Response from GET /api/v1/pods
export interface PodsResponse {
    pods: Pod[]
    namespace: string
    count: number
}

// Node taint
export interface NodeTaint {
    key: string
    value: string
    effect: string
}

// Node condition
export interface NodeCondition {
    type: string
    status: string
    reason?: string
    message?: string
}

// Node information with resource metrics
export interface NodeInfo {
    name: string
    status: string
    role: string
    version: string
    labels: Record<string, string>
    annotations: Record<string, string>
    taints: NodeTaint[]
    conditions: NodeCondition[]
    cpuCapacity: number
    cpuAllocatable: number
    cpuUsagePercent: number
    memoryCapacity: number
    memoryAllocatable: number
    memoryUsagePercent: number
    podsCapacity: number
    podsAllocatable: number
    podCount: number
    age: string
    osImage: string
    kernelVersion: string
    containerRuntime: string
    architecture: string
}

// ConfigMap information
export interface ConfigMapInfo {
    name: string
    namespace: string
    keys: string[]
    data?: Record<string, string>
    age: string
}

// Secret metadata (no data for security)
export interface SecretInfo {
    name: string
    namespace: string
    type: string
    keys: string[]
    age: string
}

// Revealed secret data
export interface SecretReveal {
    name: string
    namespace: string
    data: Record<string, string>
}

// Error response from API
export interface ApiError {
    error: string
    message: string
}
