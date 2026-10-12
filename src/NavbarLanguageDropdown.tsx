import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, LANGUAGES, LanguageCode } from './LanguageContext';

interface NavbarLanguageDropdownProps {
  className?: string;
  align?: 'left' | 'right';
}

export const NavbarLanguageDropdown: React.FC<NavbarLanguageDropdownProps> = ({
  className = '',
  align = 'right',
}) => {
  const { language, setLanguage, languages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = languages.find((l) => l.code === language) || LANGUAGES[0];

  // Close dropdown on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger: Shows short code (EN, HI, MR...) and globe icon */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language (currently ${activeOption.label})`}
        className="h-9 px-2.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs font-bold text-xs"
        title={`Language: ${activeOption.label} (${activeOption.nativeLabel})`}
      >
        <span className="material-symbols-outlined text-[17px] text-[#059669] dark:text-[#34D399]">
          translate
        </span>
        <span className="tracking-wide font-extrabold">{activeOption.shortCode}</span>
        <span className={`material-symbols-outlined text-[15px] text-[#4B6356] dark:text-[#B2CDC0] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available Languages"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-52 bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-2xl shadow-xl py-1.5 z-50 animate-fadeIn`}
        >
          <div className="px-3 py-1.5 border-b border-[#D1E3D7]/60 dark:border-[#244535]/60 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#4B6356] dark:text-[#8AA897]">
              Select Language
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-0.5 space-y-0.5">
            {languages.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLanguage(item.code)}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer min-h-[38px] ${
                    isSelected
                      ? 'bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                      : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#F4FAF6] dark:hover:bg-[#15271E]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">
                      {item.nativeLabel}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {item.shortCode}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="material-symbols-outlined text-[17px] text-[#059669] dark:text-[#34D399] shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
