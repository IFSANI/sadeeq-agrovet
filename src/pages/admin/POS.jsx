import { useState, useRef, useEffect } from 'react'
import { Search, Trash2, Plus, Minus, ShoppingCart, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { searchProducts } from '../../services/productService'
import { createSale, confirmCashPayment, confirmTransferPayment, confirmPOSPayment } from '../../services/salesService'
import { getBranches } from '../../services/branchService'
import Receipt from '../../components/pos/Receipt'
import useAuthStore from '../../store/authStore'

function POS() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [searching, setSearching] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const searchRef = useRef(null)
  const { user } = useAuthStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin'
  const activeBranchId = isSuperAdmin ? selectedBranchId : user?.branch_id

  // Auto focus search box on load
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Fetch branches for super admin
  useEffect(() => {
    if (isSuperAdmin) {
      getBranches().then((res) => {
        if (res.success) {
          setBranches(res.data)
          if (res.data.length > 0) {
            setSelectedBranchId(res.data[0].id)
          }
        }
      })
    }
  }, [])

  // Search products as user types
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (query.length < 2) {
        setSearchResults([])
        return
      }
      setSearching(true)
      try {
        const res = await searchProducts(query)
        if (res.success) setSearchResults(res.data)
      } catch {
        toast.error('Search failed')
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const addToCart = (product) => {
    setQuery('')
    setSearchResults([])
    const existing = cartItems.find((i) => i.id === product.id)
    if (existing) {
      setCartItems(cartItems.map((i) =>
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1 }])
    }
    searchRef.current?.focus()
  }

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id)
    setCartItems(cartItems.map((i) => i.id === id ? { ...i, quantity: qty } : i))
  }

  const removeFromCart = (id) => {
    setCartItems(cartItems.filter((i) => i.id !== id))
  }

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">

      {/* Left — Search & Results */}
      <div className="flex-1 space-y-4">

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">

          {/* Branch Selector — only for super admin */}
          {isSuperAdmin && branches.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Selling From Branch
              </label>
              <select
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} {branch.is_main ? '(Main)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-600 mb-2">
            Search Product or Scan Barcode
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type product name or scan barcode..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 transition border-b border-gray-50 last:border-0 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-400">
                      {product.category} • {product.unit_of_measurement}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      ₦{Number(product.price).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">per {product.unit_of_measurement}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty State */}
        {cartItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <ShoppingCart size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Cart is empty</p>
            <p className="text-gray-300 text-sm mt-1">Search for a product to add it</p>
          </div>
        )}

        {/* Cart Items */}
        {cartItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">
                Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      ₦{Number(item.price).toLocaleString()} per {item.unit_of_measurement}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.id, Number(e.target.value))}
                      className="w-12 text-center text-sm font-medium border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-800 w-24 text-right">
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — Order Summary */}
      <div className="w-full lg:w-80 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-20">
          <h2 className="font-semibold text-gray-700 mb-4">Order Summary</h2>

          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {cartItems.length === 0 ? (
              <p className="text-gray-300 text-sm text-center py-4">No items yet</p>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate flex-1 mr-2">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium text-gray-800 flex-shrink-0">
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-xl font-bold text-green-600">
                ₦{total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (cartItems.length === 0) {
                toast.error('Add items to cart first')
                return
              }
              if (!activeBranchId) {
                toast.error('Please select a branch first')
                return
              }
              setShowPayment(true)
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition"
          >
            Proceed to Payment
          </button>

          {cartItems.length > 0 && (
            <button
              onClick={() => setCartItems([])}
              className="w-full mt-2 text-sm text-red-400 hover:text-red-600 transition py-2"
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          cartItems={cartItems}
          total={total}
          branchId={activeBranchId}
          cashierId={user?.id}
          onClose={() => setShowPayment(false)}
          onSuccess={(sale) => {
            setCartItems([])
            setShowPayment(false)
            setReceipt(sale)
          }}
        />
      )}

      {/* Receipt */}
      {receipt && (
        <Receipt
          sale={receipt}
          onClose={() => setReceipt(null)}
        />
      )}

    </div>
  )
}

// Payment Modal
function PaymentModal({ cartItems, total, branchId, cashierId, onClose, onSuccess }) {
  const [method, setMethod] = useState(null)
  const [processing, setProcessing] = useState(false)

  const methods = ['Cash', 'Transfer', 'POS', 'Credit']

  const methodColors = {
    Cash: 'bg-green-50 border-green-300 text-green-700',
    Transfer: 'bg-blue-50 border-blue-300 text-blue-700',
    POS: 'bg-purple-50 border-purple-300 text-purple-700',
    Credit: 'bg-orange-50 border-orange-300 text-orange-700',
  }

  const handleCompleteSale = async () => {
    if (!method) return
    setProcessing(true)

    try {
      const salePayload = {
        branch_id: branchId,
        cashier_id: cashierId,
        payment_method: method.toLowerCase(),
        total_amount: total,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
        })),
      }

      const saleRes = await createSale(salePayload)
      if (!saleRes.success) {
        toast.error(saleRes.message || 'Failed to create sale')
        return
      }

      const saleId = saleRes.data.id
      let paymentRes

      if (method === 'Cash') {
        paymentRes = await confirmCashPayment(saleId, total)
      } else if (method === 'Transfer') {
        paymentRes = await confirmTransferPayment(saleId)
      } else if (method === 'POS') {
        paymentRes = await confirmPOSPayment(saleId)
      } else if (method === 'Credit') {
        paymentRes = saleRes
      }

      if (paymentRes?.success) {
        toast.success('Sale completed!')
        onSuccess(paymentRes.data.sale)
      } else {
        toast.error('Payment confirmation failed')
      }

    } catch {
      toast.error('Something went wrong')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="bg-green-50 rounded-xl p-4 text-center mb-5">
          <p className="text-sm text-gray-500 mb-1">Amount Due</p>
          <p className="text-3xl font-bold text-green-600">₦{total.toLocaleString()}</p>
        </div>

        <p className="text-sm font-medium text-gray-600 mb-3">Select Payment Method</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition ${
                method === m
                  ? methodColors[m]
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {method === 'Cash' && (
          <div className="mb-4 bg-green-50 rounded-xl p-4 text-sm text-green-700">
            <p className="font-medium">Collect exact amount from customer:</p>
            <p className="text-2xl font-bold mt-1">₦{total.toLocaleString()}</p>
          </div>
        )}

        {method === 'Transfer' && (
          <div className="mb-4 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">Ask customer to transfer to:</p>
            <p>Bank: First Bank</p>
            <p>Account: 1234567890</p>
            <p>Name: Sadeeq Agrovet</p>
            <p className="mt-2 font-medium">Confirm on your bank app before proceeding.</p>
          </div>
        )}

        {method === 'POS' && (
          <div className="mb-4 bg-purple-50 rounded-xl p-4 text-sm text-purple-700">
            <p className="font-medium">Use the POS machine to collect payment.</p>
            <p className="mt-1">Confirm the transaction before clicking Complete.</p>
          </div>
        )}

        {method === 'Credit' && (
          <div className="mb-4 bg-orange-50 rounded-xl p-4 text-sm text-orange-700">
            <p className="font-medium">Search for customer account to add debt.</p>
            <p className="mt-1 text-xs">Customer credit management coming soon.</p>
          </div>
        )}

        <button
          onClick={handleCompleteSale}
          disabled={!method || processing}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
            : 'Complete Sale'
          }
        </button>

      </div>
    </div>
  )
}

export default POS