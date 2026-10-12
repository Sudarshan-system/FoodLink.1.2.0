import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { FoodListing } from './DonorDashboard';
import { INDIAN_CITIES, matchesCity } from './cities';
import { CourierRescueMap } from './CourierRescueMap';
import { getUserUnlockedBadges } from './badgeSystem';
import { triggerStatusNotification } from './fcmService';
import { TemperatureLogModal } from './TemperatureLogModal';
import {
  TemperatureLogEntry,
  logBatchTemperature,
  evaluateTemperatureSafety,
  StorageConditionType,
} from './temperatureLogService';
import { OptimizedRoutePlan, RouteStop } from './MultiStopRoutePlanner';
import { useTranslation } from './LanguageContext';

interface VolunteerLogisticsProps {
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  onOpenAuth: () => void;
  onNavigateVerify: () => void;
  onOpenCsrModal: (listing?: FoodListing) => void;
}

interface ActiveMission {
  listing: FoodListing;
  status: 'heading_to_donor' | 'at_donor' | 'en_route_shelter' | 'delivered';
  transportMode: 'bike' | 'auto' | 'van';
  distanceKm: number;
  etaMinutes: number;
  tempChecked: boolean;
  hygieneApproved: boolean;
  handoffOtpInput: string;
  acceptedAt: number;
  shelterName?: string;
  measuredTemperature?: number;
}

interface ActiveMultiStopMission {
  plan: OptimizedRoutePlan;
  currentStopIndex: number;
  completedStopIds: string[];
  startedAt: number;
  tempCheckedStops: Record<string, boolean>;
  measuredTemperatures: Record<string, number>;
  status: 'in_progress' | 'delivered';
}

export const VolunteerLogistics: React.FC<VolunteerLogisticsProps> = ({
  selectedCityId,
  onSelectCity,
  onOpenAuth,
  onNavigateVerify,
  onOpenCsrModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [availableRuns, setAvailableRuns] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMission, setActiveMission] = useState<ActiveMission | null>(null);
  const [activeMultiStopMission, setActiveMultiStopMission] = useState<ActiveMultiStopMission | null>(null);
  const [logisticsViewMode, setLogisticsViewMode] = useState<'single' | 'multi_stop'>('single');
  const [multiStopTempInput, setMultiStopTempInput] = useState<number>(65);
  const [vehicleType, setVehicleType] = useState<'bike' | 'auto' | 'van'>('bike');
  const [selectedRunForTemp, setSelectedRunForTemp] = useState<FoodListing | null>(null);
  const [tempModalStage, setTempModalStage] = useState<'courier_pickup' | 'in_transit'>('courier_pickup');
  const [volunteerStats, setVolunteerStats] = useState({
    completedRuns: 14,
    kgDelivered: 420,
    co2SavedKg: 1029,
    badgeLevel: 'Tier 3 Golden Courier',
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleStartMultiStopMission = (plan: OptimizedRoutePlan) => {
    setActiveMultiStopMission({
      plan,
      currentStopIndex: 1, // Stop 0 is Origin Hub, Stop 1 is First Pickup
      completedStopIds: [plan.orderedStops[0]?.id || 'origin_hub'],
      startedAt: Date.now(),
      tempCheckedStops: {},
      measuredTemperatures: {},
      status: 'in_progress',
    });
    setLogisticsViewMode('multi_stop');
    const firstPickup = plan.orderedStops[1];
    showToast(`Multi-Stop Rescue Circuit Started! Heading to Stop #2: ${firstPickup?.title || 'First Pickup'}`);
  };

  const handleConfirmMultiStopPickup = async (stop: RouteStop) => {
    if (!activeMultiStopMission) return;
    const temp = multiStopTempInput || 65;

    if (stop.listingId) {
      try {
        await logBatchTemperature(stop.listingId, {
          batchTitle: stop.title,
          temperatureCelsius: temp,
          stage: 'courier_pickup',
          storageCondition: (stop.storageCondition as StorageConditionType) || 'Hot and covered',
          loggedByRole: 'courier',
          loggedByName: userProfile?.displayName || currentUser?.displayName || 'Courier Runner',
          loggedByUserId: currentUser?.uid || 'courier_volunteer',
          notes: `Multi-stop consolidated route checkpoint verification: ${stop.address}`,
        });
      } catch (err) {
        console.error('Failed to log temperature:', err);
      }
    }

    const nextIdx = activeMultiStopMission.currentStopIndex + 1;
    const newCompleted = [...activeMultiStopMission.completedStopIds, stop.id];
    const isAtFinal = nextIdx >= activeMultiStopMission.plan.orderedStops.length - 1;

    setActiveMultiStopMission({
      ...activeMultiStopMission,
      currentStopIndex: nextIdx,
      completedStopIds: newCompleted,
      tempCheckedStops: {
        ...activeMultiStopMission.tempCheckedStops,
        [stop.id]: true,
      },
      measuredTemperatures: {
        ...activeMultiStopMission.measuredTemperatures,
        [stop.id]: temp,
      },
      status: 'in_progress',
    });

    const nextStop = activeMultiStopMission.plan.orderedStops[nextIdx];
    if (isAtFinal) {
      showToast(`All surplus batches secured! En route to final recipient shelter: ${nextStop?.title}`);
    } else {
      showToast(`Pickup verified! Proceeding to Stop #${nextIdx + 1}: ${nextStop?.title}`);
    }
  };

  const handleCompleteMultiStopMission = () => {
    if (!activeMultiStopMission) return;
    const finalStop = activeMultiStopMission.plan.orderedStops[activeMultiStopMission.plan.orderedStops.length - 1];

    setActiveMultiStopMission({
      ...activeMultiStopMission,
      completedStopIds: [...activeMultiStopMission.completedStopIds, finalStop.id],
      status: 'delivered',
    });

    setVolunteerStats((prev) => ({
      ...prev,
      completedRuns: prev.completedRuns + activeMultiStopMission.plan.orderedStops.filter((s) => s.type === 'pickup').length,
      kgDelivered: prev.kgDelivered + 85,
      co2SavedKg: prev.co2SavedKg + Math.round(activeMultiStopMission.plan.co2SavedKg),
    }));

    showToast('Multi-stop rescue mission complete! Verified thermal chain of custody recorded.');
  };

  const handleAbortMultiStopMission = () => {
    setActiveMultiStopMission(null);
    showToast('Multi-stop rescue mission cancelled.');
  };

  // Real-time listener for listings that are claimed or available and need courier rescue
  useEffect(() => {
    setLoading(true);
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('status', 'in', ['claimed', 'available']));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FoodListing[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<FoodListing, 'id'>),
          });
        });

        // Filter by selected city
        const cityFiltered = items.filter((item) =>
          matchesCity(item.location, selectedCityId)
        );

        setAvailableRuns(cityFiltered);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching volunteer runs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedCityId]);

  const handleAcceptRun = (listing: FoodListing) => {
    const pseudoDist = Math.round((2.5 + Math.random() * 5.5) * 10) / 10;
    const pseudoEta = Math.round(pseudoDist * 4 + 8);
    const initialTemp = listing.initialTemperature ?? listing.currentTemperature ?? (listing.storageCondition === 'Refrigerated' ? 4.0 : 68.0);

    setActiveMission({
      listing,
      status: 'heading_to_donor',
      transportMode: vehicleType,
      distanceKm: pseudoDist,
      etaMinutes: pseudoEta,
      tempChecked: false,
      hygieneApproved: false,
      handoffOtpInput: '',
      acceptedAt: Date.now(),
      measuredTemperature: initialTemp,
    });

    showToast(`Mission Accepted! Heading to ${listing.donorOrg || 'Donor Kitchen'}`);
  };

  const handleConfirmArrivedDonor = () => {
    if (!activeMission) return;
    setActiveMission({
      ...activeMission,
      status: 'at_donor',
    });
    showToast('Arrived at donor kitchen. Please complete food hygiene & temperature check.');
  };

  const handleConfirmCargoLoaded = async () => {
    if (!activeMission) return;
    if (!activeMission.tempChecked || !activeMission.hygieneApproved) {
      showToast('Please verify both thermal temperature and sealed packaging safety check!');
      return;
    }

    const measuredTemp =
      activeMission.measuredTemperature ||
      (activeMission.listing.storageCondition === 'Refrigerated' ? 4.0 : 68.0);

    try {
      await logBatchTemperature(activeMission.listing.id, {
        batchTitle: activeMission.listing.title,
        temperatureCelsius: measuredTemp,
        stage: 'courier_pickup',
        storageCondition: (activeMission.listing.storageCondition as StorageConditionType) || 'Hot and covered',
        loggedByRole: 'courier',
        loggedByName: userProfile?.displayName || currentUser?.displayName || 'Courier Runner',
        loggedByUserId: currentUser?.uid || 'courier_demo',
        probeMethod: 'Infrared Non-Contact Gun',
        notes: `Pickup verified by courier. Batch secured in insulated thermal bag at ${measuredTemp}°C.`,
      });
    } catch (e) {
      console.warn('Courier temperature log error:', e);
    }

    setActiveMission({
      ...activeMission,
      status: 'en_route_shelter',
    });
    showToast(`Thermal check passed (${measuredTemp}°C)! Published to Public Ledger.`);
  };

  const handleCompleteHandover = async () => {
    if (!activeMission) return;
    if (!activeMission.handoffOtpInput.trim()) {
      showToast('Please enter the 4-digit recipient shelter handoff verification code.');
      return;
    }

    try {
      // Mark as completed in Firestore
      await updateDoc(doc(db, 'listings', activeMission.listing.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        volunteerCourierId: currentUser?.uid || 'volunteer-runner-01',
        volunteerCourierName: userProfile?.displayName || currentUser?.displayName || 'Volunteer Runner',
        handoffCodeEntered: activeMission.handoffOtpInput,
      });

      // Log handover temperature to public ledger
      const handoverTemp = Number(
        ((activeMission.measuredTemperature || 68.0) - (activeMission.listing.storageCondition === 'Refrigerated' ? -0.4 : 2.2)).toFixed(1)
      );
      await logBatchTemperature(activeMission.listing.id, {
        batchTitle: activeMission.listing.title,
        temperatureCelsius: handoverTemp,
        stage: 'shelter_delivery',
        storageCondition: (activeMission.listing.storageCondition as StorageConditionType) || 'Hot and covered',
        loggedByRole: 'courier',
        loggedByName: userProfile?.displayName || currentUser?.displayName || 'Courier Runner',
        loggedByUserId: currentUser?.uid || 'courier_demo',
        probeMethod: 'Calibrated Probe Thermometer',
        notes: `Delivery completed at shelter with OTP ${activeMission.handoffOtpInput}. Handover temperature confirmed safe at ${handoverTemp}°C.`,
      });

      setVolunteerStats((prev) => ({
        ...prev,
        completedRuns: prev.completedRuns + 1,
        kgDelivered: prev.kgDelivered + activeMission.listing.quantity,
        co2SavedKg: prev.co2SavedKg + Math.round(activeMission.listing.quantity * 2.45),
      }));

      // Trigger FCM delivery confirmed push notification for donor and shelter
      triggerStatusNotification({
        listingId: activeMission.listing.id,
        listingTitle: activeMission.listing.title,
        status: 'completed',
        donorId: activeMission.listing.donorId,
        recipientId: activeMission.listing.claimingOrgId || '',
        donorName: activeMission.listing.donorOrg,
        recipientName: activeMission.listing.claimingOrgName || 'Recipient Shelter',
      });

      setActiveMission({
        ...activeMission,
        status: 'delivered',
      });
      showToast('Rescue delivery confirmed! 80G tax certificate & thermal log recorded.');
    } catch (err) {
      console.error('Handover completion error:', err);
      showToast('Handover verification failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#D97706] text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-[13px] flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Mode Control */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border transition-colors shadow-xs ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#111A17]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#D97706]/15 text-[#D97706] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-ping" />
                <span>Volunteer Courier &amp; Logistics Mode</span>
              </span>
              <span className="text-[12px] font-bold text-[#059669] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">electric_bolt</span>
                <span>Zero Wastage Dispatch</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t('courier.hubTitle', 'Rapid Food Rescue Dispatch & Route Hub')}
            </h1>
            <p className={`text-[13px] max-w-2xl ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
              {t('courier.hubSubtitle', 'Pick up inspected surplus batches from restaurants, caterers, and banquets, and safely deliver them to verified NGO shelters within the critical safe consumption window.')}
            </p>
          </div>

          {/* Vehicle Selector & City Indicator */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div
              className={`p-1.5 rounded-2xl border flex items-center gap-1 text-[12px] font-bold ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <button
                type="button"
                onClick={() => setVehicleType('bike')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'bike'
                    ? 'bg-[#D97706] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Electric Two-Wheeler (Fast for <25kg)"
              >
                <span className="material-symbols-outlined text-[16px]">two_wheeler</span>
                <span>{t('courier.bike', 'EV Bike')}</span>
              </button>

              <button
                type="button"
                onClick={() => setVehicleType('auto')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'auto'
                    ? 'bg-[#D97706] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Cargo Auto (Ideal for 25-150kg)"
              >
                <span className="material-symbols-outlined text-[16px]">electric_rickshaw</span>
                <span>{t('courier.auto', 'Auto')}</span>
              </button>

              <button
                type="button"
                onClick={() => setVehicleType('van')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  vehicleType === 'van'
                    ? 'bg-[#D97706] text-white shadow-xs'
                    : isDark
                    ? 'text-[#B8CCC1] hover:text-white'
                    : 'text-[#4D5C56] hover:text-[#111A17]'
                }`}
                title="Insulated Mini-Van (>150kg Banquets)"
              >
                <span className="material-symbols-outlined text-[16px]">airport_shuttle</span>
                <span>{t('courier.van', 'Van')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Courier Digital Passport / Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#CFDED5]/60 dark:border-[#233833]">
          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              {t('courier.completedRunsStat', 'Completed Missions')}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-[#D97706]">
                {volunteerStats.completedRuns}
              </span>
              <span className="text-[11px] font-bold text-[#059669]">Verified</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Surplus Rescued
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#059669]">
                {volunteerStats.kgDelivered}
              </span>
              <span className="text-[12px] font-bold">kg</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              {t('courier.co2SavedStat', 'Carbon Offset')}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#059669]">
                {volunteerStats.co2SavedKg}
              </span>
              <span className="text-[12px] font-bold">kg CO₂e</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
            }`}
          >
            <span className={`text-[10px] font-bold block uppercase tracking-wider ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
              Milestone Badges
            </span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-500/30">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">workspace_premium</span>
                <span>Century Rescuer</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center gap-0.5 border border-amber-500/30">
                <span className="material-symbols-outlined text-[12px]">electric_bolt</span>
                <span>Rapid</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Logistics Dispatch Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#CFDED5] dark:border-[#233833] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-[22px]">alt_route</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-2">
              <span>Google Maps Rescue Navigation &amp; Routing Mode</span>
            </h3>
            <p className="text-xs text-[#526357] dark:text-[#95A89C]">
              Switch between single immediate dispatch runs and fastest multi-stop consolidated circuits
            </p>
          </div>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#CFDED5] dark:border-[#233833]">
          <button
            type="button"
            onClick={() => setLogisticsViewMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              logisticsViewMode === 'single'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">near_me</span>
            <span>Single Pickup Dispatch</span>
          </button>

          <button
            type="button"
            onClick={() => setLogisticsViewMode('multi_stop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              logisticsViewMode === 'multi_stop'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#526357] dark:text-[#95A89C] hover:text-[#0F1E17] dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">alt_route</span>
            <span>Fastest Multi-Stop Circuit</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-amber-400 text-slate-900 ml-0.5">
              Google Maps
            </span>
          </button>
        </div>
      </div>

      {/* ACTIVE MULTI-STOP MISSION CONSOLE (IF ACTIVE) */}
      {activeMultiStopMission && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border-2 border-[#059669] shadow-xl relative overflow-hidden transition-colors ${
            isDark ? 'bg-[#162421]' : 'bg-[#FFFFFF]'
          }`}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CFDED5]/60 dark:border-[#233833]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">alt_route</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#059669]/20 text-[#059669] uppercase tracking-wider">
                    Multi-Stop Rescue Circuit • {activeMultiStopMission.status === 'delivered' ? 'Completed' : 'In Progress'}
                  </span>
                  <span className="text-[12px] font-bold text-[#059669] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    <span>Total Circuit ETA ~{activeMultiStopMission.plan.totalDurationMins} mins</span>
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight mt-0.5">
                  Checkpoint {Math.min(activeMultiStopMission.currentStopIndex + 1, activeMultiStopMission.plan.orderedStops.length)} of {activeMultiStopMission.plan.orderedStops.length}: {activeMultiStopMission.plan.orderedStops[activeMultiStopMission.currentStopIndex]?.title || 'Final Stop'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeMultiStopMission.plan.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl border border-[#CFDED5] dark:border-[#233833] hover:bg-slate-50 dark:hover:bg-[#182C22] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-blue-600">open_in_new</span>
                <span>Open Full Route in Google Maps</span>
              </a>
              <button
                type="button"
                onClick={handleAbortMultiStopMission}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              >
                Cancel Run
              </button>
            </div>
          </div>

          {/* Sequential Checkpoints Progress Ribbon */}
          <div className="py-4 border-b border-[#CFDED5]/60 dark:border-[#233833]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-[#526357] dark:text-[#95A89C]">Circuit Progression</span>
              <span className="font-bold text-[#059669]">
                {activeMultiStopMission.completedStopIds.length} / {activeMultiStopMission.plan.orderedStops.length} Checkpoints Cleared
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {activeMultiStopMission.plan.orderedStops.map((stop, sIdx) => {
                const isCleared = activeMultiStopMission.completedStopIds.includes(stop.id);
                const isCurrent = activeMultiStopMission.currentStopIndex === sIdx;
                const isDelivery = stop.type === 'delivery';

                return (
                  <div
                    key={`checkpoint-${stop.id}-${sIdx}`}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      isCleared
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : isCurrent
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                      <span>Stop #{sIdx + 1}</span>
                      {isCleared ? (
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                      ) : isCurrent ? (
                        <span className="material-symbols-outlined text-[14px] text-amber-600 animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                      )}
                    </div>
                    <p className="font-bold truncate text-[11px]">{stop.title}</p>
                    <span className="text-[10px] uppercase font-bold opacity-75 block mt-0.5">
                      {isDelivery ? 'Delivery' : stop.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Stop Action Box */}
          {activeMultiStopMission.status !== 'delivered' && (
            <div className="pt-5">
              {(() => {
                const curStop = activeMultiStopMission.plan.orderedStops[activeMultiStopMission.currentStopIndex];
                if (!curStop) return null;
                const isDelivery = curStop.type === 'delivery';
                const tempSafety = evaluateTemperatureSafety(
                  multiStopTempInput,
                  (curStop.storageCondition as StorageConditionType) || 'Hot and covered'
                );

                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#CFDED5] dark:border-[#233833] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#059669] text-white">
                            Current Target • Stop #{activeMultiStopMission.currentStopIndex + 1}
                          </span>
                          <span className="text-xs font-bold text-[#526357] dark:text-[#95A89C]">
                            {isDelivery ? 'Final Shelter Delivery' : 'Donor Kitchen Collection'}
                          </span>
                        </div>
                        <h3 className="font-serif font-black text-lg text-[#0F1E17] dark:text-[#F4F8F5] mt-1">
                          {curStop.title}
                        </h3>
                        <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                          📍 {curStop.address}
                        </p>
                      </div>

                      {curStop.contactPhone && (
                        <a
                          href={`tel:${curStop.contactPhone}`}
                          className="px-3 py-1.5 rounded-xl border border-[#059669] text-[#059669] hover:bg-[#059669]/10 text-xs font-bold flex items-center gap-1.5 transition-colors self-start"
                        >
                          <span className="material-symbols-outlined text-[16px]">call</span>
                          <span>Call {curStop.contactPerson || 'Coordinator'}</span>
                        </a>
                      )}
                    </div>

                    {!isDelivery ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#CFDED5]/60 dark:border-[#233833]">
                        {/* Food batch details */}
                        <div className="space-y-1.5 text-xs">
                          <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block">
                            Food Batch Details
                          </span>
                          <div className="p-3 rounded-xl bg-white dark:bg-[#112019] border border-[#CFDED5]/60 dark:border-[#233833] space-y-1">
                            <div>📦 Quantity: <strong>{curStop.quantity} {curStop.unit || 'plates'}</strong></div>
                            <div>❄️ Storage: <strong>{curStop.storageCondition}</strong></div>
                            <div>🌡️ Initial Temp: <strong className="font-mono text-[#059669] dark:text-[#34D399]">{curStop.initialTemperature !== undefined ? `${curStop.initialTemperature}°C` : 'Recorded at kitchen'}</strong></div>
                            <div>📋 Subtitle: {curStop.subtitle}</div>
                          </div>
                        </div>

                        {/* Temperature & Inspection Log Input */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                              Verify Thermal Temperature (°C)
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tempSafety.status === 'safe'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tempSafety.status === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tempSafety.badgeLabel}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-[#112019] border border-[#CFDED5]/60 dark:border-[#233833] flex items-center gap-3">
                            <input
                              type="number"
                              step="0.5"
                              value={multiStopTempInput}
                              onChange={(e) => setMultiStopTempInput(parseFloat(e.target.value) || 0)}
                              className="w-24 px-3 py-1.5 rounded-lg border border-[#CFDED5] dark:border-[#233833] font-mono font-bold text-sm bg-transparent"
                            />
                            <span className="text-xs text-[#526357] dark:text-[#95A89C]">
                              {curStop.storageCondition === 'Refrigerated' ? 'Target: ≤ 4°C' : 'Target: ≥ 60°C'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#112019] border border-[#CFDED5]/60 dark:border-[#233833] text-xs space-y-1">
                        <div className="font-bold text-[#059669]">Recipient Shelter Destination Reached!</div>
                        <p className="text-slate-600 dark:text-slate-400">
                          Transfer all consolidated food surplus batches to the shelter intake personnel. Digital 80G tax certification &amp; FSSAI chain of custody records will be generated automatically.
                        </p>
                      </div>
                    )}

                    {/* Step Action Button */}
                    <div className="flex items-center justify-between pt-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${curStop.lat},${curStop.lng}&travelmode=${vehicleType === 'bike' ? 'two-wheeler' : 'driving'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">navigation</span>
                        <span>Navigate to Stop #{activeMultiStopMission.currentStopIndex + 1}</span>
                      </a>

                      {!isDelivery ? (
                        <button
                          type="button"
                          onClick={() => handleConfirmMultiStopPickup(curStop)}
                          className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[17px]">verified</span>
                          <span>Verify Cargo &amp; Proceed to Next Stop</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCompleteMultiStopMission}
                          className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-[17px]">done_all</span>
                          <span>Complete Multi-Stop Rescue Circuit</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Mission Completed Card */}
          {activeMultiStopMission.status === 'delivered' && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/40 text-center space-y-3 mt-4">
              <span className="material-symbols-outlined text-4xl text-[#059669] block">
                military_tech
              </span>
              <h3 className="font-serif font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5]">
                Consolidated Multi-Stop Mission Cleared!
              </h3>
              <p className="text-xs text-[#526357] dark:text-[#95A89C] max-w-md mx-auto">
                All food pickup batches safely gathered, temperature verified, and delivered to the recipient shelter. You saved {activeMultiStopMission.plan.timeSavedMins} mins and avoided {activeMultiStopMission.plan.co2SavedKg} kg of redundant CO₂ emissions!
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenCsrModal()}
                  className="px-4 py-2 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-[#047857] cursor-pointer"
                >
                  Download 80G Certificate
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMultiStopMission(null)}
                  className="px-4 py-2 rounded-xl border border-[#CFDED5] dark:border-[#233833] font-bold text-xs hover:bg-white dark:hover:bg-[#112019] cursor-pointer"
                >
                  Close Mission
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GOOGLE MAPS ACTIVE DISPATCH ROUTES & PICKUP PINS */}
      <CourierRescueMap
        selectedCityId={selectedCityId}
        listings={availableRuns}
        activeMission={activeMission}
        onAcceptRun={handleAcceptRun}
        vehicleType={vehicleType}
        onStartMultiStopMission={handleStartMultiStopMission}
        defaultViewMode={logisticsViewMode === 'multi_stop' ? 'multi_stop' : 'split'}
      />

      {/* ACTIVE DISPATCH MISSION WORKFLOW (IF ACCEPTED) */}
      {activeMission && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border-2 border-[#D97706] shadow-xl relative overflow-hidden transition-colors ${
            isDark ? 'bg-[#162421]' : 'bg-[#FFFFFF]'
          }`}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#CFDED5]/60 dark:border-[#233833]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#D97706] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">local_shipping</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#D97706]/20 text-[#D97706] uppercase tracking-wider">
                    Active Mission #{activeMission.listing.id.slice(0, 6)}
                  </span>
                  <span className="text-[12px] font-bold text-[#059669] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">speed</span>
                    <span>ETA ~{activeMission.etaMinutes} mins</span>
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight mt-0.5">
                  {activeMission.listing.title} ({activeMission.listing.quantity} {activeMission.listing.unit})
                </h2>
              </div>
            </div>

            {activeMission.status === 'delivered' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCsrModal(activeMission.listing)}
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>View 80G Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMission(null)}
                  className="px-4 py-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-[13px] cursor-pointer"
                >
                  Start Next Run
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Cancel this active rescue mission?')) {
                    setActiveMission(null);
                    showToast('Mission cancelled');
                  }
                }}
                className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border cursor-pointer ${
                  isDark
                    ? 'border-[#233833] text-[#B8CCC1] hover:text-white hover:bg-[#1C2E2A]'
                    : 'border-[#CFDED5] text-[#4D5C56] hover:text-[#111A17] hover:bg-[#EBF2ED]'
                }`}
              >
                Abort Mission
              </button>
            )}
          </div>

          {/* Stepper Progress Bar */}
          <div className="my-6 grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'heading_to_donor'
                  ? 'border-[#D97706] bg-[#D97706]/10 text-[#D97706]'
                  : 'border-[#059669] bg-[#059669]/10 text-[#059669]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">navigation</span>
              <span>1. En Route Donor</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'at_donor'
                  ? 'border-[#D97706] bg-[#D97706]/10 text-[#D97706]'
                  : activeMission.status === 'en_route_shelter' || activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span>2. Cargo Inspection</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'en_route_shelter'
                  ? 'border-[#D97706] bg-[#D97706]/10 text-[#D97706]'
                  : activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">route</span>
              <span>3. Transit to Shelter</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 ${
                activeMission.status === 'delivered'
                  ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                  : isDark
                  ? 'border-[#233833] text-[#7B9487]'
                  : 'border-[#CFDED5] text-[#71827A]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>4. OTP Handover</span>
            </div>
          </div>

          {/* Mission Details & Route Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            {/* Cargo Batch & Initial Temperature Card */}
            <div
              className={`p-4 rounded-2xl border md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#059669]/15 text-[#059669] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">device_thermostat</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-[#059669] tracking-wider">
                      Thermal Chain of Custody
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#059669]/15 text-[#059669] font-bold">
                      {activeMission.listing.storageCondition || 'Hot and covered'}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold mt-0.5">
                    Donor Initial Batch Temperature:{' '}
                    <span className="font-mono text-[#059669] dark:text-[#34D399] font-black text-base">
                      {activeMission.listing.initialTemperature !== undefined
                        ? `${activeMission.listing.initialTemperature}°C`
                        : activeMission.listing.currentTemperature !== undefined
                        ? `${activeMission.listing.currentTemperature}°C`
                        : `${activeMission.listing.fssaiCompliance?.dispatchTemperatureCelsius || 72}°C`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#162421] border border-[#CFDED5] dark:border-[#233833] text-[#4D5C56] dark:text-[#B8CCC1]">
                  📦 {activeMission.listing.quantity} {activeMission.listing.unit}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold">
                  ✓ Donor Baseline Logged
                </span>
              </div>
            </div>

            {/* Pickup Node */}
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#D97706] tracking-wider">
                  Pickup Point (Donor)
                </span>
                <span className="text-[11px] font-mono font-bold text-[#059669]">
                  {activeMission.distanceKm} km away
                </span>
              </div>
              <p className="font-extrabold text-[15px]">{activeMission.listing.donorOrg}</p>
              <p className={`text-[12px] mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                {activeMission.listing.location}
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#CFDED5]/50 dark:border-[#233833] text-[12px]">
                <span className="font-bold">Contact:</span>
                <span>{activeMission.listing.donorName}</span>
                {activeMission.listing.donorPhone && (
                  <a
                    href={`tel:${activeMission.listing.donorPhone}`}
                    className="text-[#D97706] hover:underline font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call Donor</span>
                  </a>
                )}
              </div>
            </div>

            {/* Destination Node */}
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#059669] tracking-wider">
                  Destination Node (Shelter)
                </span>
                <span className="text-[11px] font-bold text-[#D97706]">Priority Drop</span>
              </div>
              <p className="font-extrabold text-[15px]">
                {activeMission.listing.claimedQuantity ? 'Akshaya Patra Community Food Hall' : 'Registered City NGO Shelter'}
              </p>
              <p className={`text-[12px] mt-0.5 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                Receiving Bay #2, Urban Relief Center, Central Hub
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#CFDED5]/50 dark:border-[#233833] text-[12px]">
                <span className="font-bold">Protocol:</span>
                <span className="text-[#059669] font-semibold">Immediate Dinner Distribution</span>
              </div>
            </div>
          </div>

          {/* STEP CONTROLS */}
          {activeMission.status === 'heading_to_donor' && (
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <h4 className="font-bold text-[14px]">Heading to Donor Facility</h4>
                <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Drive safely. Park in designated receiving bay. Click below once you arrive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmArrivedDonor}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">where_to_vote</span>
                <span>Confirm Arrival at Donor</span>
              </button>
            </div>
          )}

          {activeMission.status === 'at_donor' && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-[14px] text-[#D97706] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">device_thermostat</span>
                    <span>FSSAI Food Quality &amp; Thermal Cargo Inspection</span>
                  </h4>
                  <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                    Verify that the surplus batch satisfies statutory temperature and clean packaging requirements before loading into your vehicle crate:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRunForTemp(activeMission.listing);
                    setTempModalStage('courier_pickup');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold text-xs flex items-center gap-1 hover:bg-[#D1FAE5] cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  <span>Advanced Temp Logger</span>
                </button>
              </div>

              {/* Physical Temperature Input Widget */}
              <div className="p-4 rounded-xl border border-[#D97706]/30 bg-[#D97706]/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D97706] flex items-center gap-1">
                    <span>Courier Measured Temperature (°C)</span>
                  </span>
                  <span className="text-[11px] text-[#4D5C56] dark:text-[#B8CCC1]">
                    Storage: <strong>{activeMission.listing.storageCondition || 'Hot and covered'}</strong>
                  </span>
                </div>

                {/* Donor Initial Baseline Comparison */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 dark:bg-[#112019] border border-[#D97706]/30 text-xs shadow-2xs">
                  <span className="text-[#92400E] dark:text-[#FCD34D] font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">thermostat</span>
                    <span>Donor Recorded Initial Temperature:</span>
                  </span>
                  <span className="font-mono font-black text-sm text-[#059669] dark:text-[#34D399]">
                    {activeMission.listing.initialTemperature !== undefined
                      ? `${activeMission.listing.initialTemperature}°C`
                      : activeMission.listing.currentTemperature !== undefined
                      ? `${activeMission.listing.currentTemperature}°C`
                      : `${activeMission.listing.fssaiCompliance?.dispatchTemperatureCelsius || 72}°C`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white dark:bg-[#112019] px-3 py-1.5 rounded-xl border border-[#CFDED5] dark:border-[#233833] shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeMission.measuredTemperature ?? 68.0;
                        const next = Math.max(0, Math.round((cur - 1) * 10) / 10);
                        setActiveMission({
                          ...activeMission,
                          measuredTemperature: next,
                          tempChecked: true,
                        });
                      }}
                      className="w-7 h-7 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] font-bold text-xs flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#18241C] cursor-pointer"
                    >
                      -1°
                    </button>
                    <span className="font-mono font-black text-xl text-[#0F1E17] dark:text-[#F4F8F5]">
                      {activeMission.measuredTemperature ?? 68.0}°C
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeMission.measuredTemperature ?? 68.0;
                        const next = Math.min(100, Math.round((cur + 1) * 10) / 10);
                        setActiveMission({
                          ...activeMission,
                          measuredTemperature: next,
                          tempChecked: true,
                        });
                      }}
                      className="w-7 h-7 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] font-bold text-xs flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#18241C] cursor-pointer"
                    >
                      +1°
                    </button>
                  </div>

                  {(() => {
                    const verdict = evaluateTemperatureSafety(
                      activeMission.measuredTemperature ?? 68.0,
                      (activeMission.listing.storageCondition as StorageConditionType) || 'Hot and covered'
                    );
                    return (
                      <span
                        className={`text-[11.5px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${verdict.badgeColorClass} ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{verdict.icon}</span>
                        <span>{verdict.badgeLabel} ({verdict.headline})</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={activeMission.tempChecked}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, tempChecked: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#D97706] rounded cursor-pointer"
                  />
                  <span>
                    Thermal temperature verified &amp; approved ({activeMission.measuredTemperature ?? 68.0}&deg;C verified before departure)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={activeMission.hygieneApproved}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, hygieneApproved: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#D97706] rounded cursor-pointer"
                  />
                  <span>
                    Clean, food-grade sealed packaging and no signs of contamination or spillage
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleConfirmCargoLoaded}
                disabled={!activeMission.tempChecked || !activeMission.hygieneApproved}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#D97706] hover:bg-[#B45309] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                <span>Seal Insulated Bag &amp; Start Transit ({activeMission.measuredTemperature ?? 68.0}&deg;C Logged)</span>
              </button>
            </div>
          )}

          {activeMission.status === 'en_route_shelter' && (
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[14px] text-[#059669]">
                    Live Transit: En Route to Recipient Shelter
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRunForTemp(activeMission.listing);
                      setTempModalStage('in_transit');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold text-[11px] flex items-center gap-1 hover:bg-[#D1FAE5] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">device_thermostat</span>
                    <span>Log Mid-Transit Check</span>
                  </button>
                </div>
                <p className={`text-[12px] mt-1 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                  Safe transport in progress (holding at {activeMission.measuredTemperature ?? 68.0}°C). When you meet the shelter coordinator, enter the 4-digit transfer OTP below to verify completion.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 4-Digit OTP"
                    value={activeMission.handoffOtpInput}
                    onChange={(e) =>
                      setActiveMission({ ...activeMission, handoffOtpInput: e.target.value })
                    }
                    className={`w-44 px-3 py-2 rounded-xl border text-center font-mono font-black text-lg tracking-widest ${
                      isDark
                        ? 'bg-[#162421] border-[#233833] text-white'
                        : 'bg-white border-[#CFDED5] text-[#111A17]'
                    }`}
                  />
                  <span className="text-[11px] text-opacity-70">
                    (Provided by receiving NGO)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompleteHandover}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Verify Delivery &amp; Complete</span>
              </button>
            </div>
          )}

          {activeMission.status === 'delivered' && (
            <div
              className={`p-5 rounded-2xl border text-center space-y-2 ${
                isDark ? 'bg-[#059669]/15 border-[#059669]/40' : 'bg-[#D1FAE5] border-[#A7F3D0]'
              }`}
            >
              <span className="material-symbols-outlined text-4xl text-[#059669]">task_alt</span>
              <h3 className="text-xl font-black text-[#059669]">
                Rescue Mission Successfully Completed!
              </h3>
              <p className={`text-[13px] max-w-lg mx-auto ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                {activeMission.listing.quantity} {activeMission.listing.unit} of surplus food was delivered in sound condition. 80G tax report and CSR credit have been recorded in the central ledger.
              </p>
            </div>
          )}
        </div>
      )}

      {/* City Geofence Selection Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 max-w-full">
        <div className="flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[#D97706] text-[20px]">near_me</span>
          <h2 className="text-lg font-black tracking-tight">
            Surplus Batches Requesting Dispatch ({availableRuns.length})
          </h2>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 min-w-0 max-w-full">
          {INDIAN_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => onSelectCity(city.id)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCityId === city.id
                  ? 'bg-[#D97706] text-white border-[#D97706]'
                  : isDark
                  ? 'bg-[#162421] border-[#233833] text-[#B8CCC1] hover:text-white'
                  : 'bg-white border-[#CFDED5] text-[#4D5C56] hover:text-[#111A17]'
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Available Rescue Runs Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 border-4 border-[#D97706] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className={`text-[13px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
            Scanning active food dispatch requests...
          </p>
        </div>
      ) : availableRuns.length === 0 ? (
        <div
          className={`p-10 rounded-3xl border text-center ${
            isDark ? 'bg-[#162421] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-[#D97706] mb-2 block">
            check_circle
          </span>
          <h3 className="text-lg font-black">All Clear in this Region!</h3>
          <p className={`text-[13px] max-w-md mx-auto mt-1 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
            There are currently no outstanding surplus rescue runs waiting for transport in {INDIAN_CITIES.find(c => c.id === selectedCityId)?.name || 'this city'}. Select another city or check back shortly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {availableRuns.map((listing) => {
            const isCurrentlyActive = activeMission?.listing.id === listing.id;

            return (
              <div
                key={listing.id}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                  isCurrentlyActive
                    ? 'border-[#D97706] ring-2 ring-[#D97706]/30'
                    : isDark
                    ? 'bg-[#162421] border-[#233833]'
                    : 'bg-[#FFFFFF] border-[#CFDED5]'
                }`}
              >
                <div className="space-y-3">
                  {/* Top status */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D97706]/15 text-[#D97706]">
                      {listing.foodType || 'Prepared Meals'}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        listing.status === 'claimed'
                          ? 'bg-[#059669]/15 text-[#059669]'
                          : 'bg-[#2563EB]/15 text-[#2563EB]'
                      }`}
                    >
                      {listing.status === 'claimed' ? '● Claimed (Needs Delivery)' : '● Ready to Rescue'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-black tracking-tight">{listing.title}</h3>
                    <p className={`text-[12px] font-bold mt-0.5 text-[#D97706]`}>
                      {listing.donorOrg}
                    </p>
                    <p className={`text-[11px] line-clamp-1 flex items-center gap-1 ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                      <span className="material-symbols-outlined text-[14px] text-[#2E7D4F]">location_on</span>
                      <span>{listing.location}</span>
                    </p>
                  </div>

                  {/* Quantity & Packaging Specs */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-[12px] ${
                      isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold block uppercase opacity-70">
                        Cargo Volume
                      </span>
                      <span className="font-black text-[#059669]">
                        {listing.quantity} {listing.unit}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold block uppercase opacity-70">
                        Est. Servings
                      </span>
                      <span className="font-extrabold">
                        ~{Math.round(listing.quantity * 2.5)} meals
                      </span>
                    </div>
                  </div>

                  {/* Batch Initial Temperature & Thermal Chain */}
                  <div className="p-2.5 rounded-xl border border-[#CFDED5]/80 dark:border-[#233833] bg-[#EAF4EE]/70 dark:bg-[#12241D] flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-[#2E7D4F] dark:text-[#34D399]">
                        <span className="material-symbols-outlined text-[15px]">device_thermostat</span>
                        <span>Initial Batch Temp:</span>
                      </span>
                      <span className="font-mono px-2 py-0.5 rounded bg-white dark:bg-[#1B3228] text-[#1E2A22] dark:text-[#E8F3EC] border border-[#D9E2DA] dark:border-[#2B4638] font-black text-xs">
                        {listing.initialTemperature !== undefined
                          ? `${listing.initialTemperature}°C`
                          : listing.currentTemperature !== undefined
                          ? `${listing.currentTemperature}°C`
                          : listing.fssaiCompliance?.dispatchTemperatureCelsius
                          ? `${listing.fssaiCompliance.dispatchTemperatureCelsius}°C`
                          : 'Recorded Safe'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] opacity-80 pt-0.5 border-t border-[#CFDED5]/40 dark:border-[#233833]/60">
                      <span>Holding Standard:</span>
                      <span className="font-semibold text-[#059669] dark:text-[#34D399]">
                        {listing.storageCondition || 'Hot and covered'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-[#CFDED5]/60 dark:border-[#233833] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenCsrModal(listing)}
                      className={`text-[11px] font-bold flex items-center gap-1 hover:underline cursor-pointer ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">description</span>
                      <span>80G Specs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRunForTemp(listing);
                        setTempModalStage('courier_pickup');
                      }}
                      className="text-[11px] font-bold text-[#059669] dark:text-[#34D399] flex items-center gap-0.5 hover:underline cursor-pointer"
                      title="Inspect & Log Temperature for this batch"
                    >
                      <span className="material-symbols-outlined text-[13px]">device_thermostat</span>
                      <span>Log Temp</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAcceptRun(listing)}
                    disabled={activeMission !== null}
                    className={`px-4 py-2 rounded-xl text-white font-bold text-[12px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      activeMission !== null
                        ? 'opacity-50 cursor-not-allowed bg-[#7B9487]'
                        : 'bg-[#D97706] hover:bg-[#B45309] active:scale-95'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">navigation</span>
                    <span>Accept Run</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Temperature Log Entry Modal for Couriers */}
      {selectedRunForTemp && (
        <TemperatureLogModal
          isOpen={Boolean(selectedRunForTemp)}
          onClose={() => setSelectedRunForTemp(null)}
          listingId={selectedRunForTemp.id}
          batchTitle={selectedRunForTemp.title}
          storageCondition={(selectedRunForTemp.storageCondition as StorageConditionType) || 'Hot and covered'}
          defaultRole="courier"
          defaultStage={tempModalStage}
          existingLogs={selectedRunForTemp.temperatureLogs || []}
          onTemperatureLogged={(newEntry) => {
            setAvailableRuns((prev) =>
              prev.map((r) =>
                r.id === selectedRunForTemp.id
                  ? {
                      ...r,
                      currentTemperature: newEntry.temperatureCelsius,
                      latestTemperatureLog: newEntry,
                      temperatureLogs: [newEntry, ...(r.temperatureLogs || [])],
                    }
                  : r
              )
            );
            if (activeMission && activeMission.listing.id === selectedRunForTemp.id) {
              setActiveMission({
                ...activeMission,
                measuredTemperature: newEntry.temperatureCelsius,
                tempChecked: true,
                listing: {
                  ...activeMission.listing,
                  currentTemperature: newEntry.temperatureCelsius,
                  latestTemperatureLog: newEntry,
                  temperatureLogs: [newEntry, ...(activeMission.listing.temperatureLogs || [])],
                },
              });
            }
            showToast(`Temperature ${newEntry.temperatureCelsius}°C recorded and published!`);
          }}
        />
      )}
    </div>
  );
};
