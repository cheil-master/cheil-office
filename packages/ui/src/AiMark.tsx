export interface AiMarkProps {
  size?: number
  className?: string
}

/**
 * Neutral mark for the AI entry points (ribbon button, panel header, launcher
 * chips): document lines with a four-point action mark. It names no AI
 * vendor, so it stays correct whichever provider the user has connected.
 *
 * Drawn inline with `currentColor` so it follows the surrounding text color in
 * both themes and stays crisp at device resolution. The reference drawing is
 * apps/shell/build/brand/ai-mark.svg; keep the two in sync.
 */
export function AiMark({ size = 18, className }: AiMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Cheil fork: document lines and a separate four-point action mark. */}
      <path d="M5 4h9M5 9h6M5 14h4M5 19h9" />
      <path d="m17 7 1.6 4.4L23 13l-4.4 1.6L17 19l-1.6-4.4L11 13l4.4-1.6z" />
    </svg>
  )
}
