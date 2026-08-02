import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer, X } from 'lucide-react'

function Receipt({ sale, onClose }) {
  const receiptRef = useRef()

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  })

  if (!sale) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition"
            >
              <Printer size={16} />
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6">

          {/* Shop Header */}
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold text-gray-800">Sadeeq Agrovet</h1>
            <p className="text-xs text-gray-500">and General Merchant</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(sale.created_at).toLocaleString('en-NG', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </p>
          </div>

          {/* Sale Info */}
          <div className="border-t border-dashed border-gray-200 pt-3 mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Receipt No:</span>
              <span className="font-medium">{sale.id?.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Cashier:</span>
              <span className="font-medium">{sale.cashier?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Payment:</span>
              <span className="font-medium capitalize">{sale.payment_method}</span>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-dashed border-gray-200 pt-3 mb-3">
            {sale.items?.map((item, index) => (
              <div key={index} className="flex justify-between text-xs mb-2">
                <div className="flex-1 mr-2">
                  <p className="font-medium text-gray-800">{item.product?.name}</p>
                  <p className="text-gray-400">
                    {item.quantity} {item.product?.unit_of_measurement} x ₦{Number(item.unit_price).toLocaleString()}
                  </p>
                </div>
                <span className="font-semibold text-gray-800">
                  ₦{Number(item.subtotal).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-dashed border-gray-200 pt-3">
            <div className="flex justify-between font-bold text-gray-800">
              <span>TOTAL</span>
              <span>₦{Number(sale.total_amount).toLocaleString()}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4">
            <p className="text-xs text-gray-400">Thank you for your business!</p>
            <p className="text-xs text-gray-300 mt-1">Powered by Sadeeq POS</p>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Receipt