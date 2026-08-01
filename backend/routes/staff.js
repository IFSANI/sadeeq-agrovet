import express from 'express'
import bcrypt from 'bcryptjs'
import supabase from '../lib/supabase.js'
import { success, error } from '../lib/helpers.js'
import { requireAuth, requireRole } from '../lib/middleware.js'

const router = express.Router()

router.put('/:id/reset-password', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body
    if (!newPassword) return error(res, 'newPassword is required')
    if (newPassword.length < 6) return error(res, 'Password must be at least 6 characters')

    const { data: user } = await supabase.from('users').select('id').eq('id', id).single()
    if (!user) return error(res, 'Staff member not found', 404)

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const { error: dbError } = await supabase.from('users').update({ password: hashedPassword, updated_at: new Date() }).eq('id', id)
    if (dbError) return error(res, 'Could not reset password', 500)

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'reset_password', entity_type: 'user', entity_id: id })
    return success(res, {}, 'Password reset successful')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

export default router