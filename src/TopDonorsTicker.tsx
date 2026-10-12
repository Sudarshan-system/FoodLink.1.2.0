import React, { useState, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { useTranslation } from './LanguageContext';

export interface TopDonorItem {
  id: string;
  rank: number;
  name: string;
  organization: string;
  category: string;
  city: string;
  totalMeals: number;
  weightKg: number;
  tier: 'Diamond' | 'Gold' | 'Silver' | 'Bronze';
  medalEmoji: string;
  recentDonation: string;
  verified: boolean;
}

export const TOP_DONORS_DATA: TopDonorItem[] = [
  {
    id: 'donor_1',
    rank: 1,
    name: 'Chef Marcus Vance',
    organization: 'The Grand Bistro & Royal Banquet',
    category: 'Hotel & Banquet',
    city: 'Mumbai',
    totalMeals: 3450,
    weightKg: 1725,
    tier: 'Diamond',
    medalEmoji: '🏆',
    recentDonation: '75 meals hot biryani handoff today',
    verified: true,
  },
  {
    id: 'donor_2',
    rank: 2,
    name: 'Vikramaditya Oberoi',
    organization: 'Imperial Palace Convention & Caterers',
    category: 'Catering & Events',
    city: 'Bengaluru',
    totalMeals: 2890,
    weightKg: 1445,
    tier: 'Diamond',
    medalEmoji: '🥈',
    recentDonation: '120 meals South Indian feast yesterday',
    verified: true,
  },
  {
    id: 'donor_3',
    rank: 3,
    name: 'Chef Ananya Deshmukh',
    organization: 'Spice Route Contemporary Kitchens',
    category: 'Restaurant & Cafe',
    city: 'Pune',
    totalMeals: 2150,
    weightKg: 1075,
    tier: 'Gold',
    medalEmoji: '🥉',
    recentDonation: '50 meals paneer curry & rotis',
    verified: true,
  },
  {
    id: 'donor_4',
    rank: 4,
    name: 'Sunita Rao (Director)',
    organization: 'InfraTech Campus Corporate Dining',
    category: 'Corporate Kitchen',
    city: 'Hyderabad',
    totalMeals: 1820,
    weightKg: 910,
    tier: 'Gold',
    medalEmoji: '⭐',
    recentDonation: '65 meals steamed rice & sambar',
    verified: true,
  },
  {
    id: 'donor_5',
    rank: 5,
    name: 'Philippe & Aarav',
    organization: 'Artisan Sourdough & Patisserie Hub',
    category: 'Bakery & Sweets',
    city: 'New Delhi',
    totalMeals: 1480,
    weightKg: 740,
    tier: 'Silver',
    medalEmoji: '🥐',
    recentDonation: '80 packets multigrain bread buns',
    verified: true,
  },
  {
    id: 'donor_6',
    rank: 6,
    name: 'Rajesh & Kavita Singhal',
    organization: 'Golden Harvest Heritage Sweets & Thali',
    category: 'Restaurant & Cafe',
    city: 'Jaipur',
    totalMeals: 1250,
    weightKg: 625,
    tier: 'Silver',
    medalEmoji: '🍲',
    recentDonation: '40 meals Dal Baati Churma plates',
    verified: true,
  },
  {
    id: 'donor_7',
    rank: 7,
    name: 'Captain Harpreet Singh',
    organization: 'Langar Seva Community Kitchen Hall',
    category: 'Community Kitchen',
    city: 'Amritsar',
    totalMeals: 1100,
    weightKg: 550,
    tier: 'Silver',
    medalEmoji: '🌟',
    recentDonation: '90 meals hot khichdi & pickles',
    verified: true,
  },
  {
    id: 'donor_8',
    rank: 8,
    name: 'Rohan Kulkarni',
    organization: 'FreshHarvest Central Bakery & Cafe',
    category: 'Bakery & Cafe',
    city: 'Bengaluru',
    totalMeals: 980,
    weightKg: 490,
    tier: 'Bronze',
    medalEmoji: '🥗',
    recentDonation: '35 wholesome sandwich boxes',
    verified: true,
  },
  {
    id: 'donor_9',
    rank: 9,
    name: 'Meenakshi Sundaram',
    organization: 'Oberoi Sky Banquets & Convention',
    category: 'Hotel & Banquet',
    city: 'Chennai',
    totalMeals: 890,
    weightKg: 445,
    tier: 'Bronze',
    medalEmoji: '🎖️',
    recentDonation: '45 meal trays curd rice & rasam',
    verified: true,
  },
  {
    id: 'donor_10',
    rank: 10,
    name: 'Tarun Mathur',
    organization: 'GreenPlate Tech Park Cafeteria',
    category: 'Corporate Kitchen',
    city: 'Gurugram',
    totalMeals: 810,
    weightKg: 405,
    tier: 'Bronze',
    medalEmoji: '🍽️',
    recentDonation: '60 executive box lunches',
    verified: true,
  },
];

interface TopDonorsTickerProps {
  onNavigateLeaderboard?: () => void;
  onSelectDonor?: (donor: TopDonorItem) => void;
}

export const TopDonorsTicker: React.FC<TopDonorsTickerProps> = ({
  onNavigateLeaderboard,
  onSelectDonor,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Manual nudge step controls
  const handleScrollNudge = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (isMinimized) {
    return (
      <div className="w-full bg-[#EBF5EE] dark:bg-[#0D1A14] border-b border-[#D1E3D7] dark:border-[#1E3328] px-3 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#059669] dark:text-[#34D399] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#059669] dark:bg-[#34D399] animate-pulse"></span>
          <span>🏆 {t('ticker.title', 'TOP DONORS')}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="text-xs font-semibold text-[#059669] dark:text-[#34D399] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>{t('ticker.resume', 'Expand Ticker')}</span>
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Top Food Rescue Donors Live Ticker"
      className="w-full bg-gradient-to-r from-[#F0FDF4] via-[#F7FCF9] to-[#ECFDF5] dark:from-[#091510] dark:via-[#0F2018] dark:to-[#0A1712] border-b border-[#D1E3D7] dark:border-[#1B3528] shadow-xs relative overflow-hidden transition-colors"
    >
      <div className="site-container py-2 flex items-center gap-2 sm:gap-3">
        {/* Fixed Left Badge: Live Top Donors Title */}
        <div className="shrink-0 flex items-center gap-2 pr-2 sm:pr-3 border-r border-[#D1E3D7] dark:border-[#224032]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#059669] text-white shadow-xs">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span className="text-[11px] font-black tracking-wider uppercase flex items-center gap-1">
              <span>{t('ticker.title', 'TOP DONORS')}</span>
            </span>
          </div>

          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#4B6356] dark:text-[#9FBDB0] tracking-wide">
              {t('ticker.liveRescue', 'Live Hunger Rescue')}
            </span>
            <span className="text-[12px] font-extrabold text-[#0F1E17] dark:text-[#E6F4ED] leading-none">
              {t('ticker.mealsCount', '16,020+ Meals')}
            </span>
          </div>
        </div>

        {/* Rolling Marquee Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-hidden relative cursor-grab active:cursor-grabbing select-none"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Subtle gradient edges to make scroll feel cinematic */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-[#F0FDF4] dark:from-[#091510] to-transparent"></div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-[#ECFDF5] dark:to-transparent dark:from-[#0A1712]"></div>

          <div
            className={`animate-marquee flex items-center gap-3 sm:gap-4 py-0.5 ${
              isPaused ? 'marquee-paused' : ''
            }`}
          >
            {/* Repeat the list twice to create continuous seamless rolling */}
            {[...TOP_DONORS_DATA, ...TOP_DONORS_DATA].map((donor, idx) => {
              const isTop3 = donor.rank <= 3;
              const rankColor =
                donor.rank === 1
                  ? 'bg-amber-500 text-white'
                  : donor.rank === 2
                  ? 'bg-slate-400 text-white'
                  : donor.rank === 3
                  ? 'bg-amber-700 text-white'
                  : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300';

              return (
                <div
                  key={`${donor.id}-${idx}`}
                  onClick={() => {
                    if (onSelectDonor) onSelectDonor(donor);
                    else if (onNavigateLeaderboard) onNavigateLeaderboard();
                  }}
                  className={`shrink-0 flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs hover:scale-[1.02] hover:shadow-sm ${
                    isDark
                      ? 'bg-[#12221A] hover:bg-[#182C22] border-[#223E31] text-[#F4F8F5]'
                      : 'bg-white hover:bg-[#F4FAF6] border-[#DCE8E0] text-[#0F1E17]'
                  }`}
                  title={`Click to view ${donor.organization} on Leaderboard`}
                >
                  {/* Rank Badge */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${rankColor}`}
                  >
                    {donor.rank <= 3 ? donor.medalEmoji : `#${donor.rank}`}
                  </span>

                  {/* Donor Info */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold truncate max-w-[150px] sm:max-w-[190px]">
                        {donor.organization}
                      </span>
                      {donor.verified && (
                        <span
                          className="material-symbols-outlined text-[14px] text-[#059669] shrink-0"
                          title="FSSAI & Hygiene Verified Donor"
                        >
                          verified
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 hidden sm:inline">
                        • {donor.city}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-extrabold text-[#059669] dark:text-[#34D399]">
                        {donor.totalMeals.toLocaleString()} {t('ticker.meals', 'meals')}
                      </span>
                      <span className="text-slate-400 dark:text-slate-400">•</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {donor.weightKg.toLocaleString()} {t('ticker.kgRescued', 'kg rescued')}
                      </span>
                    </div>
                  </div>

                  {/* Tier / Recent Action Pill */}
                  <span
                    className={`hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      donor.tier === 'Diamond'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        : donor.tier === 'Gold'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                    }`}
                  >
                    {donor.tier}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Controls: Play/Pause, Nudge, Full Leaderboard link, Minimize */}
        <div className="shrink-0 flex items-center gap-1 sm:gap-1.5 pl-1 border-l border-[#D1E3D7] dark:border-[#224032]">
          {/* Pause / Play button */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#1B3328] text-[#9FBDB0]' : 'hover:bg-[#E2EDE5] text-[#4B6356]'
            }`}
            title={isPaused ? t('ticker.resume', 'Resume rolling marquee') : t('ticker.pause', 'Pause rolling marquee')}
            aria-label={isPaused ? t('ticker.resume', 'Resume marquee') : t('ticker.pause', 'Pause marquee')}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>

          {/* Left / Right manual arrows */}
          <div className="hidden sm:flex items-center">
            <button
              type="button"
              onClick={() => handleScrollNudge('left')}
              className={`w-6 h-7 rounded-l-md flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#1B3328] text-[#9FBDB0]' : 'hover:bg-[#E2EDE5] text-[#4B6356]'
              }`}
              title="Scroll left"
              aria-label="Scroll left"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => handleScrollNudge('right')}
              className={`w-6 h-7 rounded-r-md flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#1B3328] text-[#9FBDB0]' : 'hover:bg-[#E2EDE5] text-[#4B6356]'
              }`}
              title="Scroll right"
              aria-label="Scroll right"
            >
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          {/* Leaderboard CTA Button */}
          {onNavigateLeaderboard && (
            <button
              type="button"
              onClick={onNavigateLeaderboard}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#059669] hover:bg-[#047857] text-white flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
              title="Open full leaderboard ranking"
            >
              <span className="material-symbols-outlined text-[14px]">leaderboard</span>
              <span className="hidden sm:inline">{t('ticker.rankings', 'Rankings')}</span>
            </button>
          )}

          {/* Minimize / hide toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className={`w-6 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#1B3328] text-slate-400' : 'hover:bg-[#E2EDE5] text-slate-400'
            }`}
            title={t('ticker.minimize', 'Minimize ticker bar')}
            aria-label={t('ticker.minimize', 'Minimize ticker bar')}
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
