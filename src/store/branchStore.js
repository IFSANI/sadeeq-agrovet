import { create } from 'zustand'
import api from '../services/api'

const useBranchStore = create((set, get) => ({
  branches: [],
  loaded: false,

  fetchBranches: async () => {
    try {
      const res = await api.get('/api/branches')
      if (res.data.success) {
        set({ branches: res.data.data, loaded: true })
      }
    } catch {
      // Silently fail — guards below default to "not main branch" if the
      // list hasn't loaded, which is the safe direction (locks a feature
      // out rather than accidentally exposing it).
    }
  },

  // Resolves which branch a user is "operating from" and checks if it's
  // the main branch. Cashier/admin use their fixed branch_id. Super admin
  // uses their chosen defaultBranchId, falling back to whichever branch
  // is flagged is_main.
  isMainBranchUser: (user, defaultBranchId) => {
    const { branches } = get()
    if (!user || branches.length === 0) return false

    const resolvedBranchId =
      user.role === 'super_admin'
        ? defaultBranchId || branches.find((b) => b.is_main)?.id
        : user.branch_id

    const branch = branches.find((b) => b.id === resolvedBranchId)
    return !!branch?.is_main
  },
}))

export default useBranchStore