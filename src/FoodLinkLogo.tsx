import React from 'react';
import { useTheme } from './ThemeContext';

interface FoodLinkLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

export const FoodLinkLogo: React.FC<FoodLinkLogoProps> = ({
  variant = 'compact',
  size = 'md',
  className = '',
  showSubtitle = false,
}) => {
  const { isDark } = useTheme();

  // Size mapping for the icon mark
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8 sm:w-9 sm:h-9',
    lg: 'w-10 h-10 sm:w-11 sm:h-11',
    xl: 'w-12 h-12 sm:w-14 sm:h-14',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[22px]',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Bespoke Vector Mark: Interlocking circular leaf & warm nourishing bowl */}
      <div className={`relative ${iconSizes[size]} shrink-0 transition-transform hover:scale-105 duration-200`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
          aria-hidden="true"
        >
          <defs>
            {/* Emerald Life Gradient */}
            <linearGradient id="flEmeraldVibrant" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Warm Harvest Gold Gradient */}
            <linearGradient id="flAmberWarm" x1="14" y1="20" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            {/* Fresh Sprout Leaf Gradient */}
            <linearGradient id="flSproutFresh" x1="18" y1="8" x2="34" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {/* Squircle Badge Background */}
          <rect
            x="2"
            y="2"
            width="44"
            height="44"
            rx="14"
            fill={isDark ? '#064E3B' : '#ECFDF5'}
            fillOpacity={isDark ? '0.45' : '1'}
            stroke={isDark ? '#059669' : '#A7F3D0'}
            strokeWidth="1.5"
          />

          {/* Nourishing Bowl Base (Representing shared meals, community kitchens) */}
          <path
            d="M11 25C11 32.5 16.8 36.5 24 36.5C31.2 36.5 37 32.5 37 25H11Z"
            fill="url(#flAmberWarm)"
          />

          {/* Bowl Rim Highlight */}
          <path
            d="M11 25C11 24.17 12 23.5 13.5 23.5H34.5C36 23.5 37 24.17 37 25C37 25.83 36 26.5 34.5 26.5H13.5C12 26.5 11 25.83 11 25Z"
            fill="#FEF3C7"
            fillOpacity="0.85"
          />

          {/* Rising Living Leaf / Sprout (Left Wing) */}
          <path
            d="M24 10C24 10 20 16 14 19.5C19 21.5 27 20 29.5 14C30.5 11.5 27.5 10 24 10Z"
            fill="url(#flSproutFresh)"
          />

          {/* Rising Interlocking Leaf (Right Wing) */}
          <path
            d="M24 10C24 10 26.5 16.5 33 18.5C29 21.5 21.5 21 19 17C17.5 13.5 20 10 24 10Z"
            fill="url(#flEmeraldVibrant)"
          />

          {/* Central Stem Line */}
          <path
            d="M24 12V24"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {/* Nourishing Warmth Spark / Golden Sun dot */}
          <circle cx="24" cy="7.5" r="2.5" fill="#F59E0B" />
        </svg>
      </div>

      {/* Typography: Humanist Editorial & Modern Sans pairing */}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline">
            <span
              className={`font-serif font-black tracking-tight ${textSizes[size]} ${
                isDark ? 'text-[#F4F8F5]' : 'text-[#0F1E17]'
              }`}
            >
              Food
            </span>
            <span
              className={`font-sans font-black tracking-tight ${textSizes[size]} text-[#059669] dark:text-[#34D399] ml-0.5`}
            >
              Link
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] ml-1 inline-block align-baseline"></span>
          </div>

          {(showSubtitle || variant === 'full') && (
            <span
              className={`text-[9.5px] uppercase tracking-widest font-bold mt-0.5 ${
                isDark ? 'text-[#A7F3D0]' : 'text-[#059669]'
              }`}
            >
              Surplus to Plate
            </span>
          )}
        </div>
      )}
    </div>
  );
};

