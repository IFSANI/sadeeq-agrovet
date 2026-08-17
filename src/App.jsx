import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/auth/Login'
import AdminLayout from './components/common/AdminLayout'
import CashierLayout from './components/common/CashierLayout'
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
import LooseCart from './pages/cashier/LooseCart'
import CashierDashboard from './pages/cashier/CashierDashboard'
import CreditDebt from './pages/admin/CreditDebt'
import CustomerDetail from './pages/admin/CustomerDetail'
import SupplierDebt from './pages/admin/SupplierDebt'

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

function CashierPage({ children, title }) {
  return (
    <CashierLayout>
      {children || <ComingSoon title={title} />}
    </CashierLayout>
  )
}

// Guards a route by role. `allowed` is an array of roles permitted here.
// Not logged in -> /login. Logged in but wrong role -> their own dashboard.
function ProtectedRoute({ allowed, children }) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!allowed.includes(user?.role)) {
    const fallback = user?.role === 'cashier' ? '/cashier/dashboard' : '/admin/dashboard'
    return <Navigate to={fallback} replace />
  }

  return children
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

        {/* Admin + Super Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Dashboard /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/pos" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><POS /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/products" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Products /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/products/:id" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><ProductDetail /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/branches" element={
          <ProtectedRoute allowed={['super_admin']}><AdminPage><Branches /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/suppliers" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Suppliers /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/staff" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Staff /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/chicks/varieties" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage title="Chick Varieties" /></ProtectedRoute>
        } />
        <Route path="/admin/chicks/schedules" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage title="Delivery Schedules" /></ProtectedRoute>
        } />
        <Route path="/admin/chicks/bookings" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage title="Chick Bookings" /></ProtectedRoute>
        } />
        <Route path="/admin/credit" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><CreditDebt /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/expenses" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage title="Expenses" /></ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage title="Reports" /></ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowed={['super_admin']}><AdminPage title="Settings" /></ProtectedRoute>
        } />
        <Route path="/admin/stock" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Stock /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/sales" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><SalesHistory /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/customers" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><Customers /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/customers/:id" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><CustomerDetail /></AdminPage></ProtectedRoute>
        } />
        <Route path="/admin/cart" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><LooseCart /></AdminPage></ProtectedRoute>
        } />

        {/* Cashier Routes */}
        <Route path="/cashier/dashboard" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><CashierDashboard /></CashierPage></ProtectedRoute>
        } />
        <Route path="/cashier/pos" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><POS /></CashierPage></ProtectedRoute>
        } />
        <Route path="/cashier/cart" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><LooseCart /></CashierPage></ProtectedRoute>
        } />
        <Route path="/cashier/sales" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><SalesHistory /></CashierPage></ProtectedRoute>
        } />
        <Route path="/cashier/customers" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><Customers /></CashierPage></ProtectedRoute>
        } />
        <Route path="/cashier/credit" element={
          <ProtectedRoute allowed={['cashier']}><CashierPage><CreditDebt /></CashierPage></ProtectedRoute>
        } />
        <Route path="/admin/supplier-debt" element={
          <ProtectedRoute allowed={['super_admin', 'admin']}><AdminPage><SupplierDebt /></AdminPage></ProtectedRoute>
        } />
      </Routes>

      
    </BrowserRouter>
  )
}

export default App