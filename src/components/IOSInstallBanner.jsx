import { useState, useEffect } from 'react'
import { Share2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return window.navigator.standalone === true
}

/**
 * Banner shown to iOS users guiding them to add the app to their home screen.
 * Only shown once — dismissed state stored in localStorage.
 */
export default function IOSInstallBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isIOS() && !isInStandaloneMode() && !localStorage.getItem('ios_banner_dismissed')) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem('ios_banner_dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
      <div className="bg-ink2 text-white rounded-xl p-4 shadow-xl flex items-start gap-3">
        <Share2 size={24} className="text-orange shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-base">{t('pwa.ios_install_title')}</p>
          <p className="text-sm text-white/70 mt-1">{t('pwa.ios_install_hint')}</p>
        </div>
        <button
          onClick={dismiss}
          className="p-1 text-white/60 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  )
}
