import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout'
import { CommandPalette } from '@/components/CommandPalette'
import { Toaster } from '@/components/ui/toast'
import { SettingsProvider } from '@/context/SettingsContext'
import { GlobalQueryConfig } from '@/components/GlobalQueryConfig'
import { SettingsPage } from '@/pages/SettingsPage'
import { NamespacesPage } from '@/pages/NamespacesPage'
import { NamespaceDetailPage } from '@/pages/NamespaceDetailPage'
import {
    WorkloadsPage,
    NodesPage,
    ConfigMapsPage,
    SecretsPage,
    DeploymentsPage,
    StatefulSetsPage,
    DaemonSetsPage,
    CronJobsPage,
    ServicesPage,
    IngressesPage,
    NetworkPoliciesPage,
    PVCsPage,
    PVsPage,
    StorageClassesPage,
    ServiceAccountsPage,
    RolesPage,
    RoleBindingsPage,
    ClusterRolesPage,
    ClusterRoleBindingsPage,
    HPAPage,
    EventsPage,
    HelmPage,
    TeamAccessPage,
    TopologyPage,
    Home,
    CRDListPage,
    CRDExplorerPage
} from '@/pages'

// Create a query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30000,
            // refetchInterval will be controlled by GlobalQueryConfig
        },
    },
})

function AppRoutes() {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

    return (
        <>
            <Layout>
                <Routes>
                    {/* Home dashboard */}
                    <Route path="/" element={<Home />} />

                    {/* Workload routes */}
                    <Route path="/pods" element={<WorkloadsPage />} />
                    <Route path="/deployments" element={<DeploymentsPage />} />
                    <Route path="/statefulsets" element={<StatefulSetsPage />} />
                    <Route path="/daemonsets" element={<DaemonSetsPage />} />
                    <Route path="/cronjobs" element={<CronJobsPage />} />
                    <Route path="/hpa" element={<HPAPage />} />

                    {/* Network routes */}
                    <Route path="/services" element={<ServicesPage />} />
                    <Route path="/ingresses" element={<IngressesPage />} />
                    <Route path="/networkpolicies" element={<NetworkPoliciesPage />} />

                    {/* Storage routes */}
                    <Route path="/pvcs" element={<PVCsPage />} />
                    <Route path="/pvs" element={<PVsPage />} />
                    <Route path="/storageclasses" element={<StorageClassesPage />} />

                    {/* Config routes */}
                    <Route path="/configmaps" element={<ConfigMapsPage />} />
                    <Route path="/secrets" element={<SecretsPage />} />

                    {/* Access/RBAC routes */}
                    <Route path="/serviceaccounts" element={<ServiceAccountsPage />} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/rolebindings" element={<RoleBindingsPage />} />
                    <Route path="/clusterroles" element={<ClusterRolesPage />} />
                    <Route path="/clusterrolebindings" element={<ClusterRoleBindingsPage />} />
                    <Route path="/team-access" element={<TeamAccessPage />} />

                    {/* Apps routes */}
                    <Route path="/helm" element={<HelmPage />} />
                    <Route path="/topology" element={<TopologyPage />} />

                    {/* Cluster routes */}
                    <Route path="/nodes" element={<NodesPage />} />
                    <Route path="/namespaces" element={<NamespacesPage />} />
                    <Route path="/namespaces/:namespace" element={<NamespaceDetailPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* CRD routes */}
                    <Route path="/crds" element={<CRDExplorerPage />} />
                    <Route path="/crds/:group/:version/:resource" element={<CRDListPage />} />

                    {/* Catch-all redirect to pods */}
                    <Route path="*" element={<Navigate to="/pods" replace />} />
                </Routes>
            </Layout>

            {/* Global Command Palette */}
            <CommandPalette
                open={commandPaletteOpen}
                onOpenChange={setCommandPaletteOpen}
            />
        </>
    )
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <SettingsProvider>
                <GlobalQueryConfig />
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
                <Toaster position="bottom-right" />
            </SettingsProvider>
        </QueryClientProvider>
    )
}

export default App
