import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { id: branch_id } = req.query
    const { product_id } = req.body
    if (!product_id) return error(res, 'product_id is required')

    const { data: branch } = await supabase.from('branches').select('id').eq('id', branch_id).single()
    if (!branch) return error(res, 'Branch not found', 404)

    const { data: product } = await supabase.from('products').select('id').eq('id', product_id).single()
    if (!product) return error(res, 'Product not found', 404)

    const { data, error: dbError } = await supabase
      .from('branch_products')
      .upsert({ branch_id, product_id, is_active: true }, { onConflict: 'branch_id,product_id' })
      .select()
      .single()

    if (dbError) return error(res, 'Could not link product to branch', 500)

    await supabase.from('stock').upsert(
      { branch_id, product_id, quantity: 0 },
      { onConflict: 'branch_id,product_id', ignoreDuplicates: true }
    )

    return success(res, data, 'Product added to branch')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}