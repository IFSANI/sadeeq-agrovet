import { useState, useEffect } from 'react'
import { Bird } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const statusColor = (status) => {
  if (status === 'confirmed') return 'bg-blue-50 text-blue-600'
  if (status === 'collected') return 'bg-green-50 text-green-600'
  if (status === 'cancelled') return 'bg-red-50 text-red-500'
  return 'bg-yellow-50 text-yellow-600'
}

function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/chicks/bookings/mine')
      setBookings(res.data.data || res.data)
    } catch {
      toast.error('Failed to load your bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [])

  const handleCancel = async (id) => {
    if (!confirm('Cancel this booking?')) return
    setCancellingId(id)
    try {
      await api.put(`/api/chicks/bookings/${id}/cancel`)
      toast.success('Booking cancelled')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">My Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">{bookings.length} bookings</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <Bird size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No bookings yet</p>
          <p className="text-gray-300 text-sm mt-1">Head to "Book Chicks" to make your first booking</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-800">{b.booking_code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(b.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${statusColor(b.booking_status)}`}>
                  {b.booking_status?.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {(b.items || b.chick_booking_items || []).map((i, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-600">{i.chick_varieties?.name}</span>
                      {i.chick_delivery_schedules?.delivery_date && (
                        <span className="text-xs text-gray-400 block">
                          Arriving {new Date(i.chick_delivery_schedules.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-800">{i.cartons || 0} carton(s), {i.pieces || 0} pc</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-500">
                  <span className="capitalize">{b.payment_method}</span>
                  <span className={`ml-1 ${b.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    ({b.payment_status})
                  </span>
                </div>
                {['pending_approval', 'confirmed'].includes(b.booking_status) && (
                  <button
                    onClick={() => handleCancel(b.id)}
                    disabled={cancellingId === b.id}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    {cancellingId === b.id ? 'Cancelling...' : 'Cancel Booking'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyBookings