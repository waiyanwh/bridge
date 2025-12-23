import type { PodsResponse, PodDetail, NodeInfo, ConfigMapInfo, SecretInfo, SecretReveal } from '@/types'

const API_BASE = '/api/v1'

// Namespaces API
export interface NamespacesResponse {
    namespaces: string[]
    count: number
}

export async function fetchNamespaces(): Promise<NamespacesResponse> {
    const response = await fetch(`${API_BASE}/namespaces`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch namespaces')
    }

    return response.json()
}

export async function fetchPods(namespace: string = 'default'): Promise<PodsResponse> {
    const response = await fetch(`${API_BASE}/pods?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch pods')
    }

    return response.json()
}

export async function fetchPodDetail(namespace: string, name: string): Promise<PodDetail> {
    const response = await fetch(`${API_BASE}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch pod details')
    }

    return response.json()
}

export function getPodLogsWebSocketUrl(namespace: string, name: string, container?: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    let url = `${protocol}//${host}${API_BASE}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/logs`
    if (container) {
        url += `?container=${encodeURIComponent(container)}`
    }
    return url
}

export interface NodesResponse {
    nodes: NodeInfo[]
    count: number
}

export async function fetchNodes(): Promise<NodesResponse> {
    const response = await fetch(`${API_BASE}/nodes`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch nodes')
    }

    return response.json()
}

// Workload Types
export interface DeploymentInfo {
    name: string
    namespace: string
    replicas: string
    readyCount: number
    desiredCount: number
    images: string[]
    age: string
    selector?: Record<string, string>
}

export interface StatefulSetInfo {
    name: string
    namespace: string
    replicas: string
    readyCount: number
    desiredCount: number
    images: string[]
    age: string
    selector?: Record<string, string>
}

export interface DaemonSetInfo {
    name: string
    namespace: string
    desired: number
    current: number
    ready: number
    available: number
    images: string[]
    age: string
    selector?: Record<string, string>
    nodeSelector?: Record<string, string>
}

export interface CronJobInfo {
    name: string
    namespace: string
    schedule: string
    lastScheduleTime: string
    suspend: boolean
    active: number
    age: string
}

// Workload API Responses
export interface DeploymentsResponse {
    deployments: DeploymentInfo[]
    namespace: string
    count: number
}

export interface StatefulSetsResponse {
    statefulSets: StatefulSetInfo[]
    namespace: string
    count: number
}

export interface DaemonSetsResponse {
    daemonSets: DaemonSetInfo[]
    namespace: string
    count: number
}

export interface CronJobsResponse {
    cronJobs: CronJobInfo[]
    namespace: string
    count: number
}

// Workload API Functions
export async function fetchDeployments(namespace: string = 'default'): Promise<DeploymentsResponse> {
    const response = await fetch(`${API_BASE}/deployments?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch deployments')
    }

    return response.json()
}

export async function fetchStatefulSets(namespace: string = 'default'): Promise<StatefulSetsResponse> {
    const response = await fetch(`${API_BASE}/statefulsets?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch statefulsets')
    }

    return response.json()
}

export async function fetchDaemonSets(namespace: string = 'default'): Promise<DaemonSetsResponse> {
    const response = await fetch(`${API_BASE}/daemonsets?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch daemonsets')
    }

    return response.json()
}

export async function fetchCronJobs(namespace: string = 'default'): Promise<CronJobsResponse> {
    const response = await fetch(`${API_BASE}/cronjobs?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch cronjobs')
    }

    return response.json()
}

// Workload Action Types
export interface ActionResponse {
    success: boolean
    message: string
}

// Restart a workload (deployment, statefulset, daemonset)
export async function restartWorkload(
    kind: string,
    namespace: string,
    name: string
): Promise<ActionResponse> {
    const response = await fetch(
        `${API_BASE}/workloads/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/restart`,
        { method: 'POST' }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to restart workload')
    }

    return response.json()
}

// Scale a workload (deployment, statefulset)
export async function scaleWorkload(
    kind: string,
    namespace: string,
    name: string,
    replicas: number
): Promise<ActionResponse> {
    const response = await fetch(
        `${API_BASE}/workloads/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/scale`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replicas }),
        }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to scale workload')
    }

    return response.json()
}

// Suspend/Resume a CronJob
export async function suspendCronJob(
    namespace: string,
    name: string,
    suspend: boolean
): Promise<ActionResponse> {
    const response = await fetch(
        `${API_BASE}/cronjobs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/suspend`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suspend }),
        }
    )

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update cronjob')
    }

    return response.json()
}

// ConfigMap API
export interface ConfigMapsResponse {
    configMaps: ConfigMapInfo[]
    namespace: string
    count: number
}

export async function fetchConfigMaps(namespace: string = 'default'): Promise<ConfigMapsResponse> {
    const response = await fetch(`${API_BASE}/configmaps?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch configmaps')
    }

    return response.json()
}

// Resource Reference (for Used By feature)
export interface ResourceReference {
    kind: string
    name: string
    namespace: string
}

// ConfigMap Detail with references
export interface ConfigMapDetailResponse {
    name: string
    namespace: string
    keys: string[]
    data: Record<string, string>
    age: string
    referencedBy: ResourceReference[]
}

export async function fetchConfigMap(namespace: string, name: string): Promise<ConfigMapDetailResponse> {
    const response = await fetch(`${API_BASE}/configmaps/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch configmap')
    }

    return response.json()
}

// Secret Detail with references
export interface SecretDetailResponse {
    name: string
    namespace: string
    type: string
    keys: string[]
    age: string
    referencedBy: ResourceReference[]
}

export async function fetchSecret(namespace: string, name: string): Promise<SecretDetailResponse> {
    const response = await fetch(`${API_BASE}/secrets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch secret')
    }

    return response.json()
}

// Secrets API
export interface SecretsResponse {
    secrets: SecretInfo[]
    namespace: string
    count: number
}

export async function fetchSecrets(namespace: string = 'default'): Promise<SecretsResponse> {
    const response = await fetch(`${API_BASE}/secrets?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch secrets')
    }

    return response.json()
}

export async function revealSecret(namespace: string, name: string): Promise<SecretReveal> {
    const response = await fetch(`${API_BASE}/secrets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/reveal`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to reveal secret')
    }

    return response.json()
}

// Network Types
export interface ServiceInfo {
    name: string
    namespace: string
    type: string
    clusterIP: string
    ports: string[]
    age: string
}

export interface IngressInfo {
    name: string
    namespace: string
    hosts: string[]
    address: string
    class: string
    age: string
}

export interface NetworkPolicyInfo {
    name: string
    namespace: string
    podSelector: string
    policyTypes: string[]
    age: string
}

// Network API Responses
export interface ServicesResponse {
    services: ServiceInfo[]
    namespace: string
    count: number
}

export interface IngressesResponse {
    ingresses: IngressInfo[]
    namespace: string
    count: number
}

export interface NetworkPoliciesResponse {
    networkPolicies: NetworkPolicyInfo[]
    namespace: string
    count: number
}

// Network API Functions
export async function fetchServices(namespace: string = 'default'): Promise<ServicesResponse> {
    const response = await fetch(`${API_BASE}/services?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch services')
    }

    return response.json()
}

export async function fetchIngresses(namespace: string = 'default'): Promise<IngressesResponse> {
    const response = await fetch(`${API_BASE}/ingresses?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch ingresses')
    }

    return response.json()
}

export async function fetchNetworkPolicies(namespace: string = 'default'): Promise<NetworkPoliciesResponse> {
    const response = await fetch(`${API_BASE}/networkpolicies?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch network policies')
    }

    return response.json()
}

// Storage Types
export interface PVCInfo {
    name: string
    namespace: string
    status: string
    capacity: string
    accessModes: string[]
    storageClass: string
    volumeName: string
    age: string
}

export interface PVInfo {
    name: string
    capacity: string
    accessModes: string[]
    reclaimPolicy: string
    status: string
    claim: string
    storageClass: string
    age: string
}

export interface StorageClassInfo {
    name: string
    provisioner: string
    reclaimPolicy: string
    volumeBinding: string
    allowExpansion: boolean
    isDefault: boolean
    age: string
}

// Storage API Responses
export interface PVCsResponse {
    pvcs: PVCInfo[]
    namespace: string
    count: number
}

export interface PVsResponse {
    pvs: PVInfo[]
    count: number
}

export interface StorageClassesResponse {
    storageClasses: StorageClassInfo[]
    count: number
}

// Storage API Functions
export async function fetchPVCs(namespace: string = 'default'): Promise<PVCsResponse> {
    const response = await fetch(`${API_BASE}/pvcs?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch PVCs')
    }

    return response.json()
}

export async function fetchPVs(): Promise<PVsResponse> {
    const response = await fetch(`${API_BASE}/pvs`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch PVs')
    }

    return response.json()
}

export async function fetchStorageClasses(): Promise<StorageClassesResponse> {
    const response = await fetch(`${API_BASE}/storageclasses`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch storage classes')
    }

    return response.json()
}

// RBAC Types
export interface PolicyRule {
    verbs: string[]
    resources: string[]
    apiGroups: string[]
}

export interface ServiceAccountInfo {
    name: string
    namespace: string
    secretsCount: number
    age: string
}

export interface RoleInfo {
    name: string
    namespace: string
    rules: PolicyRule[]
    age: string
}

export interface ClusterRoleInfo {
    name: string
    rules: PolicyRule[]
    age: string
}

// RBAC API Responses
export interface ServiceAccountsResponse {
    serviceAccounts: ServiceAccountInfo[]
    namespace: string
    count: number
}

export interface RolesResponse {
    roles: RoleInfo[]
    namespace: string
    count: number
}

export interface ClusterRolesResponse {
    clusterRoles: ClusterRoleInfo[]
    count: number
}

// RBAC API Functions
export async function fetchServiceAccounts(namespace: string = 'default'): Promise<ServiceAccountsResponse> {
    const response = await fetch(`${API_BASE}/serviceaccounts?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch service accounts')
    }

    return response.json()
}

export async function fetchRoles(namespace: string = 'default'): Promise<RolesResponse> {
    const response = await fetch(`${API_BASE}/roles?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch roles')
    }

    return response.json()
}

export async function fetchClusterRoles(): Promise<ClusterRolesResponse> {
    const response = await fetch(`${API_BASE}/clusterroles`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch cluster roles')
    }

    return response.json()
}

// Role Binding Types
export interface RoleBindingInfo {
    name: string
    namespace: string
    roleRef: string
    roleKind: string
    subjects: string[]
    age: string
}

export interface ClusterRoleBindingInfo {
    name: string
    roleRef: string
    roleKind: string
    subjects: string[]
    age: string
}

export interface RoleBindingsResponse {
    roleBindings: RoleBindingInfo[]
    namespace: string
    count: number
}

export interface ClusterRoleBindingsResponse {
    clusterRoleBindings: ClusterRoleBindingInfo[]
    count: number
}

export async function fetchRoleBindings(namespace: string = 'default'): Promise<RoleBindingsResponse> {
    const response = await fetch(`${API_BASE}/rolebindings?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch role bindings')
    }

    return response.json()
}

export async function fetchClusterRoleBindings(): Promise<ClusterRoleBindingsResponse> {
    const response = await fetch(`${API_BASE}/clusterrolebindings`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch cluster role bindings')
    }

    return response.json()
}

// HPA Types
export interface HPAInfo {
    name: string
    namespace: string
    targetRef: string
    targetKind: string
    minReplicas: number
    maxReplicas: number
    currentReplicas: number
    desiredReplicas: number
    utilization: string
    age: string
}

// Event Types
export interface EventInfo {
    type: string
    reason: string
    objectKind: string
    objectName: string
    objectNs: string
    message: string
    count: number
    firstSeen: string
    lastSeen: string
    lastSeenAge: string
    sourceComponent: string
}

// HPA/Events API Responses
export interface HPAResponse {
    hpas: HPAInfo[]
    namespace: string
    count: number
}

export interface EventsResponse {
    events: EventInfo[]
    namespace: string
    count: number
}

// HPA/Events API Functions
export async function fetchHPAs(namespace: string = 'default'): Promise<HPAResponse> {
    const response = await fetch(`${API_BASE}/hpa?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch HPAs')
    }

    return response.json()
}

export async function fetchEvents(namespace: string = 'default'): Promise<EventsResponse> {
    const response = await fetch(`${API_BASE}/events?namespace=${encodeURIComponent(namespace)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch events')
    }

    return response.json()
}

// Tunnel Types
export interface TunnelInfo {
    id: string
    namespace: string
    resourceType: string
    resourceName: string
    targetPort: number
    localPort: number
    status: 'Active' | 'Dead'
    createdAt: string
    errorMsg?: string
    url: string
}

export interface TunnelsResponse {
    tunnels: TunnelInfo[]
    count: number
}

export interface CreateTunnelRequest {
    namespace: string
    resourceType: 'pod' | 'service'
    resourceName: string
    targetPort: number
    localPort?: number
}

// Tunnel API Functions
export async function fetchTunnels(): Promise<TunnelsResponse> {
    const response = await fetch(`${API_BASE}/tunnels`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch tunnels')
    }

    return response.json()
}

export async function createTunnel(req: CreateTunnelRequest): Promise<TunnelInfo> {
    const response = await fetch(`${API_BASE}/tunnels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create tunnel')
    }

    return response.json()
}

export async function deleteTunnel(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tunnels/${id}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete tunnel')
    }
}

// Helm Types
export interface HelmReleaseInfo {
    name: string
    namespace: string
    revision: number
    status: string
    chart: string
    chartVersion: string
    appVersion: string
    updated: string
    notes?: string
}

export interface HelmReleaseDetail extends HelmReleaseInfo {
    values: Record<string, unknown>
    manifest?: string
}

export interface HelmRevisionInfo {
    revision: number
    updated: string
    status: string
    chart: string
    appVersion: string
    description: string
}

// Helm API Responses
export interface HelmReleasesResponse {
    releases: HelmReleaseInfo[]
    count: number
}

export interface HelmValuesResponse {
    name: string
    namespace: string
    values: string
}

export interface HelmHistoryResponse {
    name: string
    namespace: string
    history: HelmRevisionInfo[]
}

// Helm API Functions
export async function fetchHelmReleases(namespace: string = ''): Promise<HelmReleasesResponse> {
    const url = namespace && namespace !== 'all'
        ? `${API_BASE}/helm/releases?namespace=${encodeURIComponent(namespace)}`
        : `${API_BASE}/helm/releases`

    const response = await fetch(url)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch Helm releases')
    }

    return response.json()
}

export async function fetchHelmRelease(namespace: string, name: string): Promise<HelmReleaseDetail> {
    const response = await fetch(`${API_BASE}/helm/releases/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch Helm release')
    }

    return response.json()
}

export async function fetchHelmReleaseValues(namespace: string, name: string): Promise<HelmValuesResponse> {
    const response = await fetch(`${API_BASE}/helm/releases/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/values`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch Helm release values')
    }

    return response.json()
}

export async function fetchHelmReleaseHistory(namespace: string, name: string): Promise<HelmHistoryResponse> {
    const response = await fetch(`${API_BASE}/helm/releases/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/history`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch Helm release history')
    }

    return response.json()
}
