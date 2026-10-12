import React from 'react';
import { useTheme } from './ThemeContext';

interface NotFoundPageProps {
  onNavigateHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigateHome }) => {
  const { isDark } = useTheme();

  return (
    <div className="site-container py-16 sm:py-24 flex flex-col items-center justify-center text-center min-h-[50vh]">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${
          isDark
            ? 'bg-[#18241C] border-[#2D4436] text-[#2E7D4F]'
            : 'bg-[#EAF3EC] border-[#D9E2DA] text-[#2E7D4F]'
        }`}
      >
        <span className="material-symbols-outlined text-[36px]">search_off</span>
      </div>

      <span className="text-xs uppercase tracking-wider font-bold text-[#D9822B] mb-2">
        Error 404
      </span>

      <h1
        className={`font-serif text-3xl sm:text-4xl font-bold mb-3 ${
          isDark ? 'text-[#FAFBF8]' : 'text-[#1E2A22]'
        }`}
      >
        Page not found
      </h1>

      <p
        className={`text-base max-w-[45ch] mb-8 leading-relaxed ${
          isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'
        }`}
      >
        The page you are looking for does not exist or may have been moved.
      </p>

      <button
        type="button"
        onClick={onNavigateHome}
        className="px-6 py-3 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">home</span>
        <span>Back to Home</span>
      </button>
    </div>
  );
};
