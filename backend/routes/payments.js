import express from 'express'
import supabase from '../lib/supabase.js'
import { success, error } from '../lib/helpers.js'
import { requireAuth } from '../lib/middleware.js'

const router = express.Router()
router.use(requireAuth)

async function confirmPayment(req, res, expectedMethod) {
  try {
    if (!['super_admin', 'admin', 'cashier'].includes(req.user.role)) {
      return error(res, 'Unauthorized', 403)
    }
    const { sale_id, reference, amount_paid } = req.body
    if (!sale_id) return error(res, 'sale_id is required')

    const { data: sale } = await supabase.from('sales').select('*').eq('id', sale_id).single()
    if (!sale) return error(res, 'Sale not found', 404)
    if (sale.payment_method !== expectedMethod) return error(res, `This sale was not created as a ${expectedMethod} sale`)
    if (sale.payment_status === 'paid') return error(res, 'This sale has already been paid')

    const paidAmount = expectedMethod === 'cash' ? amount_paid : sale.total_amount
    if (expectedMethod === 'cash') {
      if (!amount_paid) return error(res, 'amount_paid is required')
      if (Number(amount_paid) < Number(sale.total_amount)) return error(res, 'amount_paid is less than the sale total')
    }

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        sale_id, amount: sale.total_amount, payment_method: expectedMethod,
        reference: reference || null, confirmed_by: req.user.id
      })
      .select().single()

    if (payErr) return error(res, 'Could not record payment', 500)

    const changeGiven = expectedMethod === 'cash' ? Number(amount_paid) - Number(sale.total_amount) : 0

    const { error: saleErr } = await supabase
      .from('sales')
      .update({ amount_paid: paidAmount, change_given: changeGiven, payment_status: 'paid' })
      .eq('id', sale_id)

    if (saleErr) return error(res, 'Could not update sale', 500)

    const { data: receipt, error: receiptErr } = await supabase
      .from('sales')
      .select('*, branches(name, address, phone), customers(name, phone), users:cashier_id(name), sale_items(*, products(name, unit_of_measurement)))')
      .eq('id', sale_id).single()

    if (receiptErr) return error(res, 'Payment confirmed but could not load receipt', 500)

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'confirm_payment', entity_type: 'payment', entity_id: payment.id, new_value: payment })

    return success(res, { payment, sale: receipt }, 'Payment confirmed')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
}

router.post('/cash', (req, res) => confirmPayment(req, res, 'cash'))
router.post('/transfer/confirm', (req, res) => confirmPayment(req, res, 'transfer'))
router.post('/pos/confirm', (req, res) => confirmPayment(req, res, 'pos'))
import axios from 'axios'

router.post('/online/initialize', async (req, res) => {
  try {
    const { booking_id } = req.body
    if (!booking_id) return error(res, 'booking_id is required')

    const { data: booking } = await supabase.from('chick_bookings').select('*, customers(email)').eq('id', booking_id).single()
    if (!booking) return error(res, 'Booking not found', 404)
    if (!booking.customers?.email) return error(res, 'Customer has no email on file — required for online payment')
    if (booking.payment_status === 'paid') return error(res, 'This booking is already paid')

    const paystackRes = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: booking.customers.email,
      amount: Math.round(Number(booking.total_amount) * 100)
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
    })

    const { authorization_url, reference } = paystackRes.data.data
    await supabase.from('chick_bookings').update({ paystack_reference: reference }).eq('id', booking_id)

    return success(res, { authorization_url, reference }, 'Payment initialized')
  } catch (err) {
    return error(res, 'Could not initialize payment', 500)
  }
})

router.post('/online/verify', async (req, res) => {
  try {
    const { reference } = req.body
    if (!reference) return error(res, 'reference is required')

    const paystackRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    })

    if (paystackRes.data.data.status !== 'success') {
      return error(res, 'Payment was not successful')
    }

    const { data: booking } = await supabase.from('chick_bookings').select('*').eq('paystack_reference', reference).single()
    if (!booking) return error(res, 'No booking found for this payment reference', 404)

    const { data: updated, error: dbError } = await supabase
      .from('chick_bookings').update({ payment_status: 'paid' }).eq('id', booking.id).select().single()

    if (dbError) return error(res, 'Could not update booking', 500)
    return success(res, updated, 'Payment verified, booking marked as paid')
  } catch (err) {
    return error(res, 'Could not verify payment', 500)
  }
})
export default router