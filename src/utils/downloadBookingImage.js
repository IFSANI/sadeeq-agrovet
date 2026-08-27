import QRCodeLib from 'qrcode'

export async function downloadBookingImage(booking) {
  const items = booking.items || booking.chick_booking_items || []
  const qrDataUrl = await QRCodeLib.toDataURL(booking.booking_code, { width: 300, margin: 1 })

  const qrImg = new Image()
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve
    qrImg.onerror = reject
    qrImg.src = qrDataUrl
  })

  const width = 500
  const lineHeight = 24
  const itemsHeight = items.length * (lineHeight * 2)
  const height = 420 + itemsHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#15803d'
  ctx.fillRect(0, 0, width, 70)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('SADEEQ AGROVET', width / 2, 35)
  ctx.font = '13px sans-serif'
  ctx.fillText('Chick Booking', width / 2, 55)

  let y = 100
  ctx.textAlign = 'left'
  ctx.font = 'bold 18px monospace'
  ctx.fillStyle = '#1f2937'
  ctx.fillText(booking.booking_code || '', 24, y)

  ctx.textAlign = 'right'
  ctx.font = '13px sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText((booking.booking_status || '').replace('_', ' ').toUpperCase(), width - 24, y)
  ctx.textAlign = 'left'

  y += 28
  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(width - 24, y); ctx.stroke()
  y += 26

  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = '#374151'
  ctx.fillText('Items', 24, y)
  y += 22

  items.forEach((i) => {
    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#1f2937'
    ctx.fillText(i.chick_varieties?.name || 'Chicks', 24, y)
    ctx.textAlign = 'right'
    ctx.fillText(`${i.cartons || 0} carton(s), ${i.pieces || 0} pc`, width - 24, y)
    ctx.textAlign = 'left'
    y += lineHeight
    if (i.chick_delivery_schedules?.delivery_date) {
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText(
        `Arriving ${new Date(i.chick_delivery_schedules.delivery_date).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`,
        24, y
      )
      y += lineHeight
    }
  })

  y += 4
  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(width - 24, y); ctx.stroke()
  y += 26

  ctx.font = '13px sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('Payment Method', 24, y)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#1f2937'
  ctx.fillText((booking.payment_method || '').toUpperCase(), width - 24, y)
  ctx.textAlign = 'left'
  y += 22

  if (booking.payment_status) {
    ctx.fillStyle = '#6b7280'
    ctx.fillText('Payment Status', 24, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = booking.payment_status === 'paid' ? '#16a34a' : '#ca8a04'
    ctx.fillText(booking.payment_status.toUpperCase(), width - 24, y)
    ctx.textAlign = 'left'
    y += 22
  }

  if (booking.total_amount) {
    ctx.fillStyle = '#6b7280'
    ctx.fillText('Total', 24, y)
    ctx.textAlign = 'right'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillStyle = '#15803d'
    ctx.fillText(`₦${Number(booking.total_amount).toLocaleString()}`, width - 24, y)
    ctx.textAlign = 'left'
    y += 26
  }

  y += 10
  const qrSize = 160
  ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize)
  y += qrSize + 20

  ctx.textAlign = 'center'
  ctx.font = '11px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText('Show this image at pickup, even without internet', width / 2, y)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('canvas export failed')); return }
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `booking-${booking.booking_code}.png`
      link.click()
      URL.revokeObjectURL(link.href)
      resolve()
    })
  })
}