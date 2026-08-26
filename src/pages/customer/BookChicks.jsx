import { useState, useEffect } from 'react'
import { Bird, Plus, X, Calendar, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'
import api from '../../services/api'

function BookChicks() {
  const [schedules, setSchedules] = useState([])
  const [varieties, setVarieties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [scheduleRes, varietyRes] = await Promise.all([
        api.get('/api/chicks/schedules'),
        api.get('/api/chicks/varieties'),
      ])
      setSchedules(scheduleRes.data.data || scheduleRes.data)
      setVarieties(varietyRes.data.data || varietyRes.data)
    } catch {
      toast.error('Failed to load available chicks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const varietyFor = (schedule) => varieties.find((v) => v.id === schedule.variety_id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Book Chicks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Reserve chicks from upcoming deliveries</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <Bird size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No upcoming deliveries right now</p>
          <p className="text-gray-300 text-sm mt-1">Check back soon</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((s) => {
            const variety = varietyFor(s)
            return (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Bird size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{s.chick_varieties?.name || variety?.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(s.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                      </p>
                    </div>
                  </div>
                </div>

                {variety && (
                  <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Per Carton</span>
                      <span className="font-medium text-gray-700">₦{Number(variety.price_per_carton).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Per Piece</span>
                      <span className="font-medium text-gray-700">₦{Number(variety.price_per_piece).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max per Order</span>
                      <span className="font-medium text-gray-700">{s.max_cartons_per_order} cartons</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setSelectedSchedule(s); setShowBookingModal(true) }}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                >
                  <Plus size={16} />
                  Book This Delivery
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showBookingModal && selectedSchedule && (
        <BookingModal
          schedule={selectedSchedule}
          variety={varietyFor(selectedSchedule)}
          onClose={() => { setShowBookingModal(false); setSelectedSchedule(null) }}
        />
      )}
    </div>
  )
}

function BookingModal({ schedule, variety, onClose }) {
  const [cartons, setCartons] = useState('')
  const [pieces, setPieces] = useState('')
  const [method, setMethod] = useState('transfer')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  const total = variety
    ? (Number(cartons) || 0) * Number(variety.price_per_carton) + (Number(pieces) || 0) * Number(variety.price_per_piece)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!Number(cartons) && !Number(pieces)) {
      toast.error('Enter at least a carton or piece count')
      return
    }
    if (schedule.max_cartons_per_order && Number(cartons) > schedule.max_cartons_per_order) {
      toast.error(`Max ${schedule.max_cartons_per_order} cartons per order`)
      return
    }
    setSaving(true)
    try {
      const payload = {
        payment_method: method,
        items: [{
          schedule_id: schedule.id,
          variety_id: schedule.variety_id,
          cartons: Number(cartons) || 0,
          pieces: Number(pieces) || 0,
        }],
      }
      if (method === 'deposit') payload.deposit_amount_used = total

      const res = await api.post('/api/chicks/bookings', payload)
      const booking = res.data.data || res.data
      setDone(booking)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  const downloadQR = async (bookingCode) => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(bookingCode, { width: 400, margin: 2 })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `booking-${bookingCode}.png`
      link.click()
    } catch {
      toast.error('Failed to generate QR image')
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bird size={24} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Booking Submitted!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your booking code is <span className="font-mono font-semibold text-gray-800">{done.booking_code}</span>.
            It's awaiting approval — check "My Bookings" for status updates.
          </p>
          {method === 'transfer' && (
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 text-left mb-4">
              <p className="font-medium mb-1">Transfer payment to:</p>
              <p>Bank: First Bank</p>
              <p>Account: 1234567890</p>
              <p>Name: Sadeeq Agrovet</p>
              <p className="mt-2 text-xs">Your booking will be confirmed once the store verifies your transfer.</p>
            </div>
          )}
          <button
            onClick={() => downloadQR(done.booking_code)}
            className="w-full flex items-center justify-center gap-2 border border-green-200 text-green-700 hover:bg-green-50 py-2.5 rounded-xl text-sm font-semibold transition mb-2"
          >
            <Download size={16} />
            Download QR Code
          </button>
          <p className="text-xs text-gray-400 mb-3">
            Save this image — show it at pickup, even without internet.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Book {schedule.chick_varieties?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cartons</label>
              <input
                type="number"
                value={cartons}
                onChange={(e) => setCartons(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Loose Pieces</label>
              <input
                type="number"
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Max {schedule.max_cartons_per_order} cartons per order</p>

          {total > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <span className="text-lg font-bold text-green-600">₦{total.toLocaleString()}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['transfer', 'credit', 'deposit'].map((m) => (
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
            {method === 'credit' && (
              <p className="text-xs text-gray-400 mt-1">You need an existing credit account with enough limit.</p>
            )}
            {method === 'deposit' && (
              <p className="text-xs text-gray-400 mt-1">Your deposit balance must fully cover the total.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60"
            >
              {saving ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BookChicks