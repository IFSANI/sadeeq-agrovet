import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Wallet, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPurchases, setLoadingPurchases] = useState(true)
  const [showRepay, setShowRepay] = useState(false)

  const fetchCustomer = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/customers/${id}`)
      if (res.data.success) setCustomer(res.data.data)
    } catch {
      toast.error('Failed to load customer')
    } finally {
      setLoading(false)
    }
  }

  const fetchPurchases = async () => {
    setLoadingPurchases(true)
    try {
      const res = await api.get(`/api/customers/${id}/purchases`)
      if (res.data.success) setPurchases(res.data.data)
    } catch {
      // silent — purchase history is supplementary, not critical
    } finally {
      setLoadingPurchases(false)
    }
  }

  useEffect(() => {
    fetchCustomer()
    fetchPurchases()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Customer not found</p>
      </div>
    )
  }

  const account = customer.credit_account
  const balance = Number(account?.current_balance || 0)
  const limit = Number(account?.credit_limit || 0)

  return (
    <div className="space-y-4">

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {customer.phone && (
                <span className="flex items-center gap-1.5"><Phone size={14} /> {customer.phone}</span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1.5"><Mail size={14} /> {customer.email}</span>
              )}
            </div>
            {customer.address && (
              <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <MapPin size={14} /> {customer.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Credit Account */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-700">Credit Account</h2>
        </div>

        {!account ? (
          <p className="text-gray-400 text-sm">
            No credit account yet — one gets opened automatically the first time this customer uses Credit or Split payment at checkout.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Outstanding Balance</p>
                <p className="text-xl font-bold text-red-500">₦{balance.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Credit Limit</p>
                <p className="text-xl font-bold text-gray-800">₦{limit.toLocaleString()}</p>
              </div>
            </div>

            {limit > 0 && balance / limit >= 0.8 && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-xl p-3 mb-4">
                <AlertCircle size={14} />
                Customer is close to their credit limit
              </div>
            )}

            <button
              onClick={() => setShowRepay(true)}
              disabled={balance === 0}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              Record Repayment
            </button>
          </>
        )}
      </div>

      {/* Purchase History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Purchase History</h2>
        </div>

        {loadingPurchases ? (
          <div className="flex items-center justify-center py-10">
            <span className="w-6 h-6 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">No purchases yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {purchases.map((sale) => (
              <div key={sale.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(sale.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ₦{Number(sale.total_amount).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="capitalize">{sale.payment_method}</span>
                  <span>·</span>
                  <span className={`capitalize font-medium ${sale.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {sale.payment_status}
                  </span>
                  {sale.branches?.name && (
                    <>
                      <span>·</span>
                      <span>{sale.branches.name}</span>
                    </>
                  )}
                </div>
                {sale.sale_items?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {sale.sale_items.map((i) => i.products?.name).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showRepay && (
        <RepaymentModal
          customer={customer}
          onClose={() => setShowRepay(false)}
          onSaved={() => {
            setShowRepay(false)
            fetchCustomer()
          }}
        />
      )}

    </div>
  )
}

function RepaymentModal({ customer, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const balance = Number(customer.credit_account?.current_balance || 0)
  const methods = ['cash', 'transfer', 'pos']

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (Number(amount) > balance) {
      toast.error(`Amount can't exceed the outstanding balance of ₦${balance.toLocaleString()}`)
      return
    }
    setSaving(true)
    try {
      const payload = { amount: Number(amount), payment_method: paymentMethod }
      if (reference) payload.reference = reference

      const res = await api.post(`/api/customers/${customer.id}/credit/repay`, payload)
      if (res.data.success) {
        toast.success('Repayment recorded!')
        onSaved()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record repayment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Record Repayment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="bg-orange-50 rounded-xl p-4 mb-5">
          <p className="text-sm font-medium text-gray-800">{customer.name}</p>
          <p className="text-sm text-orange-700 mt-2">
            Currently owes <span className="font-bold">₦{balance.toLocaleString()}</span>
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
              {saving ? 'Recording...' : 'Record Repayment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomerDetail