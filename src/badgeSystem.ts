// Milestone and profile badge system for FoodLink Donors and Couriers

export interface MilestoneBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'weight' | 'count' | 'speed' | 'quality' | 'streak';
  roleTarget: 'donor' | 'volunteer' | 'all';
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  thresholdText: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  accentGlow: string;
}

export const MILESTONE_BADGES: MilestoneBadge[] = [
  {
    id: 'century_rescuer',
    name: 'Century Rescuer',
    description: 'Rescued and diverted over 100 kg of fresh surplus food to community care shelters.',
    icon: 'workspace_premium',
    category: 'weight',
    roleTarget: 'all',
    tier: 'gold',
    thresholdText: '100+ kg food rescued',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/30',
    accentGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
  },
  {
    id: 'half_tonne_titan',
    name: 'Half-Tonne Titan',
    description: 'Diverted an astonishing 500+ kg of edible meals from landfills.',
    icon: 'diamond',
    category: 'weight',
    roleTarget: 'all',
    tier: 'diamond',
    thresholdText: '500+ kg food rescued',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-500/30',
    accentGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
  },
  {
    id: 'golden_spoon',
    name: 'Golden Spoon Champion',
    description: 'Achieved top ranking status with over 2,000 community impact score points.',
    icon: 'military_tech',
    category: 'quality',
    roleTarget: 'donor',
    tier: 'gold',
    thresholdText: '2,000+ impact points',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-800 dark:text-amber-200',
    borderClass: 'border-amber-500/40',
    accentGlow: 'shadow-[0_0_14px_rgba(245,158,11,0.3)]',
  },
  {
    id: 'zero_waste_hero',
    name: 'Zero-Waste Hero',
    description: 'Completed 15+ zero-waste donation dispatches without a single wasted batch.',
    icon: 'eco',
    category: 'count',
    roleTarget: 'donor',
    tier: 'silver',
    thresholdText: '15+ surplus dispatches',
    badgeBg: 'bg-teal-500/15',
    badgeText: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-500/30',
    accentGlow: 'shadow-[0_0_10px_rgba(20,184,166,0.2)]',
  },
  {
    id: 'speedy_courier',
    name: 'Rapid Transit Courier',
    description: 'Conducted priority food rescues with under 45-minute average pickup & delivery.',
    icon: 'electric_bolt',
    category: 'speed',
    roleTarget: 'volunteer',
    tier: 'gold',
    thresholdText: '< 45 min rapid delivery',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-500/30',
    accentGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
  },
  {
    id: 'cold_chain_guardian',
    name: 'Cold-Chain Guardian',
    description: '100% verified temperature inspection checklist adherence for perishable foods.',
    icon: 'ac_unit',
    category: 'quality',
    roleTarget: 'volunteer',
    tier: 'silver',
    thresholdText: '100% safety checks passed',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-500/30',
    accentGlow: 'shadow-[0_0_10px_rgba(6,182,212,0.2)]',
  },
  {
    id: 'community_lifeline',
    name: 'Community Lifeline',
    description: '10+ emergency food relief runs completed to orphanages and care homes.',
    icon: 'volunteer_activism',
    category: 'count',
    roleTarget: 'volunteer',
    tier: 'gold',
    thresholdText: '10+ rescue runs',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/30',
    accentGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
  },
  {
    id: 'fssai_verified_gold',
    name: 'FSSAI Hygiene Star',
    description: 'Verified government food safety license and pristine kitchen hygiene records.',
    icon: 'verified_user',
    category: 'quality',
    roleTarget: 'donor',
    tier: 'silver',
    thresholdText: 'Verified FSSAI Partner',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-500/30',
    accentGlow: 'shadow-[0_0_10px_rgba(59,130,246,0.2)]',
  },
];

export interface UserStatsInput {
  totalKg?: number;
  totalMeals?: number;
  completedRuns?: number;
  highestScore?: number;
  role?: string;
  isFssaiVerified?: boolean;
}

export function getUserUnlockedBadges(stats: UserStatsInput): MilestoneBadge[] {
  const kg = stats.totalKg || (stats.totalMeals ? Math.round(stats.totalMeals * 0.5) : 0);
  const runs = stats.completedRuns || 0;
  const score = stats.highestScore || (stats.totalMeals ? stats.totalMeals * 10 : 0);
  const isVolunteer = stats.role === 'volunteer';

  const unlocked: MilestoneBadge[] = [];

  // Century Rescuer: over 100kg
  if (kg >= 100) {
    const b = MILESTONE_BADGES.find((x) => x.id === 'century_rescuer');
    if (b) unlocked.push(b);
  }

  // Half-Tonne Titan: over 500kg
  if (kg >= 500) {
    const b = MILESTONE_BADGES.find((x) => x.id === 'half_tonne_titan');
    if (b) unlocked.push(b);
  }

  // Courier specific badges
  if (isVolunteer) {
    if (runs >= 10) {
      const b = MILESTONE_BADGES.find((x) => x.id === 'community_lifeline');
      if (b) unlocked.push(b);
    }
    if (runs >= 5) {
      const b = MILESTONE_BADGES.find((x) => x.id === 'speedy_courier');
      if (b) unlocked.push(b);
    }
    const bCold = MILESTONE_BADGES.find((x) => x.id === 'cold_chain_guardian');
    if (bCold) unlocked.push(bCold);
  } else {
    // Donor specific badges
    if (score >= 2000) {
      const b = MILESTONE_BADGES.find((x) => x.id === 'golden_spoon');
      if (b) unlocked.push(b);
    }
    if (runs >= 15 || (stats.totalMeals && stats.totalMeals >= 500)) {
      const b = MILESTONE_BADGES.find((x) => x.id === 'zero_waste_hero');
      if (b) unlocked.push(b);
    }
    const bFssai = MILESTONE_BADGES.find((x) => x.id === 'fssai_verified_gold');
    if (bFssai) unlocked.push(bFssai);
  }

  return unlocked;
}

export function getNextMilestoneProgress(stats: UserStatsInput): {
  nextBadgeName: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  percentage: number;
} {
  const kg = stats.totalKg || (stats.totalMeals ? Math.round(stats.totalMeals * 0.5) : 0);

  if (kg < 100) {
    return {
      nextBadgeName: 'Century Rescuer',
      currentValue: kg,
      targetValue: 100,
      unit: 'kg',
      percentage: Math.min(100, Math.round((kg / 100) * 100)),
    };
  }

  if (kg < 500) {
    return {
      nextBadgeName: 'Half-Tonne Titan',
      currentValue: kg,
      targetValue: 500,
      unit: 'kg',
      percentage: Math.min(100, Math.round((kg / 500) * 100)),
    };
  }

  return {
    nextBadgeName: 'Legendary Food Savior',
    currentValue: kg,
    targetValue: 1000,
    unit: 'kg',
    percentage: Math.min(100, Math.round((kg / 1000) * 100)),
  };
}
