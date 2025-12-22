const API_BASE = '/api/v1'

// Fetch YAML for a resource
export async function fetchResourceYAML(
    resourceType: string,
    namespace: string,
    name: string,
    group?: string,
    version?: string
): Promise<{ yaml: string; resourceType: string; name: string; namespace: string }> {
    let url = `${API_BASE}/yaml/${encodeURIComponent(resourceType)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`

    // Add CRD group/version as query params if provided
    if (group && version) {
        url += `?group=${encodeURIComponent(group)}&version=${encodeURIComponent(version)}`
    }

    const response = await fetch(url)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch resource YAML')
    }

    return response.json()
}

// Apply YAML changes to a resource
export async function applyResourceYAML(
    resourceType: string,
    namespace: string,
    name: string,
    yaml: string,
    group?: string,
    version?: string
): Promise<{ message: string; name: string }> {
    let url = `${API_BASE}/yaml/${encodeURIComponent(resourceType)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`

    // Add CRD group/version as query params if provided
    if (group && version) {
        url += `?group=${encodeURIComponent(group)}&version=${encodeURIComponent(version)}`
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yaml }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to apply YAML')
    }

    return response.json()
}
