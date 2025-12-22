import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
    isSidebarExpanded: boolean
    toggleSidebar: () => void
    setSidebarExpanded: (expanded: boolean) => void

    // CRD Navigator Sheet
    isCRDSheetOpen: boolean
    openCRDSheet: () => void
    closeCRDSheet: () => void
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            isSidebarExpanded: false,
            toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
            setSidebarExpanded: (expanded: boolean) => set({ isSidebarExpanded: expanded }),

            // CRD Navigator Sheet
            isCRDSheetOpen: false,
            openCRDSheet: () => set({ isCRDSheetOpen: true }),
            closeCRDSheet: () => set({ isCRDSheetOpen: false }),
        }),
        {
            name: 'k8s-ui-storage',
            partialize: (state) => ({ isSidebarExpanded: state.isSidebarExpanded }),
        }
    )
)

