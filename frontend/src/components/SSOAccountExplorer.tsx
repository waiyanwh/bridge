import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Cloud,
    Plus,
    RefreshCw,
    Trash2,
    ChevronDown,
    ChevronRight,
    Building2,
    Shield,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Copy,
    ExternalLink,
    Link2,
    Search,
    Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { toast } from '@/components/ui/toast'
import {
    useBridgeSessions,
    useAddBridgeSession,
    useSyncBridgeSession,
    useDeleteBridgeSession,
    useStartDeviceAuth,
    useCompleteDeviceAuth,
    useBridgeContextMappings,
    useMapContextToRole,
} from '@/hooks'
import { useContextAWSMappings } from '@/hooks'
import { cn } from '@/lib/utils'
import type { BridgeSession, DeviceAuthResponse, ContextAWSMapping, BridgeContextMapping } from '@/api'

// AWS Regions for dropdown
const AWS_REGIONS = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'EU (Ireland)' },
    { value: 'eu-west-2', label: 'EU (London)' },
    { value: 'eu-central-1', label: 'EU (Frankfurt)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

interface AddSessionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

function AddSessionDialog({ open, onOpenChange, onSuccess }: AddSessionDialogProps) {
    const [step, setStep] = useState<'form' | 'code' | 'polling'>('form')
    const [sessionName, setSessionName] = useState('')
    const [startUrl, setStartUrl] = useState('')
    const [region, setRegion] = useState('us-east-1')
    const [deviceAuth, setDeviceAuth] = useState<DeviceAuthResponse | null>(null)
    const [copied, setCopied] = useState(false)

    const startDeviceAuth = useStartDeviceAuth()
    const completeDeviceAuth = useCompleteDeviceAuth()
    const addSession = useAddBridgeSession()

    const resetState = useCallback(() => {
        setStep('form')
        setSessionName('')
        setStartUrl('')
        setRegion('us-east-1')
        setDeviceAuth(null)
        setCopied(false)
    }, [])

    useEffect(() => {
        if (!open) {
            resetState()
        }
    }, [open, resetState])

    const handleStartAuth = async () => {
        if (!sessionName || !startUrl || !region) {
            toast.error('Please fill in all fields')
            return
        }

        try {
            const result = await startDeviceAuth.mutateAsync({
                startUrl,
                region,
            })
            setDeviceAuth(result)
            setStep('code')
        } catch (err) {
            toast.error('Failed to start authentication', {
                description: err instanceof Error ? err.message : 'Unknown error',
            })
        }
    }

    const handleCopyCode = async () => {
        if (deviceAuth?.userCode) {
            await navigator.clipboard.writeText(deviceAuth.userCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success('Code copied to clipboard')
        }
    }

    const handleOpenBrowser = () => {
        if (deviceAuth?.verificationUriComplete) {
            window.open(deviceAuth.verificationUriComplete, '_blank')
        }
    }

    const handleCompleteAuth = async () => {
        if (!deviceAuth) return

        setStep('polling')

        try {
            await completeDeviceAuth.mutateAsync({
                startUrl,
                region,
                deviceCode: deviceAuth.deviceCode,
                clientId: deviceAuth.clientId,
                clientSecret: deviceAuth.clientSecret,
            })

            // Now add the session
            await addSession.mutateAsync({
                sessionName,
                startUrl,
                region,
            })

            toast.success('Session added successfully')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            const error = err as Error & { code?: string }
            if (error.code === 'SSO_LOGIN_REQUIRED') {
                toast.error('Please complete the browser authentication first')
                setStep('code')
            } else {
                toast.error('Authentication failed', {
                    description: error.message || 'Unknown error',
                })
                setStep('code')
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-orange-400" />
                        Add SSO Session
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'form' && 'Enter your AWS SSO portal details to get started.'}
                        {step === 'code' && 'Complete the authentication in your browser.'}
                        {step === 'polling' && 'Waiting for browser authentication...'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'form' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="sessionName">Session Name</Label>
                            <Input
                                id="sessionName"
                                placeholder="e.g., My Company SSO"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="startUrl">SSO Start URL</Label>
                            <Input
                                id="startUrl"
                                placeholder="https://your-company.awsapps.com/start"
                                value={startUrl}
                                onChange={(e) => setStartUrl(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="region">SSO Region</Label>
                            <Select value={region} onValueChange={setRegion}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AWS_REGIONS.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {step === 'code' && deviceAuth && (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Copy this code and enter it in the browser:
                            </div>
                            <div className="flex items-center justify-center gap-3">
                                <div className="text-4xl font-mono font-bold tracking-widest bg-zinc-800 px-6 py-4 rounded-lg">
                                    {deviceAuth.userCode}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyCode}
                                    className="shrink-0"
                                >
                                    {copied ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleOpenBrowser}
                                className="gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open AWS Login Page
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCompleteAuth}
                                disabled={completeDeviceAuth.isPending}
                            >
                                I've completed the login
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'polling' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
                        <div className="text-center">
                            <p className="font-medium">Waiting for authentication...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Complete the login in your browser to continue.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'form' && (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleStartAuth}
                                disabled={startDeviceAuth.isPending || !sessionName || !startUrl}
                            >
                                {startDeviceAuth.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Starting...
                                    </>
                                ) : (
                                    'Continue'
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface AccountTreeProps {
    session: BridgeSession
    onSync: () => void
    onDelete: () => void
    onMapRole: (accountId: string, accountName: string, roleName: string) => void
    isSyncing: boolean
}

function AccountTree({ session, onSync, onDelete, onMapRole, isSyncing }: AccountTreeProps) {
    const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

    const toggleAccount = (accountId: string) => {
        setExpandedAccounts((prev) => {
            const next = new Set(prev)
            if (next.has(accountId)) {
                next.delete(accountId)
            } else {
                next.add(accountId)
            }
            return next
        })
    }

    return (
        <Card className="border-zinc-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-3 w-3 rounded-full",
                            session.isLoggedIn ? "bg-emerald-500" : "bg-zinc-500"
                        )} />
                        <CardTitle className="text-base">{session.name}</CardTitle>
                        <Badge variant="outline" className="text-xs font-mono">
                            {session.region}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSync}
                            disabled={isSyncing}
                            className="gap-1.5"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                            Sync
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDelete}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <CardDescription className="text-xs truncate">
                    {session.startUrl}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                {session.accounts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                        No accounts found. Click "Sync" to fetch accounts.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {session.accounts.map((account) => (
                            <div key={account.accountId} className="rounded-lg border border-zinc-800 overflow-hidden">
                                <button
                                    onClick={() => toggleAccount(account.accountId)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
                                >
                                    {expandedAccounts.has(account.accountId) ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <Building2 className="h-4 w-4 text-orange-400" />
                                    <span className="font-medium text-sm">{account.accountName}</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        ({account.accountId})
                                    </span>
                                </button>

                                {expandedAccounts.has(account.accountId) && (
                                    <div className="border-t border-zinc-800 bg-zinc-900/30">
                                        {account.roles.map((role) => (
                                            <div
                                                key={role}
                                                className="flex items-center justify-between px-3 py-2 pl-10 hover:bg-zinc-800/30"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-sm">{role}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onMapRole(account.accountId, account.accountName, role)}
                                                    className="h-7 text-xs gap-1"
                                                >
                                                    <Link2 className="h-3 w-3" />
                                                    Map to Cluster
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

interface MapRoleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sessionName: string
    accountId: string
    accountName: string
    roleName: string
}

// Helper to extract friendly name from ARN or context name
function getContextDisplayName(contextName: string): string {
    // If it's an ARN like arn:aws:eks:region:account:cluster/cluster-name
    const arnMatch = contextName.match(/cluster\/([^/]+)$/)
    if (arnMatch) {
        return arnMatch[1]
    }
    // If it's a long path, get the last segment
    const segments = contextName.split('/')
    if (segments.length > 1) {
        return segments[segments.length - 1]
    }
    // Otherwise return as-is
    return contextName
}

// Helper to truncate long strings
function truncateMiddle(str: string, maxLen: number = 50): string {
    if (str.length <= maxLen) return str
    const ellipsis = '...'
    const charsToShow = maxLen - ellipsis.length
    const frontChars = Math.ceil(charsToShow / 2)
    const backChars = Math.floor(charsToShow / 2)
    return str.substr(0, frontChars) + ellipsis + str.substr(str.length - backChars)
}

function MapRoleDialog({ open, onOpenChange, sessionName, accountId, accountName, roleName }: MapRoleDialogProps) {
    const [selectedContext, setSelectedContext] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const { data: mappingsData } = useContextAWSMappings()
    const { data: bridgeMappingsData } = useBridgeContextMappings()
    const mapContext = useMapContextToRole()

    // Auto-focus search input when dialog opens
    useEffect(() => {
        if (open) {
            setSearchQuery('')
            setSelectedContext('')
            // Small delay to ensure dialog is rendered
            const timer = setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [open])

    const handleMap = async () => {
        if (!selectedContext) {
            toast.error('Please select a context')
            return
        }

        try {
            await mapContext.mutateAsync({
                contextName: selectedContext,
                sessionName,
                accountId,
                roleName,
            })
            toast.success('Context mapped successfully')
            onOpenChange(false)
        } catch (err) {
            toast.error('Failed to map context', {
                description: err instanceof Error ? err.message : 'Unknown error',
            })
        }
    }

    // Get available contexts from mappings data with full info
    const contexts: ContextAWSMapping[] = mappingsData?.mappings || []
    
    // Create a map of existing Bridge mappings for quick lookup
    const existingMappings = new Map<string, BridgeContextMapping>()
    bridgeMappingsData?.mappings?.forEach((m) => {
        if (m.contextName) {
            existingMappings.set(m.contextName, m)
        }
    })

    // Filter contexts based on search query
    const filteredContexts = contexts.filter((ctx) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        const contextNameMatch = ctx.contextName.toLowerCase().includes(query)
        const clusterNameMatch = ctx.clusterName?.toLowerCase().includes(query)
        const displayNameMatch = getContextDisplayName(ctx.contextName).toLowerCase().includes(query)
        return contextNameMatch || clusterNameMatch || displayNameMatch
    })

    const handleSelect = (contextName: string) => {
        setSelectedContext(contextName)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Map Role to Cluster</DialogTitle>
                    <DialogDescription>
                        Search and select a Kubernetes context to map to this AWS role.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/50">
                        <div className="text-sm text-muted-foreground">Selected Role</div>
                        <div className="font-medium mt-1">{accountName}</div>
                        <div className="text-sm text-muted-foreground font-mono">{roleName}</div>
                    </div>

                    <div className="space-y-2">
                        <Label>Kubernetes Context</Label>
                        <Command className="rounded-lg border border-zinc-800 bg-zinc-950" shouldFilter={false}>
                            <div className="flex items-center border-b border-zinc-800 px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    ref={inputRef}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search clusters..."
                                    className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <CommandList className="max-h-[240px]">
                                {filteredContexts.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        {searchQuery ? 'No clusters found.' : 'No clusters available.'}
                                    </div>
                                ) : (
                                    <CommandGroup>
                                        {filteredContexts.map((ctx) => {
                                            const displayName = getContextDisplayName(ctx.contextName)
                                            const isSelected = selectedContext === ctx.contextName
                                            const existingMapping = existingMappings.get(ctx.contextName)
                                            const isMappedToOther = existingMapping && (
                                                existingMapping.accountId !== accountId || 
                                                existingMapping.roleName !== roleName
                                            )

                                            return (
                                                <CommandItem
                                                    key={ctx.contextName}
                                                    value={ctx.contextName}
                                                    onSelect={() => handleSelect(ctx.contextName)}
                                                    className={cn(
                                                        'flex flex-col items-start py-3 px-3 cursor-pointer',
                                                        isSelected && 'bg-zinc-800'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2">
                                                            {isSelected ? (
                                                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                            ) : (
                                                                <div className="h-4 w-4 shrink-0" />
                                                            )}
                                                            <span className="font-medium">{displayName}</span>
                                                        </div>
                                                        {isMappedToOther && (
                                                            <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px] px-1.5 py-0">
                                                                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                                                                Mapped to {existingMapping.accountName || existingMapping.accountId}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col ml-6 mt-1">
                                                        {ctx.clusterName && ctx.clusterName !== displayName && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Cluster: {ctx.clusterName}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-muted-foreground/70 font-mono">
                                                            {truncateMiddle(ctx.contextName, 60)}
                                                        </span>
                                                    </div>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                        {selectedContext && (
                            <div className="text-xs text-muted-foreground mt-2">
                                Selected: <span className="font-mono">{getContextDisplayName(selectedContext)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleMap} disabled={mapContext.isPending || !selectedContext}>
                        {mapContext.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Mapping...
                            </>
                        ) : (
                            'Map Context'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Reauth Dialog for re-authenticating expired sessions
interface ReauthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    session: BridgeSession | null
    onSuccess: () => void
}

function ReauthDialog({ open, onOpenChange, session, onSuccess }: ReauthDialogProps) {
    const [step, setStep] = useState<'code' | 'polling'>('code')
    const [deviceAuth, setDeviceAuth] = useState<DeviceAuthResponse | null>(null)
    const [copied, setCopied] = useState(false)

    const startDeviceAuth = useStartDeviceAuth()
    const completeDeviceAuth = useCompleteDeviceAuth()

    const resetState = useCallback(() => {
        setStep('code')
        setDeviceAuth(null)
        setCopied(false)
    }, [])

    // Start device auth when dialog opens
    useEffect(() => {
        if (open && session && !deviceAuth) {
            startDeviceAuth.mutateAsync({
                startUrl: session.startUrl,
                region: session.region,
            }).then((result) => {
                setDeviceAuth(result)
            }).catch((err) => {
                toast.error('Failed to start authentication', {
                    description: err instanceof Error ? err.message : 'Unknown error',
                })
                onOpenChange(false)
            })
        }
    }, [open, session, deviceAuth, startDeviceAuth, onOpenChange])

    useEffect(() => {
        if (!open) {
            resetState()
        }
    }, [open, resetState])

    const handleCopyCode = async () => {
        if (deviceAuth?.userCode) {
            await navigator.clipboard.writeText(deviceAuth.userCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success('Code copied to clipboard')
        }
    }

    const handleOpenBrowser = () => {
        if (deviceAuth?.verificationUriComplete) {
            window.open(deviceAuth.verificationUriComplete, '_blank')
        }
    }

    const handleCompleteAuth = async () => {
        if (!deviceAuth || !session) return

        setStep('polling')

        try {
            await completeDeviceAuth.mutateAsync({
                startUrl: session.startUrl,
                region: session.region,
                deviceCode: deviceAuth.deviceCode,
                clientId: deviceAuth.clientId,
                clientSecret: deviceAuth.clientSecret,
            })

            toast.success('Re-authenticated successfully')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            const error = err as Error & { code?: string }
            if (error.code === 'SSO_LOGIN_REQUIRED') {
                toast.error('Please complete the browser authentication first')
                setStep('code')
            } else {
                toast.error('Authentication failed', {
                    description: error.message || 'Unknown error',
                })
                setStep('code')
            }
        }
    }

    if (!session) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-orange-400" />
                        Re-authenticate Session
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'code' && `Your session "${session.name}" has expired. Complete login to continue.`}
                        {step === 'polling' && 'Waiting for browser authentication...'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'code' && deviceAuth && (
                    <div className="space-y-6 py-4">
                        <div className="text-center space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Copy this code and enter it in the browser:
                            </div>
                            <div className="flex items-center justify-center gap-3">
                                <div className="text-4xl font-mono font-bold tracking-widest bg-zinc-800 px-6 py-4 rounded-lg">
                                    {deviceAuth.userCode}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyCode}
                                    className="shrink-0"
                                >
                                    {copied ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleOpenBrowser}
                                className="gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open AWS Login Page
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCompleteAuth}
                                disabled={completeDeviceAuth.isPending}
                            >
                                I've completed the login
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'code' && !deviceAuth && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
                        <div className="text-center">
                            <p className="font-medium">Starting authentication...</p>
                        </div>
                    </div>
                )}

                {step === 'polling' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
                        <div className="text-center">
                            <p className="font-medium">Waiting for authentication...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Complete the login in your browser to continue.
                            </p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

export function SSOAccountExplorer() {
    const { data: sessionsData, isLoading, error, refetch } = useBridgeSessions()
    const syncSession = useSyncBridgeSession()
    const deleteSession = useDeleteBridgeSession()

    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [syncingSession, setSyncingSession] = useState<string | null>(null)
    const [mapDialogOpen, setMapDialogOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<{
        sessionName: string
        accountId: string
        accountName: string
        roleName: string
    } | null>(null)

    // Reauth dialog state
    const [reauthDialogOpen, setReauthDialogOpen] = useState(false)
    const [sessionToReauth, setSessionToReauth] = useState<BridgeSession | null>(null)
    const [pendingSyncAfterReauth, setPendingSyncAfterReauth] = useState(false)

    // Smart sync: checks auth status and handles re-auth automatically
    const handleSync = async (sessionName: string) => {
        const session = sessionsData?.sessions?.find(s => s.name === sessionName)
        if (!session) return

        setSyncingSession(sessionName)

        try {
            const result = await syncSession.mutateAsync(sessionName)
            toast.success('Session synced', {
                description: result.message,
            })
        } catch (err) {
            const error = err as Error & { code?: string }
            if (error.code === 'SSO_LOGIN_REQUIRED' || error.message?.includes('SSO_LOGIN_REQUIRED') || error.message?.includes('expired')) {
                // Session expired - trigger re-auth flow
                setSessionToReauth(session)
                setPendingSyncAfterReauth(true)
                setReauthDialogOpen(true)
                // Don't clear syncing state - keep the spinner going
                return
            } else {
                toast.error('Failed to sync session', {
                    description: error.message || 'Unknown error',
                })
            }
        }
        setSyncingSession(null)
    }

    // Handle successful re-authentication
    const handleReauthSuccess = async () => {
        if (pendingSyncAfterReauth && sessionToReauth) {
            // Re-auth succeeded, now do the sync
            try {
                const result = await syncSession.mutateAsync(sessionToReauth.name)
                toast.success('Session synced', {
                    description: result.message,
                })
            } catch (err) {
                toast.error('Failed to sync after re-auth', {
                    description: err instanceof Error ? err.message : 'Unknown error',
                })
            }
        }
        // Clean up
        setPendingSyncAfterReauth(false)
        setSyncingSession(null)
        setSessionToReauth(null)
        refetch()
    }

    // Clean up on reauth dialog close
    const handleReauthDialogChange = (open: boolean) => {
        setReauthDialogOpen(open)
        if (!open) {
            // Dialog was closed without completing
            if (pendingSyncAfterReauth) {
                setSyncingSession(null)
                setPendingSyncAfterReauth(false)
            }
        }
    }

    const handleDelete = async (sessionName: string) => {
        try {
            await deleteSession.mutateAsync(sessionName)
            toast.success('Session deleted')
        } catch (err) {
            toast.error('Failed to delete session', {
                description: err instanceof Error ? err.message : 'Unknown error',
            })
        }
    }

    const handleMapRole = (sessionName: string, accountId: string, accountName: string, roleName: string) => {
        setSelectedRole({ sessionName, accountId, accountName, roleName })
        setMapDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-orange-400" />
                        SSO Identity Manager
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage AWS SSO sessions and map accounts to your clusters.
                    </p>
                </div>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Session
                </Button>
            </div>

            {/* Sessions List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading sessions...</span>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center py-12 text-destructive">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>{error.message}</span>
                </div>
            ) : !sessionsData?.sessions || sessionsData.sessions.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Cloud className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground text-center">
                            No SSO sessions configured.
                            <br />
                            Add a session to start managing your AWS accounts.
                        </p>
                        <Button onClick={() => setAddDialogOpen(true)} className="mt-4 gap-2">
                            <Plus className="h-4 w-4" />
                            Add Your First Session
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {sessionsData.sessions.map((session) => (
                        <AccountTree
                            key={session.name}
                            session={session}
                            onSync={() => handleSync(session.name)}
                            onDelete={() => handleDelete(session.name)}
                            onMapRole={(accountId, accountName, roleName) =>
                                handleMapRole(session.name, accountId, accountName, roleName)
                            }
                            isSyncing={syncingSession === session.name}
                        />
                    ))}
                </div>
            )}

            {/* Add Session Dialog */}
            <AddSessionDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSuccess={() => refetch()}
            />

            {/* Map Role Dialog */}
            {selectedRole && (
                <MapRoleDialog
                    open={mapDialogOpen}
                    onOpenChange={setMapDialogOpen}
                    sessionName={selectedRole.sessionName}
                    accountId={selectedRole.accountId}
                    accountName={selectedRole.accountName}
                    roleName={selectedRole.roleName}
                />
            )}

            {/* Reauth Dialog for expired sessions */}
            <ReauthDialog
                open={reauthDialogOpen}
                onOpenChange={handleReauthDialogChange}
                session={sessionToReauth}
                onSuccess={handleReauthSuccess}
            />
        </div>
    )
}

