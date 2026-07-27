import supabase from '../../../lib/supabase.js'
import { success, error } from '../../../lib/helpers.js'
import { authenticate, requireRole } from '../../../lib/middleware.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return error(res, 'Method not allowed', 405)

  try {
    const decoded = authenticate(req)
    requireRole(decoded, ['super_admin', 'admin'])

    const { id } = req.query
    const { newPassword } = req.body
    if (!newPassword) return error(res, 'newPassword is required')
    if (newPassword.length < 6) return error(res, 'Password must be at least 6 characters')

    const { data: customer } = await supabase.from('customers').select('id').eq('id', id).single()
    if (!customer) return error(res, 'Customer not found', 404)

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const { error: dbError } = await supabase
      .from('customers')
      .update({ password: hashedPassword })
      .eq('id', id)

    if (dbError) return error(res, 'Could not reset password', 500)

    await supabase.from('audit_logs').insert({
      user_id: decoded.id,
      action: 'reset_password',
      entity_type: 'customer',
      entity_id: id
    })

    return success(res, {}, 'Password reset successful')
  } catch (err) {
    return error(res, err.message === 'Unauthorized' ? 'Unauthorized' : 'Server error', err.message === 'Unauthorized' ? 403 : 500)
  }
}