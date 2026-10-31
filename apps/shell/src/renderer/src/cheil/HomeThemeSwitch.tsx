/** Cheil fork: persist the same theme preference used by Settings. */
import { useEffect, useState } from 'react'
import type { UiTheme } from '../../../shared/home-api'
import { useI18n } from '../locale'
export function HomeThemeSwitch() {
  const { t } = useI18n()
  const [theme, setTheme] = useState<UiTheme>('system')
  useEffect(() => {
    let live = true
    void window.aiOffice.getTheme().then((value) => {
      if (live) setTheme(value)
    })
    const off = window.aiOffice.onThemeChanged(setTheme)
    return () => {
      live = false
      off()
    }
  }, [])
  return (
    <div className="cheil-theme-switch" role="group" aria-label={t('theme')}>
      {(['light', 'dark', 'system'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => {
            void window.aiOffice.setTheme(value)
          }}
          data-testid={'cheil-theme-' + value}
        >
          {t(value === 'light' ? 'themeLight' : value === 'dark' ? 'themeDark' : 'themeSystem')}
        </button>
      ))}
    </div>
  )
}
