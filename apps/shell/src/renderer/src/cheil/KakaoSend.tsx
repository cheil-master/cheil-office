/** Cheil fork: opt-in Kakao self-chat connection and editable send preview. */
import { useState } from 'react'
import type { Lang } from '@genoffice/i18n'
import type { WikiReply, WikiRequest } from '../../../shared/cheil-wiki-api'
import { OptionsDialog } from './OptionsDialog'
export function KakaoSend({
  lang,
  call,
  text,
}: {
  lang: Lang
  call: (req: WikiRequest) => Promise<WikiReply>
  text?: string
}) {
  const ko = lang === 'ko'
  const label = ko ? '카카오톡 나에게 보내기' : 'Send to KakaoTalk'
  const [open, setOpen] = useState(false),
    [connected, setConnected] = useState(false),
    [token, setToken] = useState(''),
    [message, setMessage] = useState(text ?? ''),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('')
  async function openDialog() {
    setMessage(text ?? '')
    setStatus('')
    setOpen(true)
    const r = await call({ op: 'kakaoStatus' })
    setConnected(r.ok && !!r.kakaoConnected)
  }
  async function connect() {
    setBusy(true)
    setStatus('')
    try {
      const r = await call({ op: 'kakaoConnect', token })
      setToken('')
      setConnected(r.ok)
      setStatus(
        r.ok
          ? ko
            ? '연결되었습니다.'
            : 'Connected.'
          : ko
            ? '연결하지 못했습니다. 일회용 정보를 다시 확인하세요.'
            : 'Connection failed. Check the one-time token.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function send() {
    setBusy(true)
    setStatus('')
    try {
      const r = await call({ op: 'kakaoSend', text: message, approved: true })
      setStatus(
        r.ok
          ? ko
            ? '나와의 채팅으로 보냈습니다.'
            : 'Sent to your chat.'
          : ko
            ? '전송하지 못했습니다. 연결과 나챗방 도구를 확인하세요.'
            : 'Send failed. Check your connection and tool.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => void openDialog()}>
        {text ? label : ko ? '카카오톡 연결' : 'Connect KakaoTalk'}
      </button>
      <OptionsDialog
        open={open}
        title={label}
        onClose={() => {
          if (!busy) {
            setOpen(false)
            setToken('')
          }
        }}
      >
        {!connected && (
          <div className="cheil-wiki-import">
            <p>
              {ko
                ? 'PlayMCP 도구함에서 카카오톡 나챗방을 추가한 뒤 ‘OpenClaw와 연결’을 눌러 생성한 일회용 연결 정보를 입력하세요. OpenClaw 설치는 필요 없습니다.'
                : 'Add KakaoTalk self-chat to your PlayMCP toolbox. Generate a one-time connection token using “Connect with OpenClaw”; installing OpenClaw is not required.'}
            </p>
            <label>
              {ko ? '일회용 연결 정보' : 'One-time connection token'}
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || !token.trim()}
              onClick={() => void connect()}
            >
              {ko ? '연결하기' : 'Connect'}
            </button>
          </div>
        )}
        {connected && <p>{ko ? '카카오 나챗방 연결됨' : 'Kakao self-chat connected'}</p>}
        {connected && text && (
          <>
            <label>
              {ko ? '보낼 내용 확인 및 수정' : 'Review and edit message'}
              <textarea
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
              />
            </label>
            <p>
              {ko
                ? '200자까지 전송할 수 있습니다. 이 내용이 카카오톡 나와의 채팅으로 전송됩니다.'
                : 'Up to 200 characters can be sent to your KakaoTalk self-chat.'}
            </p>
            <button
              className="btn btn-primary"
              disabled={busy || !message.trim() || message.length > 200}
              onClick={() => void send()}
            >
              {ko ? '나에게 보내기' : 'Send to myself'}
            </button>
          </>
        )}
        {status && <p role="status">{status}</p>}
      </OptionsDialog>
    </>
  )
}
