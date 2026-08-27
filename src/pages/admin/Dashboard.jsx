import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, AlertTriangle, Bird, Wallet, Receipt
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const methodColors = {
  cash: 'bg-green-100 text-green-700',
  transfer: 'bg-blue-100 text-blue-700',
  pos: 'bg-purple-100 text-purple-700',
  credit: 'bg-orange-100 text-orange-700',
  deposit: 'bg-teal-100 text-teal-700',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function Dashboard() {
  const { user, defaultBranchId } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('') // '' = All Branches (super admin only)
  const [loading, setLoading] = useState(true)

  const [salesToday, setSalesToday] = useState({ count: 0, total: 0 })
  const [recentSales, setRecentSales] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [pendingBookings, setPendingBookings] = useState(null) // null = feature not available here
  const [debt, setDebt] = useState({ total: 0, customerCount: 0 })

  // Branch admin/cashier are pinned to their own branch. Super admin can
  // pick a branch or leave it blank for a company-wide view.
  const branchForStock = isSuperAdmin
    ? (selectedBranch || defaultBranchId)
    : user?.branch_id

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/branches')
      if (res.data.success) setBranches(res.data.data)
    } catch {
      // silent — branch filter just won't show options
    }
  }

  const fetchLowStock = useCallback(async (branchList) => {
    try {
      if (branchForStock) {
        const res = await api.get(`/api/stock/branch/${branchForStock}`)
        if (!res.data.success) return []
        return res.data.data
          .filter((s) => s.quantity <= s.low_stock_threshold)
          .map((s) => ({ ...s, branchName: null }))
      }

      // Super admin with "All Branches" selected — combine every branch.
      if (!branchList?.length) return []
      const results = await Promise.allSettled(
        branchList.map((b) =>
          api.get(`/api/stock/branch/${b.id}`).then((res) => ({ branch: b, data: res.data.data || [] }))
        )
      )
      const combined = []
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          r.value.data
            .filter((s) => s.quantity <= s.low_stock_threshold)
            .forEach((s) => combined.push({ ...s, branchName: r.value.branch.name }))
        }
      })
      return combined
    } catch {
      return []
    }
  }, [branchForStock])

  const fetchData = async () => {
    setLoading(true)
    try {
      const today = todayStr()
      const salesParams = { from: today }
    if (isSuperAdmin) {
      if (selectedBranch) salesParams.branch = selectedBranch
    } else {
      salesParams.branch = user?.branch_id
    }

      const [salesRes, bookingsRes, customersRes, lowStockData] = await Promise.allSettled([
        api.get('/api/sales', { params: salesParams }),
        api.get('/api/chicks/bookings', { params: { status: 'pending_approval' } }),
        api.get('/api/customers'),
        fetchLowStock(branches),
      ])

      if (salesRes.status === 'fulfilled' && salesRes.value.data.success) {
        const sales = salesRes.value.data.data
        const total = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
        setSalesToday({ count: sales.length, total })
        setRecentSales(
          [...sales]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5)
        )
      }

      if (bookingsRes.status === 'fulfilled') {
        const list = bookingsRes.value.data.data || bookingsRes.value.data
        setPendingBookings(Array.isArray(list) ? list.length : 0)
      } else {
        setPendingBookings(null)
      }

      if (customersRes.status === 'fulfilled' && customersRes.value.data.success) {
        const withCredit = customersRes.value.data.data.filter((c) => c.credit_account?.current_balance > 0)
        setDebt({
          total: withCredit.reduce((sum, c) => sum + Number(c.credit_account?.current_balance || 0), 0),
          customerCount: withCredit.length,
        })
      }

      if (lowStockData.status === 'fulfilled') setLowStock(lowStockData.value)
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperAdmin) fetchBranches()
  }, [])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, branches.length])

  const stats = [
    {
      label: 'Total Sales Today',
      value: `₦${salesToday.total.toLocaleString()}`,
      change: `${salesToday.count} transaction${salesToday.count === 1 ? '' : 's'}`,
      icon: ShoppingCart,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Products Low on Stock',
      value: String(lowStock.length),
      change: lowStock.length ? 'Needs restocking' : 'All good',
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600',
    },
    ...(pendingBookings !== null
      ? [{
          label: 'Pending Chick Bookings',
          value: String(pendingBookings),
          change: 'Awaiting approval',
          icon: Bird,
          color: 'bg-yellow-50 text-yellow-600',
        }]
      : []),
    {
      label: 'Outstanding Debt',
      value: `₦${debt.total.toLocaleString()}`,
      change: `Across ${debt.customerCount} customer${debt.customerCount === 1 ? '' : 's'}`,
      icon: Wallet,
      color: 'bg-blue-50 text-blue-600',
    },
  ]

  return (
    <div className="space-y-6">

      {/* Page Title */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Here is what is happening today.
          </p>
        </div>

        {isSuperAdmin && branches.length > 0 && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${stats.length >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4`}>
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Recent Sales + Stock Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Recent Sales */}
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700">Recent Sales</h2>
                <a href="/admin/sales" className="text-xs text-green-600 font-medium hover:underline">
                  View all
                </a>
              </div>
              {recentSales.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt size={32} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No sales recorded today yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="text-left px-5 py-3">Sale ID</th>
                        <th className="text-left px-5 py-3">Cashier</th>
                        {(isSuperAdmin && !selectedBranch) && (
                          <th className="text-left px-5 py-3">Branch</th>
                        )}
                        <th className="text-left px-5 py-3">Method</th>
                        <th className="text-left px-5 py-3">Amount</th>
                        <th className="text-left px-5 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-5 py-3 font-medium text-gray-700">
                            {sale.id?.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 text-gray-600">{sale.users?.name || 'N/A'}</td>
                          {(isSuperAdmin && !selectedBranch) && (
                            <td className="px-5 py-3 text-gray-600">{sale.branches?.name || 'N/A'}</td>
                          )}
                          <td className="px-5 py-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${methodColors[sale.payment_method] || 'bg-gray-100 text-gray-600'}`}>
                              {sale.payment_method}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">
                            ₦{Number(sale.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-gray-400">
                            {new Date(sale.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Stock Alerts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700">Stock Alerts</h2>
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              {lowStock.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <p className="text-sm text-gray-400">Nothing running low right now</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
                  {lowStock.map((item, idx) => (
                    <div key={`${item.product_id || item.id}-${idx}`} className="flex items-start justify-between gap-3 p-3 bg-red-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {item.products?.name || 'Unknown Product'}
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">
                          Only {item.quantity} {item.products?.unit_of_measurement || 'units'} left
                          {item.branchName ? ` · ${item.branchName}` : ''}
                        </p>
                      </div>
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  )
}

export default Dashboard