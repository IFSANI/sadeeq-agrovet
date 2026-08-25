import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, AlertTriangle, Bird } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'

function ChicksProfitLoss() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const applyPreset = (preset) => {
    const today = new Date()
    const to = today.toISOString().split('T')[0]
    let from = new Date()
    if (preset === '7d') from.setDate(today.getDate() - 7)
    if (preset === '30d') from.setDate(today.getDate() - 30)
    if (preset === '1y') from.setFullYear(today.getFullYear() - 1)
    setDateFrom(from.toISOString().split('T')[0])
    setDateTo(to)
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get('/api/reports/chicks/profit-loss', { params })
      setData(res.data.data || res.data)
    } catch {
      toast.error('Failed to load chicks profit & loss report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [dateFrom, dateTo])

  return (
    <div className="space-y-4">
      <Link to="/admin/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition w-fit">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      <h1 className="text-xl font-bold text-gray-800">Chicks Profit & Loss</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-3">
        <div className="flex gap-2">
          <button onClick={() => applyPreset('7d')} className="px-3 py-2 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition">Last 7 Days</button>
          <button onClick={() => applyPreset('30d')} className="px-3 py-2 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition">Last 30 Days</button>
          <button onClick={() => applyPreset('1y')} className="px-3 py-2 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition">Last Year</button>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="px-3 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition">Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>
      {!dateFrom && !dateTo && (
        <p className="text-xs text-gray-400">No date range selected — showing all-time totals.</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-gray-400 text-center py-10">No data</p>
      ) : (
        <>
          {data.bookings_missing_cost > 0 && (
            <div className="flex items-start gap-2 bg-yellow-50 text-yellow-700 text-sm px-4 py-3 rounded-xl">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {data.bookings_missing_cost} booking{data.bookings_missing_cost > 1 ? 's' : ''} included items from a schedule with no cost recorded —
                those are counted as ₦0 cost, so the margin below is likely overstated. Add cost to those schedules for an accurate figure.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Revenue</p>
              <p className="text-2xl font-bold text-green-600">₦{Number(data.revenue || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Cost of Goods Sold</p>
              <p className="text-2xl font-bold text-red-500">₦{Number(data.cost_of_goods_sold || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Gross Profit</p>
              <p className="text-2xl font-bold text-gray-800">₦{Number(data.gross_profit || 0).toLocaleString()}</p>
            </div>
          </div>

          {data.by_variety?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">By Variety</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Variety</th>
                    <th className="px-4 py-3 font-medium text-right">Cartons Equiv.</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    <th className="px-4 py-3 font-medium text-right">COGS</th>
                    <th className="px-4 py-3 font-medium text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_variety.map((v, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-800 flex items-center gap-2">
                        <Bird size={14} className="text-amber-500" /> {v.variety_name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{v.quantity_cartons_equivalent}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">₦{Number(v.revenue || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-500">₦{Number(v.cogs || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">₦{Number(v.gross_profit || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ChicksProfitLoss