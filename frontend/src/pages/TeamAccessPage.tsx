import { useState, useEffect } from 'react'
import { Shield, RefreshCw, Copy, Check, Download, AlertCircle, Plus, Trash2, Users, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useNamespaces } from '@/hooks'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

const API_BASE = '/api/v1'

interface PermissionRow {
    id: string
    label: string
    resources: string[]
    viewChecked: boolean
    editChecked: boolean
}

interface BridgeAccessUser {
    name: string
    namespace: string
    username: string
    createdAt: string
    expiresAt?: string
    serviceAccount: string
    role: string
    roleBinding: string
}

const durationOptions = [
    { value: '1h', label: '1 Hour' },
    { value: '8h', label: '8 Hours (Workday)' },
    { value: '24h', label: '24 Hours' },
    { value: '168h', label: '7 Days' },
    { value: '0', label: 'Permanent' },
]

const defaultPermissions: PermissionRow[] = [
    { id: 'workloads', label: 'Workloads (Deployments, Pods)', resources: ['deployments', 'pods', 'replicasets'], viewChecked: false, editChecked: false },
    { id: 'statefulsets', label: 'StatefulSets', resources: ['statefulsets'], viewChecked: false, editChecked: false },
    { id: 'daemonsets', label: 'DaemonSets', resources: ['daemonsets'], viewChecked: false, editChecked: false },
    { id: 'cronjobs', label: 'CronJobs & Jobs', resources: ['cronjobs', 'jobs'], viewChecked: false, editChecked: false },
    { id: 'services', label: 'Services', resources: ['services'], viewChecked: false, editChecked: false },
    { id: 'ingresses', label: 'Ingresses', resources: ['ingresses'], viewChecked: false, editChecked: false },
    { id: 'configmaps', label: 'ConfigMaps', resources: ['configmaps'], viewChecked: false, editChecked: false },
    { id: 'secrets', label: 'Secrets', resources: ['secrets'], viewChecked: false, editChecked: false },
    { id: 'pvcs', label: 'PersistentVolumeClaims', resources: ['persistentvolumeclaims'], viewChecked: false, editChecked: false },
]

// Helper to format time remaining
function formatTimeRemaining(expiresAt: string): { text: string; isUrgent: boolean; isExpired: boolean } {
    const expiry = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()

    if (diffMs <= 0) {
        return { text: 'Expired', isUrgent: true, isExpired: true }
    }

    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    const isUrgent = diffHours < 1

    if (diffDays > 0) {
        return { text: `in ${diffDays}d ${diffHours % 24}h`, isUrgent: false, isExpired: false }
    }
    if (diffHours > 0) {
        return { text: `in ${diffHours}h ${diffMinutes % 60}m`, isUrgent, isExpired: false }
    }
    return { text: `in ${diffMinutes}m`, isUrgent: true, isExpired: false }
}

function formatDate(dateStr: string) {
    try {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    } catch {
        return dateStr
    }
}

export function TeamAccessPage() {
    // Active users state
    const [activeUsers, setActiveUsers] = useState<BridgeAccessUser[]>([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(true)
    const [revokeTarget, setRevokeTarget] = useState<BridgeAccessUser | null>(null)
    const [isRevoking, setIsRevoking] = useState(false)

    // Dialog state
    const [grantDialogOpen, setGrantDialogOpen] = useState(false)
    const [configTarget, setConfigTarget] = useState<BridgeAccessUser | null>(null)

    // Load active users
    const loadActiveUsers = async () => {
        setIsLoadingUsers(true)
        try {
            const response = await fetch(`${API_BASE}/bridge/access`)
            const data = await response.json()
            if (response.ok) {
                setActiveUsers(data.users || [])
            }
        } catch (err) {
            console.error('Failed to load active users:', err)
        } finally {
            setIsLoadingUsers(false)
        }
    }

    useEffect(() => {
        loadActiveUsers()
    }, [])

    const handleRevoke = async () => {
        if (!revokeTarget) return

        setIsRevoking(true)
        try {
            const response = await fetch(
                `${API_BASE}/bridge/access/${encodeURIComponent(revokeTarget.namespace)}/${encodeURIComponent(revokeTarget.name)}`,
                { method: 'DELETE' }
            )

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Failed to revoke access')
            }

            loadActiveUsers()
            setRevokeTarget(null)
        } catch (err) {
            console.error('Failed to revoke:', err)
        } finally {
            setIsRevoking(false)
        }
    }

    const handleGrantSuccess = () => {
        loadActiveUsers()
        setGrantDialogOpen(false)
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Bridge Access Control
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {activeUsers.length} active user{activeUsers.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadActiveUsers}
                        disabled={isLoadingUsers}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setGrantDialogOpen(true)}
                        className="gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600"
                    >
                        <Plus className="h-4 w-4" />
                        Grant New Access
                    </Button>
                </div>
            </div>

            {/* Active Bridge Users Table */}
            <div className="rounded-lg border bg-card">
                {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-16">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : activeUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-lg">No active Bridge users</p>
                        <p className="text-sm mt-1">Click "Grant New Access" to create an access token</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Namespace</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead>Service Account</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeUsers.map(user => {
                                const timeInfo = user.expiresAt ? formatTimeRemaining(user.expiresAt) : null
                                return (
                                    <TableRow key={`${user.namespace}/${user.name}`}>
                                        <TableCell className="font-mono font-medium">
                                            {user.username || user.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{user.namespace}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(user.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            {timeInfo ? (
                                                <Badge className={
                                                    timeInfo.isExpired
                                                        ? "bg-red-500/20 text-red-400"
                                                        : timeInfo.isUrgent
                                                            ? "bg-amber-500/20 text-amber-400"
                                                            : "bg-blue-500/20 text-blue-400"
                                                }>
                                                    {timeInfo.text}
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-indigo-500/20 text-indigo-400">Never</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-mono text-xs">
                                                {user.serviceAccount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setConfigTarget(user)}
                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Key className="h-4 w-4 mr-1" />
                                                    Get Config
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setRevokeTarget(user)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                    Revoke
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Grant Access Dialog */}
            <GrantAccessDialog
                open={grantDialogOpen}
                onOpenChange={setGrantDialogOpen}
                onSuccess={handleGrantSuccess}
            />

            {/* Revoke Confirmation Dialog */}
            <Dialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-400">Revoke Access</DialogTitle>
                        <DialogDescription>
                            Bridge will revoke access for <strong className="text-foreground">{revokeTarget?.username || revokeTarget?.name}</strong>.
                            This will delete the ServiceAccount, Role, and RoleBinding.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <strong>Warning:</strong> This action cannot be undone. Any kubeconfig files using this access will immediately stop working.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRevoke}
                            disabled={isRevoking}
                            className="gap-2"
                        >
                            {isRevoking ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            {isRevoking ? 'Revoking...' : 'Revoke Access'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Config Details Dialog */}
            <ConfigDetailsDialog
                user={configTarget}
                onClose={() => setConfigTarget(null)}
            />
        </div>
    )
}

// Grant Access Dialog Component
interface GrantAccessDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

function GrantAccessDialog({ open, onOpenChange, onSuccess }: GrantAccessDialogProps) {
    const [step, setStep] = useState<'form' | 'result'>('form')
    const [name, setName] = useState('')
    const [namespace, setNamespace] = useState('default')
    const [duration, setDuration] = useState('24h')
    const [permissions, setPermissions] = useState<PermissionRow[]>(defaultPermissions)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedKubeconfig, setGeneratedKubeconfig] = useState<string | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const { data: namespacesData } = useNamespaces()

    const handlePermissionChange = (id: string, type: 'view' | 'edit', checked: boolean) => {
        setPermissions(prev => prev.map(p => {
            if (p.id === id) {
                if (type === 'view') {
                    return { ...p, viewChecked: checked }
                } else {
                    return { ...p, editChecked: checked, viewChecked: checked ? true : p.viewChecked }
                }
            }
            return p
        }))
    }

    // Select All handlers
    const allViewChecked = permissions.every(p => p.viewChecked)
    const allEditChecked = permissions.every(p => p.editChecked)

    const handleSelectAllView = () => {
        const newValue = !allViewChecked
        setPermissions(prev => prev.map(p => ({ ...p, viewChecked: newValue })))
    }

    const handleSelectAllEdit = () => {
        const newValue = !allEditChecked
        // If selecting all edit, also select all view (smart interaction)
        setPermissions(prev => prev.map(p => ({
            ...p,
            editChecked: newValue,
            viewChecked: newValue ? true : p.viewChecked
        })))
    }

    const buildRequest = () => {
        const selectedResources: string[] = []
        const verbs = new Set<string>()

        permissions.forEach(p => {
            if (p.viewChecked || p.editChecked) {
                selectedResources.push(...p.resources)
            }
            if (p.viewChecked) {
                verbs.add('get')
                verbs.add('list')
                verbs.add('watch')
            }
            if (p.editChecked) {
                verbs.add('create')
                verbs.add('update')
                verbs.add('patch')
                verbs.add('delete')
            }
        })

        return {
            userLabel: name,
            namespace,
            duration,
            permissions: {
                resources: [...new Set(selectedResources)],
                verbs: [...verbs]
            }
        }
    }

    const handleGenerate = async () => {
        if (!name.trim()) {
            setError('Name is required')
            return
        }

        const hasAnyPermission = permissions.some(p => p.viewChecked || p.editChecked)
        if (!hasAnyPermission) {
            setError('At least one permission must be selected')
            return
        }

        setIsGenerating(true)
        setError(null)

        try {
            const request = buildRequest()
            const response = await fetch(`${API_BASE}/bridge/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate kubeconfig')
            }

            setGeneratedKubeconfig(data.kubeconfig)
            setExpiresAt(data.expiresAt || null)
            setStep('result')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleCopy = async () => {
        if (generatedKubeconfig) {
            await navigator.clipboard.writeText(generatedKubeconfig)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleDownload = () => {
        if (generatedKubeconfig) {
            const blob = new Blob([generatedKubeconfig], { type: 'text/yaml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `config-${name.toLowerCase().replace(/\s+/g, '-')}.yaml`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }
    }

    const handleDone = () => {
        onSuccess()
        // Reset state after closing
        setTimeout(() => {
            setStep('form')
            setName('')
            setNamespace('default')
            setDuration('24h')
            setPermissions(defaultPermissions)
            setGeneratedKubeconfig(null)
            setExpiresAt(null)
            setError(null)
        }, 200)
    }

    const handleClose = (open: boolean) => {
        if (!open && step === 'result') {
            handleDone()
        } else {
            onOpenChange(open)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {step === 'form' ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-cyan-400" />
                                Create Access Token
                            </DialogTitle>
                            <DialogDescription>
                                Generate an RBAC-restricted kubeconfig for team access
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto py-4 space-y-5">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name / Label</label>
                                <Input
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                    placeholder="e.g., john-doe, frontend-team"
                                    className="font-mono"
                                />
                            </div>

                            {/* Namespace + Duration Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Namespace</label>
                                    <select
                                        value={namespace}
                                        onChange={(e) => setNamespace(e.target.value)}
                                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                                    >
                                        {namespacesData?.namespaces.map((ns: string) => (
                                            <option key={ns} value={ns}>{ns}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Validity Period</label>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                                    >
                                        {durationOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Permissions Matrix */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Permissions</label>
                                <div className="rounded-md border overflow-hidden">
                                    {/* Header */}
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-muted/50 border-b text-sm font-medium">
                                                <th className="text-left px-4 py-2.5">Resource</th>
                                                <th className="w-16 px-2 py-2.5">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                                        <span>View</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={allViewChecked}
                                                            onChange={handleSelectAllView}
                                                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                                                        />
                                                    </label>
                                                </th>
                                                <th className="w-16 px-2 py-2.5">
                                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                                        <span>Edit</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={allEditChecked}
                                                            onChange={handleSelectAllEdit}
                                                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                                                        />
                                                    </label>
                                                </th>
                                            </tr>
                                        </thead>
                                    </table>
                                    {/* Body with scroll */}
                                    <div className="max-h-[200px] overflow-y-auto pr-1">
                                        <table className="w-full">
                                            <tbody>
                                                {permissions.map(perm => (
                                                    <tr key={perm.id} className="border-b last:border-0 hover:bg-muted/30">
                                                        <td className="px-4 py-2.5 text-sm">{perm.label}</td>
                                                        <td className="w-16 px-2 py-2.5 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={perm.viewChecked}
                                                                onChange={(e) => handlePermissionChange(perm.id, 'view', e.target.checked)}
                                                                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="w-16 px-2 py-2.5 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={perm.editChecked}
                                                                onChange={(e) => handlePermissionChange(perm.id, 'edit', e.target.checked)}
                                                                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <strong>View</strong>: get, list, watch · <strong>Edit</strong>: create, update, patch, delete
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="border-t pt-4 mt-2">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600"
                            >
                                {isGenerating ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Shield className="h-4 w-4" />
                                )}
                                {isGenerating ? 'Generating...' : 'Generate'}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-green-400">
                                <Check className="h-5 w-5" />
                                Access Token Generated
                            </DialogTitle>
                            <DialogDescription>
                                Save this kubeconfig file securely. It will not be shown again.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden py-4 space-y-4">
                            {/* Status Badges */}
                            <div className="flex gap-2 flex-wrap">
                                <Badge className="bg-green-500/20 text-green-400">
                                    User: {name}
                                </Badge>
                                <Badge className="bg-blue-500/20 text-blue-400">
                                    Namespace: {namespace}
                                </Badge>
                                {expiresAt ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-400">
                                        Expires: {formatDate(expiresAt)}
                                    </Badge>
                                ) : (
                                    <Badge className="bg-indigo-500/20 text-indigo-400">
                                        Permanent Access
                                    </Badge>
                                )}
                            </div>

                            {/* Kubeconfig YAML */}
                            <div className="rounded-md bg-zinc-900 border border-zinc-700 max-h-[400px] overflow-auto">
                                <pre className="p-4 font-mono text-xs text-foreground whitespace-pre">
                                    {generatedKubeconfig}
                                </pre>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Use with: <code className="bg-muted px-1 py-0.5 rounded">kubectl --kubeconfig=config-{name || 'user'}.yaml</code>
                            </p>
                        </div>

                        <DialogFooter className="border-t pt-4 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="gap-1.5"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                className="gap-1.5"
                            >
                                <Download className="h-4 w-4" />
                                Download .kubeconfig
                            </Button>
                            <Button onClick={handleDone}>
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

// Config Details Dialog Component
interface ConfigDetailsDialogProps {
    user: BridgeAccessUser | null
    onClose: () => void
}

function ConfigDetailsDialog({ user, onClose }: ConfigDetailsDialogProps) {
    const [kubeconfig, setKubeconfig] = useState<string | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Fetch kubeconfig when user changes
    useEffect(() => {
        if (user) {
            setIsLoading(true)
            setError(null)
            setKubeconfig(null)

            fetch(`${API_BASE}/bridge/access/${encodeURIComponent(user.namespace)}/${encodeURIComponent(user.name)}/kubeconfig`)
                .then(async (response) => {
                    const data = await response.json()
                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to fetch kubeconfig')
                    }
                    setKubeconfig(data.kubeconfig)
                    setExpiresAt(data.expiresAt || null)
                })
                .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to fetch kubeconfig')
                })
                .finally(() => {
                    setIsLoading(false)
                })
        }
    }, [user])

    const handleCopy = async () => {
        if (kubeconfig) {
            await navigator.clipboard.writeText(kubeconfig)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleDownload = () => {
        if (kubeconfig && user) {
            const blob = new Blob([kubeconfig], { type: 'text/yaml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `config-${user.name}.yaml`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }
    }

    const handleClose = () => {
        onClose()
        // Reset state after closing
        setTimeout(() => {
            setKubeconfig(null)
            setExpiresAt(null)
            setError(null)
            setCopied(false)
        }, 200)
    }

    const timeInfo = expiresAt ? formatTimeRemaining(expiresAt) : null

    return (
        <Dialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-400" />
                        Kubeconfig for {user?.username || user?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Download or copy the kubeconfig for this access token
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden py-4 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div>
                                <p className="font-medium">Failed to retrieve kubeconfig</p>
                                <p className="text-sm opacity-80">{error}</p>
                            </div>
                        </div>
                    ) : kubeconfig ? (
                        <>
                            {/* Status Info */}
                            <div className="flex gap-2 flex-wrap">
                                <Badge className="bg-blue-500/20 text-blue-400">
                                    Namespace: {user?.namespace}
                                </Badge>
                                {timeInfo ? (
                                    <Badge className={
                                        timeInfo.isExpired
                                            ? "bg-red-500/20 text-red-400"
                                            : timeInfo.isUrgent
                                                ? "bg-amber-500/20 text-amber-400"
                                                : "bg-green-500/20 text-green-400"
                                    }>
                                        {timeInfo.isExpired ? 'Expired' : `Expires ${timeInfo.text}`}
                                    </Badge>
                                ) : (
                                    <Badge className="bg-indigo-500/20 text-indigo-400">
                                        Permanent Access
                                    </Badge>
                                )}
                            </div>

                            {/* Security Note */}
                            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                                <strong>Security Note:</strong> This kubeconfig contains a bearer token.
                                Keep it secure and do not share publicly.
                            </div>

                            {/* Kubeconfig Code Block */}
                            <div className="rounded-md bg-zinc-900 border border-zinc-700 max-h-[300px] overflow-auto">
                                <pre className="p-4 font-mono text-xs text-foreground whitespace-pre">
                                    {kubeconfig}
                                </pre>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Use with: <code className="bg-muted px-1 py-0.5 rounded">kubectl --kubeconfig=config-{user?.name}.yaml</code>
                            </p>
                        </>
                    ) : null}
                </div>

                <DialogFooter className="border-t pt-4 gap-2">
                    {kubeconfig && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="gap-1.5"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                                className="gap-1.5"
                            >
                                <Download className="h-4 w-4" />
                                Download .yaml
                            </Button>
                        </>
                    )}
                    <Button onClick={handleClose}>
                        {kubeconfig ? 'Done' : 'Close'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
