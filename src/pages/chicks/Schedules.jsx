import { useState, useEffect } from 'react'
import { Plus, Edit2, Calendar, Bird, Search, Truck, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [varieties, setVarieties] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [payingSchedule, setPayingSchedule] = useState(null)
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'super_admin'

  const fetchVarieties = async () => {
    try {
      const res = await api.get('/api/chicks/varieties')
      setVarieties(res.data.data || res.data)
    } catch {
      // silent — the dropdown just won't populate
    }
  }

  const fetchSuppliers = async () => {
    if (!canManage) return
    try {
      const res = await api.get('/api/suppliers')
      if (res.data.success) setSuppliers(res.data.data)
    } catch {
      // silent
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
      const res = await api.get('/api/chicks/schedules', { params })
      setSchedules(res.data.data || res.data)
    } catch {
      toast.error('Failed to load delivery schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVarieties(); fetchSuppliers() }, [])
  useEffect(() => { fetchSchedules() }, [dateFrom, dateTo])

  const checkAvailability = async (schedule) => {
    setCheckingAvailability(schedule.id)
    setAvailability(null)
    try {
      const res = await api.get(`/api/chicks/schedules/${schedule.id}/availability`)
      setAvailability(res.data.data || res.data)
    } catch {
      toast.error('Failed to check availability')
      setCheckingAvailability(null)
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Delivery Schedules</h1>
          <p className="text-sm text-gray-500 mt-0.5">{schedules.length} scheduled deliveries</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <Plus size={16} />
            Add Schedule
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-2">
        <Calendar size={16} className="text-gray-400" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <Bird size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No delivery schedules found</p>
          {canManage && <p className="text-gray-300 text-sm mt-1">Click "Add Schedule" to get started</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Variety</th>
                <th className="px-4 py-3 font-medium">Delivery Date</th>
                <th className="px-4 py-3 font-medium text-right">Total Cartons</th>
                <th className="px-4 py-3 font-medium text-right">Max per Order</th>
                {canManage && <th className="px-4 py-3 font-medium">Supplier / Cost</th>}
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.chick_varieties?.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(s.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.total_cartons_available}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.max_cartons_per_order}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {s.cost_per_carton ? (
                        <div className="text-xs">
                          <p className="text-gray-600 flex items-center gap-1">
                            <Truck size={11} /> {s.supplier_name || 'No supplier'} · ₦{Number(s.cost_per_carton).toLocaleString()}/ctn
                          </p>
                          {Number(s.balance_owed) > 0 ? (
                            <p className="text-red-500 font-medium mt-0.5">
                              ₦{Number(s.balance_owed).toLocaleString()} owed
                            </p>
                          ) : (
                            <p className="text-green-600 font-medium mt-0.5">Fully paid</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">No cost recorded</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => checkAvailability(s)}
                        className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700"
                      >
                        <Search size={13} /> Availability
                      </button>
                      {canManage && Number(s.balance_owed) > 0 && (
                        <button
                          onClick={() => setPayingSchedule(s)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <Wallet size={13} /> Pay
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => { setEditing(s); setShowModal(true) }}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ScheduleModal
          schedule={editing}
          varieties={varieties}
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchSchedules()
          }}
        />
      )}

      {checkingAvailability && (
        <AvailabilityModal
          availability={availability}
          onClose={() => { setCheckingAvailability(null); setAvailability(null) }}
        />
      )}

      {payingSchedule && (
        <PayBalanceModal
          schedule={payingSchedule}
          onClose={() => setPayingSchedule(null)}
          onPaid={() => {
            setPayingSchedule(null)
            fetchSchedules()
          }}
        />
      )}

    </div>
  )
}

function AvailabilityModal({ availability, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Availability</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {!availability ? (
          <div className="flex items-center justify-center py-8">
            <span className="w-6 h-6 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Cartons</span>
              <span className="font-medium text-gray-800">{availability.total_cartons_available}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cartons Booked</span>
              <span className="font-medium text-gray-800">{availability.cartons_booked}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-500">Cartons Remaining</span>
              <span className="font-bold text-green-600">{availability.cartons_remaining}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max per Order</span>
              <span className="font-medium text-gray-800">{availability.max_cartons_per_order}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ScheduleModal({ schedule, varieties, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({
    variety_id: schedule?.variety_id || '',
    delivery_date: schedule?.delivery_date?.slice(0, 10) || '',
    total_cartons_available: schedule?.total_cartons_available || '',
    max_cartons_per_order: schedule?.max_cartons_per_order || '',
  })
  const [trackCost, setTrackCost] = useState(false)
  const [costForm, setCostForm] = useState({
    supplier_id: '',
    cost_per_carton: '',
    amount_paid_now: '',
    payment_method_now: 'cash',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleCostChange = (e) => {
    setCostForm({ ...costForm, [e.target.name]: e.target.value })
  }

  const estimatedTotalCost = trackCost && costForm.cost_per_carton && form.total_cartons_available
    ? Number(costForm.cost_per_carton) * Number(form.total_cartons_available)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.delivery_date || !form.total_cartons_available || !form.max_cartons_per_order) {
      toast.error('Please fill all required fields')
      return
    }
    if (!schedule && !form.variety_id) {
      toast.error('Please select a variety')
      return
    }
    if (trackCost && !costForm.cost_per_carton) {
      toast.error('Enter a cost per carton, or turn off cost tracking')
      return
    }
    setSaving(true)
    try {
      if (schedule) {
        // variety_id and cost fields aren't editable after creation per the API.
        const payload = {
          delivery_date: form.delivery_date,
          total_cartons_available: Number(form.total_cartons_available),
          max_cartons_per_order: Number(form.max_cartons_per_order),
        }
        await api.put(`/api/chicks/schedules/${schedule.id}`, payload)
        toast.success('Schedule updated!')
      } else {
        const payload = {
          variety_id: form.variety_id,
          delivery_date: form.delivery_date,
          total_cartons_available: Number(form.total_cartons_available),
          max_cartons_per_order: Number(form.max_cartons_per_order),
        }
        if (trackCost) {
          if (costForm.supplier_id) payload.supplier_id = costForm.supplier_id
          payload.cost_per_carton = Number(costForm.cost_per_carton)
          if (costForm.amount_paid_now) {
            payload.amount_paid_now = Number(costForm.amount_paid_now)
            payload.payment_method_now = costForm.payment_method_now
          }
        }
        await api.post('/api/chicks/schedules', payload)
        toast.success('Schedule added!')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {schedule ? 'Edit Schedule' : 'Add New Schedule'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Variety *</label>
            {schedule ? (
              <input
                value={varieties.find((v) => v.id === schedule.variety_id)?.name || schedule.chick_varieties?.name || ''}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500"
              />
            ) : (
              <select
                name="variety_id"
                value={form.variety_id}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="">Select variety</option>
                {varieties.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}
            {schedule && (
              <p className="text-xs text-gray-400 mt-1">Variety can't be changed once a schedule exists.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Delivery Date *</label>
            <input
              name="delivery_date"
              type="date"
              value={form.delivery_date}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Total Cartons Available *</label>
            <input
              name="total_cartons_available"
              type="number"
              value={form.total_cartons_available}
              onChange={handleChange}
              placeholder="e.g. 500"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Max Cartons per Order *</label>
            <input
              name="max_cartons_per_order"
              type="number"
              value={form.max_cartons_per_order}
              onChange={handleChange}
              placeholder="e.g. 10"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {!schedule && (
            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackCost}
                  onChange={(e) => setTrackCost(e.target.checked)}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="text-sm font-medium text-gray-700">Record supplier & cost for this delivery</span>
              </label>

              {trackCost && (
                <div className="space-y-3 bg-gray-50 rounded-xl p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
                    <select
                      name="supplier_id"
                      value={costForm.supplier_id}
                      onChange={handleCostChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="">Select supplier (optional)</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cost per Carton (₦) *</label>
                    <input
                      name="cost_per_carton"
                      type="number"
                      value={costForm.cost_per_carton}
                      onChange={handleCostChange}
                      placeholder="e.g. 12000"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>

                  {estimatedTotalCost > 0 && (
                    <p className="text-xs text-gray-500">
                      Estimated total cost: <span className="font-semibold text-gray-700">₦{estimatedTotalCost.toLocaleString()}</span>
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paying Supplier Now (₦)</label>
                    <input
                      name="amount_paid_now"
                      type="number"
                      value={costForm.amount_paid_now}
                      onChange={handleCostChange}
                      placeholder="Leave blank if paying nothing now"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">Whatever's left stays owed to the supplier</p>
                  </div>

                  {costForm.amount_paid_now && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Paying Via</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['cash', 'transfer', 'pos'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCostForm({ ...costForm, payment_method_now: m })}
                            className={`py-2 rounded-xl border-2 text-xs font-semibold capitalize transition ${
                              costForm.payment_method_now === m
                                ? 'bg-green-50 border-green-400 text-green-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? 'Saving...' : schedule ? 'Update Schedule' : 'Add Schedule'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

function PayBalanceModal({ schedule, onClose, onPaid }) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const balance = Number(schedule.balance_owed || 0)
  const methods = ['cash', 'transfer', 'pos']

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const payload = { amount: Number(amount), payment_method: paymentMethod }
      if (reference) payload.reference = reference

      await api.post(`/api/stock/restock/${schedule.stock_receipt_id}/pay`, payload)
      toast.success('Payment recorded!')
      onPaid()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Pay Supplier Balance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="bg-orange-50 rounded-xl p-4 mb-5">
          <p className="text-sm font-medium text-gray-800">{schedule.chick_varieties?.name} — {new Date(schedule.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</p>
          <p className="text-xs text-gray-500">{schedule.supplier_name || 'No supplier'}</p>
          <p className="text-sm text-orange-700 mt-2">
            Balance owed: <span className="font-bold">₦{balance.toLocaleString()}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Amount Paying (₦) *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${balance.toLocaleString()}`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-xl border-2 text-xs font-semibold capitalize transition ${
                    paymentMethod === m
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Reference (optional)</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. transaction ID, note"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Schedules