import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../lib/middleware.js'

function randomBarcode() {
  let code = '2'
  for (let i = 0; i < 11; i++) code += Math.floor(Math.random() * 10)
  return code
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { id } = req.query
    const { data: existing } = await supabase.from('products').select('id').eq('id', id).single()
    if (!existing) return error(res, 'Product not found', 404)

    let barcode, attempts = 0
    while (attempts < 5) {
      barcode = randomBarcode()
      const { data: clash } = await supabase.from('products').select('id').eq('barcode', barcode).maybeSingle()
      if (!clash) break
      attempts++
    }

    const { data: updated, error: dbError } = await supabase
      .from('products').update({ barcode, updated_at: new Date() }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not generate barcode', 500)
    return success(res, updated, 'Barcode generated')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}