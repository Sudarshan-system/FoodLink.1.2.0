import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { LeaderboardDonor, SEED_LEADERBOARD_DONORS } from './DonationLeaderboard';

interface HomeLeaderboardSectionProps {
  onNavigateLeaderboard: () => void;
  onNavigateDonor: () => void;
  onOpenAuth?: (role?: 'donor' | 'recipient') => void;
}

export const HomeLeaderboardSection: React.FC<HomeLeaderboardSectionProps> = ({
  onNavigateLeaderboard,
  onNavigateDonor,
  onOpenAuth,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [metric, setMetric] = useState<'meals' | 'weight' | 'co2'>('meals');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [firestoreDonors, setFirestoreDonors] = useState<Record<string, Partial<LeaderboardDonor>>>({});
  const [selectedDonorModal, setSelectedDonorModal] = useState<LeaderboardDonor | null>(null);

  // Subscribe to real Firestore listings to dynamically credit active donors
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'listings'),
        where('status', 'in', ['claimed', 'completed'])
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const donorMap: Record<string, { count: number; totalMeals: number; totalWeight: number }> = {};
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const donorKey = (data.donorOrg || data.donorName || data.donorId || '').trim();
            if (!donorKey) return;

            if (!donorMap[donorKey]) {
              donorMap[donorKey] = { count: 0, totalMeals: 0, totalWeight: 0 };
            }
            const qNum = Number(data.quantity) || 20;
            donorMap[donorKey].count += 1;
            donorMap[donorKey].totalMeals += qNum;
            donorMap[donorKey].totalWeight += Math.round(qNum * 0.45);
          });

          const updates: Record<string, Partial<LeaderboardDonor>> = {};
          Object.entries(donorMap).forEach(([orgName, stats]) => {
            updates[orgName.toLowerCase()] = {
              totalDonationsCount: stats.count,
              totalMealsDonated: stats.totalMeals,
              totalWeightKg: stats.totalWeight,
              co2SavedKg: Math.round(stats.totalWeight * 2.5),
            };
          });
          setFirestoreDonors(updates);
        },
        (error) => {
          console.warn('Real-time home leaderboard fallback active:', error);
        }
      );
      return () => unsubscribe();
    } catch {
      // offline fallback
    }
  }, []);

  // Merge seed data with live Firestore metrics
  const allDonors = useMemo<LeaderboardDonor[]>(() => {
    const merged = SEED_LEADERBOARD_DONORS.map((d) => {
      const key = d.organization.toLowerCase();
      const live = firestoreDonors[key];
      if (live) {
        return {
          ...d,
          totalDonationsCount: d.totalDonationsCount + (live.totalDonationsCount || 0),
          totalMealsDonated: d.totalMealsDonated + (live.totalMealsDonated || 0),
          totalWeightKg: d.totalWeightKg + (live.totalWeightKg || 0),
          co2SavedKg: d.co2SavedKg + (live.co2SavedKg || 0),
        };
      }
      return d;
    });

    // If current logged in user has donor profile, ensure they appear on the board
    if (currentUser && userProfile && (userProfile.role === 'restaurant' || userProfile.role === 'donor')) {
      const userOrg = userProfile.orgName || userProfile.displayName || 'My Commercial Kitchen';
      const alreadyIncluded = merged.some(
        (m) => m.organization.toLowerCase() === userOrg.toLowerCase()
      );
      if (!alreadyIncluded) {
        const liveUser = firestoreDonors[userOrg.toLowerCase()];
        const count = liveUser?.totalDonationsCount || 1;
        const meals = liveUser?.totalMealsDonated || 180;
        const weight = liveUser?.totalWeightKg || 90;
        merged.push({
          id: currentUser.uid,
          name: userProfile.displayName || 'Executive Chef',
          organization: userOrg,
          category: 'Restaurant & Cafe',
          city: userProfile.address ? userProfile.address.split(',')[0] : 'Mumbai',
          verified: userProfile.verificationStatus === 'verified',
          fssaiNumber: userProfile.verificationDocs?.fssaiNumber || '11523000000000',
          totalDonationsCount: count,
          totalMealsDonated: meals,
          totalWeightKg: weight,
          co2SavedKg: Math.round(weight * 2.5),
          highestScore: meals + count * 20,
          streakDays: 3,
          tier: 'Gold Hero',
          recentDonationDate: 'Just now',
          recentFoodItem: 'Fresh wholesome meals batch',
          avatarInitial: userOrg.substring(0, 2).toUpperCase(),
          avatarBg: 'bg-emerald-600',
        });
      }
    }

    return merged;
  }, [firestoreDonors, currentUser, userProfile]);

  // Filter & sort
  const filteredDonors = useMemo(() => {
    return allDonors
      .filter((d) => {
        if (categoryFilter === 'all') return true;
        return d.category.toLowerCase().includes(categoryFilter.toLowerCase());
      })
      .sort((a, b) => {
        if (metric === 'meals') return b.totalMealsDonated - a.totalMealsDonated;
        if (metric === 'weight') return b.totalWeightKg - a.totalWeightKg;
        return b.co2SavedKg - a.co2SavedKg;
      });
  }, [allDonors, categoryFilter, metric]);

  const top3 = filteredDonors.slice(0, 3);
  const remaining = filteredDonors.slice(3, 7);

  // Community total aggregate
  const communityStats = useMemo(() => {
    return allDonors.reduce(
      (acc, curr) => ({
        meals: acc.meals + curr.totalMealsDonated,
        weight: acc.weight + curr.totalWeightKg,
        co2: acc.co2 + curr.co2SavedKg,
      }),
      { meals: 0, weight: 0, co2: 0 }
    );
  }, [allDonors]);

  return (
    <section
      id="community-leaderboard-section"
      className="bg-[#F8FAF8] dark:bg-[#0A130E] border-t border-[#D1E3D7] dark:border-[#244535] py-8 sm:py-10 lg:py-12 transition-colors"
    >
      <div className="site-container">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399] border border-[#059669]/25 text-xs font-bold mb-3 shadow-2xs">
              <span className="material-symbols-outlined text-[16px]">leaderboard</span>
              <span>Live Zero-Hunger Community Rankings</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0F1E17] dark:text-[#F4F8F5] tracking-tight">
              Top Donors &amp; Rescue Champions
            </h2>
            <p className="text-sm sm:text-base text-[#4B6356] dark:text-[#B2CDC0] mt-2 leading-relaxed">
              Honoring verified banquet halls, hotels, and restaurants actively preventing food waste and feeding local shelters across India.
            </p>
          </div>

          {/* Quick Action to Full Board */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onNavigateLeaderboard}
              className="px-4 py-2.5 rounded-xl border border-[#059669]/40 bg-white dark:bg-[#112019] text-[#059669] dark:text-[#34D399] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
              <span>View Full Leaderboard (25+)</span>
            </button>
            <button
              type="button"
              onClick={onNavigateDonor}
              className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>List Surplus Food</span>
            </button>
          </div>
        </div>

        {/* Aggregate Impact Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">soup_kitchen</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#4B6356] dark:text-[#8AA897] uppercase tracking-wider block">
                Total Meals Served
              </span>
              <span className="font-serif text-xl sm:text-2xl font-black text-[#0F1E17] dark:text-white">
                {communityStats.meals.toLocaleString()} <span className="text-xs font-sans font-normal text-[#4B6356] dark:text-[#8AA897]">portions</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">scale</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#4B6356] dark:text-[#8AA897] uppercase tracking-wider block">
                Surplus Weight Rescued
              </span>
              <span className="font-serif text-xl sm:text-2xl font-black text-[#0F1E17] dark:text-white">
                {communityStats.weight.toLocaleString()} <span className="text-xs font-sans font-normal text-[#4B6356] dark:text-[#8AA897]">kg saved</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">eco</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#4B6356] dark:text-[#8AA897] uppercase tracking-wider block">
                CO₂ Emissions Avoided
              </span>
              <span className="font-serif text-xl sm:text-2xl font-black text-[#0F1E17] dark:text-white">
                {communityStats.co2.toLocaleString()} <span className="text-xs font-sans font-normal text-[#4B6356] dark:text-[#8AA897]">kg CO₂e</span>
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-8 bg-white dark:bg-[#112019] p-2.5 rounded-2xl border border-[#D1E3D7] dark:border-[#244535] shadow-2xs">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Partners' },
              { id: 'hotel', label: 'Hotels & Banquets' },
              { id: 'restaurant', label: 'Restaurants & Cafes' },
              { id: 'corporate', label: 'Corporate Kitchens' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#059669] text-white shadow-xs'
                    : 'text-[#4B6356] dark:text-[#B2CDC0] hover:bg-[#F0F5F1] dark:hover:bg-[#182C22]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Metric Sort Switcher */}
          <div className="flex items-center gap-1 bg-[#F0F5F1] dark:bg-[#182C22] p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setMetric('meals')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metric === 'meals'
                  ? 'bg-white dark:bg-[#112019] text-[#059669] dark:text-[#34D399] shadow-2xs'
                  : 'text-[#4B6356] dark:text-[#8AA897]'
              }`}
            >
              Meals Fed
            </button>
            <button
              type="button"
              onClick={() => setMetric('weight')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metric === 'weight'
                  ? 'bg-white dark:bg-[#112019] text-[#059669] dark:text-[#34D399] shadow-2xs'
                  : 'text-[#4B6356] dark:text-[#8AA897]'
              }`}
            >
              Kg Rescued
            </button>
            <button
              type="button"
              onClick={() => setMetric('co2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                metric === 'co2'
                  ? 'bg-white dark:bg-[#112019] text-[#059669] dark:text-[#34D399] shadow-2xs'
                  : 'text-[#4B6356] dark:text-[#8AA897]'
              }`}
            >
              CO₂ Saved
            </button>
          </div>
        </div>

        {/* TOP 3 PODIUM CARDS */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-end">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div
                onClick={() => setSelectedDonorModal(top3[1])}
                className="bg-white dark:bg-[#112019] rounded-2xl border border-slate-200 dark:border-[#244535] p-5 shadow-xs hover:shadow-md transition-all cursor-pointer relative order-2 md:order-1"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center border border-slate-300 dark:border-slate-700">
                      2
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Silver Champion
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <span>🔥</span>
                    <span>{top3[1].streakDays}d streak</span>
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {top3[1].avatarInitial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-[#0F1E17] dark:text-white truncate">
                      {top3[1].organization}
                    </h3>
                    <p className="text-xs text-[#4B6356] dark:text-[#8AA897] truncate">
                      {top3[1].city} • {top3[1].category}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#244535] grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#F8FAF8] dark:bg-[#182C22] p-2 rounded-xl">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Meals Donated
                    </span>
                    <span className="font-serif font-black text-base text-[#0F1E17] dark:text-white">
                      {top3[1].totalMealsDonated.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#F8FAF8] dark:bg-[#182C22] p-2 rounded-xl">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Surplus Rescued
                    </span>
                    <span className="font-serif font-black text-base text-[#059669] dark:text-[#34D399]">
                      {top3[1].totalWeightKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold - Elevated Champion) */}
            {top3[0] && (
              <div
                onClick={() => setSelectedDonorModal(top3[0])}
                className="bg-gradient-to-b from-[#ECFDF5] to-white dark:from-[#112F21] dark:to-[#112019] rounded-2xl border-2 border-[#059669] p-6 shadow-md hover:shadow-lg transition-all cursor-pointer relative order-1 md:order-2 md:-translate-y-2 ring-4 ring-[#059669]/10"
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#059669] text-white text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                  <span>👑</span>
                  <span>#1 Leaderboard Champion</span>
                </div>

                <div className="flex items-center justify-between mb-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full bg-amber-400 text-[#0F1E17] font-black text-base flex items-center justify-center shadow-xs">
                      1
                    </span>
                    <span className="text-xs font-black text-[#059669] dark:text-[#34D399] uppercase tracking-wide">
                      Diamond Patron
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <span>🔥</span>
                    <span>{top3[0].streakDays}d streak</span>
                  </span>
                </div>

                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm ring-2 ring-[#059669]/30">
                    {top3[0].avatarInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-serif font-black text-base sm:text-lg text-[#0F1E17] dark:text-white truncate">
                        {top3[0].organization}
                      </h3>
                      <span className="material-symbols-outlined text-[17px] text-[#059669] shrink-0" title="FSSAI Verified">
                        verified
                      </span>
                    </div>
                    <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] truncate">
                      {top3[0].city} • {top3[0].category}
                    </p>
                    <span className="text-[11px] text-[#059669] dark:text-[#34D399] font-bold">
                      {top3[0].totalDonationsCount} rescue missions completed
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#D1E3D7] dark:border-[#244535] grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white/80 dark:bg-[#182C22] p-2.5 rounded-xl border border-[#059669]/20">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Meals Donated
                    </span>
                    <span className="font-serif font-black text-lg text-[#0F1E17] dark:text-white">
                      {top3[0].totalMealsDonated.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-[#182C22] p-2.5 rounded-xl border border-[#059669]/20">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Surplus Rescued
                    </span>
                    <span className="font-serif font-black text-lg text-[#059669] dark:text-[#34D399]">
                      {top3[0].totalWeightKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div
                onClick={() => setSelectedDonorModal(top3[2])}
                className="bg-white dark:bg-[#112019] rounded-2xl border border-amber-200/80 dark:border-[#244535] p-5 shadow-xs hover:shadow-md transition-all cursor-pointer relative order-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-black text-sm flex items-center justify-center border border-amber-300 dark:border-amber-800">
                      3
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                      Bronze Guardian
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <span>🔥</span>
                    <span>{top3[2].streakDays}d streak</span>
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {top3[2].avatarInitial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-[#0F1E17] dark:text-white truncate">
                      {top3[2].organization}
                    </h3>
                    <p className="text-xs text-[#4B6356] dark:text-[#8AA897] truncate">
                      {top3[2].city} • {top3[2].category}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#244535] grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#F8FAF8] dark:bg-[#182C22] p-2 rounded-xl">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Meals Donated
                    </span>
                    <span className="font-serif font-black text-base text-[#0F1E17] dark:text-white">
                      {top3[2].totalMealsDonated.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#F8FAF8] dark:bg-[#182C22] p-2 rounded-xl">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Surplus Rescued
                    </span>
                    <span className="font-serif font-black text-base text-[#059669] dark:text-[#34D399]">
                      {top3[2].totalWeightKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPACT TABLE FOR RANKS 4 TO 7 */}
        {remaining.length > 0 && (
          <div className="bg-white dark:bg-[#112019] rounded-2xl border border-[#D1E3D7] dark:border-[#244535] overflow-hidden shadow-xs mb-6">
            <div className="px-5 py-3.5 bg-[#F0F5F1] dark:bg-[#182C22] border-b border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between text-xs font-bold text-[#4B6356] dark:text-[#B2CDC0]">
              <span>Ranks 4 – {3 + remaining.length} Community Rescuers</span>
              <span>Updated Live</span>
            </div>

            <div className="divide-y divide-[#D1E3D7]/60 dark:divide-[#244535]/60">
              {remaining.map((donor, idx) => (
                <div
                  key={donor.id}
                  onClick={() => setSelectedDonorModal(donor)}
                  className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAF8] dark:hover:bg-[#15281D] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      #{4 + idx}
                    </span>
                    <div className={`w-9 h-9 rounded-xl ${donor.avatarBg || 'bg-emerald-600'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                      {donor.avatarInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm text-[#0F1E17] dark:text-white truncate">
                          {donor.organization}
                        </h4>
                        {donor.verified && (
                          <span className="material-symbols-outlined text-[15px] text-[#059669] shrink-0">
                            verified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4B6356] dark:text-[#8AA897] truncate">
                        {donor.city} • <span className="font-medium">{donor.category}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pl-10 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                        {metric === 'meals' ? 'Meals' : metric === 'weight' ? 'Weight' : 'CO₂ Saved'}
                      </span>
                      <span className="font-serif font-black text-sm sm:text-base text-[#059669] dark:text-[#34D399]">
                        {metric === 'meals'
                          ? `${donor.totalMealsDonated.toLocaleString()} plates`
                          : metric === 'weight'
                          ? `${donor.totalWeightKg.toLocaleString()} kg`
                          : `${donor.co2SavedKg.toLocaleString()} kg CO₂`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399]">
                        {donor.tier}
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[#4B6356] dark:text-[#8AA897]">
                        chevron_right
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Banner Call to Action */}
        <div className="bg-gradient-to-r from-[#ECFDF5] via-[#E6F4EA] to-[#F0FDF4] dark:from-[#112F21] dark:via-[#132A1F] dark:to-[#112019] rounded-2xl border border-[#059669]/30 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-[#0F1E17] dark:text-white">
                Operate a Restaurant, Banquet Hall, or Food Business?
              </h4>
              <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] mt-0.5">
                Join our verified donor network under the Good Samaritan Food Donation Act. Track CSR metrics, earn badges, and feed local shelters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onNavigateDonor}
              className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">volunteer_activism</span>
              <span>Register &amp; Post Surplus</span>
            </button>
            <button
              type="button"
              onClick={onNavigateLeaderboard}
              className="px-4 py-2.5 rounded-xl border border-[#059669]/40 bg-white dark:bg-[#112019] text-[#059669] dark:text-[#34D399] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] text-xs font-bold transition-all cursor-pointer"
            >
              Full Rankings
            </button>
          </div>
        </div>

        {/* Selected Donor Quick Details Modal */}
        {selectedDonorModal && (
          <div
            className="fixed inset-0 z-50 bg-[#0F1E17]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedDonorModal(null);
            }}
          >
            <div className="bg-white dark:bg-[#15231B] w-full max-w-lg rounded-3xl border border-[#D1E3D7] dark:border-[#244535] shadow-2xl overflow-hidden my-auto animate-slideUp">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-[#0F291C] via-[#059669] to-[#047857] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-black text-base shadow-xs">
                    {selectedDonorModal.avatarInitial}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                        {selectedDonorModal.tier}
                      </span>
                      {selectedDonorModal.verified && (
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          <span>FSSAI Verified</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg font-bold text-white truncate mt-0.5">
                      {selectedDonorModal.organization}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDonorModal(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#1A2E22] border border-[#D1E3D7] dark:border-[#244535]">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Meals Donated
                    </span>
                    <span className="font-serif font-black text-lg text-[#059669] dark:text-[#34D399]">
                      {selectedDonorModal.totalMealsDonated.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#1A2E22] border border-[#D1E3D7] dark:border-[#244535]">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Weight Saved
                    </span>
                    <span className="font-serif font-black text-lg text-[#0F1E17] dark:text-white">
                      {selectedDonorModal.totalWeightKg.toLocaleString()} kg
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#1A2E22] border border-[#D1E3D7] dark:border-[#244535]">
                    <span className="text-[10px] text-[#4B6356] dark:text-[#8AA897] uppercase font-bold block">
                      Active Streak
                    </span>
                    <span className="font-serif font-black text-lg text-amber-600 dark:text-amber-400">
                      {selectedDonorModal.streakDays} days
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAF8] dark:bg-[#1A2E22] border border-[#D1E3D7] dark:border-[#244535] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#4B6356] dark:text-[#8AA897]">Partner Contact:</span>
                    <span className="font-bold text-[#0F1E17] dark:text-white">{selectedDonorModal.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#4B6356] dark:text-[#8AA897]">Location:</span>
                    <span className="font-bold text-[#0F1E17] dark:text-white">{selectedDonorModal.city}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#4B6356] dark:text-[#8AA897]">Category:</span>
                    <span className="font-bold text-[#059669] dark:text-[#34D399]">{selectedDonorModal.category}</span>
                  </div>
                  {selectedDonorModal.fssaiNumber && (
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[#4B6356] dark:text-[#8AA897]">FSSAI License:</span>
                      <span className="font-bold text-[#0F1E17] dark:text-white">{selectedDonorModal.fssaiNumber}</span>
                    </div>
                  )}
                  {selectedDonorModal.recentFoodItem && (
                    <div className="pt-2 border-t border-[#D1E3D7] dark:border-[#244535] text-[11px] text-[#4B6356] dark:text-[#B2CDC0]">
                      <span className="font-bold text-[#0F1E17] dark:text-white block mb-0.5">Most Recent Contribution:</span>
                      <span>{selectedDonorModal.recentFoodItem} ({selectedDonorModal.recentDonationDate})</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDonorModal(null)}
                    className="px-4 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] text-xs font-bold text-[#4B6356] dark:text-[#B2CDC0] hover:bg-[#F8FAF8] cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDonorModal(null);
                      onNavigateLeaderboard();
                    }}
                    className="px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    View All Rankings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
