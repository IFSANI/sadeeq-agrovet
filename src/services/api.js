import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthAttempt = error.config?.url?.includes('/api/auth/')

    // Don't hijack a failed login/register attempt — let the page's own
    // error handling show the real message (wrong password, duplicate
    // phone, etc.) instead of yanking the browser away mid-attempt.
    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      const onCustomerSide = window.location.pathname.startsWith('/customer')
      window.location.href = onCustomerSide ? '/customer/login' : '/login'
    }
    return Promise.reject(error)
  }
)

export default api