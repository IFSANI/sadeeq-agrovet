import {
  ShoppingCart, Package, Users, TrendingUp,
  AlertTriangle, Clock, Bird, Wallet
} from 'lucide-react'

// Mock data — will be replaced with real API data later
const stats = [
  {
    label: 'Total Sales Today',
    value: '₦124,500',
    change: '+12% from yesterday',
    icon: ShoppingCart,
    color: 'bg-green-50 text-green-600',
  },
  {
    label: 'Products Low on Stock',
    value: '7',
    change: 'Needs restocking',
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-600',
  },
  {
    label: 'Pending Chick Bookings',
    value: '4',
    change: 'Awaiting approval',
    icon: Bird,
    color: 'bg-yellow-50 text-yellow-600',
  },
  {
    label: 'Outstanding Debt',
    value: '₦89,200',
    change: 'Across 12 customers',
    icon: Wallet,
    color: 'bg-blue-50 text-blue-600',
  },
]

const recentSales = [
  { id: 'SL-001', cashier: 'Musa', amount: '₦12,400', method: 'Cash', time: '9:12 AM', items: 5 },
  { id: 'SL-002', cashier: 'Aisha', amount: '₦6,800', method: 'Transfer', time: '9:45 AM', items: 3 },
  { id: 'SL-003', cashier: 'Musa', amount: '₦31,000', method: 'POS', time: '10:20 AM', items: 8 },
  { id: 'SL-004', cashier: 'Aisha', amount: '₦4,200', method: 'Cash', time: '11:05 AM', items: 2 },
  { id: 'SL-005', cashier: 'Musa', amount: '₦18,750', method: 'Credit', time: '11:40 AM', items: 6 },
]

const stockAlerts = [
  { name: 'Oxytetracycline Injection 100ml', stock: 3, unit: 'bottles' },
  { name: 'Cargill Fish Feed 25kg', stock: 5, unit: 'bags' },
  { name: 'Newcastle Vaccine', stock: 2, unit: 'vials' },
  { name: 'Broiler Finisher 50kg', stock: 4, unit: 'bags' },
]

const methodColors = {
  Cash: 'bg-green-100 text-green-700',
  Transfer: 'bg-blue-100 text-blue-700',
  POS: 'bg-purple-100 text-purple-700',
  Credit: 'bg-orange-100 text-orange-700',
}

function Dashboard() {
  return (
    <div className="space-y-6">

      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Welcome back! Here is what is happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
            <span className="text-xs text-green-600 font-medium cursor-pointer hover:underline">
              View all
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left px-5 py-3">Sale ID</th>
                  <th className="text-left px-5 py-3">Cashier</th>
                  <th className="text-left px-5 py-3">Items</th>
                  <th className="text-left px-5 py-3">Method</th>
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-700">{sale.id}</td>
                    <td className="px-5 py-3 text-gray-600">{sale.cashier}</td>
                    <td className="px-5 py-3 text-gray-600">{sale.items} items</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${methodColors[sale.method]}`}>
                        {sale.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{sale.amount}</td>
                    <td className="px-5 py-3 text-gray-400">{sale.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">Stock Alerts</h2>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="p-4 space-y-3">
            {stockAlerts.map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3 p-3 bg-red-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Only {item.stock} {item.unit} left
                  </p>
                </div>
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}

export default Dashboard