export interface ResourceQuotaInfo {
    name: string
    namespace: string
    hardCPU: string
    hardMemory: string
    hardPods: string
    usedCPU: string
    usedMemory: string
    usedPods: string
    cpuUsagePercent: number
    memoryUsagePercent: number
    podsUsagePercent: number
}

export interface ResourceQuotasResponse {
    quotas: ResourceQuotaInfo[]
}

const API_BASE = '/api/v1'

export async function fetchResourceQuotas(namespace: string): Promise<ResourceQuotasResponse> {
    const response = await fetch(`${API_BASE}/resourcequotas/${encodeURIComponent(namespace)}`)
    if (!response.ok) {
        throw new Error('Failed to fetch resource quotas')
    }
    return response.json()
}
