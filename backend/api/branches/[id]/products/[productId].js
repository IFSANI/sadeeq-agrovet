import supabase from '../../../../lib/supabase.js'
import { success, error } from '../../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../../lib/middleware.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { id: branch_id, productId: product_id } = req.query

    const { error: dbError } = await supabase
      .from('branch_products')
      .update({ is_active: false })
      .eq('branch_id', branch_id)
      .eq('product_id', product_id)

    if (dbError) return error(res, 'Could not remove product from branch', 500)

    return success(res, {}, 'Product removed from branch')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}