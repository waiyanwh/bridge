import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
    isSidebarExpanded: boolean
    toggleSidebar: () => void
    setSidebarExpanded: (expanded: boolean) => void
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            isSidebarExpanded: false,
            toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
            setSidebarExpanded: (expanded: boolean) => set({ isSidebarExpanded: expanded }),
        }),
        {
            name: 'k8s-ui-storage',
        }
    )
)
