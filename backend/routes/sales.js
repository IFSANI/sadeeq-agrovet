import express from 'express'
import supabase from '../lib/supabase.js'
import { success, error } from '../lib/helpers.js'
import { requireAuth, requireRole } from '../lib/middleware.js'

const router = express.Router()
router.use(requireAuth)
router.use(requireRole('super_admin', 'admin', 'cashier'))

router.get('/today', async (req, res) => {
  try {
    let { branch } = req.query
    if (req.user.role !== 'super_admin') branch = req.user.branch_id

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    let query = supabase
      .from('sales')
      .select('*, customers(name, phone), sale_items(*, products(name)))')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })

    if (branch) query = query.eq('branch_id', branch)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch today\'s sales', 500)
    return success(res, data, 'Today\'s sales fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/', async (req, res) => {
  try {
    let { branch, status, from, to, customer } = req.query
    if (req.user.role !== 'super_admin') branch = req.user.branch_id

    let query = supabase
      .from('sales')
      .select('*, customers(name, phone), branches(name), users:cashier_id(name)')
      .order('created_at', { ascending: false })

    if (branch) query = query.eq('branch_id', branch)
    if (status) query = query.eq('status', status)
    if (customer) query = query.eq('customer_id', customer)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error: dbError } = await query
    if (dbError) return error(res, 'Could not fetch sales', 500)
    return success(res, data, 'Sales fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.post('/', async (req, res) => {
  try {
    let { branch_id, customer_id, payment_method, items, offline_id, amount_paid_now, payment_method_now, deposit_amount_used } = req.body

    if (!branch_id) return error(res, 'branch_id is required')
    if (req.user.role !== 'super_admin') branch_id = req.user.branch_id
    if (!payment_method) return error(res, 'payment_method is required')
    if (!Array.isArray(items) || items.length === 0) return error(res, 'items array is required')
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.unit_price === undefined) {
        return error(res, 'Each item needs product_id, quantity and unit_price')
      }
    }

    const total_amount = items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unit_price)), 0)

    if (['credit', 'split', 'deposit'].includes(payment_method) && !customer_id) {
      return error(res, 'customer_id is required for credit, split and deposit sales')
    }
    if (payment_method === 'split') {
      if (!amount_paid_now || amount_paid_now <= 0) return error(res, 'amount_paid_now is required for split sales')
      if (!['cash', 'transfer', 'pos'].includes(payment_method_now)) return error(res, 'payment_method_now must be cash, transfer or pos')
    }
    if (payment_method === 'deposit') {
      if (!deposit_amount_used || deposit_amount_used <= 0) return error(res, 'deposit_amount_used is required for deposit sales')
      if (Number(deposit_amount_used) < total_amount) {
        if (!amount_paid_now || amount_paid_now <= 0) return error(res, 'amount_paid_now is required when the deposit does not cover the full total')
        if (!['cash', 'transfer', 'pos'].includes(payment_method_now)) return error(res, 'payment_method_now must be cash, transfer or pos')
      }
    }

    if (offline_id) {
      const { data: existingSale } = await supabase.from('sales').select('*, sale_items(*)').eq('offline_id', offline_id).maybeSingle()
      if (existingSale) return success(res, existingSale, 'Sale already recorded')
    }

    for (const item of items) {
      const { data: stockRow } = await supabase.from('stock').select('quantity').eq('branch_id', branch_id).eq('product_id', item.product_id).single()
      if (!stockRow || Number(stockRow.quantity) < Number(item.quantity)) {
        return error(res, `Insufficient stock for product ${item.product_id}`)
      }
    }

    let creditAccount = null
    let creditPortion = total_amount
    if (payment_method === 'split') creditPortion = total_amount - Number(amount_paid_now)

    if (['credit', 'split'].includes(payment_method)) {
      const { data: account } = await supabase.from('credit_accounts').select('*').eq('customer_id', customer_id).maybeSingle()
      if (!account) return error(res, 'Customer has no credit account')
      if (account.status !== 'active') return error(res, 'Customer credit account is suspended')
      if (Number(account.current_balance) + creditPortion > Number(account.credit_limit)) {
        return error(res, 'This sale would exceed the customer\'s credit limit')
      }
      creditAccount = account
    }

    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        branch_id,
        cashier_id: req.user.id,
        customer_id: customer_id || null,
        payment_method,
        payment_method_now: ['split', 'deposit'].includes(payment_method) ? (payment_method_now || null) : null,
        deposit_amount_used: payment_method === 'deposit' ? deposit_amount_used : null,
        total_amount,
        amount_paid: payment_method === 'credit' ? total_amount : (['split', 'deposit'].includes(payment_method) ? (amount_paid_now || null) : null),
        payment_status: payment_method === 'credit' ? 'paid' : 'pending',
        status: 'completed',
        sale_type: 'regular',
        offline_id: offline_id || null
      })
      .select().single()

    if (saleErr) {
      if (saleErr.code === '23505') return error(res, 'This sale was already recorded (duplicate offline_id)')
      return error(res, 'Could not create sale', 500)
    }

    const itemRows = items.map(i => ({
      sale_id: sale.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, subtotal: i.quantity * i.unit_price
    }))
    await supabase.from('sale_items').insert(itemRows)

    for (const item of items) {
      const { data: stockRow } = await supabase.from('stock').select('*').eq('branch_id', branch_id).eq('product_id', item.product_id).single()
      await supabase.from('stock').update({ quantity: Number(stockRow.quantity) - Number(item.quantity), updated_at: new Date() }).eq('id', stockRow.id)
    }

    if (['credit', 'split'].includes(payment_method) && creditAccount) {
      const newBalance = Number(creditAccount.current_balance) + creditPortion
      await supabase.from('credit_accounts').update({ current_balance: newBalance }).eq('id', creditAccount.id)
      await supabase.from('credit_transactions').insert({
        credit_account_id: creditAccount.id, type: 'debit', amount: creditPortion, sale_id: sale.id, balance_after: newBalance
      })
    }

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'create', entity_type: 'sale', entity_id: sale.id, new_value: sale })

    return success(res, { ...sale, items }, 'Sale created')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/:id/receipt', async (req, res) => {
  try {
    const { data: sale, error: dbError } = await supabase
      .from('sales')
      .select('*, branches(name, address, phone), customers(name, phone), users:cashier_id(name), sale_items(*, products(name, unit_of_measurement)))')
      .eq('id', req.params.id).single()

    if (dbError || !sale) return error(res, 'Sale not found', 404)
    return success(res, sale, 'Receipt fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data: sale, error: dbError } = await supabase
      .from('sales')
      .select('*, branches(name), customers(name, phone), sale_items(*, products(name)))')
      .eq('id', req.params.id).single()

    if (dbError || !sale) return error(res, 'Sale not found', 404)
    return success(res, sale, 'Sale fetched')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

router.put('/:id/void', requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { data: sale } = await supabase.from('sales').select('*, sale_items(*)').eq('id', id).single()
    if (!sale) return error(res, 'Sale not found', 404)
    if (sale.status === 'voided') return error(res, 'Sale is already voided')

    for (const item of sale.sale_items) {
      const { data: stockRow } = await supabase.from('stock').select('*').eq('branch_id', sale.branch_id).eq('product_id', item.product_id).maybeSingle()
      if (stockRow) {
        await supabase.from('stock').update({ quantity: Number(stockRow.quantity) + Number(item.quantity), updated_at: new Date() }).eq('id', stockRow.id)
      }
    }

    if (sale.payment_method === 'credit' && sale.customer_id) {
      const { data: account } = await supabase.from('credit_accounts').select('*').eq('customer_id', sale.customer_id).maybeSingle()
      if (account) {
        const newBalance = Number(account.current_balance) - Number(sale.total_amount)
        await supabase.from('credit_accounts').update({ current_balance: newBalance }).eq('id', account.id)
        await supabase.from('credit_transactions').insert({
          credit_account_id: account.id, type: 'credit', amount: sale.total_amount, sale_id: sale.id, balance_after: newBalance
        })
      }
    }

    const { data: updated, error: dbError } = await supabase.from('sales').update({ status: 'voided' }).eq('id', id).select().single()
    if (dbError) return error(res, 'Could not void sale', 500)

    await supabase.from('audit_logs').insert({ user_id: req.user.id, action: 'void', entity_type: 'sale', entity_id: id, old_value: sale, new_value: updated })
    return success(res, updated, 'Sale voided, stock and credit restored')
  } catch (err) {
    return error(res, 'Server error', 500)
  }
})

export default router