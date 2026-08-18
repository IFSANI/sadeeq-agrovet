import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import useAuthStore from '../../../store/authStore'

function ProfitLossReport() {
  const [data, setData] = useState(null)
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/branches')
      if (res.data.success) setBranches(res.data.data)
    } catch { /* silent */ }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (isSuperAdmin && selectedBranch) params.branch_id = selectedBranch

      const res = await api.get('/api/reports/profit-loss', { params })
      if (res.data.success) setData(res.data.data)
    } catch {
      toast.error('Failed to load profit & loss report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isSuperAdmin) fetchBranches() }, [])
  useEffect(() => { fetchReport() }, [dateFrom, dateTo, selectedBranch])

  const netPositive = Number(data?.net_profit || 0) >= 0

  return (
    <div className="space-y-4">
      <Link to="/admin/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition w-fit">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <h1 className="text-xl font-bold text-gray-800">Profit & Loss</h1>
      <p className="text-xs text-gray-400 -mt-3">
        Cost of goods sold is estimated using today's average product cost — figures for past periods may not be exact if buying prices have changed
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-3">
        {isSuperAdmin && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-gray-400 text-center py-10">No data</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Revenue</span>
              <span className="font-semibold text-gray-800">₦{Number(data.revenue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cost of Goods Sold</span>
              <span className="font-semibold text-red-500">− ₦{Number(data.cost_of_goods_sold || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-700 font-medium">Gross Profit</span>
              <span className="font-bold text-gray-800">₦{Number(data.gross_profit || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Expenses</span>
              <span className="font-semibold text-red-500">− ₦{Number(data.total_expenses || 0).toLocaleString()}</span>
            </div>
            <div className={`flex justify-between text-lg border-t-2 pt-3 mt-2 ${netPositive ? 'border-green-200' : 'border-red-200'}`}>
              <span className="font-bold text-gray-800">Net Profit</span>
              <span className={`font-bold ${netPositive ? 'text-green-600' : 'text-red-500'}`}>
                ₦{Number(data.net_profit || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfitLossReport