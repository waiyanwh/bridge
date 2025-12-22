// Pod information from the backend API
export interface Pod {
    name: string
    namespace: string
    status: string
    restarts: number
    age: string
    ip: string
}

// Container information
export interface ContainerInfo {
    name: string
    image: string
    ready: boolean
    restartCount: number
    state: string
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
}

// Response from GET /api/v1/pods
export interface PodsResponse {
    pods: Pod[]
    namespace: string
    count: number
}

// Node information with resource metrics
export interface NodeInfo {
    name: string
    status: string
    role: string
    version: string
    cpuCapacity: number
    cpuAllocatable: number
    cpuUsagePercent: number
    memoryCapacity: number
    memoryAllocatable: number
    memoryUsagePercent: number
    podCount: number
    age: string
    osImage?: string
    kernelVersion?: string
    containerRuntime?: string
    architecture?: string
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
