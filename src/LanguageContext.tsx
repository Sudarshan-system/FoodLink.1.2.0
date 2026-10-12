import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import kn from './locales/kn.json';

export type LanguageCode = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'gu' | 'kn';

export interface LanguageOption {
  code: LanguageCode;
  shortCode: string;
  label: string;
  nativeLabel: string;
  flag?: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', shortCode: 'EN', label: 'English', nativeLabel: 'English', flag: '🇮🇳' },
  { code: 'hi', shortCode: 'HI', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', shortCode: 'MR', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', shortCode: 'TA', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', shortCode: 'TE', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', shortCode: 'BN', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu', shortCode: 'GU', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', shortCode: 'KN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en,
  hi,
  mr,
  ta,
  te,
  bn,
  gu,
  kn,
};

const VALID_CODES = new Set<LanguageCode>(['en', 'hi', 'mr', 'ta', 'te', 'bn', 'gu', 'kn']);

export interface TranslationContextType {
  language: LanguageCode;
  currentLanguage: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallbackOrVars?: string | Record<string, string | number>, vars?: Record<string, string | number>) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<TranslationContextType>({
  language: 'en',
  currentLanguage: 'en',
  setLanguage: () => {},
  t: (key: string, fallbackOrVars?: string | Record<string, string | number>) =>
    typeof fallbackOrVars === 'string' ? fallbackOrVars : key,
  languages: LANGUAGES,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('foodlink_lang') as LanguageCode;
      if (saved && VALID_CODES.has(saved)) {
        return saved;
      }
    } catch {
      // Storage access blocked in restricted iframe
    }
    return 'en';
  });

  // Synchronize document.documentElement.lang with chosen language
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (!VALID_CODES.has(lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem('foodlink_lang', lang);
    } catch {
      // Storage access may fail in restricted iframes
    }
  }, []);

  const t = useCallback(
    (
      key: string,
      fallbackOrVars?: string | Record<string, string | number>,
      vars?: Record<string, string | number>
    ): string => {
      let fallbackText = '';
      let variables: Record<string, string | number> | undefined;

      if (typeof fallbackOrVars === 'string') {
        fallbackText = fallbackOrVars;
        variables = vars;
      } else if (typeof fallbackOrVars === 'object' && fallbackOrVars !== null) {
        variables = fallbackOrVars;
      }

      const activeDict = TRANSLATIONS[language];
      let translated = activeDict ? activeDict[key] : undefined;

      // Fallback to English if translation is missing in the chosen language
      if (!translated) {
        translated = TRANSLATIONS.en[key];
      }

      // If still missing, use provided fallback or the key itself
      let result = translated || fallbackText || key;

      // Interpolate variables if supplied (e.g. {count})
      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return result;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        currentLanguage: language,
        setLanguage,
        t,
        languages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
export const useLanguage = () => useContext(LanguageContext);
