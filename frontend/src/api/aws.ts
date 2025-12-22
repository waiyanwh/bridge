const API_BASE = '/api/v1'

// AWS Profile Types
export interface AWSProfilesResponse {
    profiles: string[]
    count: number
}

export interface ContextAWSMapping {
    contextName: string
    clusterName: string
    userName: string
    awsProfile: string
}

export interface ContextAWSMappingsResponse {
    mappings: ContextAWSMapping[]
    count: number
}

export interface SetAWSProfileRequest {
    contextName: string
    awsProfile: string
}

export interface SetAWSProfileResponse {
    success: boolean
    message: string
    contextName: string
    awsProfile: string
}

export interface SSOLoginRequest {
    profile: string
}

export interface SSOLoginResponse {
    success: boolean
    message: string
    profile: string
}

// Fetch available AWS profiles from ~/.aws/config
export async function fetchAWSProfiles(): Promise<AWSProfilesResponse> {
    const response = await fetch(`${API_BASE}/aws/profiles`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch AWS profiles')
    }

    return response.json()
}

// Get all context to AWS profile mappings
export async function fetchContextAWSMappings(): Promise<ContextAWSMappingsResponse> {
    const response = await fetch(`${API_BASE}/system/context/aws-mappings`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch context AWS mappings')
    }

    return response.json()
}

// Set AWS profile for a specific context
export async function setContextAWSProfile(
    contextName: string,
    awsProfile: string
): Promise<SetAWSProfileResponse> {
    const response = await fetch(`${API_BASE}/system/context/aws-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextName, awsProfile } as SetAWSProfileRequest),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to set AWS profile')
    }

    return response.json()
}

// Trigger AWS SSO login for a profile
export async function triggerSSOLogin(profile: string): Promise<SSOLoginResponse> {
    const response = await fetch(`${API_BASE}/aws/sso-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile } as SSOLoginRequest),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to trigger SSO login')
    }

    return response.json()
}

// ================== SSO Sync Types ==================

export interface SSOSessionInfo {
    name: string
    startUrl: string
    region: string
}

export interface SSOSessionsResponse {
    sessions: SSOSessionInfo[]
    count: number
}

export interface SSOSyncRequest {
    ssoStartUrl?: string
    ssoRegion?: string
    ssoSessionName?: string
}

export interface SSOSyncResponse {
    success: boolean
    message: string
    newProfiles: number
    totalAccounts: number
    totalRoles: number
    profiles: string[]
}

export interface SSOSyncError {
    error: string
    message: string
}

export interface SSOSessionLoginRequest {
    sessionName?: string
    startUrl?: string
    region?: string
}

// Fetch available SSO sessions from ~/.aws/config
export async function fetchSSOSessions(): Promise<SSOSessionsResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/sessions`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch SSO sessions')
    }

    return response.json()
}

// Sync AWS SSO accounts and create profiles
export async function syncSSOAccounts(req?: SSOSyncRequest): Promise<SSOSyncResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req || {}),
    })

    if (!response.ok) {
        const error = await response.json() as SSOSyncError
        // Special handling for SSO_LOGIN_REQUIRED
        if (error.error === 'SSO_LOGIN_REQUIRED') {
            const ssoError = new Error(error.message) as Error & { code: string }
            ssoError.code = 'SSO_LOGIN_REQUIRED'
            throw ssoError
        }
        throw new Error(error.message || 'Failed to sync SSO accounts')
    }

    return response.json()
}

// Trigger AWS SSO login for a session
export async function triggerSSOSessionLogin(req: SSOSessionLoginRequest): Promise<SSOLoginResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to trigger SSO login')
    }

    return response.json()
}

// ================== Bridge-Managed SSO (Isolated Mode) ==================

// Device authorization types
export interface DeviceAuthRequest {
    startUrl: string
    region: string
}

export interface DeviceAuthResponse {
    userCode: string
    verificationUri: string
    verificationUriComplete: string
    expiresIn: number
    interval: number
    deviceCode: string
    clientId: string
    clientSecret: string
}

export interface CompleteAuthRequest {
    startUrl: string
    region: string
    deviceCode: string
    clientId: string
    clientSecret: string
}

export interface TokenResponse {
    success: boolean
    message: string
    expiresAt: string
}

export interface AuthStatusResponse {
    isLoggedIn: boolean
    tokenExpiry?: string
}

// Session types
export interface BridgeAccount {
    accountId: string
    accountName: string
    email?: string
    roles: string[]
}

export interface BridgeSession {
    name: string
    startUrl: string
    region: string
    isLoggedIn: boolean
    tokenExpiry?: string
    lastSynced?: string
    accounts: BridgeAccount[]
}

export interface BridgeSessionsResponse {
    sessions: BridgeSession[]
    count: number
}

export interface AddSessionRequest {
    sessionName: string
    startUrl: string
    region: string
}

// Context mapping types
export interface ContextMappingRequest {
    contextName: string
    sessionName: string
    accountId: string
    roleName: string
}

export interface BridgeContextMapping {
    contextName: string
    clusterName: string
    sessionName: string
    accountId: string
    accountName?: string
    roleName: string
    updatedAt: string
}

export interface BridgeContextMappingsResponse {
    mappings: BridgeContextMapping[]
    count: number
}

// Start device authorization flow
export async function startDeviceAuth(req: DeviceAuthRequest): Promise<DeviceAuthResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/device/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to start device authorization')
    }

    return response.json()
}

// Complete device authorization (polls for token)
export async function completeDeviceAuth(req: CompleteAuthRequest): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/device/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to complete device authorization')
    }

    return response.json()
}

// Check auth status (non-blocking)
export async function checkAuthStatus(startUrl: string): Promise<AuthStatusResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/device/status?startUrl=${encodeURIComponent(startUrl)}`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to check auth status')
    }

    return response.json()
}

// List Bridge-managed sessions
export async function fetchBridgeSessions(): Promise<BridgeSessionsResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/sessions`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch sessions')
    }

    return response.json()
}

// Add a new Bridge-managed session
export async function addBridgeSession(req: AddSessionRequest): Promise<{ success: boolean; message: string; accountsCount: number }> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        if (error.error === 'SSO_LOGIN_REQUIRED') {
            const ssoError = new Error(error.message) as Error & { code: string }
            ssoError.code = 'SSO_LOGIN_REQUIRED'
            throw ssoError
        }
        throw new Error(error.message || 'Failed to add session')
    }

    return response.json()
}

// Sync a session's accounts
export async function syncBridgeSession(sessionName: string): Promise<{ success: boolean; message: string; accountsCount: number }> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/sessions/${encodeURIComponent(sessionName)}/sync`, {
        method: 'POST',
    })

    if (!response.ok) {
        const error = await response.json()
        if (error.error === 'SSO_LOGIN_REQUIRED') {
            const ssoError = new Error(error.message) as Error & { code: string }
            ssoError.code = 'SSO_LOGIN_REQUIRED'
            throw ssoError
        }
        throw new Error(error.message || 'Failed to sync session')
    }

    return response.json()
}

// Delete a Bridge-managed session
export async function deleteBridgeSession(sessionName: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/sessions/${encodeURIComponent(sessionName)}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete session')
    }

    return response.json()
}

// List context mappings
export async function fetchBridgeContextMappings(): Promise<BridgeContextMappingsResponse> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/context-mappings`)

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch context mappings')
    }

    return response.json()
}

// Map a context to an AWS role
export async function mapContextToRole(req: ContextMappingRequest): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/context-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to map context')
    }

    return response.json()
}

// Delete a context mapping
export async function deleteContextMapping(contextName: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/aws/sso/bridge/context-mapping/${encodeURIComponent(contextName)}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete mapping')
    }

    return response.json()
}

