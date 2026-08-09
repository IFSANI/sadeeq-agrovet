import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  defaultBranchId: localStorage.getItem('defaultBranchId') || null,

  login: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('defaultBranchId')
    set({ user: null, token: null, isAuthenticated: false, defaultBranchId: null })
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user'))
    const defaultBranchId = localStorage.getItem('defaultBranchId')
    if (token && user) {
      set({ user, token, isAuthenticated: true, defaultBranchId })
    }
  },

  setDefaultBranch: (branchId) => {
    localStorage.setItem('defaultBranchId', branchId)
    set({ defaultBranchId: branchId })
  },
}))

export default useAuthStore