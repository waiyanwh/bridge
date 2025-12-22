const API_BASE = '/api/v1'

// CRD Types
export interface CRDResource {
    kind: string
    name: string
    version: string
    namespaced: boolean
}

export interface CRDGroup {
    group: string
    resources: CRDResource[]
}

export interface PrinterColumn {
    name: string
    type: string
    jsonPath: string
    description?: string
    priority?: number
}

export interface CustomResourcesResponse {
    columns: PrinterColumn[]
    items: Record<string, unknown>[]
    namespace?: string
    count: number
}

// Fetch all CRD groups
export async function fetchCRDGroups(): Promise<CRDGroup[]> {
    const response = await fetch(`${API_BASE}/crds`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch CRD groups')
    }

    return response.json()
}

// Fetch custom resources for a specific CRD
export async function fetchCustomResources(
    group: string,
    version: string,
    resource: string,
    namespace?: string
): Promise<CustomResourcesResponse> {
    let url = `${API_BASE}/custom/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(resource)}`

    if (namespace) {
        url += `?namespace=${encodeURIComponent(namespace)}`
    }

    const response = await fetch(url)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch custom resources')
    }

    return response.json()
}
