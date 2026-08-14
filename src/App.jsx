import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/auth/Login'
import AdminLayout from './components/common/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import POS from './pages/admin/POS'
import Products from './pages/admin/Products'
import ProductDetail from './pages/admin/ProductDetail'
import Branches from './pages/admin/Branches'
import Suppliers from './pages/admin/Suppliers'
import Staff from './pages/admin/Staff'
import useAuthStore from './store/authStore'
import Stock from './pages/admin/Stock'
import SalesHistory from './pages/admin/SalesHistory'
import Customers from './pages/admin/Customers'

function ComingSoon({ title }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-300 mb-2">{title}</p>
        <p className="text-gray-400 text-sm">Coming soon</p>
      </div>
    </div>
  )
}

function AdminPage({ children, title }) {
  return (
    <AdminLayout>
      {children || <ComingSoon title={title} />}
    </AdminLayout>
  )
}

function App() {
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/customer/login" element={<ComingSoon title="Customer Login" />} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminPage><Dashboard /></AdminPage>} />
        <Route path="/admin/pos" element={<AdminPage><POS /></AdminPage>} />
        <Route path="/admin/products" element={<AdminPage><Products /></AdminPage>} />
        <Route path="/admin/products/:id" element={<AdminPage><ProductDetail /></AdminPage>} />
        <Route path="/admin/branches" element={<AdminPage><Branches /></AdminPage>} />
        <Route path="/admin/suppliers" element={<AdminPage><Suppliers /></AdminPage>} />
        <Route path="/admin/staff" element={<AdminPage><Staff /></AdminPage>} />
        
        <Route path="/admin/cart" element={<AdminPage title="Loose Cart" />} />
        
        <Route path="/admin/chicks/varieties" element={<AdminPage title="Chick Varieties" />} />
        <Route path="/admin/chicks/schedules" element={<AdminPage title="Delivery Schedules" />} />
        <Route path="/admin/chicks/bookings" element={<AdminPage title="Chick Bookings" />} />
        
        <Route path="/admin/credit" element={<AdminPage title="Credit & Debt" />} />
        <Route path="/admin/expenses" element={<AdminPage title="Expenses" />} />
        <Route path="/admin/reports" element={<AdminPage title="Reports" />} />
        <Route path="/admin/settings" element={<AdminPage title="Settings" />} />
        <Route path="/admin/stock" element={<AdminPage><Stock /></AdminPage>} />
        <Route path="/admin/sales" element={<AdminPage><SalesHistory /></AdminPage>} />
        <Route path="/admin/customers" element={<AdminPage><Customers /></AdminPage>} />

      </Routes>
    </BrowserRouter>
  )
}

export default App