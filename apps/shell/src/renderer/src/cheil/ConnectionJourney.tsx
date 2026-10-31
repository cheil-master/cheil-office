/** Cheil fork: official program authentication only; SSO remains the vendor's flow. */
import type { SubscriptionConnection } from '../subscription-client'
export type ConnectionFlow = 'detect' | 'personal' | 'company' | 'api'
export function ConnectionJourney({
  flow,
  onChange,
  connection,
}: {
  flow: ConnectionFlow
  onChange: (flow: ConnectionFlow) => void
  connection: SubscriptionConnection
}) {
  const descriptions = {
    detect:
      '이 PC의 Claude Code·Codex 연결을 확인합니다. 브라우저 쿠키나 로그인 파일을 가져오지 않습니다.',
    personal:
      '개인 구독 계정으로 연결합니다. 아래 프로그램 카드에서 설치·로그인을 진행하세요. 웹 로그인 상태에 따라 공식 인증 화면에서 추가 입력을 줄일 수 있습니다.',
    company:
      '회사 계정·SSO는 아래 제공자의 공식 로그인에서 진행합니다. 조직과 사용 권한을 확인하세요. 관리자 승인이나 좌석 권한이 없으면 로그인이 되어도 사용할 수 없습니다. 이 앱은 SSO 인증서나 회사 비밀번호를 받지 않습니다.',
    api: 'API 키를 등록합니다. 웹 채팅 구독과 별도 이용 권한·요금이 적용될 수 있습니다. 여러 제공자의 키를 함께 보관할 수 있습니다.',
  }
  return (
    <section className="cheil-connection-journey">
      <h4>어떤 방식으로 연결할까요?</h4>
      <div className="cheil-connect-routes" role="group" aria-label="AI 연결 방법">
        {(['detect', 'personal', 'company', 'api'] as const).map((id, i) => (
          <button
            key={id}
            className="set-btn"
            aria-pressed={flow === id}
            onClick={() => onChange(id)}
          >
            {['기존 로그인 감지', '개인 구독 계정', '회사 계정·SSO', 'API 키'][i]}
          </button>
        ))}
      </div>
      <p>{descriptions[flow]}</p>
      {flow === 'detect' && (
        <button
          className="set-btn"
          disabled={connection.busy}
          onClick={() => {
            connection.recheck('claude-code')
            connection.recheck('codex')
          }}
        >
          기존 연결 다시 확인
        </button>
      )}
      <p>기존 로그인 감지 → 공식 인증 또는 키 등록 → 연결 상태 확인 → 기본 AI 선택</p>
    </section>
  )
}
