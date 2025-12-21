import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

interface LayoutProps {
    children: ReactNode
}

export function Layout({ children }: LayoutProps) {
    const { isSidebarExpanded } = useUIStore()

    return (
        <div className="min-h-screen bg-background">
            {/* Fixed sidebar */}
            <Sidebar />

            {/* Main content area with dynamic left margin */}
            <div
                className={cn(
                    'transition-all duration-300 ease-in-out',
                    isSidebarExpanded ? 'ml-64' : 'ml-16'
                )}
            >
                <Header />
                <main className="p-6">{children}</main>
            </div>
        </div>
    )
}
