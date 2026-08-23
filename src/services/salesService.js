import api from './api'

export const createSale = async (saleData) => {
  const response = await api.post('/api/sales', saleData)
  return response.data
}

export const confirmCashPayment = async (saleId, amount) => {
  const response = await api.post('/api/payments/cash', { sale_id: saleId, amount_paid: amount })
  return response.data
}

export const confirmTransferPayment = async (saleId) => {
  const response = await api.post('/api/payments/transfer/confirm', { sale_id: saleId })
  return response.data
}

export const confirmPOSPayment = async (saleId) => {
  const response = await api.post('/api/payments/pos/confirm', { sale_id: saleId })
  return response.data
}

export const confirmDepositPayment = async (saleId, amount) => {
  const response = await api.post('/api/payments/deposit/confirm', { sale_id: saleId, amount })
  return response.data
}

export const createCreditSale = async (saleData) => {
  const response = await api.post('/api/sales', { ...saleData, payment_method: 'credit' })
  return response.data
}