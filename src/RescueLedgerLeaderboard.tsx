import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { FoodListing } from './DonorDashboard';
import { RescueImpactD3Chart } from './RescueImpactD3Chart';
import { DonationLeaderboard } from './DonationLeaderboard';
import { TemperatureLogModal } from './TemperatureLogModal';
import {
  TemperatureLogEntry,
  SAMPLE_BATCH_TEMPERATURES,
  evaluateTemperatureSafety,
  StorageConditionType,
} from './temperatureLogService';
import { useTranslation } from './LanguageContext';

interface RescueLedgerLeaderboardProps {
  onOpenAuth?: (role?: 'donor' | 'recipient') => void;
  onNavigateTab?: (tab: 'donor' | 'browse' | 'courier' | 'verify' | any) => void;
  onNavigateDonor?: () => void;
}

export type LedgerStatus = 'Listed' | 'Claimed' | 'Picked up' | 'Completed' | 'Expired';

export interface LedgerItem {
  id: string;
  foodName: string;
  category: string;
  isVeg: boolean;
  date: string;
  timestampMillis: number;
  status: LedgerStatus;
  rawStatus: string;
  quantityStr: string;
  quantityNum: number;
  unit: string;
  donorName: string;
  donorOrg: string;
  donorAddress: string;
  donorPhone: string;
  recipientOrg: string;
  recipientContact?: string;
  courierName?: string;
  pickupTime: string;
  description?: string;
  storageCondition?: string;
  allergens?: string[];
  timeline: {
    listedAt: string;
    claimedAt?: string;
    pickedUpAt?: string;
    completedAt?: string;
  };
  temperatureLogs?: TemperatureLogEntry[];
  currentTemperature?: number;
  latestTemperatureLog?: TemperatureLogEntry;
  isSample?: boolean;
}

// Built-in sample ledger records for instant testing if Firestore has no user-specific records
const SAMPLE_LEDGER_ITEMS: LedgerItem[] = [
  {
    id: 'ledger_sample_1',
    foodName: 'Surplus Dal Makhani & Jeera Rice',
    category: 'Veg',
    isVeg: true,
    date: '30 Sep 2026',
    timestampMillis: Date.now() - 2 * 3600000,
    status: 'Listed',
    rawStatus: 'available',
    quantityStr: '50 plates',
    quantityNum: 50,
    unit: 'plates',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Awaiting Claim',
    pickupTime: 'Today before 10:30 PM',
    description: 'Hot kept in stainless steel containers. Cooked at 6 PM.',
    storageCondition: 'Hot and covered',
    allergens: ['Dairy'],
    timeline: {
      listedAt: '30 Sep 2026, 06:15 PM',
    },
    currentTemperature: 68.2,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_1'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_1']?.[1],
    isSample: true,
  },
  {
    id: 'ledger_sample_2',
    foodName: 'Chicken Dum Biryani (Wedding Surplus)',
    category: 'Non-veg (Chicken)',
    isVeg: false,
    date: '30 Sep 2026',
    timestampMillis: Date.now() - 4 * 3600000,
    status: 'Claimed',
    rawStatus: 'claimed',
    quantityStr: '75 plates',
    quantityNum: 75,
    unit: 'plates',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Hope Community Shelter & Kitchen',
    recipientContact: 'Sister Mary Teresa (+91 98200 44551)',
    courierName: 'Rahul Verma (Eco Courier Runner)',
    pickupTime: 'Tonight 08:30 PM - 09:30 PM',
    description: 'Fresh non-veg biryani sealed in insulated thermal vessels.',
    storageCondition: 'Hot and covered',
    allergens: ['Dairy'],
    timeline: {
      listedAt: '30 Sep 2026, 04:30 PM',
      claimedAt: '30 Sep 2026, 05:15 PM',
    },
    currentTemperature: 67.0,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_2'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_2']?.[2],
    isSample: true,
  },
  {
    id: 'ledger_sample_3',
    foodName: 'Freshly Baked Multigrain Breads & Buns',
    category: 'Veg',
    isVeg: true,
    date: '29 Sep 2026',
    timestampMillis: Date.now() - 26 * 3600000,
    status: 'Picked up',
    rawStatus: 'picked_up',
    quantityStr: '60 packets',
    quantityNum: 60,
    unit: 'packets',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Sneha Sadan Child Care Trust',
    recipientContact: 'Dr. Joseph Fernandes (+91 98334 11200)',
    courierName: 'Rahul Verma (Eco Courier Runner)',
    pickupTime: '29 Sep 2026, 07:00 PM',
    description: 'Clean packaged bakery surplus from evening bake.',
    storageCondition: 'Room temperature sealed',
    allergens: ['Gluten'],
    timeline: {
      listedAt: '29 Sep 2026, 05:00 PM',
      claimedAt: '29 Sep 2026, 05:40 PM',
      pickedUpAt: '29 Sep 2026, 06:45 PM',
    },
    currentTemperature: 23.0,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_3'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_3']?.[1],
    isSample: true,
  },
  {
    id: 'ledger_sample_4',
    foodName: 'Steam Idli, Medu Vada & Sambar',
    category: 'Veg',
    isVeg: true,
    date: '28 Sep 2026',
    timestampMillis: Date.now() - 50 * 3600000,
    status: 'Completed',
    rawStatus: 'completed',
    quantityStr: '80 plates',
    quantityNum: 80,
    unit: 'plates',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Hope Community Shelter & Kitchen',
    recipientContact: 'Sister Mary Teresa (+91 98200 44551)',
    courierName: 'Rahul Verma (Eco Courier Runner)',
    pickupTime: '28 Sep 2026, 11:30 AM',
    description: 'Breakfast banquet surplus delivered and distributed to 80 children.',
    storageCondition: 'Hot and covered',
    allergens: ['None'],
    timeline: {
      listedAt: '28 Sep 2026, 09:15 AM',
      claimedAt: '28 Sep 2026, 09:45 AM',
      pickedUpAt: '28 Sep 2026, 10:30 AM',
      completedAt: '28 Sep 2026, 11:45 AM',
    },
    currentTemperature: 65.8,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_4'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_4']?.[2],
    isSample: true,
  },
  {
    id: 'ledger_sample_5',
    foodName: 'Vegetable Hakka Noodles & Manchurian',
    category: 'Veg',
    isVeg: true,
    date: '27 Sep 2026',
    timestampMillis: Date.now() - 74 * 3600000,
    status: 'Completed',
    rawStatus: 'completed',
    quantityStr: '40 plates',
    quantityNum: 40,
    unit: 'plates',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Karuna Old Age Home & Hospice',
    recipientContact: 'Meenakshi Sundaram (+91 99100 88234)',
    courierName: 'Amit Shah (Dispatch Van)',
    pickupTime: '27 Sep 2026, 03:00 PM',
    description: 'Dinner banquet surplus verified and consumed within 3 hours.',
    storageCondition: 'Hot and covered',
    allergens: ['Soy', 'Gluten'],
    timeline: {
      listedAt: '27 Sep 2026, 01:00 PM',
      claimedAt: '27 Sep 2026, 01:30 PM',
      pickedUpAt: '27 Sep 2026, 02:15 PM',
      completedAt: '27 Sep 2026, 03:10 PM',
    },
    currentTemperature: 65.0,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_1'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_1']?.[1],
    isSample: true,
  },
  {
    id: 'ledger_sample_6',
    foodName: 'Mixed Fruit Custard & Desserts',
    category: 'Veg',
    isVeg: true,
    date: '25 Sep 2026',
    timestampMillis: Date.now() - 120 * 3600000,
    status: 'Expired',
    rawStatus: 'expired',
    quantityStr: '30 plates',
    quantityNum: 30,
    unit: 'plates',
    donorName: 'Chef Marcus Vance',
    donorOrg: 'The Grand Bistro & Banquet',
    donorAddress: 'Loading Dock #2, Grand Hotel, Downtown, Mumbai',
    donorPhone: '+91 1800 555 3663',
    recipientOrg: 'Unclaimed',
    pickupTime: '25 Sep 2026, 06:00 PM',
    description: 'Chilled dessert bowls that reached safe consumption limit.',
    storageCondition: 'Refrigerated',
    allergens: ['Dairy'],
    timeline: {
      listedAt: '25 Sep 2026, 02:00 PM',
    },
    currentTemperature: 3.8,
    temperatureLogs: SAMPLE_BATCH_TEMPERATURES['ledger_sample_6'],
    latestTemperatureLog: SAMPLE_BATCH_TEMPERATURES['ledger_sample_6']?.[0],
    isSample: true,
  },
];

export const RescueLedgerLeaderboard: React.FC<RescueLedgerLeaderboardProps> = ({
  onOpenAuth,
  onNavigateTab,
  onNavigateDonor,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Mode: personal ledger vs community leaderboard
  const [activeSection, setActiveSection] = useState<'ledger' | 'leaderboard'>('ledger');

  // Filter tabs: All, Active, Completed
  const [filterTab, setFilterTab] = useState<'All' | 'Active' | 'Completed'>('All');

  // Search box state
  const [searchQuery, setSearchQuery] = useState('');

  // Selected row for details panel
  const [selectedItem, setSelectedItem] = useState<LedgerItem | null>(null);
  const [tempModalItem, setTempModalItem] = useState<LedgerItem | null>(null);

  // Pagination (10 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Real-time Firestore items
  const [firestoreItems, setFirestoreItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to map raw status to exact requested status label:
  // (Listed, Claimed, Picked up, Completed, Expired)
  const mapToStatusLabel = (statusStr: string): LedgerStatus => {
    const s = (statusStr || '').toLowerCase();
    if (s === 'claimed') return 'Claimed';
    if (s === 'picked_up' || s === 'in_transit') return 'Picked up';
    if (s === 'completed') return 'Completed';
    if (s === 'expired' || s === 'cancelled' || s === 'rejected') return 'Expired';
    return 'Listed';
  };

  // Helper to format date
  const formatDate = (dateObj: any): string => {
    if (!dateObj) return '30 Sep 2026';
    if (dateObj.toDate) {
      return dateObj.toDate().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    if (typeof dateObj === 'string') {
      try {
        return new Date(dateObj).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return dateObj.slice(0, 10);
      }
    }
    return '30 Sep 2026';
  };

  // Subscribe to Firestore listings
  useEffect(() => {
    if (!currentUser) {
      setFirestoreItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(
      listingsRef,
      (snapshot) => {
        const items: LedgerItem[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const statusLabel = mapToStatusLabel(d.status);

          // Role-based visibility:
          // "Donors see their own donations, organizations see their claims, and couriers see their pickups."
          const isDonor =
            userProfile?.role === 'donor' ||
            userProfile?.role === 'restaurant' ||
            (!userProfile?.role && currentUser.email?.includes('bistro'));

          const isOrg =
            userProfile?.role === 'ngo' ||
            userProfile?.role === 'recipient' ||
            (!userProfile?.role && currentUser.email?.includes('shelter'));

          const isCourier =
            userProfile?.role === 'volunteer' ||
            (!userProfile?.role && currentUser.email?.includes('volunteer'));

          const matchesUser =
            (isDonor && (d.donorId === currentUser.uid || d.donorEmail === currentUser.email)) ||
            (isOrg && (d.claimingOrgId === currentUser.uid || d.recipientEmail === currentUser.email || statusLabel !== 'Listed')) ||
            (isCourier && (d.courierId === currentUser.uid || statusLabel === 'Picked up' || statusLabel === 'Completed')) ||
            userProfile?.role === 'admin' ||
            userProfile?.isDemo;

          if (matchesUser) {
            const dateStr = formatDate(d.createdAt);
            const tsMillis = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();

            let tempLogs: TemperatureLogEntry[] = d.temperatureLogs || [];
            if ((!tempLogs || tempLogs.length === 0) && typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem(`foodlink_temp_logs_${docSnap.id}`);
                if (stored) {
                  tempLogs = JSON.parse(stored);
                }
              } catch (e) {
                // Ignore storage error
              }
            }

            const currentTemp =
              d.currentTemperature !== undefined
                ? d.currentTemperature
                : tempLogs?.[0]?.temperatureCelsius;
            const latestLog = d.latestTemperatureLog || tempLogs?.[0];

            items.push({
              id: docSnap.id,
              foodName: d.title || 'Prepared Surplus Food',
              category: d.isVeg === false ? `Non-veg ${d.nonVegType ? `(${d.nonVegType})` : ''}` : 'Veg',
              isVeg: d.isVeg !== false,
              date: dateStr,
              timestampMillis: tsMillis,
              status: statusLabel,
              rawStatus: d.status || 'available',
              quantityStr: d.quantity ? `${d.quantity} ${d.unit || 'plates'}` : '50 plates',
              quantityNum: Number(d.quantity) || 50,
              unit: d.unit || 'plates',
              donorName: d.donorName || d.donorOrg || 'Verified Food Partner',
              donorOrg: d.donorOrg || d.donorName || 'Commercial Kitchen',
              donorAddress: d.location || 'Loading Bay, Food Partner Hub',
              donorPhone: d.donorPhone || '+91 1800 555 3663',
              recipientOrg: d.recipientOrg || d.claimingOrgName || (statusLabel === 'Listed' ? 'Awaiting Claim' : 'Verified Shelter'),
              recipientContact: d.recipientContact || 'Intake Officer',
              courierName: d.courierName || 'Eco Courier Logistics',
              pickupTime: d.expiryTime || d.pickupWindow || 'Today',
              description: d.notes || 'Hygienically prepared surplus food.',
              storageCondition: d.storageCondition || d.foodType || 'Hot and covered',
              allergens: d.allergens || ['None declared'],
              timeline: {
                listedAt: `${dateStr}, ${d.preparedTime || '06:00 PM'}`,
                claimedAt: statusLabel !== 'Listed' ? `${dateStr}, 07:00 PM` : undefined,
                pickedUpAt: statusLabel === 'Picked up' || statusLabel === 'Completed' ? `${dateStr}, 07:45 PM` : undefined,
                completedAt: statusLabel === 'Completed' ? `${dateStr}, 08:30 PM` : undefined,
              },
              currentTemperature: currentTemp,
              temperatureLogs: tempLogs,
              latestTemperatureLog: latestLog,
              isSample: false,
            });
          }
        });

        items.sort((a, b) => b.timestampMillis - a.timestampMillis);
        setFirestoreItems(items);
        setLoading(false);
      },
      (err) => {
        console.warn('Ledger firestore error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  // Combined records: use Firestore records, or fallback to sample items if Firestore is empty
  const allRecords = useMemo(() => {
    if (firestoreItems.length > 0) {
      return firestoreItems;
    }
    // If signed in but no transactions yet, show sample items for demonstration
    return SAMPLE_LEDGER_ITEMS;
  }, [firestoreItems]);

  // Filter by Tab (All, Active, Completed) and search query
  const filteredRecords = useMemo(() => {
    return allRecords.filter((item) => {
      // 1. Filter Tab
      if (filterTab === 'Active') {
        const isActive = item.status === 'Listed' || item.status === 'Claimed' || item.status === 'Picked up';
        if (!isActive) return false;
      } else if (filterTab === 'Completed') {
        const isCompleted = item.status === 'Completed' || item.status === 'Expired';
        if (!isCompleted) return false;
      }

      // 2. Search Box by name
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = item.foodName.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory) return false;
      }

      return true;
    });
  }, [allRecords, filterTab, searchQuery]);

  // Pagination (10 rows per page)
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery]);

  // Food Safety Transparency Metrics computed from records
  const tempStats = useMemo(() => {
    let auditedCount = 0;
    let totalLogsCount = 0;
    let compliantCount = 0;

    allRecords.forEach((item) => {
      const logs = item.temperatureLogs || [];
      if (logs.length > 0 || item.currentTemperature !== undefined) {
        auditedCount++;
        totalLogsCount += Math.max(1, logs.length);
        const temp = item.currentTemperature ?? logs[0]?.temperatureCelsius;
        if (temp !== undefined) {
          const verdict = evaluateTemperatureSafety(
            temp,
            (item.storageCondition as StorageConditionType) || 'Hot and covered'
          );
          if (verdict.isCompliant) compliantCount++;
        }
      }
    });

    const complianceRate =
      auditedCount > 0 ? Math.round((compliantCount / auditedCount) * 100) : 100;
    return { auditedCount, totalLogsCount, complianceRate };
  }, [allRecords]);

  // Helper for Status label styling
  const renderStatusBadge = (status: LedgerStatus) => {
    switch (status) {
      case 'Listed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF3EC] text-[#2E7D4F] border border-[#A7F3D0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
            Listed
          </span>
        );
      case 'Claimed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF3E8] text-[#D9822B] border border-[#FCD34D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9822B]" />
            Claimed
          </span>
        );
      case 'Picked up':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
            Picked up
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF3EC] text-[#2E7D4F] border border-[#A7F3D0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
            Completed
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFBF8] text-[#526357] border border-[#D9E2DA]">
            {status}
          </span>
        );
    }
  };

  const handleNavigateToDonor = () => {
    if (onNavigateDonor) {
      onNavigateDonor();
    } else if (onNavigateTab) {
      onNavigateTab('donor');
    }
  };

  // If Leaderboard is active, show it directly
  if (activeSection === 'leaderboard') {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#D1E3D7] dark:border-[#244535]">
          <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] shadow-xs">
            <button
              type="button"
              onClick={() => setActiveSection('ledger')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>My Donations & Pickups</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('leaderboard')}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#059669] text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#F59E0B]">military_tech</span>
              <span>Community Leaderboard</span>
            </button>
          </div>
        </div>
        <DonationLeaderboard
          onNavigateDonor={handleNavigateToDonor}
          onOpenAuth={onOpenAuth}
        />
      </div>
    );
  }

  // SIGN-IN REQUIRED: If user is signed out for personal ledger
  if (!currentUser) {
    return (
      <div className="site-container py-10 md:py-14 space-y-6">
        {/* Toggle between Ledger & Public Leaderboard */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] shadow-xs">
            <button
              type="button"
              onClick={() => setActiveSection('ledger')}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#059669] text-white shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>Personal Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('leaderboard')}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#F59E0B]">military_tech</span>
              <span>Community Leaderboard (Public)</span>
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-2xl shadow-xs p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">receipt_long</span>
          </div>

          <div>
            {/* Title: "Your donations and pickups" */}
            <h1 className="font-serif text-2xl font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
              Your donations and pickups
            </h1>
            <p className="text-sm text-[#4B6356] dark:text-[#B2CDC0] mt-2 leading-relaxed">
              Please sign in to view your personal donations, claims, and delivery logs on the FoodLink Ledger.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAuth && onOpenAuth()}
              className="w-full h-12 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[48px]"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              <span>Sign In to View Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('leaderboard')}
              className="w-full h-11 rounded-lg bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#D97706] font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">military_tech</span>
              <span>View Public Donor Leaderboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Top Toggle: Personal Ledger vs Community Leaderboard */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D1E3D7] dark:border-[#244535]">
        <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] shadow-xs">
          <button
            type="button"
            onClick={() => setActiveSection('ledger')}
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#059669] text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span>{t('ledger.pageTitle', 'My Donations & Pickups')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('leaderboard')}
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px] text-[#F59E0B]">military_tech</span>
            <span>{t('leaderboard.pageTitle', 'Community Leaderboard')}</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
          {t('ledger.pageTitle', 'Your donations and pickups')}
        </h1>
        <p className="text-sm text-[#526357] dark:text-[#95A89C] mt-1">
          {userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
            ? 'Track your organization’s claimed meals and distribution status.'
            : userProfile?.role === 'volunteer'
            ? 'Track your courier rescue runs and deliveries.'
            : t('ledger.pageSubtitle', 'Track surplus food packages listed by your kitchen and delivery outcomes.')}
        </p>
      </div>

      {/* D3 Impact Chart: 30-Day Food Rescued (kg) Tracker */}
      <RescueImpactD3Chart records={allRecords} userRole={userProfile?.role} />

      {/* Public Food Safety & Thermal Compliance Transparency Ribbon */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#059669] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-[#0F1E17] dark:text-[#F4F8F5]">
                  Public Food Safety &amp; Thermal Compliance Ledger
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  FSSAI / HACCP Audited
                </span>
              </div>
              <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-0.5">
                Every surplus food donation requires verifiable temperature checkpoint logging from kitchen dispatch to shelter intake.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#D9E2DA]/60 dark:border-[#2D4436]/60 text-center">
            <div className="px-3 py-1.5 rounded-xl bg-[#F8FAF8] dark:bg-[#111A14] border border-[#D9E2DA]/60 dark:border-[#2D4436]/60">
              <span className="text-[10px] font-bold text-[#526357] dark:text-[#95A89C] uppercase block">
                Thermal Pass Rate
              </span>
              <span className="font-mono font-black text-sm sm:text-base text-[#059669]">
                {tempStats.complianceRate}%
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#F8FAF8] dark:bg-[#111A14] border border-[#D9E2DA]/60 dark:border-[#2D4436]/60">
              <span className="text-[10px] font-bold text-[#526357] dark:text-[#95A89C] uppercase block">
                Total Checkpoints
              </span>
              <span className="font-mono font-black text-sm sm:text-base text-[#0F1E17] dark:text-[#F4F8F5]">
                {tempStats.totalLogsCount} Logs
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#F8FAF8] dark:bg-[#111A14] border border-[#D9E2DA]/60 dark:border-[#2D4436]/60">
              <span className="text-[10px] font-bold text-[#526357] dark:text-[#95A89C] uppercase block">
                Batches Tracked
              </span>
              <span className="font-mono font-black text-sm sm:text-base text-[#0F1E17] dark:text-[#F4F8F5]">
                {tempStats.auditedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BOX */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter tabs: All, Active, Completed */}
        <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] shadow-xs">
          {(['All', 'Active', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] ${
                filterTab === tab
                  ? 'bg-[#2E7D4F] text-white shadow-xs'
                  : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
              }`}
            >
              {tab === 'All' ? t('ledger.filterAll', 'All') : tab === 'Active' ? t('ledger.filterClaimed', 'Active') : t('ledger.filterDelivered', 'Completed')}
            </button>
          ))}
        </div>

        {/* Search box to find items by name */}
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#526357] dark:text-[#95A89C]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('leaderboard.searchPlaceholder', 'Search items by name...')}
            className="w-full h-10 pl-9 pr-8 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] text-xs sm:text-sm text-[#1E2A22] dark:text-[#FAFBF8] placeholder:text-[#526357] dark:placeholder:text-[#95A89C] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* LIST OF DONATIONS AND PICKUPS */}
      {loading ? (
        <div className="p-12 text-center text-sm text-[#526357] dark:text-[#95A89C]">
          {t('common.loading', 'Loading donations and pickups...')}
        </div>
      ) : filteredRecords.length === 0 ? (
        /* Empty state with a plain sentence and a link to the Donor page */
        <div className="bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <p className="text-base text-[#1E2A22] dark:text-[#FAFBF8]">
            {t('ledger.noLedgerItems', 'You have not made any donations or pickups yet.')}
          </p>
          <p className="text-sm text-[#526357] dark:text-[#95A89C]">
            Share extra prepared meals with verified community shelters and care homes.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleNavigateToDonor}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2E7D4F] hover:text-[#1F5C39] hover:underline cursor-pointer"
            >
              <span>{t('verify.goToDonorPortal', 'Go to the Donor page to list surplus food')}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      ) : (
        /* Clean list where each row shows: small icon, food name, category, date, temperature safety, status label, quantity on right */
        <div className="bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-2xl shadow-xs overflow-hidden divide-y divide-[#D9E2DA] dark:divide-[#2D4436]">
          {paginatedRecords.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="p-4 sm:p-5 hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
            >
              {/* Left group: small icon + food name + category + date */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Small icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    item.isVeg
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F]'
                      : 'bg-[#FFF3E8] dark:bg-[#3D2614] text-[#D9822B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.isVeg ? 'eco' : 'restaurant'}
                  </span>
                </div>

                {/* Food name, category, date */}
                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base text-[#1E2A22] dark:text-[#FAFBF8] group-hover:text-[#2E7D4F] transition-colors truncate">
                    {item.foodName}
                  </div>
                  <div className="text-xs text-[#526357] dark:text-[#95A89C] flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-medium text-[#1E2A22] dark:text-[#FAFBF8]">{item.category}</span>
                    <span>•</span>
                    <span>{item.date}</span>
                    {item.isSample && (
                      <>
                        <span>•</span>
                        <span className="text-[10px] text-[#526357] dark:text-[#95A89C]">(Sample)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle & Right group */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 sm:gap-5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#D9E2DA]/60 dark:border-[#2D4436]/60">
                {/* Food Safety & Batch Temperature Transparency Indicator */}
                <div className="flex items-center gap-2">
                  {item.currentTemperature !== undefined ? (
                    (() => {
                      const verdict = evaluateTemperatureSafety(
                        item.currentTemperature,
                        (item.storageCondition as StorageConditionType) || 'Hot and covered'
                      );
                      const logCount = (item.temperatureLogs || []).length || 1;
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:opacity-90 transition-all cursor-pointer ${verdict.badgeColorClass} ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
                            title={`FSSAI Food Safety Audit: ${item.currentTemperature}°C (${verdict.headline})`}
                          >
                            <span className="material-symbols-outlined text-[15px]">{verdict.icon}</span>
                            <span className="font-mono">{item.currentTemperature}°C</span>
                            <span className="hidden sm:inline text-[11px] font-medium border-l pl-1.5 border-current/25">
                              {verdict.badgeLabel.split('·')[1]?.trim() || 'Safe'}
                            </span>
                            <span className="text-[10px] opacity-75 font-normal">
                              ({logCount} log{logCount !== 1 ? 's' : ''})
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTempModalItem(item);
                            }}
                            className="px-2 py-1 rounded-lg border border-[#059669]/30 bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold text-[11px] flex items-center gap-0.5 hover:bg-[#D1FAE5] dark:hover:bg-[#203a2e] transition-colors cursor-pointer"
                            title="Input new food batch temperature"
                          >
                            <span className="material-symbols-outlined text-[13px]">add</span>
                            <span>Log</span>
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-xl border border-dashed border-[#D9E2DA] dark:border-[#2D4436] bg-slate-50 dark:bg-[#111A14] text-[11px] font-medium text-[#526357] dark:text-[#95A89C] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">device_thermostat</span>
                        <span>Pending Temp Check</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempModalItem(item);
                        }}
                        className="px-2 py-1 rounded-lg border border-[#059669]/30 bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold text-[11px] flex items-center gap-0.5 hover:bg-[#D1FAE5] cursor-pointer"
                        title="Input initial food batch temperature"
                      >
                        <span className="material-symbols-outlined text-[13px]">add</span>
                        <span>Log</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Status label + Quantity */}
                <div className="flex items-center gap-4">
                  <div>{renderStatusBadge(item.status)}</div>
                  <div className="text-right min-w-[70px]">
                    <div className="font-bold text-sm sm:text-base text-[#1E2A22] dark:text-[#FAFBF8]">
                      {item.quantityStr}
                    </div>
                    <div className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                      Details →
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINATION AT THE BOTTOM (10 rows per page) */}
      {filteredRecords.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs sm:text-sm text-[#526357] pt-2">
          <span>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of{' '}
            {filteredRecords.length} items
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] disabled:opacity-40 cursor-pointer min-h-[36px]"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                  currentPage === pg
                    ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                    : 'bg-white dark:bg-[#18241C] text-[#1E2A22] dark:text-[#FAFBF8] border-[#D9E2DA] dark:border-[#2D4436] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                }`}
              >
                {pg}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] disabled:opacity-40 cursor-pointer min-h-[36px]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* DETAILS PANEL / MODAL (Opens upon clicking any row) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18241C] rounded-2xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-xl w-full p-6 sm:p-7 space-y-6 animate-fadeIn my-8 text-[#1E2A22] dark:text-[#FAFBF8]">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#D9E2DA] dark:border-[#2D4436] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-serif text-xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                    {selectedItem.foodName}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedItem.isVeg
                        ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F]'
                        : 'bg-[#FFF3E8] dark:bg-[#3D2614] text-[#D9822B]'
                    }`}
                  >
                    {selectedItem.category}
                  </span>
                  <span>•</span>
                  <span className="text-xs text-[#526357] dark:text-[#95A89C]">{selectedItem.date}</span>
                  <span>•</span>
                  {renderStatusBadge(selectedItem.status)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] p-1 rounded-lg hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Description & Quantity */}
            <div className="p-3.5 rounded-xl bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436] space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#526357] dark:text-[#95A89C]">Total Portion:</span>
                <span className="font-bold text-base text-[#1E2A22] dark:text-[#FAFBF8]">
                  {selectedItem.quantityStr}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526357] dark:text-[#95A89C]">Storage Condition:</span>
                <span className="font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                  {selectedItem.storageCondition || 'Hot and covered'}
                </span>
              </div>
              {selectedItem.description && (
                <div className="pt-1.5 border-t border-[#D9E2DA]/60 dark:border-[#2D4436]/60 text-[#526357] dark:text-[#95A89C]">
                  <span className="font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">Notes: </span>
                  {selectedItem.description}
                </div>
              )}
            </div>

            {/* Donor and Organization Involved */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Donor */}
              <div className="p-3.5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] bg-[#FAFBF8] dark:bg-[#111A14] space-y-1.5">
                <div className="font-bold text-[#1E2A22] dark:text-[#FAFBF8] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">
                    storefront
                  </span>
                  <span>Donor</span>
                </div>
                <div className="text-sm font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                  {selectedItem.donorOrg}
                </div>
                <div className="text-[#526357] dark:text-[#95A89C]">{selectedItem.donorName}</div>
                <div className="text-[#526357] dark:text-[#95A89C]">{selectedItem.donorPhone}</div>
                <div className="text-[#526357] dark:text-[#95A89C] text-[11px] pt-1 truncate">
                  {selectedItem.donorAddress}
                </div>
              </div>

              {/* Organization */}
              <div className="p-3.5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] bg-[#FAFBF8] dark:bg-[#111A14] space-y-1.5">
                <div className="font-bold text-[#1E2A22] dark:text-[#FAFBF8] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">
                    corporate_fare
                  </span>
                  <span>Claiming Organization</span>
                </div>
                <div className="text-sm font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                  {selectedItem.recipientOrg}
                </div>
                {selectedItem.recipientContact && (
                  <div className="text-[#526357] dark:text-[#95A89C]">{selectedItem.recipientContact}</div>
                )}
                {selectedItem.courierName && (
                  <div className="text-xs text-[#2E7D4F] pt-1">
                    Courier: {selectedItem.courierName}
                  </div>
                )}
              </div>
            </div>

            {/* Pickup Time */}
            <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-[#EAF3EC] dark:bg-[#203026] border border-[#A7F3D0] dark:border-[#2E7D4F] text-[#1E2A22] dark:text-[#FAFBF8]">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">
                  schedule
                </span>
                <span>Pickup Time / Window:</span>
              </span>
              <span className="font-bold">{selectedItem.pickupTime}</span>
            </div>

            {/* Food Safety & Temperature Chain of Custody (Transparency Ledger) */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#D9E2DA] dark:border-[#2D4436] bg-[#F8FAF8] dark:bg-[#111A14] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9E2DA]/60 dark:border-[#2D4436]/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#059669]">
                    health_and_safety
                  </span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#0F1E17] dark:text-[#F4F8F5]">
                      Food Safety &amp; Temperature Chain of Custody
                    </h3>
                    <p className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                      FSSAI / HACCP public transparency ledger records
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTempModalItem(selectedItem)}
                  className="px-3 py-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer shrink-0 self-start sm:self-auto"
                  title="Input new temperature log checkpoint for this batch"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>Log Temperature Check</span>
                </button>
              </div>

              {/* Current Holding Temperature Banner */}
              {(() => {
                const currentTemp =
                  selectedItem.currentTemperature ??
                  selectedItem.temperatureLogs?.[0]?.temperatureCelsius;
                const cond =
                  (selectedItem.storageCondition as StorageConditionType) || 'Hot and covered';
                if (currentTemp !== undefined) {
                  const verdict = evaluateTemperatureSafety(currentTemp, cond);
                  return (
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/80 dark:bg-black/30 flex items-center justify-center shrink-0">
                          <span className={`material-symbols-outlined text-2xl ${verdict.badgeColorClass}`}>
                            {verdict.icon}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5]">
                              {currentTemp}°C
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${verdict.badgeColorClass} ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
                            >
                              {verdict.badgeLabel}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-[#4B6356] dark:text-[#B2CDC0] mt-0.5">
                            {verdict.headline}: {verdict.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:border-l sm:pl-4 border-current/20 shrink-0">
                        <span className="text-[10px] uppercase font-bold text-[#526357] dark:text-[#95A89C] block">
                          Storage Regime
                        </span>
                        <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                          {cond}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">warning</span>
                      <span>No temperature logs recorded yet for this surplus food batch.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempModalItem(selectedItem)}
                      className="text-xs font-bold text-[#059669] hover:underline cursor-pointer"
                    >
                      Record First Log →
                    </button>
                  </div>
                );
              })()}

              {/* Logged Checkpoints Timeline */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#059669]">receipt_long</span>
                    <span>Audit Checkpoint Entries ({selectedItem.temperatureLogs?.length || 0})</span>
                  </span>
                  <span className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                    Immutable public safety log
                  </span>
                </div>

                {selectedItem.temperatureLogs && selectedItem.temperatureLogs.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedItem.temperatureLogs.map((log, idx) => {
                      const logVerdict = evaluateTemperatureSafety(
                        log.temperatureCelsius,
                        log.storageCondition
                      );
                      return (
                        <div
                          key={log.id || idx}
                          className="p-3 rounded-xl bg-white dark:bg-[#18241C] border border-[#D9E2DA]/80 dark:border-[#2D4436]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono font-black text-sm px-2 py-0.5 rounded-md ${logVerdict.badgeColorClass} ${logVerdict.badgeBgClass}`}
                              >
                                {log.temperatureCelsius}°C
                              </span>
                              <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                                {log.stageLabel}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#059669]/10 text-[#059669]">
                                {log.loggedByRole}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#526357] dark:text-[#95A89C] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>Verified by: <strong>{log.loggedByName}</strong></span>
                              <span>•</span>
                              <span>{log.probeMethod}</span>
                              {log.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate max-w-xs">"{log.notes}"</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-[10.5px] font-mono text-[#526357] dark:text-[#95A89C] shrink-0 self-end sm:self-center">
                            {log.loggedAt}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#526357] dark:text-[#95A89C] italic p-3 bg-white dark:bg-[#18241C] rounded-xl border border-dashed border-[#D9E2DA] dark:border-[#2D4436]">
                    Awaiting first thermal check. Donors and couriers can record temperatures during dispatch and pickup.
                  </p>
                )}
              </div>
            </div>

            {/* Status Timeline */}
            <div className="space-y-3 pt-2 border-t border-[#D9E2DA] dark:border-[#2D4436]">
              <h3 className="font-serif text-sm font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                Status timeline
              </h3>

              <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D9E2DA] dark:before:bg-[#2D4436]">
                {/* 1. Listed */}
                <div className="relative text-xs">
                  <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[#2E7D4F] text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <div className="font-bold text-[#1E2A22] dark:text-[#FAFBF8]">1. Listed by Donor</div>
                  <div className="text-[#526357] dark:text-[#95A89C] text-[11px]">{selectedItem.timeline.listedAt}</div>
                </div>

                {/* 2. Claimed */}
                <div className="relative text-xs">
                  <span
                    className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedItem.timeline.claimedAt
                        ? 'bg-[#2E7D4F] text-white'
                        : 'border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] text-transparent'
                    }`}
                  >
                    {selectedItem.timeline.claimedAt ? '✓' : ''}
                  </span>
                  <div
                    className={`font-bold ${
                      selectedItem.timeline.claimedAt ? 'text-[#1E2A22] dark:text-[#FAFBF8]' : 'text-[#526357] dark:text-[#95A89C]'
                    }`}
                  >
                    2. Claimed by Organization
                  </div>
                  <div className="text-[#526357] dark:text-[#95A89C] text-[11px]">
                    {selectedItem.timeline.claimedAt || 'Pending shelter claim'}
                  </div>
                </div>

                {/* 3. Picked up */}
                <div className="relative text-xs">
                  <span
                    className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedItem.timeline.pickedUpAt
                        ? 'bg-[#2E7D4F] text-white'
                        : 'border border-[#D9E2DA] bg-white text-transparent'
                    }`}
                  >
                    {selectedItem.timeline.pickedUpAt ? '✓' : ''}
                  </span>
                  <div
                    className={`font-bold ${
                      selectedItem.timeline.pickedUpAt ? 'text-[#1E2A22]' : 'text-[#526357]'
                    }`}
                  >
                    3. Picked up for Delivery
                  </div>
                  <div className="text-[#526357] text-[11px]">
                    {selectedItem.timeline.pickedUpAt || 'Awaiting logistics courier'}
                  </div>
                </div>

                {/* 4. Completed */}
                <div className="relative text-xs">
                  <span
                    className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedItem.timeline.completedAt
                        ? 'bg-[#2E7D4F] text-white'
                        : 'border border-[#D9E2DA] bg-white text-transparent'
                    }`}
                  >
                    {selectedItem.timeline.completedAt ? '✓' : ''}
                  </span>
                  <div
                    className={`font-bold ${
                      selectedItem.timeline.completedAt ? 'text-[#1E2A22]' : 'text-[#526357]'
                    }`}
                  >
                    4. Handed Over &amp; Completed
                  </div>
                  <div className="text-[#526357] text-[11px]">
                    {selectedItem.timeline.completedAt || 'Pending final verification handover'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#D9E2DA] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temperature Log Entry Modal for Donors, Couriers, and Public Ledger Audit */}
      {tempModalItem && (
        <TemperatureLogModal
          isOpen={Boolean(tempModalItem)}
          onClose={() => setTempModalItem(null)}
          listingId={tempModalItem.id}
          batchTitle={tempModalItem.foodName}
          storageCondition={
            (tempModalItem.storageCondition as StorageConditionType) || 'Hot and covered'
          }
          defaultRole={
            userProfile?.role === 'volunteer'
              ? 'courier'
              : userProfile?.role === 'donor' || userProfile?.role === 'restaurant'
              ? 'donor'
              : userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
              ? 'shelter'
              : 'donor'
          }
          defaultStage={
            tempModalItem.status === 'Listed'
              ? 'cooking_dispatch'
              : tempModalItem.status === 'Claimed'
              ? 'courier_pickup'
              : tempModalItem.status === 'Picked up'
              ? 'in_transit'
              : 'shelter_delivery'
          }
          existingLogs={tempModalItem.temperatureLogs || []}
          onTemperatureLogged={(newEntry) => {
            // Update Firestore items
            setFirestoreItems((prev) =>
              prev.map((item) =>
                item.id === tempModalItem.id
                  ? {
                      ...item,
                      currentTemperature: newEntry.temperatureCelsius,
                      latestTemperatureLog: newEntry,
                      temperatureLogs: [newEntry, ...(item.temperatureLogs || [])],
                    }
                  : item
              )
            );
            // Also update selectedItem if currently opened
            if (selectedItem && selectedItem.id === tempModalItem.id) {
              setSelectedItem((prev) =>
                prev
                  ? {
                      ...prev,
                      currentTemperature: newEntry.temperatureCelsius,
                      latestTemperatureLog: newEntry,
                      temperatureLogs: [newEntry, ...(prev.temperatureLogs || [])],
                    }
                  : null
              );
            }
          }}
        />
      )}
    </div>
  );
};
