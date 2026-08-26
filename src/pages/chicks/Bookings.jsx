import { useState, useEffect } from 'react'
import { Plus, Search, Bird, X, UserPlus, User, Eye, Check, XCircle, Package, QrCode, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'collected', label: 'Collected' },
  { id: 'cancelled', label: 'Cancelled' },
]

const statusColor = (status) => {
  if (status === 'confirmed') return 'bg-blue-50 text-blue-600'
  if (status === 'collected') return 'bg-green-50 text-green-600'
  if (status === 'cancelled') return 'bg-red-50 text-red-500'
  return 'bg-yellow-50 text-yellow-600' // pending_approval
}

function Bookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [showLookup, setShowLookup] = useState(false)
  const [viewingBookingId, setViewingBookingId] = useState(null)
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'super_admin'
  const canCollect = ['admin', 'super_admin', 'cashier'].includes(user?.role)

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/api/chicks/bookings', { params })
      setBookings(res.data.data || res.data)
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [statusFilter])

  const quickApprove = async (id) => {
    try {
      await api.put(`/api/chicks/bookings/${id}/approve`)
      toast.success('Booking approved')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve')
    }
  }

  const quickReject = async (id) => {
    if (!confirm('Reject this booking?')) return
    try {
      await api.put(`/api/chicks/bookings/${id}/reject`)
      toast.success('Booking rejected')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject')
    }
  }

  const quickCollect = async (id) => {
    if (!confirm('Mark this booking as collected?')) return
    try {
      await api.put(`/api/chicks/bookings/${id}/collect`)
      toast.success('Booking marked as collected')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark as collected')
    }
  }

  const itemsSummary = (booking) => {
    if (!booking.items?.length) return '—'
    return booking.items.map((i) => {
      const parts = []
      if (i.cartons > 0) parts.push(`${i.cartons} carton${i.cartons > 1 ? 's' : ''}`)
      if (i.pieces > 0) parts.push(`${i.pieces} pc`)
      const date = i.chick_delivery_schedules?.delivery_date
        ? ` — ${new Date(i.chick_delivery_schedules.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'short' })}`
        : ''
      return `${i.chick_varieties?.name || 'Variety'} (${parts.join(', ')})${date}`
    }).join('; ')
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Chick Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bookings.length} bookings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLookup(true)}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <QrCode size={16} />
            Lookup / Scan
          </button>
          <button
            onClick={() => setShowNewBooking(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <Plus size={16} />
            New Booking
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              statusFilter === tab.id
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <Bird size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No bookings found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">{b.booking_code}</td>
                  <td className="px-4 py-3 text-gray-700">{b.customers?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{itemsSummary(b)}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-gray-600">{b.payment_method}</span>
                    <span className={`ml-1 text-xs ${b.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                      ({b.payment_status})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${statusColor(b.booking_status)}`}>
                      {b.booking_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {canManage && b.booking_status === 'pending_approval' && (
                        <>
                          <button onClick={() => quickApprove(b.id)} title="Approve" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition">
                            <Check size={15} />
                          </button>
                          <button onClick={() => quickReject(b.id)} title="Reject" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                      {canCollect && b.booking_status === 'confirmed' && (
                        <button onClick={() => quickCollect(b.id)} title="Mark Collected" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Package size={15} />
                        </button>
                      )}
                      <button onClick={() => setViewingBookingId(b.id)} title="View" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition">
                        <Eye size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewBooking && (
        <NewBookingModal
          onClose={() => setShowNewBooking(false)}
          onCreated={() => {
            setShowNewBooking(false)
            fetchBookings()
          }}
        />
      )}

      {showLookup && (
        <LookupModal
          onClose={() => setShowLookup(false)}
          onFound={(id) => { setShowLookup(false); setViewingBookingId(id) }}
        />
      )}

      {viewingBookingId && (
        <BookingDetailModal
          bookingId={viewingBookingId}
          onClose={() => setViewingBookingId(null)}
          onChanged={fetchBookings}
        />
      )}

    </div>
  )
}

// ---------- New Booking ----------

function NewBookingModal({ onClose, onCreated }) {
  const [step, setStep] = useState('customer') // 'customer' | 'details'
  const [customer, setCustomer] = useState(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const [schedules, setSchedules] = useState([])
  const [varieties, setVarieties] = useState([])
  const [items, setItems] = useState([{ schedule_id: '', cartons: '', pieces: '' }])
  const [method, setMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (customerQuery.length < 2) { setCustomerResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get('/api/customers/search', { params: { q: customerQuery } })
        setCustomerResults(res.data.data || res.data)
      } catch { /* silent */ } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerQuery])

  useEffect(() => {
    if (step !== 'details') return
    api.get('/api/chicks/schedules').then((res) => setSchedules(res.data.data || res.data)).catch(() => {})
    api.get('/api/chicks/varieties').then((res) => setVarieties(res.data.data || res.data)).catch(() => {})
  }, [step])

  const varietyFor = (scheduleId) => {
    const s = schedules.find((sc) => sc.id === scheduleId)
    return varieties.find((v) => v.id === s?.variety_id)
  }

  const lineTotal = (item) => {
    const v = varietyFor(item.schedule_id)
    if (!v) return 0
    return (Number(item.cartons) || 0) * Number(v.price_per_carton) + (Number(item.pieces) || 0) * Number(v.price_per_piece)
  }

  const total = items.reduce((sum, i) => sum + lineTotal(i), 0)
  const depositBalance = Number(customer?.deposit_account?.current_balance || 0)

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    if (!newName || !newPhone) { toast.error('Name and phone are required'); return }
    try {
      const res = await api.post('/api/customers', { name: newName, phone: newPhone })
      setCustomer(res.data.data)
      setStep('details')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add customer')
    }
  }

  const addItem = () => setItems([...items, { schedule_id: '', cartons: '', pieces: '' }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, value) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (items.some((i) => !i.schedule_id || (!Number(i.cartons) && !Number(i.pieces)))) {
      toast.error('Pick a schedule and at least a carton or piece count for each item')
      return
    }
    if (method === 'deposit' && depositBalance < total) {
      toast.error(`Insufficient deposit balance. Customer has ₦${depositBalance.toLocaleString()}, total is ₦${total.toLocaleString()}.`)
      return
    }
    setSaving(true)
    try {
      const payload = {
        customer_id: customer.id,
        payment_method: method,
        items: items.map((i) => ({
          schedule_id: i.schedule_id,
          variety_id: varietyFor(i.schedule_id)?.id,
          cartons: Number(i.cartons) || 0,
          pieces: Number(i.pieces) || 0,
        })),
      }
      if (method === 'deposit') payload.deposit_amount_used = total

      const res = await api.post('/api/chicks/bookings', payload)
      const code = res.data.data?.booking_code || res.data.booking_code
      toast.success(code ? `Booking created — ${code}` : 'Booking created!')
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">New Chick Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {step === 'customer' && (
          <div>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search customer name or phone"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />}
            </div>

            {customerResults.length > 0 && (
              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm mb-2">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomer(c); setStep('details') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                  >
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </button>
                ))}
              </div>
            )}

            {customerQuery.length >= 2 && !searching && customerResults.length === 0 && !showQuickAdd && (
              <button
                onClick={() => { setShowQuickAdd(true); setNewPhone(customerQuery.match(/^\d+$/) ? customerQuery : ''); setNewName(customerQuery.match(/^\d+$/) ? '' : customerQuery) }}
                className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium mt-1"
              >
                <UserPlus size={13} /> No match — quick-add customer
              </button>
            )}

            {showQuickAdd && (
              <form onSubmit={handleQuickAdd} className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <button type="submit" className="w-full py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
                  Add & Continue
                </button>
              </form>
            )}
          </div>
        )}

        {step === 'details' && customer && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.phone}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setCustomer(null); setStep('customer') }} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Items *</label>
              <div className="space-y-3">
                {items.map((item, i) => {
                  const schedule = schedules.find((s) => s.id === item.schedule_id)
                  return (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <select
                          value={item.schedule_id}
                          onChange={(e) => updateItem(i, 'schedule_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          <option value="">Select delivery schedule</option>
                          {schedules.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.chick_varieties?.name} — {new Date(s.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                            </option>
                          ))}
                        </select>
                        {schedule && (
                          <p className="text-xs text-gray-400">Max {schedule.max_cartons_per_order} cartons per order</p>
                        )}
                        <div className="flex gap-2">
                          <input type="number" placeholder="Cartons" value={item.cartons}
                            onChange={(e) => updateItem(i, 'cartons', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                          <input type="number" placeholder="Loose pieces" value={item.pieces}
                            onChange={(e) => updateItem(i, 'pieces', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                        </div>
                        {item.schedule_id && (
                          <p className="text-xs text-gray-500 text-right">₦{lineTotal(item).toLocaleString()}</p>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition mt-1">✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
              <button type="button" onClick={addItem} className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                <Plus size={14} /> Add another item
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Estimated Total</span>
              <span className="text-lg font-bold text-green-600">₦{total.toLocaleString()}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'transfer', 'pos', 'credit', 'deposit'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 rounded-xl border-2 text-xs font-semibold capitalize transition ${
                      method === m ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {method === 'deposit' && (
              <div className={`rounded-xl p-3 text-sm ${depositBalance >= total ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                <div className="flex justify-between">
                  <span>Deposit balance</span>
                  <span className="font-bold">₦{depositBalance.toLocaleString()}</span>
                </div>
                {depositBalance < total && (
                  <p className="text-xs mt-1">Insufficient — deposit must cover the full total for this booking.</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (method === 'deposit' && depositBalance < total)}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create Booking'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------- Lookup by code / QR ----------

function LookupModal({ onClose, onFound }) {
  const [mode, setMode] = useState('scan') // 'scan' | 'type'
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => {
    if (mode !== 'scan') return
    const scanner = new Html5Qrcode('qr-reader')
    let handled = false
    let stopped = false

    const stopScanner = async () => {
      if (stopped) return
      stopped = true
      try { await scanner.stop() } catch { /* wasn't running */ }
      try { await scanner.clear() } catch { /* already cleared */ }
    }

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 240 },
      async (decodedText) => {
        if (handled) return
        handled = true
        await stopScanner()
        resolveBooking(decodedText, true)
      },
      () => { /* per-frame scan miss — ignore, keep scanning */ }
    ).catch(() => {
      setCameraError(true)
    })

    return () => { stopScanner() }
  }, [mode])

  const resolveBooking = async (value, viaScan) => {
    setSearching(true)
    try {
      const res = viaScan
        ? await api.post('/api/chicks/bookings/scan-qr', { qr_code: value })
        : await api.get(`/api/chicks/bookings/code/${value}`)
      const booking = res.data.data || res.data
      onFound(booking.id)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking not found')
    } finally {
      setSearching(false)
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!code.trim()) return
    resolveBooking(code.trim(), false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Lookup Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('scan'); setCameraError(false) }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'scan' ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-600'}`}
          >
            Scan QR
          </button>
          <button
            onClick={() => setMode('type')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'type' ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-600'}`}
          >
            Enter Code
          </button>
        </div>

        {mode === 'scan' ? (
          cameraError ? (
            <div className="text-center py-6">
              <p className="text-sm text-red-500 mb-2">Couldn't access a camera on this device.</p>
              <button onClick={() => setMode('type')} className="text-xs font-semibold text-green-600 hover:text-green-700">
                Enter the code manually instead
              </button>
            </div>
          ) : (
            <div>
              <div id="qr-reader" className="rounded-xl overflow-hidden min-h-[250px]" />
              {searching && (
                <p className="text-xs text-green-600 mt-2 text-center">Found it — loading booking...</p>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center">Point the camera at the booking's QR code</p>
            </div>
          )
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CHK-AB12CD34"
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <p className="text-xs text-gray-400">
              Type the code from a printed receipt.
            </p>
            <button type="submit" disabled={searching} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
              {searching ? 'Looking up...' : 'Find Booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------- Booking Detail ----------

function BookingDetailModal({ bookingId, onClose, onChanged }) {
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'super_admin'
  const canCollect = ['admin', 'super_admin', 'cashier'].includes(user?.role)

  const fetchBooking = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/chicks/bookings/${bookingId}`)
      setBooking(res.data.data || res.data)
    } catch {
      toast.error('Failed to load booking')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBooking() }, [bookingId])

  const runAction = async (action) => {
    setActing(true)
    try {
      await api.put(`/api/chicks/bookings/${bookingId}/${action}`)
      toast.success('Updated!')
      fetchBooking()
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const handlePrint = async () => {
    try {
      const res = await api.get(`/api/chicks/bookings/${bookingId}/receipt`)
      const r = res.data.data || res.data
      const qrDataUrl = await QRCodeLib.toDataURL(r.booking_code, { width: 160, margin: 1 })
      const win = window.open('', '_blank')
      win.document.write(`
        <html><head><title>Booking Receipt ${r.booking_code}</title>
        <style>body{font-family:monospace;padding:20px;max-width:320px} h2{text-align:center} .line{display:flex;justify-content:space-between;margin:4px 0} hr{border:none;border-top:1px dashed #999} .qr{text-align:center;margin:16px 0}</style>
        </head><body>
        <h2>Sadeeq Agrovet</h2>
        <p style="text-align:center">Chick Booking Receipt</p>
        <hr/>
        <div class="line"><span>Code</span><strong>${r.booking_code}</strong></div>
        <div class="line"><span>Customer</span><span>${r.customers?.name || ''}</span></div>
        <div class="line"><span>Status</span><span>${r.booking_status}</span></div>
        <div class="line"><span>Payment</span><span>${r.payment_method} (${r.payment_status})</span></div>
        <hr/>
        ${(r.items || []).map((i) => `<div class="line"><span>${i.chick_varieties?.name || 'Variety'}</span><span>${i.cartons || 0} ctn / ${i.pieces || 0} pc</span></div>`).join('')}
        <hr/>
        <div class="line"><strong>Total</strong><strong>₦${Number(r.total_amount || 0).toLocaleString()}</strong></div>
        <div class="qr"><img src="${qrDataUrl}" width="160" height="160" /></div>
        <p style="text-align:center;font-size:10px">Scan at collection</p>
        ${r.users?.name ? `<p style="margin-top:10px;font-size:11px">Approved by: ${r.users.name}</p>` : ''}
        </body></html>
      `)
      win.document.close()
      win.print()
    } catch {
      toast.error('Failed to load receipt')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Booking Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {loading || !booking ? (
          <div className="flex items-center justify-center py-10">
            <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Code</span><span className="font-mono font-medium text-gray-800">{booking.booking_code}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium text-gray-800">{booking.customers?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment</span><span className="capitalize font-medium text-gray-800">{booking.payment_method} ({booking.payment_status})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${statusColor(booking.booking_status)}`}>{booking.booking_status?.replace('_', ' ')}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Items</p>
              <div className="space-y-1.5">
                {(booking.items || []).map((i, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-600">{i.chick_varieties?.name}</span>
                      {i.chick_delivery_schedules?.delivery_date && (
                        <span className="text-xs text-gray-400 block">
                          Delivery: {new Date(i.chick_delivery_schedules.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-800">{i.cartons || 0} carton(s), {i.pieces || 0} pc</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {canManage && booking.booking_status === 'pending_approval' && (
                <>
                  <button onClick={() => runAction('approve')} disabled={acting} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
                    Approve
                  </button>
                  <button onClick={() => runAction('reject')} disabled={acting} className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                    Reject
                  </button>
                </>
              )}
              {canManage && booking.payment_method === 'transfer' && booking.payment_status !== 'paid' && (
                <button onClick={() => runAction('confirm-transfer')} disabled={acting} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
                  Confirm Transfer
                </button>
              )}
              {canCollect && booking.booking_status === 'confirmed' && (
                <button onClick={() => runAction('collect')} disabled={acting} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
                  Mark Collected
                </button>
              )}
              {['pending_approval', 'confirmed'].includes(booking.booking_status) && (
                <button onClick={() => runAction('cancel')} disabled={acting} className="flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                  Cancel Booking
                </button>
              )}
              <button onClick={handlePrint} className="flex items-center justify-center gap-1.5 flex-1 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-semibold transition">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Bookings