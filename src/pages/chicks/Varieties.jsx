import { useState, useEffect } from 'react'
import { Plus, Edit2, Bird, RotateCcw, Trash2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

function Varieties() {
  const [varieties, setVarieties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'super_admin'

  const fetchVarieties = async () => {
    setLoading(true)
    try {
      const params = canManage && showInactive ? { include_inactive: true } : {}
      const res = await api.get('/api/chicks/varieties', { params })
      if (res.data.success !== false) {
        setVarieties(res.data.data || res.data)
      }
    } catch {
      toast.error('Failed to load chick varieties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVarieties() }, [showInactive])

  const handleDeactivate = async (variety) => {
    if (!confirm(`Deactivate "${variety.name}"? It won't be bookable until reactivated.`)) return
    try {
      await api.delete(`/api/chicks/varieties/${variety.id}`)
      toast.success('Variety deactivated')
      fetchVarieties()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate variety')
    }
  }

  const handleReactivate = async (variety) => {
    try {
      await api.put(`/api/chicks/varieties/${variety.id}`, { is_active: true })
      toast.success('Variety reactivated')
      fetchVarieties()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reactivate variety')
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Chick Varieties</h1>
          <p className="text-sm text-gray-500 mt-0.5">{varieties.length} varieties</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium px-3 py-2.5 rounded-xl transition"
            >
              {showInactive ? <EyeOff size={16} /> : <Eye size={16} />}
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </button>
          )}
          {canManage && (
            <button
              onClick={() => { setEditing(null); setShowModal(true) }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Add Variety
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : varieties.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <Bird size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No varieties yet</p>
          {canManage && <p className="text-gray-300 text-sm mt-1">Click "Add Variety" to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {varieties.map((v) => (
            <div key={v.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${
              v.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Bird size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{v.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                      v.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditing(v); setShowModal(true) }}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 size={14} />
                    </button>
                    {v.is_active ? (
                      <button
                        onClick={() => handleDeactivate(v)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(v)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Reactivate"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Price per Carton</span>
                  <span className="font-medium text-gray-700">₦{Number(v.price_per_carton).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price per Piece</span>
                  <span className="font-medium text-gray-700">₦{Number(v.price_per_piece).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pieces per Carton</span>
                  <span className="font-medium text-gray-700">{v.pieces_per_carton}</span>
                </div>
                {canManage && (v.wholesale_price_per_carton || v.wholesale_price_per_piece) && (
                  <div className="border-t border-gray-50 pt-1.5 mt-1.5 space-y-1.5">
                    {v.wholesale_price_per_carton && (
                      <div className="flex justify-between">
                        <span className="text-amber-600 text-xs">Wholesale / Carton</span>
                        <span className="font-medium text-amber-700 text-xs">₦{Number(v.wholesale_price_per_carton).toLocaleString()}</span>
                      </div>
                    )}
                    {v.wholesale_price_per_piece && (
                      <div className="flex justify-between">
                        <span className="text-amber-600 text-xs">Wholesale / Piece</span>
                        <span className="font-medium text-amber-700 text-xs">₦{Number(v.wholesale_price_per_piece).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <VarietyModal
          variety={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchVarieties()
          }}
        />
      )}

    </div>
  )
}

function VarietyModal({ variety, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: variety?.name || '',
    price_per_carton: variety?.price_per_carton || '',
    price_per_piece: variety?.price_per_piece || '',
    pieces_per_carton: variety?.pieces_per_carton || 50,
    wholesale_price_per_carton: variety?.wholesale_price_per_carton || '',
    wholesale_price_per_piece: variety?.wholesale_price_per_piece || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.price_per_carton || !form.price_per_piece) {
      toast.error('Name, price per carton and price per piece are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        price_per_carton: Number(form.price_per_carton),
        price_per_piece: Number(form.price_per_piece),
        pieces_per_carton: Number(form.pieces_per_carton) || 50,
        wholesale_price_per_carton: form.wholesale_price_per_carton ? Number(form.wholesale_price_per_carton) : null,
        wholesale_price_per_piece: form.wholesale_price_per_piece ? Number(form.wholesale_price_per_piece) : null,
      }

      const res = variety
        ? await api.put(`/api/chicks/varieties/${variety.id}`, payload)
        : await api.post('/api/chicks/varieties', payload)

      if (res.data.success !== false) {
        toast.success(variety ? 'Variety updated!' : 'Variety added!')
        onSaved()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save variety')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {variety ? 'Edit Variety' : 'Add New Variety'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Variety Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Broiler"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Price per Carton (₦) *</label>
            <input
              name="price_per_carton"
              type="number"
              value={form.price_per_carton}
              onChange={handleChange}
              placeholder="e.g. 15000"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Price per Piece (₦) *</label>
            <input
              name="price_per_piece"
              type="number"
              value={form.price_per_piece}
              onChange={handleChange}
              placeholder="e.g. 350"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Pieces per Carton</label>
            <input
              name="pieces_per_carton"
              type="number"
              value={form.pieces_per_carton}
              onChange={handleChange}
              placeholder="Defaults to 50"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Special Customer Pricing</p>
            <p className="text-xs text-gray-400 mb-3">
              Charged automatically to customers flagged as "special" — regardless of quantity ordered.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Wholesale Price per Carton (₦)</label>
                <input
                  name="wholesale_price_per_carton"
                  type="number"
                  value={form.wholesale_price_per_carton}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Wholesale Price per Piece (₦)</label>
                <input
                  name="wholesale_price_per_piece"
                  type="number"
                  value={form.wholesale_price_per_piece}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>
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
              {saving ? 'Saving...' : variety ? 'Update Variety' : 'Add Variety'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default Varieties