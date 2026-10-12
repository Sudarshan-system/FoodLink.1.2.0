import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also check if running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setShowBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install FoodLink on your device:\n• On Android (Chrome): Tap the three-dot menu and select "Install app" or "Add to Home screen".\n• On iOS (Safari): Tap the Share button and select "Add to Home Screen".'
      );
    }
  };

  if (!showBanner || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-white dark:bg-[#112019] border-2 border-[#059669] shadow-2xl animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[22px]">phone_iphone</span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5]">
              {t('installApp', 'Install Mobile App')}
            </h4>
            <p className="text-[11px] text-[#526357] dark:text-[#95A89C] leading-snug">
              {t('pwaBanner', 'Add FoodLink to your home screen for rapid courier dispatch and kitchen alerts.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-[#D1E3D7] dark:border-[#244535]">
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Maybe Later
        </button>
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-4 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[15px]">download</span>
          <span>Install Now</span>
        </button>
      </div>
    </div>
  );
};
