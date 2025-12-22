import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    Box,
    Server,
    Layers,
    Container,
    Settings,
    Database,
    Network,
    Shield,
    HardDrive,
    Clock,
    ChevronDown,
    ChevronRight,
    User,
    Key,
    Activity,
    Bell,
    PanelLeft,
    Package,
    ShipWheel,
    Workflow,
    Home,
    LayoutGrid,
    Puzzle,
    Cloud,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import { TunnelsButton, TunnelsButtonCompact } from '@/components/tunnels'
import { ContextSwitcher } from '@/components/ContextSwitcher'

interface NavItem {
    icon: React.ElementType
    label: string
    href?: string
    action?: string // Special action identifier (e.g., 'openCRDSheet')
    children?: NavItem[]
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Dashboard', href: '/' },
    {
        icon: Server,
        label: 'Workloads',
        children: [
            { icon: Box, label: 'Pods', href: '/pods' },
            { icon: Server, label: 'Deployments', href: '/deployments' },
            { icon: Database, label: 'StatefulSets', href: '/statefulsets' },
            { icon: Layers, label: 'DaemonSets', href: '/daemonsets' },
            { icon: Clock, label: 'CronJobs', href: '/cronjobs' },
            { icon: Activity, label: 'HPA', href: '/hpa' },
        ]
    },
    {
        icon: Network,
        label: 'Network',
        children: [
            { icon: Layers, label: 'Services', href: '/services' },
            { icon: Network, label: 'Ingresses', href: '/ingresses' },
            { icon: Shield, label: 'Net Policies', href: '/networkpolicies' },
        ]
    },
    {
        icon: HardDrive,
        label: 'Storage',
        children: [
            { icon: HardDrive, label: 'PVCs', href: '/pvcs' },
            { icon: Database, label: 'PVs', href: '/pvs' },
            { icon: Layers, label: 'Storage Classes', href: '/storageclasses' },
        ]
    },
    {
        icon: Container,
        label: 'Config',
        children: [
            { icon: Container, label: 'ConfigMaps', href: '/configmaps' },
            { icon: Key, label: 'Secrets', href: '/secrets' },
        ]
    },
    {
        icon: Shield,
        label: 'Access',
        children: [
            { icon: User, label: 'Service Accounts', href: '/serviceaccounts' },
            { icon: Shield, label: 'Roles', href: '/roles' },
            { icon: Shield, label: 'Role Bindings', href: '/rolebindings' },
            { icon: Shield, label: 'Cluster Roles', href: '/clusterroles' },
            { icon: Shield, label: 'Cluster Role Bindings', href: '/clusterrolebindings' },
            { icon: Shield, label: 'Bridge Access Control', href: '/team-access' },
        ]
    },
    {
        icon: Package,
        label: 'Apps',
        children: [
            { icon: Package, label: 'Helm Releases', href: '/helm' },
            { icon: Workflow, label: 'Topology Map', href: '/topology' },
        ]
    },
    { icon: HardDrive, label: 'Nodes', href: '/nodes' },
    { icon: LayoutGrid, label: 'Namespaces', href: '/namespaces' },
    { icon: Bell, label: 'Events', href: '/events' },
    { icon: Puzzle, label: 'Custom Resources', href: '/crds' },
    { icon: Cloud, label: 'Cloud Accounts', href: '/cloud-accounts' },
]

// Helper to find which section contains the current path
function findSectionForPath(path: string): string | null {
    for (const item of navItems) {
        if (item.children) {
            for (const child of item.children) {
                if (child.href && path.startsWith(child.href)) {
                    return item.label
                }
            }
        }
    }
    return null
}

// Floating submenu component for collapsed sidebar
function FloatingSubmenu({
    item,
    isOpen,
    onClose,
    buttonRef
}: {
    item: NavItem
    isOpen: boolean
    onClose: () => void
    buttonRef: React.RefObject<HTMLButtonElement>
}) {
    const [position, setPosition] = useState({ top: 0 })

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPosition({ top: rect.top })
        }
    }, [isOpen, buttonRef])

    if (!isOpen || !item.children) return null

    return (
        <>
            {/* Backdrop to close on click outside */}
            <div
                className="fixed inset-0 z-50"
                onClick={onClose}
            />
            {/* Floating menu */}
            <div
                className="fixed left-16 z-50 py-2 min-w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
                style={{ top: position.top }}
            >
                {/* Header */}
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-zinc-800 mb-1">
                    {item.label}
                </div>
                {/* Links */}
                <div className="flex flex-col">
                    {item.children.map((child) => (
                        <NavLink
                            key={child.href}
                            to={child.href!}
                            onClick={onClose}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-zinc-800 text-foreground'
                                        : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
                                )
                            }
                        >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span>{child.label}</span>
                        </NavLink>
                    ))}
                </div>
            </div>
        </>
    )
}

// Nav item with children (collapsible or floating)
function NavItemWithChildren({
    item,
    isSidebarExpanded,
    isExpanded,
    onToggle
}: {
    item: NavItem
    isSidebarExpanded: boolean
    isExpanded: boolean
    onToggle: () => void
}) {
    const [floatingOpen, setFloatingOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleClick = () => {
        if (isSidebarExpanded) {
            onToggle()
        } else {
            setFloatingOpen(true)
        }
    }

    return (
        <div>
            {/* Section header */}
            <button
                ref={buttonRef}
                onClick={handleClick}
                className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground',
                    'focus:outline-none',
                    floatingOpen && !isSidebarExpanded && 'bg-zinc-800 text-foreground'
                )}
            >
                <item.icon className="h-5 w-5 shrink-0" />
                <span
                    className={cn(
                        'flex-1 text-left text-sm font-medium whitespace-nowrap transition-opacity duration-200',
                        isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                    )}
                >
                    {item.label}
                </span>
                {isSidebarExpanded && (
                    isExpanded
                        ? <ChevronDown className="h-4 w-4 shrink-0" />
                        : <ChevronRight className="h-4 w-4 shrink-0" />
                )}
            </button>

            {/* Expanded children (sidebar expanded mode) */}
            {isExpanded && isSidebarExpanded && item.children && (
                <div className="flex flex-col gap-0.5 ml-4 mt-1">
                    {item.children.map((child) => (
                        <NavLink
                            key={child.href}
                            to={child.href!}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                                    'focus:outline-none focus:ring-2 focus:ring-ring',
                                    isActive
                                        ? 'bg-zinc-800 text-foreground'
                                        : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
                                )
                            }
                        >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm whitespace-nowrap">
                                {child.label}
                            </span>
                        </NavLink>
                    ))}
                </div>
            )}

            {/* Floating submenu (sidebar collapsed mode) */}
            <FloatingSubmenu
                item={item}
                isOpen={floatingOpen}
                onClose={() => setFloatingOpen(false)}
                buttonRef={buttonRef}
            />
        </div>
    )
}

export function Sidebar() {
    const { isSidebarExpanded, toggleSidebar, openCRDSheet } = useUIStore()
    const location = useLocation()

    // Compute which section should be expanded based on current route
    const activeSection = findSectionForPath(location.pathname)
    const [expandedSections, setExpandedSections] = useState<string[]>(
        activeSection ? [activeSection] : []
    )

    // Update expanded sections when route changes
    useEffect(() => {
        const section = findSectionForPath(location.pathname)
        if (section && !expandedSections.includes(section)) {
            setExpandedSections(prev => [...prev, section])
        }
    }, [location.pathname])

    const toggleSection = (label: string) => {
        setExpandedSections(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        )
    }

    // Handle action items (like opening CRD sheet)
    const handleAction = (action: string) => {
        if (action === 'openCRDSheet') {
            openCRDSheet()
        }
    }

    return (
        <aside
            className={cn(
                // Fixed position on left
                'fixed left-0 top-0 h-screen',
                // Solid background
                'bg-zinc-950',
                // Border
                'border-r border-zinc-800',
                // Width transition
                'transition-all duration-300 ease-in-out',
                isSidebarExpanded ? 'w-64' : 'w-16',
                // Z-index
                'z-40'
            )}
        >
            {/* Logo */}
            <div className="flex h-14 items-center border-b border-zinc-800 px-4">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                        <ShipWheel className="h-5 w-5 text-white" />
                    </div>
                    <span
                        className={cn(
                            'font-bold text-lg whitespace-nowrap transition-opacity duration-200 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent',
                            isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                        )}
                    >
                        Bridge
                    </span>
                </div>
            </div>

            {/* Context Switcher */}
            <div className="border-b border-zinc-800 py-2">
                <ContextSwitcher isExpanded={isSidebarExpanded} />
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 p-2 mt-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-250px)]">
                {navItems.map((item) => (
                    item.children ? (
                        <NavItemWithChildren
                            key={item.label}
                            item={item}
                            isSidebarExpanded={isSidebarExpanded}
                            isExpanded={expandedSections.includes(item.label)}
                            onToggle={() => toggleSection(item.label)}
                        />
                    ) : item.action ? (
                        // Action button (e.g., Custom Resources sheet opener)
                        <button
                            key={item.label}
                            onClick={() => handleAction(item.action!)}
                            className={cn(
                                'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                                'focus:outline-none focus:ring-2 focus:ring-ring',
                                'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
                            )}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span
                                className={cn(
                                    'text-sm font-medium whitespace-nowrap transition-opacity duration-200',
                                    isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                                )}
                            >
                                {item.label}
                            </span>
                        </button>
                    ) : (
                        <NavLink
                            key={item.href}
                            to={item.href!}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                                    'focus:outline-none focus:ring-2 focus:ring-ring',
                                    isActive
                                        ? 'bg-zinc-800 text-foreground'
                                        : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
                                )
                            }
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span
                                className={cn(
                                    'text-sm font-medium whitespace-nowrap transition-opacity duration-200',
                                    isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                                )}
                            >
                                {item.label}
                            </span>
                        </NavLink>
                    )
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="absolute bottom-4 left-0 right-0 px-2 space-y-1">
                {/* Tunnels button */}
                {isSidebarExpanded ? <TunnelsButton /> : <TunnelsButtonCompact />}

                {/* Toggle button */}
                <button
                    onClick={toggleSidebar}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                        'text-muted-foreground hover:bg-zinc-800 hover:text-foreground',
                        'focus:outline-none'
                    )}
                >
                    <PanelLeft
                        className={cn(
                            'h-5 w-5 shrink-0 transition-transform duration-300',
                            isSidebarExpanded ? 'rotate-180' : 'rotate-0'
                        )}
                    />
                    <span
                        className={cn(
                            'text-sm font-medium whitespace-nowrap transition-opacity duration-200',
                            isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                        )}
                    >
                        Collapse
                    </span>
                </button>

                {/* Settings */}
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        cn(
                            'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                            isActive
                                ? 'bg-zinc-800 text-foreground'
                                : 'text-muted-foreground hover:bg-zinc-800/50 hover:text-foreground'
                        )
                    }
                >
                    <Settings className="h-5 w-5 shrink-0" />
                    <span
                        className={cn(
                            'text-sm font-medium whitespace-nowrap transition-opacity duration-200',
                            isSidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none w-0'
                        )}
                    >
                        Settings
                    </span>
                </NavLink>
            </div>
        </aside >
    )
}
