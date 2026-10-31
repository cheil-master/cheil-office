/** Cheil fork: QR generation and export run entirely on this PC. */
export type QrRequest =
  | { op: 'preview' | 'copy'; text: string; size: number }
  | { op: 'save'; text: string; size: number; format: 'png' | 'svg' }
export type QrReply =
  | { ok: true; png?: string; canceled?: boolean }
  | { ok: false; reason: 'invalid' | 'failed' | 'busy' }
export interface CheilQrApi {
  request(req: QrRequest): Promise<QrReply>
}
export const CHEIL_QR_CHANNEL = 'cheil:qr'
export const CHEIL_QR_BRIDGE = 'aiOfficeCheilQr'
