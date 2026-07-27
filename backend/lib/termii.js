import axios from 'axios'

export async function sendSMS(phone, message) {
  try {
    await axios.post('https://api.ng.termii.com/api/sms/send', {
      to: phone,
      from: 'Sadeeq',
      sms: message,
      type: 'plain',
      api_key: process.env.TERMII_API_KEY,
      channel: 'generic'
    })
    return true
  } catch (err) {
    console.error('Termii SMS error:', err.response?.data || err.message)
    return false
  }
}