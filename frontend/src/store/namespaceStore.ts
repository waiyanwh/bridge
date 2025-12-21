import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NamespaceStore {
    selectedNamespace: string
    setNamespace: (namespace: string) => void
}

export const useNamespaceStore = create<NamespaceStore>()(
    persist(
        (set) => ({
            selectedNamespace: 'default',
            setNamespace: (namespace: string) => set({ selectedNamespace: namespace }),
        }),
        {
            name: 'k8s-namespace-storage',
        }
    )
)
