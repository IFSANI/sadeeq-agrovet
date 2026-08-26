import express from 'express'
import { nanoid } from 'nanoid'
import supabase from '../lib/supabase.js'
import { success, error } from '../lib/helpers.js'
import { requireAuth, requireRole } from '../lib/middleware.js'

const router = express.Router()

router.get('/varieties', requireAuth, async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true' && ['super_admin', 'admin'].includes(req.user.role)
    let query = supabase.from('chick_varieties').select('*').order('name', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch varieties', 500)
    return success(res, data, 'Varieties fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/varieties', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { name, price_per_carton, price_per_piece, pieces_per_carton } = req.body
    if (!name || price_per_carton === undefined || price_per_piece === undefined) {
      return error(res, 'name, price_per_carton and price_per_piece are required')
    }

    const { data: variety, error: dbError } = await supabase
      .from('chick_varieties')
      .insert({ name, price_per_carton, price_per_piece, pieces_per_carton: pieces_per_carton || 50 })
      .select().single()

    if (dbError) return error(res, 'Could not create variety', 500)
    return success(res, variety, 'Variety created')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/varieties/:id', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'price_per_carton', 'price_per_piece', 'pieces_per_carton', 'is_active']
    const updates = {}
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key]

    const { data: updated, error: dbError } = await supabase.from('chick_varieties').update(updates).eq('id', id).select().single()
    if (dbError) return error(res, 'Could not update variety', 500)
    return success(res, updated, 'Variety updated')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.delete('/varieties/:id', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: updated, error: dbError } = await supabase.from('chick_varieties').update({ is_active: false }).eq('id', id).select().single()
    if (dbError) return error(res, 'Could not delete variety', 500)
    return success(res, updated, 'Variety deactivated')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/schedules', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query
    const canSeeCost = ['super_admin', 'admin'].includes(req.user.role)

    const selectFields = canSeeCost
      ? '*, chick_varieties(name), stock_receipts(supplier_id, total_cost, amount_paid, suppliers(name))'
      : 'id, variety_id, delivery_date, total_cartons_available, max_cartons_per_order, created_by, created_at, chick_varieties(name)'

    let query = supabase.from('chick_delivery_schedules').select(selectFields).order('delivery_date', { ascending: true })
    if (from) query = query.gte('delivery_date', from)
    if (to) query = query.lte('delivery_date', to)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch schedules', 500)

    if (!canSeeCost) return success(res, data, 'Schedules fetched')

    const shaped = data.map(s => {
      const receipt = s.stock_receipts
      const { stock_receipts, ...rest } = s
      return {
        ...rest,
        supplier_id: receipt?.supplier_id || null,
        supplier_name: receipt?.suppliers?.name || null,
        total_cost: receipt?.total_cost ?? null,
        amount_paid: receipt?.amount_paid ?? null,
        balance_owed: receipt ? Number(receipt.total_cost) - Number(receipt.amount_paid) : null
      }
    })

    return success(res, shaped, 'Schedules fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/schedules', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { variety_id, delivery_date, total_cartons_available, max_cartons_per_order, supplier_id, cost_per_carton, amount_paid_now, payment_method_now } = req.body
    if (!variety_id || !delivery_date || !total_cartons_available || !max_cartons_per_order) {
      return error(res, 'variety_id, delivery_date, total_cartons_available and max_cartons_per_order are required')
    }

    let stock_receipt_id = null

    if (cost_per_carton !== undefined && cost_per_carton !== null) {
      const total_cost = Number(cost_per_carton) * Number(total_cartons_available)
      const amountPaid = amount_paid_now ? Number(amount_paid_now) : 0
      const paymentStatus = amountPaid >= total_cost ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid')

      const { data: receipt, error: receiptErr } = await supabase
        .from('stock_receipts')
        .insert({
          branch_id: null,
          supplier_id: supplier_id || null,
          received_by: req.user.id,
          total_cost,
          notes: 'Chick delivery schedule cost',
          amount_paid: amountPaid,
          payment_status: paymentStatus
        })
        .select().single()

      if (receiptErr) return error(res, 'Could not record schedule cost', 500)

      if (amountPaid > 0) {
        await supabase.from('stock_receipt_payments').insert({
          stock_receipt_id: receipt.id, amount: amountPaid, payment_method: payment_method_now || 'cash', paid_by: req.user.id
        })
      }

      stock_receipt_id = receipt.id
    }

    const { data: schedule, error: dbError } = await supabase
      .from('chick_delivery_schedules')
      .insert({
        variety_id, delivery_date, total_cartons_available, max_cartons_per_order,
        created_by: req.user.id, cost_per_carton: cost_per_carton ?? null, stock_receipt_id
      })
      .select().single()

    if (dbError) return error(res, 'Could not create schedule', 500)
    return success(res, schedule, 'Schedule created')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/schedules/:id', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['delivery_date', 'total_cartons_available', 'max_cartons_per_order']
    const updates = {}
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key]

    const { data: updated, error: dbError } = await supabase.from('chick_delivery_schedules').update(updates).eq('id', id).select().single()
    if (dbError) return error(res, 'Could not update schedule', 500)
    return success(res, updated, 'Schedule updated')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

async function cartonsBooked(scheduleId) {
  const { data: items } = await supabase
    .from('chick_booking_items')
    .select('cartons, pieces, chick_bookings!inner(booking_status)')
    .eq('schedule_id', scheduleId)
    .neq('chick_bookings.booking_status', 'cancelled')

  const { data: schedule } = await supabase.from('chick_delivery_schedules').select('*, chick_varieties(pieces_per_carton)').eq('id', scheduleId).single()
  const piecesPerCarton = schedule?.chick_varieties?.pieces_per_carton || 50

  return (items || []).reduce((sum, i) => sum + Number(i.cartons) + (Number(i.pieces) / piecesPerCarton), 0)
}

router.get('/schedules/:id/availability', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { data: schedule } = await supabase.from('chick_delivery_schedules').select('*').eq('id', id).single()
    if (!schedule) return error(res, 'Schedule not found', 404)

    const booked = await cartonsBooked(id)
    const available = Number(schedule.total_cartons_available) - booked

    return success(res, { total_cartons_available: schedule.total_cartons_available, cartons_booked: booked, cartons_remaining: available, max_cartons_per_order: schedule.max_cartons_per_order }, 'Availability fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/bookings', requireAuth, requireRole('super_admin', 'admin', 'cashier'), async (req, res) => {

  try {
    const { status, customer } = req.query
    let query = supabase
      .from('chick_bookings')
      .select('*, customers(name, phone), chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date)))')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('booking_status', status)
    if (customer) query = query.eq('customer_id', customer)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch bookings', 500)
    return success(res, data, 'Bookings fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { customer_id, payment_method, items, deposit_amount_used } = req.body
    const finalCustomerId = req.user.role === 'customer' ? req.user.id : customer_id
    const branch_id = req.user.role === 'customer' ? null : (req.user.branch_id || null)

    if (!finalCustomerId) return error(res, 'customer_id is required')
    if (!payment_method) return error(res, 'payment_method is required')
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required')

    const enrichedItems = []
    for (const item of items) {
      if (!item.schedule_id || !item.variety_id) return error(res, 'Each item needs schedule_id and variety_id')
      const cartons = item.cartons || 0
      const pieces = item.pieces || 0
      if (cartons === 0 && pieces === 0) return error(res, 'Each item needs cartons and/or pieces greater than 0')

      const { data: schedule } = await supabase.from('chick_delivery_schedules').select('*').eq('id', item.schedule_id).single()
      if (!schedule) return error(res, 'Delivery schedule not found')

      const { data: variety } = await supabase.from('chick_varieties').select('*').eq('id', item.variety_id).single()
      if (!variety) return error(res, 'Variety not found')

      const requestedEquivalent = cartons + (pieces / variety.pieces_per_carton)
      if (requestedEquivalent > schedule.max_cartons_per_order) {
        return error(res, `This order exceeds the max cartons per order (${schedule.max_cartons_per_order}) for this schedule`)
      }

      const booked = await cartonsBooked(item.schedule_id)
      if (booked + requestedEquivalent > Number(schedule.total_cartons_available)) {
        return error(res, 'Not enough cartons available for this schedule')
      }

      const subtotal = (cartons * Number(variety.price_per_carton)) + (pieces * Number(variety.price_per_piece))
      enrichedItems.push({ ...item, cartons, pieces, unit_price: variety.price_per_carton, subtotal })
    }

    const total_amount = enrichedItems.reduce((sum, i) => sum + i.subtotal, 0)
    const booking_code = `CHK-${nanoid(8).toUpperCase()}`

    let creditAccount = null
    if (payment_method === 'credit') {
      const { data: account } = await supabase.from('credit_accounts').select('*').eq('customer_id', finalCustomerId).maybeSingle()
      if (!account) return error(res, 'Customer has no credit account')
      if (account.status !== 'active') return error(res, 'Customer credit account is suspended')
      if (Number(account.current_balance) + total_amount > Number(account.credit_limit)) {
        return error(res, 'This booking would exceed the customer\'s credit limit')
      }
      creditAccount = account
    }

    let depositAccount = null
    if (payment_method === 'deposit') {
      if (!deposit_amount_used || deposit_amount_used <= 0) return error(res, 'deposit_amount_used is required for deposit payment')
      if (Number(deposit_amount_used) < total_amount) return error(res, 'Deposit payment currently requires the deposit to cover the full booking total')

      const { data: account } = await supabase.from('deposit_accounts').select('*').eq('customer_id', finalCustomerId).maybeSingle()
      if (!account) return error(res, 'Customer has no deposit account')
      if (Number(account.current_balance) < total_amount) return error(res, "Amount exceeds the customer's deposit balance")
      depositAccount = account
    }

    const { data: booking, error: bookingErr } = await supabase
      .from('chick_bookings')
      .insert({
        customer_id: finalCustomerId,
        branch_id,
        booking_code,
        qr_code: booking_code,
        total_amount,
        payment_method,
        deposit_amount_used: payment_method === 'deposit' ? total_amount : null,
        payment_status: ['credit', 'deposit'].includes(payment_method) ? 'paid' : 'pending',
        booking_status: 'pending_approval'
      })
      .select().single()

    if (bookingErr) return error(res, 'Could not create booking', 500)

    const itemRows = enrichedItems.map(i => ({
      booking_id: booking.id, schedule_id: i.schedule_id, variety_id: i.variety_id,
      cartons: i.cartons, pieces: i.pieces, unit_price: i.unit_price, subtotal: i.subtotal
    }))
    await supabase.from('chick_booking_items').insert(itemRows)

    if (payment_method === 'credit' && creditAccount) {
      const newBalance = Number(creditAccount.current_balance) + total_amount
      await supabase.from('credit_accounts').update({ current_balance: newBalance }).eq('id', creditAccount.id)
      await supabase.from('credit_transactions').insert({
        credit_account_id: creditAccount.id, type: 'debit', amount: total_amount, balance_after: newBalance
      })
    }

    if (payment_method === 'deposit' && depositAccount) {
      const newBalance = Number(depositAccount.current_balance) - total_amount
      await supabase.from('deposit_accounts').update({ current_balance: newBalance }).eq('id', depositAccount.id)
      await supabase.from('deposit_transactions').insert({
        deposit_account_id: depositAccount.id, type: 'deposit_out', amount: total_amount, balance_after: newBalance, note: 'Chick booking payment'
      })
    }

    return success(res, { ...booking, items: enrichedItems }, 'Booking created, awaiting approval')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/bookings/code/:bookingCode', requireAuth, async (req, res) => {
  try {
    const { data, error: dbError } = await supabase
      .from('chick_bookings')
      .select('*, customers(name, phone), chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date)))')
      .eq('booking_code', req.params.bookingCode).single()

    if (dbError || !data) return error(res, 'Booking not found', 404)

    return success(res, data, 'Booking fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/bookings/scan-qr', requireAuth, requireRole('super_admin', 'admin', 'cashier'), async (req, res) => {
  try {
    const { qr_code } = req.body
    if (!qr_code) return error(res, 'qr_code is required')

    const { data, error: dbError } = await supabase
      .from('chick_bookings')
      .select('*, customers(name, phone), chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date)))')
      .eq('qr_code', qr_code).single()

    if (dbError || !data) return error(res, 'No booking found for this QR code', 404)
    return success(res, data, 'Booking found')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/bookings/:id/receipt', requireAuth, async (req, res) => {
  try {
    const { data, error: dbError } = await supabase
      .from('chick_bookings')
      .select('*, customers(name, phone), users:approved_by(name), chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date)))')
      .eq('id', req.params.id).single()

    if (dbError || !data) return error(res, 'Booking not found', 404)
      if (req.user.role === 'customer' && data.customer_id !== req.user.id) {
      return error(res, 'Unauthorized', 403)
    }
    return success(res, data, 'Receipt fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/bookings/:id', requireAuth, async (req, res) => {
  try {
    const { data, error: dbError } = await supabase
      .from('chick_bookings')
      .select('*, customers(name, phone), chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date)))')
      .eq('id', req.params.id).single()

    if (dbError || !data) return error(res, 'Booking not found', 404)
      if (req.user.role === 'customer' && data.customer_id !== req.user.id) {
      return error(res, 'Unauthorized', 403)
    }
    return success(res, data, 'Booking fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/bookings/:id/approve', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('id', id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (booking.booking_status !== 'pending_approval') return error(res, `Booking is already ${booking.booking_status}`)

    const { data: updated, error: dbError } = await supabase
      .from('chick_bookings').update({ booking_status: 'confirmed', approved_by: req.user.id }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not approve booking', 500)
    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'approve', entity_type: 'chick_booking', entity_id: id, old_value: booking, new_value: updated })
    return success(res, updated, 'Booking approved')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/bookings/:id/reject', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('id', id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (booking.booking_status !== 'pending_approval') return error(res, `Booking is already ${booking.booking_status}`)

    const { data: updated, error: dbError } = await supabase
      .from('chick_bookings').update({ booking_status: 'cancelled' }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not reject booking', 500)
    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'reject', entity_type: 'chick_booking', entity_id: id, old_value: booking, new_value: updated })
    return success(res, updated, 'Booking rejected')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})
router.put('/bookings/:id/confirm-transfer', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('id', id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (booking.payment_method !== 'transfer') return error(res, 'This booking was not created as a transfer payment')
    if (booking.payment_status === 'paid') return error(res, 'This booking is already marked as paid')

    const { data: updated, error: dbError } = await supabase
      .from('chick_bookings').update({ payment_status: 'paid' }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not confirm transfer', 500)
    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'confirm_transfer', entity_type: 'chick_booking', entity_id: id, old_value: booking, new_value: updated })
    return success(res, updated, 'Bank transfer confirmed, booking marked as paid')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/bookings/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('id', id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) return error(res, 'Unauthorized', 403)
    if (['collected', 'cancelled'].includes(booking.booking_status)) return error(res, `Booking is already ${booking.booking_status}`)

    const { data: updated, error: dbError } = await supabase
      .from('chick_bookings').update({ booking_status: 'cancelled' }).eq('id', id).select().single()

    if (dbError) return error(res, 'Could not cancel booking', 500)
    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'cancel', entity_type: 'chick_booking', entity_id: id, old_value: booking, new_value: updated })
    return success(res, updated, 'Booking cancelled')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/bookings/:id/collect', requireAuth, requireRole('super_admin', 'admin', 'cashier'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('id', id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (booking.booking_status !== 'confirmed') return error(res, 'Booking must be confirmed before it can be collected')

    if (['online', 'transfer'].includes(booking.payment_method) && booking.payment_status !== 'paid') {
      return error(res, `${booking.payment_method === 'online' ? 'Online' : 'Bank transfer'} payment has not been confirmed yet`)
    }

    const { data: updated, error: dbError } = await supabase
        .from('chick_bookings')
        .update({
        booking_status: 'collected', payment_status: 'paid', collected_at: new Date(), collected_by: req.user.id,
        branch_id: booking.branch_id || req.user.branch_id || null
      })
      .eq('id', id).select().single()

    if (dbError) return error(res, 'Could not mark booking as collected', 500)
    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'collect', entity_type: 'chick_booking', entity_id: id, old_value: booking, new_value: updated })
    return success(res, updated, 'Booking collected')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})
router.get('/bookings/mine', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') return error(res, 'This endpoint is for customer accounts only', 403)

    const { data, error: dbError } = await supabase
      .from('chick_bookings')
      .select('*, chick_booking_items(*, chick_varieties(name), chick_delivery_schedules(delivery_date))')
      .eq('customer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (dbError) return error(res, 'Could not fetch bookings', 500)
    return success(res, data, 'Your bookings fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

export default router