import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';

export const CookieNotice: React.FC = () => {
  const { isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const preference = localStorage.getItem('foodlink_cookie_preference');
    if (!preference) {
      // Delay showing slightly so it does not distract during initial render
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (type: 'all' | 'essential') => {
    localStorage.setItem('foodlink_cookie_preference', type);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className={`fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-32px)] p-4 rounded-xl border shadow-lg transition-all ${
        isDark
          ? 'bg-[#18241C] border-[#2D4436] text-[#FAFBF8]'
          : 'bg-[#FFFFFF] border-[#D9E2DA] text-[#1E2A22]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-[#2E7D4F] shrink-0 mt-0.5">
          cookie
        </span>
        <div className="flex-1 text-xs">
          <p className="font-semibold text-sm mb-1">We value your privacy</p>
          <p className={`leading-relaxed ${isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}`}>
            We use essential cookies to keep your session secure and optional cookies to improve food dispatch routing.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChoice('all')}
              className="px-3 py-1.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleChoice('essential')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#2D4436] text-[#D1DDD5] hover:bg-[#203026]'
                  : 'border-[#D9E2DA] text-[#526357] hover:bg-[#EAF3EC] hover:text-[#1E2A22]'
              }`}
            >
              Essential only
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
