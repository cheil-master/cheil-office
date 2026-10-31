/** Cheil fork: bounded offline QR generation with a four-module quiet zone. */
import QRCode from 'qrcode'
export function qrInput(text: unknown, size: unknown): { text: string; size: number } {
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    Buffer.byteLength(text, 'utf8') > 1000 ||
    typeof size !== 'number' ||
    ![256, 512, 1024].includes(size)
  )
    throw Error('invalid')
  return { text, size }
}
export async function qrBytes(text: string, size: number, format: 'png' | 'svg') {
  qrInput(text, size)
  const options = { width: size, margin: 4, errorCorrectionLevel: 'M' as const }
  return format === 'svg'
    ? QRCode.toString(text, { ...options, type: 'svg' })
    : QRCode.toBuffer(text, options)
}
