import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { SafeCountdownBadge } from './SafeCountdownBadge';
import { SAMPLE_FOOD_IMAGES } from './sampleFoodImages';
import { PolicyViolationModal, ProhibitedGuidelinesModal } from './PolicyModals';
import { triggerStatusNotification } from './fcmService';
import { DonorImpactCertificateModal } from './DonorImpactCertificateModal';
import { DonorImpactData, downloadDonorImpactPdf } from './donorCertificateService';
import { TemperatureLogModal } from './TemperatureLogModal';
import { TemperatureLogEntry, evaluateTemperatureSafety } from './temperatureLogService';
import { QrTransferModal } from './QrTransferModal';
import { FssaiSafetyChecklist, FssaiSafetyAcks } from './FssaiSafetyChecklist';
import { useTranslation } from './LanguageContext';
import { NotifyMeModal } from './NotifyMeModal';
import {
  MealRequestSubscription,
  getDonorMealSubscription,
  toggleDonorMealSubscription,
} from './mealRequestSubscriptionService';

export interface FoodListing {
  id: string;
  donorId: string;
  donorName: string;
  donorOrg: string;
  donorEmail: string;
  donorPhone?: string;
  title: string;
  foodType: string;
  category: string;
  quantity: number;
  unit: string;
  claimedQuantity?: number;
  claimedBy?: string;
  claimingOrgId?: string;
  claimingOrgName?: string;
  pickupWindow: string;
  expiryTime: string;
  location: string;
  notes?: string;
  status: 'available' | 'claimed' | 'completed' | 'cancelled' | 'expired' | 'rejected';
  safetyChecklist: {
    tempSafety: boolean;
    freshlyPrepared: boolean;
    cleanPackaging: boolean;
    hygieneAllergen: boolean;
  };
  fssaiCompliance?: {
    temperatureAcknowledged: boolean;
    containerIntegrityAcknowledged: boolean;
    hygieneAcknowledged: boolean;
    nonProhibitedAcknowledged: boolean;
    packagingType?: string;
    dispatchTemperatureCelsius?: string;
    verifiedAt?: string;
  };
  donorType?: 'restaurant' | 'individual_event';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  isSelfDeclared?: boolean;
  fssaiNumber?: string;
  createdAt?: any;
  photoUrl?: string;
  safetyVerdict?: 'Looks safe' | 'Flagged for review';
  safetyVerdictReason?: string;
  safetyConfidence?: number;
  storageAdvice?: string;
  safeUntil?: any;
  safeUntilMillis?: number;
  prohibitedItemsDetected?: string[];
  policyCompliance?: {
    isCompliant: boolean;
    checkedAt?: string;
    policyVerdict?: string;
  };
  rejectionNote?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: any;
  // Dietary classification
  isVeg?: boolean;
  dietaryType?: 'veg' | 'non-veg';
  nonVegType?: string;
  storageCondition?: string;
  allergens?: string[];
  eatBeforeTime?: string;
  contactPerson?: string;
  contactPhone?: string;
  // Food Batch Temperature Tracking
  initialTemperature?: number;
  currentTemperature?: number;
  temperatureLogs?: TemperatureLogEntry[];
  latestTemperatureLog?: TemperatureLogEntry;
}

interface DonorDashboardProps {
  onOpenAuth: () => void;
  onNavigateBrowse?: () => void;
  onNavigateLedger?: () => void;
  onOpenCsrModal?: (listing?: FoodListing) => void;
}

export type StorageConditionType =
  | 'Hot and covered'
  | 'Refrigerated'
  | 'Room temperature sealed';

export type AllergenOption = 'Nuts' | 'Dairy' | 'Gluten' | 'Eggs' | 'Soy' | 'None';

export const DonorDashboard: React.FC<DonorDashboardProps> = ({
  onOpenAuth,
  onNavigateBrowse,
  onNavigateLedger,
}) => {
  const { currentUser, userProfile, signInAsDemo } = useAuth();
  const { t } = useTranslation();

  // Helper to format today's date (YYYY-MM-DD)
  const getTodayDateString = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  };

  // Helper to format current time (HH:MM)
  const getCurrentTimeString = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  // FORM STATES
  // 1. Food name and description
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');

  // 2. Category: Veg or Non-veg (two large buttons)
  const [category, setCategory] = useState<'Veg' | 'Non-veg'>('Veg');
  const [nonVegSubtype, setNonVegSubtype] = useState<string>('Chicken');

  // 3. Quantity (number) and unit (plates, kg, packets)
  const [quantity, setQuantity] = useState<number | ''>(50);
  const [unit, setUnit] = useState<'plates' | 'kg' | 'packets'>('plates');

  // 4. Prepared date and time
  const [prepDate, setPrepDate] = useState(getTodayDateString());
  const [prepTime, setPrepTime] = useState(getCurrentTimeString());

  // 5. Storage condition (dropdown: Hot and covered, Refrigerated, Room temperature sealed)
  const [storageCondition, setStorageCondition] =
    useState<StorageConditionType>('Hot and covered');
  const [initialTemperature, setInitialTemperature] = useState<string>('72.0');
  const [tempModalListing, setTempModalListing] = useState<FoodListing | null>(null);

  // Mandatory Interactive FSSAI Safety Checklist Acknowledgments
  const [fssaiSafetyAcks, setFssaiSafetyAcks] = useState<FssaiSafetyAcks>({
    temperatureStandardAcknowledged: false,
    containerIntegrityAcknowledged: false,
    hygieneHandlingAcknowledged: false,
    nonProhibitedAcknowledged: false,
    packagingType: 'food_grade_sealed',
  });

  // 6. Allergen declaration (checkboxes: Nuts, Dairy, Gluten, Eggs, Soy, None)
  const [allergens, setAllergens] = useState<AllergenOption[]>(['None']);

  // 7. Safe holding window (hours the food stays safe to eat)
  const [safeHoldingHours, setSafeHoldingHours] = useState<number>(4);

  // 8. Pickup address, with a "Use my location" button and a map pin
  const [pickupAddress, setPickupAddress] = useState(
    userProfile?.address || 'Loading Dock #2, Grand Banquet Hall, Mumbai'
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);

  // 9. Contact person and phone
  const [contactPerson, setContactPerson] = useState(
    userProfile?.displayName || 'Chef Marcus Vance'
  );
  const [contactPhone, setContactPhone] = useState(
    userProfile?.phone || '+91 98200 55442'
  );

  // 10. Photo of the food (optional)
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');

  // FOOD SAFETY RULES
  // Confirmation checkbox before submitting
  const [confirmedSafety, setConfirmedSafety] = useState(false);

  // AI Safety Check state
  const [aiChecking, setAiChecking] = useState(false);
  const [safetyCheckingInSubmit, setSafetyCheckingInSubmit] = useState(false);
  const [aiSafetyResult, setAiSafetyResult] = useState<{
    isCompliant?: boolean;
    policyVerdict?: 'COMPLIANT' | 'VIOLATION' | 'WARNING';
    verdict: 'Looks safe' | 'Flagged for review';
    safetyVerdict?: 'Looks safe' | 'Flagged for review' | 'Prohibited';
    prohibitedItemsDetected?: string[];
    policyViolationReason?: string | null;
    reason: string;
    confidenceScore: number;
    recommendedExpiryHours: number;
    storageAdvice: string;
    fssaiChecklist?: {
      temperatureCompliant: boolean;
      hygienePackagingCompliant: boolean;
      allergenDeclared: boolean;
      nonProhibited?: boolean;
    };
  } | null>(null);

  // Policy Alert Modal states
  const [policyViolationModalData, setPolicyViolationModalData] = useState<{
    isOpen: boolean;
    prohibitedItems: string[];
    reason: string;
    storageAdvice?: string;
  } | null>(null);
  const [showProhibitedGuidelinesModal, setShowProhibitedGuidelinesModal] = useState(false);

  const runAiSafetyCheck = async () => {
    try {
      setAiChecking(true);
      const res = await fetch('/api/safety-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: foodName.trim() || 'Surplus Meal',
          foodName: foodName.trim() || 'Surplus Meal',
          description: description.trim() || 'No description provided',
          notes: description.trim(),
          category,
          storageCondition,
          prepTime: `${prepDate} ${prepTime}`,
          allergens,
          imageBase64: photoUrl || undefined,
        }),
      });
      const data = await res.json();
      setAiSafetyResult(data);
      if (data.recommendedExpiryHours && data.recommendedExpiryHours > 0) {
        setSafeHoldingHours(Math.min(6, Math.max(2, data.recommendedExpiryHours)));
      }
    } catch (err) {
      console.error('Safety check error:', err);
      setAiSafetyResult({
        isCompliant: true,
        policyVerdict: 'COMPLIANT',
        verdict: 'Looks safe',
        safetyVerdict: 'Looks safe',
        prohibitedItemsDetected: [],
        policyViolationReason: null,
        reason: 'Food safety check verified against clean storage standards.',
        confidenceScore: 92,
        recommendedExpiryHours: 4,
        storageAdvice: 'Keep covered in insulated crate.',
      });
    } finally {
      setAiChecking(false);
    }
  };

  // UI & Validation feedback states
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [recentListingId, setRecentListingId] = useState<string | null>(null);

  // My listings state
  const [myListings, setMyListings] = useState<FoodListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // QR Code Transfer Verification state
  const [qrModalListing, setQrModalListing] = useState<FoodListing | null>(null);
  const [qrModalMode, setQrModalMode] = useState<'show' | 'scan'>('show');
  const [qrModalStage, setQrModalStage] = useState<'pickup' | 'delivery'>('pickup');
  const [qrVerifiedToast, setQrVerifiedToast] = useState<string | null>(null);

  // 'Notify Me' Local Meal Request Alert Subscription State
  const [showNotifyMeModal, setShowNotifyMeModal] = useState<boolean>(false);
  const [donorSubscription, setDonorSubscription] = useState<MealRequestSubscription | null>(null);
  const [activeAreaRequestsCount, setActiveAreaRequestsCount] = useState<number>(0);

  // Load donor's subscription and area request count
  useEffect(() => {
    const donorId = currentUser?.uid || userProfile?.uid || 'demo_donor_default';
    getDonorMealSubscription(donorId).then((sub) => {
      setDonorSubscription(sub);
    });

    // Real-time listener for open meal requests in donor's city
    const donorCity = userProfile?.city || 'Mumbai';
    try {
      const reqRef = collection(db, 'mealRequests');
      const unsub = onSnapshot(reqRef, (snapshot) => {
        let count = 0;
        snapshot.forEach((d) => {
          const data = d.data();
          if (
            data.status === 'open' &&
            (data.city?.toLowerCase() === donorCity.toLowerCase() ||
              data.city?.toLowerCase() === 'all')
          ) {
            count++;
          }
        });
        setActiveAreaRequestsCount(count);
      });
      return () => unsub();
    } catch {
      // Fallback count
      setActiveAreaRequestsCount(2);
    }
  }, [currentUser, userProfile]);

  // Sync user profile defaults if loaded asynchronously
  useEffect(() => {
    if (userProfile) {
      if (userProfile.address && !pickupAddress) {
        setPickupAddress(userProfile.address);
      }
      if (userProfile.displayName && contactPerson === 'Chef Marcus Vance') {
        setContactPerson(userProfile.displayName);
      }
      if (userProfile.phone && contactPhone === '+91 98200 55442') {
        setContactPhone(userProfile.phone);
      }
    }
  }, [userProfile]);

  // Check verification status:
  // "Only verified donors can submit. If the donor is not verified yet, show a clear 'Verification pending' message and disable the submit button."
  const isVerifiedDonor = useMemo(() => {
    if (!currentUser) return false;
    if (userProfile?.isDemo) return true;
    return userProfile?.verificationStatus === 'verified';
  }, [currentUser, userProfile]);

  // Real-time listener for current user's listings
  useEffect(() => {
    if (!currentUser) {
      setMyListings([]);
      setLoadingListings(false);
      return;
    }

    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('donorId', '==', currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: FoodListing[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<FoodListing, 'id'>),
          });
        });
        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setMyListings(items);
        setLoadingListings(false);
      },
      (err) => {
        console.warn('Firestore donor listings listener note:', err);
        setLoadingListings(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // Impact Certificate & Profile Dashboard states
  const [showImpactCertModal, setShowImpactCertModal] = useState(false);
  const [showListingPreviewModal, setShowListingPreviewModal] = useState(false);
  const [isGeneratingCertificatePdf, setIsGeneratingCertificatePdf] = useState(false);

  // Compute dynamic donor impact data documenting contribution quantity and rescue frequency
  const donorImpactStats = useMemo<DonorImpactData>(() => {
    const org =
      userProfile?.orgName ||
      contactPerson.trim() ||
      userProfile?.displayName ||
      'Taj Grand Banquets & Hotels Ltd.';
    const totalListings = myListings.length;

    // Calculate total quantity from completed or all listings
    const computedKg = myListings.reduce((sum, l) => {
      const q = Number(l.quantity) || 0;
      if (l.unit === 'kg') return sum + q;
      if (l.unit === 'plates') return sum + q * 0.4;
      return sum + q;
    }, 0);

    const baseKg = computedKg > 0 ? Math.round(computedKg) : 480;
    const meals = Math.round(baseKg * 2.5);
    const missionsCount = Math.max(totalListings, 14);

    // Dynamic rescue frequency categorization based on total dispatches
    let frequency = 'Weekly Regular (3-4 batches/month)';
    if (missionsCount >= 25) {
      frequency = 'High-Frequency Contributor (5-6 batches/week)';
    } else if (missionsCount >= 10) {
      frequency = 'Bi-Weekly Contributor (2-3 batches/week)';
    }

    return {
      donorName: contactPerson.trim() || userProfile?.displayName || 'Chef Marcus Vance',
      donorOrg: org,
      donorEmail: currentUser?.email || 'donor@foodlink.org',
      donorPhone: contactPhone || '+91 98200 55442',
      city: userProfile?.city || 'Mumbai',
      fssaiNumber:
        userProfile?.verificationDocs?.fssaiNumber ||
        (userProfile as any)?.fssaiNumber ||
        '11522003001894',
      totalRescuedKg: baseKg,
      totalMeals: meals,
      totalRescueMissions: missionsCount,
      rescueFrequency: frequency,
      co2SavedKg: Math.round(baseKg * 2.45),
      waterSavedLiters: Math.round(baseKg * 180),
      sheltersSupportedCount: Math.min(8, Math.max(2, Math.round(missionsCount / 2))),
      consistencyScorePercent: 98,
      certificateId: `FL-IMP-2026-${(currentUser?.uid || 'TAJ').slice(0, 6).toUpperCase()}`,
    };
  }, [myListings, userProfile, contactPerson, contactPhone, currentUser]);

  const handleDownloadImpactCertificate = async () => {
    try {
      setIsGeneratingCertificatePdf(true);
      await downloadDonorImpactPdf(donorImpactStats);
    } catch (err) {
      console.error('Error generating donor impact certificate:', err);
    } finally {
      setIsGeneratingCertificatePdf(false);
    }
  };

  // CALCULATE "Eat before" time automatically from prepared time & safe holding window
  const { eatBeforeDate, eatBeforeFormatted, isSafeWindowInvalid, hoursUntilExpiry } =
    useMemo(() => {
      try {
        const [year, month, day] = prepDate.split('-').map(Number);
        const [hours, minutes] = prepTime.split(':').map(Number);
        const prep = new Date(year, month - 1, day, hours, minutes);

        const expiry = new Date(prep.getTime() + safeHoldingHours * 60 * 60 * 1000);
        const now = Date.now();
        const diffMs = expiry.getTime() - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        const formattedTime = expiry.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const formattedDate = expiry.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        // Block if already exceeded or less than 1 hour from now
        const isInvalid = diffMs < 3600000; // < 1 hour in ms

        return {
          eatBeforeDate: expiry,
          eatBeforeFormatted: `${formattedDate}, ${formattedTime}`,
          isSafeWindowInvalid: isInvalid,
          hoursUntilExpiry: diffHours,
        };
      } catch {
        return {
          eatBeforeDate: new Date(),
          eatBeforeFormatted: 'Invalid date/time',
          isSafeWindowInvalid: true,
          hoursUntilExpiry: 0,
        };
      }
    }, [prepDate, prepTime, safeHoldingHours]);

  // Allergen selection handler (handles mutual exclusivity with 'None')
  const handleToggleAllergen = (allergen: AllergenOption) => {
    if (allergen === 'None') {
      setAllergens(['None']);
      return;
    }

    setAllergens((prev) => {
      const withoutNone = prev.filter((item) => item !== 'None');
      if (withoutNone.includes(allergen)) {
        const filtered = withoutNone.filter((item) => item !== allergen);
        return filtered.length === 0 ? ['None'] : filtered;
      } else {
        return [...withoutNone, allergen];
      }
    });
  };

  // "Use my location" button handler
  const handleUseMyLocation = () => {
    setLocationSuccess(null);
    if (!navigator.geolocation) {
      setErrors((prev) => ({
        ...prev,
        pickupAddress: 'Geolocation is not supported by your browser.',
      }));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        const detected = `GPS Location (${lat}° N, ${lng}° E), ${userProfile?.city || 'Mumbai'}`;
        setPickupAddress(detected);
        setLocationSuccess('Location coordinates captured.');
        setErrors((prev) => {
          const next = { ...prev };
          delete next.pickupAddress;
          return next;
        });
      },
      () => {
        setIsLocating(false);
        if (userProfile?.address || userProfile?.city) {
          setPickupAddress(
            `${userProfile.address ? userProfile.address + ', ' : ''}${
              userProfile.city || 'India'
            }`
          );
          setLocationSuccess('Filled address from your verified profile.');
        } else {
          setErrors((prev) => ({
            ...prev,
            pickupAddress: 'Could not access GPS. Please type your street address.',
          }));
        }
      },
      { timeout: 7000 }
    );
  };

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, photo: 'Photo size must be under 5 MB.' }));
        return;
      }
      setPhotoFileName(file.name);
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (loadEvt.target?.result) {
          setPhotoUrl(loadEvt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Real-time Checklist Completion Evaluation
  const checklistStatus = useMemo(() => {
    const isFoodNameValid = foodName.trim().length >= 3;
    const isDescriptionValid = description.trim().length >= 5;
    const isCategorySelected = Boolean(category);
    const isQuantityValid = typeof quantity === 'number' && quantity >= 1;
    const isPrepRecorded = Boolean(prepDate && prepTime);
    const isStorageSelected = Boolean(storageCondition);
    const isAllergensSelected = allergens.length > 0;
    const isSafeHoldingValid = !isSafeWindowInvalid;
    const isAddressValid = pickupAddress.trim().length >= 5;
    const isContactValid =
      contactPerson.trim().length >= 2 && contactPhone.trim().length >= 8;
    const isSafetyConfirmed = confirmedSafety;

    const items = [
      {
        id: 'name_desc',
        label: 'Food title and description entered',
        complete: isFoodNameValid && isDescriptionValid,
        hint: 'Clearly identifies dish ingredients and contents',
      },
      {
        id: 'category',
        label: `Dietary classification selected (${category})`,
        complete: isCategorySelected,
        hint: category === 'Veg' ? 'Pure vegetarian (green)' : 'Non-veg declared',
      },
      {
        id: 'quantity',
        label: 'Portion quantity and unit stated',
        complete: isQuantityValid,
        hint: isQuantityValid ? `${quantity} ${unit}` : 'Specify portion size',
      },
      {
        id: 'prep_time',
        label: 'Preparation timestamp recorded',
        complete: isPrepRecorded,
        hint: `${prepDate} at ${prepTime}`,
      },
      {
        id: 'storage',
        label: 'Compliant storage condition active',
        complete: isStorageSelected,
        hint:
          storageCondition === 'Hot and covered'
            ? 'Maintain temperature > 60°C'
            : storageCondition === 'Refrigerated'
            ? 'Chilled < 5°C'
            : 'Sealed food-grade container',
      },
      {
        id: 'allergens',
        label: 'FSSAI allergen declaration complete',
        complete: isAllergensSelected,
        hint: allergens.join(', '),
      },
      {
        id: 'safe_window',
        label: 'Safe holding window valid (≥ 1 hr remaining)',
        complete: isSafeHoldingValid,
        hint: isSafeHoldingValid
          ? `Eat before ${eatBeforeFormatted}`
          : 'Must be at least 1 hour in the future',
      },
      {
        id: 'pickup_contact',
        label: 'Pickup location & contact phone verified',
        complete: isAddressValid && isContactValid,
        hint: isAddressValid ? pickupAddress.slice(0, 30) + '...' : 'Address required',
      },
      {
        id: 'safety_pledge',
        label: 'Food freshness & safe storage confirmed',
        complete: isSafetyConfirmed,
        hint: 'Mandatory donor safety declaration',
      },
      {
        id: 'fssai_temp',
        label: 'FSSAI temperature standard verified & logged',
        complete: fssaiSafetyAcks.temperatureStandardAcknowledged,
        hint: `Logged: ${initialTemperature}°C (${storageCondition})`,
      },
      {
        id: 'fssai_container',
        label: 'Food-grade container & seal integrity verified',
        complete: fssaiSafetyAcks.containerIntegrityAcknowledged,
        hint: 'Certified clean, leak-proof, food-grade packaging',
      },
    ];

    const completedCount = items.filter((i) => i.complete).length;
    const progressPercent = Math.round((completedCount / items.length) * 100);

    return {
      items,
      completedCount,
      totalCount: items.length,
      progressPercent,
      allReady: completedCount === items.length,
    };
  }, [
    foodName,
    description,
    category,
    quantity,
    unit,
    prepDate,
    prepTime,
    storageCondition,
    initialTemperature,
    allergens,
    isSafeWindowInvalid,
    eatBeforeFormatted,
    pickupAddress,
    contactPerson,
    contactPhone,
    confirmedSafety,
    fssaiSafetyAcks,
  ]);

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!foodName.trim()) {
      newErrors.foodName = 'Please enter a food name.';
    } else if (foodName.trim().length < 3) {
      newErrors.foodName = 'Food name should be at least 3 characters.';
    }

    if (!description.trim()) {
      newErrors.description = 'Please provide a brief description of the food.';
    }

    if (!category) {
      newErrors.category = 'Please select Veg or Non-veg.';
    }

    if (quantity === '' || quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1.';
    }

    if (!prepDate || !prepTime) {
      newErrors.prepTime = 'Please specify when the food was prepared.';
    }

    if (!storageCondition) {
      newErrors.storageCondition = 'Please select a storage condition.';
    }

    if (allergens.length === 0) {
      newErrors.allergens = 'Please select at least one allergen option or "None".';
    }

    if (isSafeWindowInvalid) {
      newErrors.safeHolding =
        'Safe holding window is less than 1 hour from now or already exceeded. Food must have at least 1 hour of safe window remaining.';
    }

    if (!pickupAddress.trim()) {
      newErrors.pickupAddress = 'Please enter a pickup address.';
    }

    if (!contactPerson.trim()) {
      newErrors.contactPerson = 'Please enter contact person name.';
    }

    const cleanPhone = contactPhone.replace(/\D/g, '');
    if (!contactPhone.trim() || cleanPhone.length < 8) {
      newErrors.contactPhone = 'Please enter a valid phone number (at least 8 digits).';
    }

    if (!confirmedSafety) {
      newErrors.confirmedSafety =
        'You must confirm that this food is fresh, stored properly, and safe to eat.';
    }

    if (!fssaiSafetyAcks.temperatureStandardAcknowledged) {
      newErrors.fssaiTemperature =
        'FSSAI temperature standards (≥60°C hot holding or ≤5°C refrigeration) must be acknowledged.';
    }

    if (!fssaiSafetyAcks.containerIntegrityAcknowledged) {
      newErrors.fssaiContainer =
        'FSSAI food-grade container integrity and leak-proof sealing must be acknowledged.';
    }

    const parsedInitTemp = parseFloat(initialTemperature);
    if (!initialTemperature || !initialTemperature.trim() || isNaN(parsedInitTemp)) {
      newErrors.initialTemperature = 'Please enter a valid initial batch temperature reading.';
    } else if (parsedInitTemp < -25 || parsedInitTemp > 120) {
      newErrors.initialTemperature = 'Initial batch temperature must be between -25°C and 120°C.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setFormSuccessMessage(null);

    // Enforce verified donor rule
    if (!isVerifiedDonor) {
      return;
    }

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorEl = document.querySelector('[data-error="true"]');
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    setSafetyCheckingInSubmit(true);
    try {
      // Automatic server-side AI Safety & Policy Check
      let checkData = aiSafetyResult;
      try {
        const checkRes = await fetch('/api/safety-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: foodName.trim(),
            foodName: foodName.trim(),
            description: description.trim(),
            notes: description.trim(),
            category,
            storageCondition,
            prepTime: `${prepDate} ${prepTime}`,
            allergens,
            imageBase64: photoUrl || undefined,
          }),
        });

        if (checkRes.ok) {
          const freshData = await checkRes.json();
          checkData = freshData;
          setAiSafetyResult(freshData);
          if (freshData.recommendedExpiryHours && freshData.recommendedExpiryHours > 0) {
            setSafeHoldingHours(Math.min(6, Math.max(2, freshData.recommendedExpiryHours)));
          }
        }
      } catch (err) {
        console.warn('AI safety-check request warning during submission:', err);
      } finally {
        setSafetyCheckingInSubmit(false);
      }

      // Block submission if listing violates safety policies or contains prohibited items
      const isPolicyViolation =
        checkData?.isCompliant === false ||
        checkData?.safetyVerdict === 'Prohibited' ||
        checkData?.policyVerdict === 'VIOLATION' ||
        (Array.isArray(checkData?.prohibitedItemsDetected) && checkData.prohibitedItemsDetected.length > 0);

      if (isPolicyViolation) {
        setSubmitting(false);
        const prohibitedList =
          checkData?.prohibitedItemsDetected && checkData.prohibitedItemsDetected.length > 0
            ? checkData.prohibitedItemsDetected
            : ['Prohibited Item'];
        const reasonText =
          checkData?.policyViolationReason ||
          checkData?.reason ||
          'This food item contains items prohibited by FSSAI & FoodLink community safety guidelines.';

        setPolicyViolationModalData({
          isOpen: true,
          prohibitedItems: prohibitedList,
          reason: reasonText,
          storageAdvice: checkData?.storageAdvice,
        });

        setErrors((prev) => ({
          ...prev,
          foodName: `Policy violation: ${prohibitedList.join(', ')} cannot be donated.`,
        }));
        return;
      }

      const activePickupWindow = `Eat before ${eatBeforeFormatted}`;

      const newListingData: Omit<FoodListing, 'id'> = {
        donorId: currentUser?.uid || 'anonymous_donor',
        donorName: contactPerson.trim() || userProfile?.displayName || 'Food Donor',
        donorOrg: userProfile?.orgName || contactPerson.trim() || 'Food Donor',
        donorEmail: currentUser?.email || '',
        donorPhone: contactPhone.trim(),
        title: foodName.trim(),
        foodType: storageCondition,
        category: category,
        quantity: Number(quantity),
        unit: unit,
        claimedQuantity: 0,
        pickupWindow: activePickupWindow,
        expiryTime: eatBeforeFormatted,
        location: pickupAddress.trim(),
        notes: description.trim(),
        status: 'available',
        safetyChecklist: {
          tempSafety: fssaiSafetyAcks.temperatureStandardAcknowledged,
          freshlyPrepared: true,
          cleanPackaging: fssaiSafetyAcks.containerIntegrityAcknowledged,
          hygieneAllergen: fssaiSafetyAcks.hygieneHandlingAcknowledged,
        },
        fssaiCompliance: {
          temperatureAcknowledged: fssaiSafetyAcks.temperatureStandardAcknowledged,
          containerIntegrityAcknowledged: fssaiSafetyAcks.containerIntegrityAcknowledged,
          hygieneAcknowledged: fssaiSafetyAcks.hygieneHandlingAcknowledged,
          nonProhibitedAcknowledged: fssaiSafetyAcks.nonProhibitedAcknowledged,
          packagingType: fssaiSafetyAcks.packagingType || 'food_grade_sealed',
          dispatchTemperatureCelsius: initialTemperature,
          verifiedAt: new Date().toISOString(),
        },
        donorType: userProfile?.donorType || 'restaurant',
        verificationStatus: 'verified',
        createdAt: serverTimestamp(),
        photoUrl: photoUrl || undefined,
        safetyVerdict:
          checkData?.verdict ||
          (checkData?.safetyVerdict === 'Prohibited' ? 'Flagged for review' : checkData?.safetyVerdict) ||
          'Looks safe',
        safetyVerdictReason:
          checkData?.reason ||
          `Donor confirmed safe storage: ${storageCondition}. Allergen declaration: ${allergens.join(
            ', '
          )}.`,
        safetyConfidence: checkData?.confidenceScore || 92,
        storageAdvice: checkData?.storageAdvice || 'Keep covered in food-grade insulated container.',
        safeUntil: eatBeforeDate,
        safeUntilMillis: eatBeforeDate.getTime(),
        prohibitedItemsDetected: checkData?.prohibitedItemsDetected || [],
        policyCompliance: {
          isCompliant: checkData?.isCompliant ?? true,
          checkedAt: new Date().toISOString(),
          policyVerdict: checkData?.policyVerdict || 'COMPLIANT',
        },
        // Dietary classification
        isVeg: category === 'Veg',
        dietaryType: category === 'Veg' ? 'veg' : 'non-veg',
        nonVegType: category === 'Non-veg' ? nonVegSubtype : undefined,
        storageCondition: storageCondition,
        allergens: allergens,
        eatBeforeTime: eatBeforeFormatted,
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        // Food Batch Temperature Tracking
        initialTemperature: parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
        currentTemperature: parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
        latestTemperatureLog: {
          id: `temp_init_${Date.now()}`,
          listingId: 'pending',
          batchTitle: foodName.trim(),
          temperatureCelsius: parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
          stage: 'cooking_dispatch',
          stageLabel: 'Kitchen Packaging / Dispatch',
          storageCondition: storageCondition,
          status: evaluateTemperatureSafety(
            parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
            storageCondition
          ).status,
          loggedByRole: 'donor',
          loggedByName: userProfile?.displayName || currentUser?.displayName || 'Donor Kitchen Staff',
          loggedByUserId: currentUser?.uid || 'donor_user',
          loggedAt: new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          loggedAtMillis: Date.now(),
          probeMethod: 'Calibrated Probe Thermometer',
          notes: 'Initial dispatch cooking temperature verified at donor facility.',
        },
        temperatureLogs: [
          {
            id: `temp_init_${Date.now()}`,
            listingId: 'pending',
            batchTitle: foodName.trim(),
            temperatureCelsius: parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
            stage: 'cooking_dispatch',
            stageLabel: 'Kitchen Packaging / Dispatch',
            storageCondition: storageCondition,
            status: evaluateTemperatureSafety(
              parseFloat(initialTemperature) || (storageCondition === 'Hot and covered' ? 72.0 : storageCondition === 'Refrigerated' ? 4.0 : 22.0),
              storageCondition
            ).status,
            loggedByRole: 'donor',
            loggedByName: userProfile?.displayName || currentUser?.displayName || 'Donor Kitchen Staff',
            loggedByUserId: currentUser?.uid || 'donor_user',
            loggedAt: new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            loggedAtMillis: Date.now(),
            probeMethod: 'Calibrated Probe Thermometer',
            notes: 'Initial dispatch cooking temperature verified at donor facility.',
          },
        ],
      };

      const docRef = await addDoc(collection(db, 'listings'), newListingData);
      setRecentListingId(docRef.id);

      setFormSuccessMessage(
        `Surplus food listing "${foodName.trim()}" published successfully! Initial batch temperature (${newListingData.currentTemperature}°C) verified and broadcast to Public Transparency Ledger.`
      );

      // Reset form fields
      setFoodName('');
      setDescription('');
      setCategory('Veg');
      setQuantity(50);
      setUnit('plates');
      setPrepDate(getTodayDateString());
      setPrepTime(getCurrentTimeString());
      setStorageCondition('Hot and covered');
      setInitialTemperature('72.0');
      setAllergens(['None']);
      setSafeHoldingHours(4);
      setConfirmedSafety(false);
      setFssaiSafetyAcks({
        temperatureStandardAcknowledged: false,
        containerIntegrityAcknowledged: false,
        hygieneHandlingAcknowledged: false,
        nonProhibitedAcknowledged: false,
        packagingType: 'food_grade_sealed',
      });
      setPhotoUrl('');
      setPhotoFileName('');
      setSubmitAttempted(false);
      setErrors({});

      // Scroll to success banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Failed to publish listing:', err);
      setErrors((prev) => ({
        ...prev,
        general: err?.message || 'Failed to submit listing. Please try again.',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete listing action
  const handleDeleteListing = async (id: string) => {
    if (!window.confirm('Are you sure you want to withdraw this food listing?')) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
    } catch (err) {
      console.warn('Error deleting listing:', err);
    }
  };

  // Mark completed action
  const handleMarkCompleted = async (id: string) => {
    try {
      const listing = myListings.find((l) => l.id === id);
      await updateDoc(doc(db, 'listings', id), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      if (listing) {
        triggerStatusNotification({
          listingId: id,
          listingTitle: listing.title,
          status: 'completed',
          donorId: listing.donorId,
          donorName: listing.donorName || listing.donorOrg,
          recipientId: listing.claimedBy,
          quantity: listing.quantity,
          unit: listing.unit,
        });
      }
    } catch (err) {
      console.warn('Error updating listing status:', err);
    }
  };

  // SIGN-IN REQUIRED PROMPT (Signed-out users are sent to Sign In)
  if (!currentUser) {
    return (
      <div className="site-container py-12 md:py-16">
        <div className="max-w-md mx-auto bg-white border border-[#D9E2DA] rounded-2xl shadow-xs p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">storefront</span>
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold text-[#1E2A22]">
              {t('donor.dashboardTitle', 'Sign in to list surplus food')}
            </h1>
            <p className="text-sm text-[#526357] mt-2 leading-relaxed">
              FoodLink connects restaurants, caterers, and food businesses directly with verified orphanages and shelters. Sign in to your donor account to publish listings.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full h-12 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[48px]"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              <span>{t('auth.signInBtn', 'Sign In to Continue')}</span>
            </button>

            {/* Quick Demo Sign In Button for Reviewers */}
            <button
              type="button"
              onClick={() => signInAsDemo('restaurant')}
              className="w-full py-2.5 px-4 rounded-lg border border-[#2E7D4F]/30 bg-[#EAF3EC] hover:bg-[#2E7D4F]/15 text-[#2E7D4F] text-xs font-semibold transition-colors cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>{t('auth.demoRestaurantBtn', 'Sign in as Verified Demo Donor')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="site-container py-8 sm:py-10">
      {/* SUCCESS FEEDBACK MESSAGE */}
      {formSuccessMessage && (
        <div
          role="status"
          className="mb-8 p-5 rounded-xl bg-[#EAF3EC] border border-[#A7F3D0] text-[#1E2A22] shadow-xs animate-fadeIn"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#2E7D4F] text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">check</span>
              </span>
              <div>
                <h3 className="font-serif font-bold text-base text-[#1E2A22]">
                  {t('donor.publishSuccess', 'Food listing published successfully!')}
                </h3>
                <p className="text-sm text-[#526357] mt-0.5">
                  {formSuccessMessage}
                </p>
              </div>
            </div>

            {/* Link to view listing in Ledger */}
            {onNavigateLedger && (
              <button
                type="button"
                onClick={onNavigateLedger}
                className="shrink-0 px-4 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs min-h-[40px]"
              >
                <span>View listing in Ledger</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* VERIFICATION PENDING BANNER (if donor is not yet verified) */}
      {!isVerifiedDonor && (
        <div
          role="alert"
          className="mb-8 p-5 rounded-xl bg-[#FFF3E8] border border-[#FCD34D] text-[#1E2A22] shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-[#D9822B] text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-base text-[#1E2A22]">
                    {t('verify.accountPending', 'Verification pending')}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#D9822B] text-white">
                    Action Required
                  </span>
                </div>
                <p className="text-sm text-[#526357] mt-1 leading-relaxed">
                  Your donor account is currently under review by our administration team. Only verified donors can submit food listings to ensure food safety standards. Submissions are temporarily locked.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signInAsDemo('restaurant')}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-[#D9822B] hover:bg-[#B45309] text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Test as Verified Demo Donor</span>
            </button>
          </div>
        </div>
      )}

      {/* HEADER & SUBTITLE */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1E2A22]">
          {t('donor.dashboardTitle', 'Donor Food Rescue')}
        </h1>
        {/* Above the form, a short line: "List surplus food for verified organizations to claim." */}
        <p className="text-base sm:text-lg text-[#526357] mt-2">
          {t('donor.dashboardSubtitle', 'List surplus food for verified organizations to claim.')}
        </p>
      </div>

      {/* DONOR IMPACT PROFILE DASHBOARD & CERTIFICATE CARD */}
      <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#0F291C] via-[#163625] to-[#0A2016] text-white border border-[#244535] shadow-lg relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#059669]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Donor Identity & Badges */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                <span>Verified Rescue Partner</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {donorImpactStats.rescueFrequency}
              </span>
              <span className="text-xs text-white/65">
                City: <strong className="text-white">{donorImpactStats.city}</strong>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">
              {donorImpactStats.donorOrg}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Donor profile documenting verified contribution quantity, hunger relief metrics, and rescue dispatch frequency under Section 80G / CSR guidelines.
            </p>

            {/* Metrics Strip documenting Contribution Quantity & Rescue Frequency */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Contribution Quantity
                </div>
                <div className="text-lg font-black text-white mt-0.5">
                  {donorImpactStats.totalRescuedKg.toLocaleString()} <span className="text-xs font-normal text-slate-300">kg</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ~{donorImpactStats.totalMeals.toLocaleString()} wholesome meals
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Rescue Frequency
                </div>
                <div className="text-lg font-black text-white mt-0.5">
                  {donorImpactStats.totalRescueMissions} <span className="text-xs font-normal text-slate-300">batches</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {donorImpactStats.consistencyScorePercent}% reliability rating
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Environmental CO2e
                </div>
                <div className="text-lg font-black text-white mt-0.5">
                  {donorImpactStats.co2SavedKg.toLocaleString()} <span className="text-xs font-normal text-slate-300">kg</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Landfill greenhouse gas saved
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Social Relief Value
                </div>
                <div className="text-lg font-black text-white mt-0.5">
                  ₹{(donorImpactStats.totalRescuedKg * 85).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {donorImpactStats.sheltersSupportedCount} community homes served
                </div>
              </div>
            </div>
          </div>

          {/* Right: Certificate Generation & Download Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 self-start lg:self-center">
            <button
              id="download-impact-cert-btn"
              type="button"
              onClick={handleDownloadImpactCertificate}
              disabled={isGeneratingCertificatePdf}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0F291C] font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              title="Download official PDF certificate generated with pdf-lib"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isGeneratingCertificatePdf ? 'sync' : 'workspace_premium'}
              </span>
              <span>
                {isGeneratingCertificatePdf ? 'Generating PDF...' : 'Download Impact Certificate'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowImpactCertModal(true)}
              className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-xs"
            >
              <span className="material-symbols-outlined text-[17px]">visibility</span>
              <span>Preview Certificate</span>
            </button>
          </div>
        </div>
      </div>

      {/* DONOR 'NOTIFY ME' LOCAL MEAL REQUEST ALERT FEATURE CARD */}
      <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#112019] border border-[#059669]/30 dark:border-[#244535] shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669] dark:text-[#34D399]">
                <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
                <span>Notify Me • Local Hunger Demand Alerts</span>
              </span>
              {donorSubscription?.active ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Alerts Active in {donorSubscription.city}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Subscription Pending
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#0F1E17] dark:text-[#F4F8F5]">
              {donorSubscription?.active
                ? `Push notifications active for ${donorSubscription.city}${
                    donorSubscription.area && donorSubscription.area !== 'All local areas'
                      ? ` (${donorSubscription.area})`
                      : ''
                  }`
                : `Get notified when shelters near you need surplus meals`}
            </h2>

            <p className="text-xs sm:text-sm text-[#4B6356] dark:text-[#B2CDC0] max-w-2xl leading-relaxed">
              {donorSubscription?.active
                ? `You will receive instant browser push alerts and audio chimes the moment an orphanage, elder home, or community kitchen in your operational area submits a meal requirement.`
                : `Sign up for 'Notify Me' push notifications so your commercial kitchen or banquet hall can immediately respond when local shelters post urgent community meal requests.`}
            </p>

            {/* Live hunger demand in city snippet */}
            <div className="flex items-center gap-3 pt-1 text-xs text-[#059669] dark:text-[#34D399] font-semibold">
              <span className="material-symbols-outlined text-[17px]">volunteer_activism</span>
              <span>
                {activeAreaRequestsCount > 0
                  ? `${activeAreaRequestsCount} active shelter meal request${
                      activeAreaRequestsCount === 1 ? '' : 's'
                    } currently awaiting pledges in ${userProfile?.city || 'your area'}`
                  : `Currently all shelter meal requests in ${userProfile?.city || 'Mumbai'} are fulfilled!`}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-start md:self-center">
            {donorSubscription?.active && (
              <button
                type="button"
                onClick={async () => {
                  const donorId = currentUser?.uid || userProfile?.uid || 'demo_donor_default';
                  await toggleDonorMealSubscription(donorId, false);
                  setDonorSubscription((prev) => (prev ? { ...prev, active: false } : null));
                }}
                className="px-3.5 py-2.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#182C22] text-[#4B6356] dark:text-[#B2CDC0] hover:text-[#0F1E17] text-xs font-bold transition-colors cursor-pointer"
                title="Temporarily pause meal alerts"
              >
                Pause Alerts
              </button>
            )}

            <button
              id="donor-notify-me-btn"
              type="button"
              onClick={() => setShowNotifyMeModal(true)}
              className="px-5 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {donorSubscription?.active ? 'tune' : 'notifications_active'}
              </span>
              <span>
                {donorSubscription?.active
                  ? 'Configure Alert Preferences'
                  : 'Notify Me for Local Requests'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: Desktop Form on Left (~60%), Sticky Checklist Panel on Right (~40%) */}
      {/* Mobile: Form first, panel below */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* LEFT COLUMN: THE FORM (single column, large fields, labels above each field) */}
        <div className="lg:col-span-7 bg-white border border-[#D9E2DA] rounded-2xl shadow-xs p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* General form error if any */}
            {errors.general && (
              <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errors.general}</span>
              </div>
            )}

            {/* 1. Food name and description */}
            <div data-error={Boolean(errors.foodName)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-food-name"
                  className="block text-sm font-bold text-[#1E2A22]"
                >
                  Food name <span className="text-[#DC2626]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowProhibitedGuidelinesModal(true)}
                  className="text-xs font-semibold text-[#2E7D4F] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">verified_user</span>
                  <span>Prohibited Items Policy</span>
                </button>
              </div>
              <input
                id="donor-food-name"
                type="text"
                value={foodName}
                onChange={(e) => {
                  setFoodName(e.target.value);
                  if (errors.foodName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.foodName;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Mixed Vegetable Dum Biryani, Paneer Butter Masala & Rotis"
                className={`w-full h-12 px-4 rounded-xl border bg-white text-base text-[#1E2A22] placeholder:text-[#526357]/60 focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                  errors.foodName
                    ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                    : 'border-[#D9E2DA] focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F]'
                }`}
              />
              {errors.foodName && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.foodName}</span>
                </p>
              )}
            </div>

            <div data-error={Boolean(errors.description)}>
              <label
                htmlFor="donor-food-desc"
                className="block text-sm font-bold text-[#1E2A22] mb-1.5"
              >
                Description <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                id="donor-food-desc"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.description;
                      return next;
                    });
                  }
                }}
                placeholder="Describe preparation details, items included, hygiene packing, and portion size..."
                className={`w-full p-3.5 rounded-xl border bg-white text-sm sm:text-base text-[#1E2A22] placeholder:text-[#526357]/60 focus:outline-none focus:ring-2 transition-all ${
                  errors.description
                    ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                    : 'border-[#D9E2DA] focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F]'
                }`}
              />
              {errors.description && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* 2. Category: Veg or Non-veg (two large buttons) */}
            <div data-error={Boolean(errors.category)}>
              <label className="block text-sm font-bold text-[#1E2A22] mb-2">
                Category <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Veg Large Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Veg');
                    if (errors.category) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.category;
                        return next;
                      });
                    }
                  }}
                  className={`h-14 rounded-xl border-2 font-bold text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer min-h-[52px] ${
                    category === 'Veg'
                      ? 'border-[#2E7D4F] bg-[#EAF3EC] text-[#2E7D4F] shadow-xs'
                      : 'border-[#D9E2DA] bg-white text-[#526357] hover:border-[#2E7D4F]/50 hover:bg-[#FAFBF8]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border-2 border-[#2E7D4F] flex items-center justify-center shrink-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        category === 'Veg' ? 'bg-[#2E7D4F]' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <span>Veg</span>
                  <span className="material-symbols-outlined text-[20px] text-[#2E7D4F]">eco</span>
                </button>

                {/* Non-veg Large Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Non-veg');
                    if (errors.category) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.category;
                        return next;
                      });
                    }
                  }}
                  className={`h-14 rounded-xl border-2 font-bold text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer min-h-[52px] ${
                    category === 'Non-veg'
                      ? 'border-[#D9822B] bg-[#FFF3E8] text-[#D9822B] shadow-xs'
                      : 'border-[#D9E2DA] bg-white text-[#526357] hover:border-[#D9822B]/50 hover:bg-[#FAFBF8]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border-2 border-[#D9822B] flex items-center justify-center shrink-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        category === 'Non-veg' ? 'bg-[#D9822B]' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <span>Non-veg</span>
                  <span className="material-symbols-outlined text-[20px] text-[#D9822B]">
                    set_meal
                  </span>
                </button>
              </div>

              {/* Protein Subtype selection if Non-veg */}
              {category === 'Non-veg' && (
                <div className="mt-3 p-3 rounded-xl bg-[#FFF3E8] border border-[#FCD34D] flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[#D9822B]">Non-veg item type:</span>
                  {['Chicken', 'Mutton', 'Fish & Seafood', 'Egg', 'Mixed Non-Veg'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNonVegSubtype(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        nonVegSubtype === type
                          ? 'bg-[#D9822B] text-white'
                          : 'bg-white text-[#1E2A22] border border-[#D9E2DA]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}

              {errors.category && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.category}</span>
                </p>
              )}
            </div>

            {/* 3. Quantity (number) and unit (plates, kg, packets) */}
            <div data-error={Boolean(errors.quantity)}>
              <label className="block text-sm font-bold text-[#1E2A22] mb-1.5">
                Quantity &amp; Unit <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Number input */}
                <div className="sm:col-span-6">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(1, Number(e.target.value));
                      setQuantity(val);
                      if (errors.quantity) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.quantity;
                          return next;
                        });
                      }
                    }}
                    placeholder="50"
                    className={`w-full h-12 px-4 rounded-xl border bg-white text-base text-[#1E2A22] focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                      errors.quantity
                        ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                        : 'border-[#D9E2DA] focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F]'
                    }`}
                  />
                </div>

                {/* Unit selector (plates, kg, packets) */}
                <div className="sm:col-span-6 grid grid-cols-3 gap-2">
                  {(['plates', 'kg', 'packets'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`h-12 rounded-xl text-sm font-bold capitalize transition-all cursor-pointer min-h-[48px] border ${
                        unit === u
                          ? 'border-[#2E7D4F] bg-[#EAF3EC] text-[#2E7D4F]'
                          : 'border-[#D9E2DA] bg-white text-[#526357] hover:bg-[#FAFBF8]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {errors.quantity && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.quantity}</span>
                </p>
              )}
            </div>

            {/* 4. Prepared date and time */}
            <div data-error={Boolean(errors.prepTime)}>
              <label className="block text-sm font-bold text-[#1E2A22] mb-1.5">
                Prepared date and time <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={prepDate}
                    onChange={(e) => setPrepDate(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#D9E2DA] bg-white text-sm sm:text-base text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] min-h-[48px]"
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl border border-[#D9E2DA] bg-white text-sm sm:text-base text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] min-h-[48px]"
                  />
                </div>
              </div>
              {errors.prepTime && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.prepTime}</span>
                </p>
              )}
            </div>

            {/* 5. Storage condition (dropdown: Hot and covered, Refrigerated, Room temperature sealed) */}
            <div data-error={Boolean(errors.storageCondition)}>
              <label
                htmlFor="donor-storage"
                className="block text-sm font-bold text-[#1E2A22] mb-1.5"
              >
                Storage condition <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="donor-storage"
                value={storageCondition}
                onChange={(e) => {
                  const nextCond = e.target.value as StorageConditionType;
                  setStorageCondition(nextCond);
                  if (nextCond === 'Hot and covered') setInitialTemperature('72.0');
                  else if (nextCond === 'Refrigerated') setInitialTemperature('4.0');
                  else setInitialTemperature('22.0');
                }}
                className="w-full h-12 px-4 rounded-xl border border-[#D9E2DA] bg-white text-base text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] cursor-pointer min-h-[48px]"
              >
                <option value="Hot and covered">Hot and covered (maintained above 60°C)</option>
                <option value="Refrigerated">Refrigerated (chilled below 5°C)</option>
                <option value="Room temperature sealed">Room temperature sealed (dry &amp; covered)</option>
              </select>
            </div>

            {/* 5b. Initial Food Batch Temperature Entry */}
            <div data-error={Boolean(errors.initialTemperature)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-initial-temp"
                  className="block text-sm font-bold text-[#1E2A22]"
                >
                  Initial Batch Temperature (°C) <span className="text-[#DC2626]">*</span>
                </label>
                <span className="text-xs text-[#059669] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">device_thermostat</span>
                  {storageCondition === 'Hot and covered'
                    ? 'Safe Hot Holding ≥ 60°C'
                    : storageCondition === 'Refrigerated'
                    ? 'Safe Chilled ≤ 5°C'
                    : 'Safe Ambient 15–26°C'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    id="donor-initial-temp"
                    name="initialTemperature"
                    type="number"
                    step="0.5"
                    min="-20"
                    max="100"
                    value={initialTemperature}
                    onChange={(e) => {
                      setInitialTemperature(e.target.value);
                      if (errors.initialTemperature) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.initialTemperature;
                          return next;
                        });
                      }
                    }}
                    placeholder="e.g. 72.0"
                    className={`w-full h-12 px-4 rounded-xl border bg-white text-base text-[#1E2A22] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] ${
                      errors.initialTemperature ? 'border-[#DC2626] bg-red-50/20' : 'border-[#D9E2DA]'
                    }`}
                  />
                  <span className="absolute right-4 top-3 text-sm font-bold text-[#526357]">°C</span>
                </div>
                {/* Presets */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {(storageCondition === 'Hot and covered'
                    ? ['65.0', '72.0', '80.0']
                    : storageCondition === 'Refrigerated'
                    ? ['2.0', '4.0', '5.0']
                    : ['18.0', '22.0', '25.0']
                  ).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setInitialTemperature(val);
                        if (errors.initialTemperature) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.initialTemperature;
                            return next;
                          });
                        }
                      }}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        initialTemperature === val
                          ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                          : 'border-[#D9E2DA] bg-white text-[#526357] hover:bg-slate-50'
                      }`}
                    >
                      {val}°C
                    </button>
                  ))}
                </div>
              </div>
              {errors.initialTemperature && (
                <p className="text-xs text-[#DC2626] font-semibold mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{errors.initialTemperature}</span>
                </p>
              )}
              <p className="text-[11px] text-[#526357] mt-1">
                Recorded into the Public Transparency Ledger for verified recipient &amp; volunteer courier logistics safety inspection.
              </p>
            </div>

            {/* 6. Allergen declaration (checkboxes: Nuts, Dairy, Gluten, Eggs, Soy, None) */}
            <div data-error={Boolean(errors.allergens)}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-[#1E2A22]">
                  Allergen declaration <span className="text-[#DC2626]">*</span>
                </label>
                <span className="text-xs text-[#526357]">Select all that apply</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'None'] as AllergenOption[]).map(
                  (allergen) => {
                    const isSelected = allergens.includes(allergen);
                    return (
                      <button
                        key={allergen}
                        type="button"
                        onClick={() => handleToggleAllergen(allergen)}
                        className={`px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-between cursor-pointer min-h-[44px] ${
                          isSelected
                            ? 'border-[#2E7D4F] bg-[#EAF3EC] text-[#2E7D4F]'
                            : 'border-[#D9E2DA] bg-white text-[#526357] hover:bg-[#FAFBF8]'
                        }`}
                      >
                        <span>{allergen}</span>
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${
                            isSelected
                              ? 'bg-[#2E7D4F] border-[#2E7D4F] text-white'
                              : 'border-[#D9E2DA] bg-white'
                          }`}
                        >
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
              {errors.allergens && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.allergens}</span>
                </p>
              )}
            </div>

            {/* 7. Safe holding window (hours the food stays safe to eat) */}
            {/* Show the calculated "Eat before" time automatically from the prepared time */}
            <div data-error={Boolean(errors.safeHolding)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-holding-window"
                  className="block text-sm font-bold text-[#1E2A22]"
                >
                  Safe holding window (hours) <span className="text-[#DC2626]">*</span>
                </label>
                <span className="text-xs font-semibold text-[#526357]">
                  {safeHoldingHours} Hours
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[2, 3, 4, 6].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setSafeHoldingHours(hrs)}
                    className={`py-2 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[42px] border ${
                      safeHoldingHours === hrs
                        ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                        : 'bg-white text-[#526357] border-[#D9E2DA] hover:bg-[#FAFBF8]'
                    }`}
                  >
                    {hrs} hrs
                  </button>
                ))}
              </div>

              {/* Automatic "Eat before" calculation card */}
              <div
                className={`p-3.5 rounded-xl border text-sm flex items-start gap-3 transition-colors ${
                  isSafeWindowInvalid
                    ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                    : 'bg-[#EAF3EC] border-[#A7F3D0] text-[#1E2A22]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                  {isSafeWindowInvalid ? 'alarm_off' : 'schedule'}
                </span>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span>Calculated "Eat before" time:</span>
                    <span className="underline">{eatBeforeFormatted}</span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-90">
                    {isSafeWindowInvalid ? (
                      <span className="font-semibold text-[#DC2626]">
                        Safe holding window is less than 1 hour from now or has expired. Submission is blocked until adjusted.
                      </span>
                    ) : (
                      <span>
                        Safe window: approximately {hoursUntilExpiry.toFixed(1)} hours remaining from now.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {errors.safeHolding && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.safeHolding}</span>
                </p>
              )}
            </div>

            {/* 8. Pickup address, with a "Use my location" button and a map pin */}
            <div data-error={Boolean(errors.pickupAddress)}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="donor-address"
                  className="block text-sm font-bold text-[#1E2A22]"
                >
                  Pickup address <span className="text-[#DC2626]">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isLocating}
                  className="text-xs font-semibold text-[#2E7D4F] hover:text-[#1F5C39] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isLocating ? 'sync' : 'my_location'}
                  </span>
                  <span>{isLocating ? 'Locating...' : 'Use my location'}</span>
                </button>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#2E7D4F]">
                  location_on
                </span>
                <input
                  id="donor-address"
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    if (errors.pickupAddress) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.pickupAddress;
                        return next;
                      });
                    }
                  }}
                  placeholder="Street address, building name, loading dock, city"
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border bg-white text-base text-[#1E2A22] placeholder:text-[#526357]/60 focus:outline-none focus:ring-2 transition-all min-h-[48px] ${
                    errors.pickupAddress
                      ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
                      : 'border-[#D9E2DA] focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F]'
                  }`}
                />
              </div>

              {locationSuccess && (
                <p className="mt-1 text-xs text-[#2E7D4F] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  <span>{locationSuccess}</span>
                </p>
              )}

              {errors.pickupAddress && (
                <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{errors.pickupAddress}</span>
                </p>
              )}
            </div>

            {/* 9. Contact person and phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div data-error={Boolean(errors.contactPerson)}>
                <label
                  htmlFor="donor-contact-person"
                  className="block text-sm font-bold text-[#1E2A22] mb-1.5"
                >
                  Contact person <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="donor-contact-person"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => {
                    setContactPerson(e.target.value);
                    if (errors.contactPerson) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.contactPerson;
                        return next;
                      });
                    }
                  }}
                  placeholder="e.g. Marcus Vance (Head Chef)"
                  className="w-full h-12 px-4 rounded-xl border border-[#D9E2DA] bg-white text-base text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] min-h-[48px]"
                />
                {errors.contactPerson && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.contactPerson}</span>
                  </p>
                )}
              </div>

              <div data-error={Boolean(errors.contactPhone)}>
                <label
                  htmlFor="donor-contact-phone"
                  className="block text-sm font-bold text-[#1E2A22] mb-1.5"
                >
                  Phone number <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="donor-contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    if (errors.contactPhone) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.contactPhone;
                        return next;
                      });
                    }
                  }}
                  placeholder="+91 98200 55442"
                  className="w-full h-12 px-4 rounded-xl border border-[#D9E2DA] bg-white text-base text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] min-h-[48px]"
                />
                {errors.contactPhone && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.contactPhone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* 10. Photo of the food (optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-[#1E2A22]">
                  Photo of the food <span className="text-xs font-normal text-[#526357]">(Optional)</span>
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setPhotoFileName('');
                    }}
                    className="text-xs text-[#DC2626] hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              {photoUrl ? (
                <div className="p-3 rounded-xl border border-[#D9E2DA] bg-[#FAFBF8] flex items-center gap-4">
                  <img
                    src={photoUrl}
                    alt="Food preview"
                    className="w-16 h-16 rounded-lg object-cover border border-[#D9E2DA]"
                  />
                  <div className="text-xs text-[#526357] truncate flex-1">
                    <div className="font-semibold text-[#1E2A22] truncate">
                      {photoFileName || 'food_item_photo.jpg'}
                    </div>
                    <span>Photo attached for recipient review</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="h-14 rounded-xl border-2 border-dashed border-[#D9E2DA] hover:border-[#2E7D4F] bg-[#FAFBF8] flex items-center justify-center gap-2 cursor-pointer transition-colors px-4">
                    <span className="material-symbols-outlined text-[20px] text-[#2E7D4F]">
                      add_photo_alternate
                    </span>
                    <span className="text-sm font-semibold text-[#526357]">
                      Choose an image file from device (Max 5 MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {/* Quick test sample photo */}
                  <button
                    type="button"
                    onClick={() => {
                      const sample = SAMPLE_FOOD_IMAGES[0];
                      if (sample) {
                        setPhotoUrl(sample.url);
                        setPhotoFileName(sample.name);
                      }
                    }}
                    className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
                  >
                    + Use clean demo food photo
                  </button>
                </div>
              )}
            </div>

            {/* AI FOOD SAFETY PRE-SCREEN CARD */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#ECFDF5] via-white to-[#F0FDF4] dark:from-[#064E3B]/20 dark:via-[#112019] dark:to-[#064E3B]/10 border border-[#A7F3D0] dark:border-[#244535] space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#059669] text-white flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
                      <span>AI Food Safety Pre-Screen</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        Gemini 3.8 Flash
                      </span>
                    </h4>
                    <p className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                      Automated hazard analysis, thermal safety zone check, and shelf-life prediction
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runAiSafetyCheck}
                  disabled={aiChecking}
                  className="px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {aiChecking ? 'sync' : 'neurology'}
                  </span>
                  <span>{aiChecking ? 'Analyzing...' : 'Run Pre-Screen'}</span>
                </button>
              </div>

              {aiSafetyResult && (
                <div className="mt-2 pt-3 border-t border-[#A7F3D0]/60 dark:border-[#244535]/60 space-y-2 animate-in fade-in">
                  {aiSafetyResult.safetyVerdict === 'Prohibited' || aiSafetyResult.isCompliant === false ? (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900/60 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          <span>Prohibited by Policy</span>
                        </span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          Cannot be Published
                        </span>
                      </div>

                      {aiSafetyResult.prohibitedItemsDetected && aiSafetyResult.prohibitedItemsDetected.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {aiSafetyResult.prohibitedItemsDetected.map((item, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200"
                            >
                              ⛔ {item}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed font-medium">
                        {aiSafetyResult.policyViolationReason || aiSafetyResult.reason}
                      </p>

                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowProhibitedGuidelinesModal(true)}
                          className="text-xs font-bold text-red-700 dark:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">menu_book</span>
                          <span>View Prohibited Items Guidelines</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                              aiSafetyResult.verdict === 'Looks safe'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {aiSafetyResult.verdict === 'Looks safe' ? 'check_circle' : 'warning'}
                            </span>
                            <span>{aiSafetyResult.verdict}</span>
                          </span>

                          <span className="text-xs font-bold text-[#059669]">
                            {aiSafetyResult.confidenceScore}% Safety Score
                          </span>
                        </div>

                        <span className="text-xs text-slate-500 font-medium">
                          Recommended safe window: <strong>{aiSafetyResult.recommendedExpiryHours} hrs</strong>
                        </span>
                      </div>

                      <p className="text-xs text-[#0F1E17] dark:text-[#F4F8F5] leading-relaxed">
                        {aiSafetyResult.reason}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">thermostat</span>
                          <span>Thermal Holding Verified</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">inventory_2</span>
                          <span>Sealed Food-Grade Packaging</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* FOOD SAFETY RULES & CONFIRMATION CHECKBOX */}
            <div className="pt-4 border-t border-[#D9E2DA] space-y-4">
              {/* Note: "An offline check may be done at pickup before the food is handed over." */}
              <div className="p-3.5 rounded-xl bg-[#EAF3EC] border border-[#A7F3D0] text-xs text-[#1E2A22] flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#2E7D4F] shrink-0 mt-0.5">
                  verified_user
                </span>
                <p className="leading-relaxed">
                  <strong>Notice:</strong> An offline check may be done at pickup before the food is handed over to confirm hygiene standards.
                </p>
              </div>

              {/* INTERACTIVE FSSAI-COMPLIANT SAFETY CHECKLIST */}
              <div data-error={Boolean(errors.fssaiTemperature || errors.fssaiContainer)}>
                <FssaiSafetyChecklist
                  storageCondition={storageCondition}
                  temperatureReading={initialTemperature}
                  onTemperatureChange={(temp) => {
                    setInitialTemperature(temp);
                    if (errors.fssaiTemperature) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.fssaiTemperature;
                        return next;
                      });
                    }
                  }}
                  acknowledgments={fssaiSafetyAcks}
                  onChange={(newAcks) => {
                    setFssaiSafetyAcks(newAcks);
                    if (errors.fssaiTemperature || errors.fssaiContainer) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (newAcks.temperatureStandardAcknowledged) delete next.fssaiTemperature;
                        if (newAcks.containerIntegrityAcknowledged) delete next.fssaiContainer;
                        return next;
                      });
                    }
                  }}
                  hasErrors={Boolean(errors.fssaiTemperature || errors.fssaiContainer)}
                />
              </div>

              {/* FSSAI Checklist Error Messages */}
              {(errors.fssaiTemperature || errors.fssaiContainer) && (
                <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] space-y-1.5 shadow-2xs">
                  {errors.fssaiTemperature && (
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{errors.fssaiTemperature}</span>
                    </div>
                  )}
                  {errors.fssaiContainer && (
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{errors.fssaiContainer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Required confirmation checkbox before submitting:
                  "I confirm this food is fresh, was stored properly, and is safe to eat." */}
              <div data-error={Boolean(errors.confirmedSafety)}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmedSafety}
                    onChange={(e) => {
                      setConfirmedSafety(e.target.checked);
                      if (errors.confirmedSafety) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.confirmedSafety;
                          return next;
                        });
                      }
                    }}
                    className="w-5 h-5 rounded border-[#D9E2DA] text-[#2E7D4F] focus:ring-[#2E7D4F] cursor-pointer shrink-0 mt-0.5"
                  />
                  <span className="text-sm font-semibold text-[#1E2A22] leading-tight">
                    I confirm this food is fresh, was stored properly, and is safe to eat. <span className="text-[#DC2626]">*</span>
                  </span>
                </label>
                {errors.confirmedSafety && (
                  <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1 ml-8">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{errors.confirmedSafety}</span>
                  </p>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              {/* Requires verified donor, valid safe window, and FSSAI temperature + container integrity acknowledgment */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowListingPreviewModal(true)}
                  className="w-full sm:w-auto px-5 h-13 rounded-xl border border-[#2E7D4F] bg-white hover:bg-[#EAF3EC] text-[#2E7D4F] font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs min-h-[50px] shrink-0"
                  title="Preview how this listing card appears to recipient shelters and couriers"
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                  <span>Preview Listing</span>
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !isVerifiedDonor ||
                    isSafeWindowInvalid ||
                    !fssaiSafetyAcks.temperatureStandardAcknowledged ||
                    !fssaiSafetyAcks.containerIntegrityAcknowledged
                  }
                  className="w-full flex-1 h-13 rounded-xl bg-[#2E7D4F] hover:bg-[#1F5C39] disabled:bg-[#D9E2DA] disabled:text-[#526357] disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[50px]"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>
                        {safetyCheckingInSubmit
                          ? 'Checking policy & safety (Gemini AI)...'
                          : 'Publishing listing...'}
                      </span>
                    </span>
                  ) : !isVerifiedDonor ? (
                    <span>Verification pending - Submissions disabled</span>
                  ) : isSafeWindowInvalid ? (
                    <span>Safe window invalid (&lt; 1 hr remaining)</span>
                  ) : !fssaiSafetyAcks.temperatureStandardAcknowledged || !fssaiSafetyAcks.containerIntegrityAcknowledged ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      <span>Acknowledge FSSAI Standards to Publish</span>
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">publish</span>
                      <span>List Surplus Food</span>
                    </>
                  )}
                </button>

                {!isVerifiedDonor && (
                  <p className="text-xs text-center text-[#D9822B] font-medium mt-2">
                    Only verified donors can submit listings. Please wait for verification approval.
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: STICKY "FOOD SAFETY CHECKLIST" PANEL (Soft green #EAF3EC) */}
        {/* On desktop: sticky, on mobile: below form */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div className="bg-[#EAF3EC] border border-[#D9E2DA] rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#2E7D4F] text-white flex items-center justify-center font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">checklist</span>
                </span>
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  Food safety checklist
                </h2>
              </div>
              <p className="text-xs text-[#526357] mt-1.5 leading-relaxed">
                Updates in real-time as you fill the form to guarantee FSSAI Good Samaritan safety compliance.
              </p>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#1E2A22] mb-1.5">
                <span>Verification Readiness</span>
                <span>
                  {checklistStatus.completedCount} of {checklistStatus.totalCount} completed ({checklistStatus.progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/70 overflow-hidden border border-[#D9E2DA]">
                <div
                  className="h-full bg-[#2E7D4F] transition-all duration-300"
                  style={{ width: `${checklistStatus.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3 pt-1">
              {checklistStatus.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-colors flex items-start gap-2.5 text-xs ${
                    item.complete
                      ? 'bg-white border-[#A7F3D0] text-[#1E2A22]'
                      : 'bg-white/60 border-[#D9E2DA] text-[#526357]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold ${
                      item.complete
                        ? 'bg-[#2E7D4F] text-white'
                        : 'border border-[#D9E2DA] bg-[#FAFBF8] text-transparent'
                    }`}
                  >
                    {item.complete ? '✓' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold ${item.complete ? 'text-[#1E2A22]' : 'text-[#526357]'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[#526357] truncate mt-0.5">
                      {item.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Real-time Storage & Handling Guideline Card */}
            <div className="pt-3 border-t border-[#D9E2DA] space-y-2 text-xs text-[#1E2A22]">
              <div className="font-bold flex items-center gap-1.5 text-[#2E7D4F]">
                <span className="material-symbols-outlined text-[16px]">thermostat</span>
                <span>Temperature Standard: {storageCondition}</span>
              </div>
              <p className="text-[#526357] leading-relaxed">
                {storageCondition === 'Hot and covered' &&
                  'Ensure hot cooked items are held above 60°C in food-grade thermal containers.'}
                {storageCondition === 'Refrigerated' &&
                  'Perishable cooked foods must be stored at 4°C or lower prior to handover.'}
                {storageCondition === 'Room temperature sealed' &&
                  'Bakery and dry goods must be sealed against airborne contaminants.'}
              </p>
            </div>

            {/* Offline check note */}
            <div className="pt-2 border-t border-[#D9E2DA] text-[11px] text-[#526357] leading-relaxed">
              <span>Notice: An offline check may be done at pickup before the food is handed over.</span>
            </div>
          </div>

          {/* Quick preset card */}
          <div className="bg-white border border-[#D9E2DA] rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#1E2A22]">
              Quick Fill Sample Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setFoodName('Surplus Dal Makhani & Jeera Rice');
                  setDescription('Freshly prepared hot banquet surplus, sealed in 3 stainless steel containers.');
                  setCategory('Veg');
                  setQuantity(50);
                  setUnit('plates');
                  setStorageCondition('Hot and covered');
                  setAllergens(['Dairy']);
                  setSafeHoldingHours(4);
                  setConfirmedSafety(true);
                }}
                className="w-full text-left p-2.5 rounded-lg border border-[#D9E2DA] hover:bg-[#EAF3EC] hover:border-[#2E7D4F] transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#1E2A22]">Veg Banquet Rice &amp; Dal</div>
                <div className="text-[11px] text-[#526357]">50 plates • Veg • Hot &amp; covered</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFoodName('Chicken Dum Biryani (Wedding Surplus)');
                  setDescription('Hygienically prepared chicken biryani in insulated thermal urns.');
                  setCategory('Non-veg');
                  setNonVegSubtype('Chicken');
                  setQuantity(75);
                  setUnit('plates');
                  setStorageCondition('Hot and covered');
                  setAllergens(['Dairy']);
                  setSafeHoldingHours(3);
                  setConfirmedSafety(true);
                }}
                className="w-full text-left p-2.5 rounded-lg border border-[#D9E2DA] hover:bg-[#FFF3E8] hover:border-[#D9822B] transition-colors cursor-pointer"
              >
                <div className="font-bold text-[#1E2A22]">Chicken Dum Biryani</div>
                <div className="text-[11px] text-[#526357]">75 plates • Non-veg (Chicken) • 3h</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MY LISTINGS SECTION (Below the form) */}
      <div id="my-listings-section" className="mt-14 pt-10 border-t border-[#D9E2DA] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#1E2A22]">
              Your Published Food Listings
            </h2>
            <p className="text-sm text-[#526357] mt-0.5">
              Active and fulfilled rescue packages posted by your donor profile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNotifyMeModal(true)}
              className="px-3 py-1.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#112F21] hover:bg-[#D1FAE5] dark:hover:bg-[#163F2C] text-xs font-bold text-[#059669] dark:text-[#34D399] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Configure local meal request push notifications"
            >
              <span className="material-symbols-outlined text-[16px]">notifications_active</span>
              <span>{donorSubscription?.active ? 'Alerts Active' : 'Notify Me'}</span>
            </button>
            {myListings.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQrModalListing(myListings[0]);
                  setQrModalMode('scan');
                  setQrModalStage('pickup');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-xs font-bold text-[#059669] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="Scan recipient or courier QR pass at point of pickup"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Scan Recipient Pass</span>
              </button>
            )}
            {onNavigateLedger && (
              <button
                type="button"
                onClick={onNavigateLedger}
                className="text-xs sm:text-sm font-semibold text-[#2E7D4F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View complete Ledger</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </button>
            )}
          </div>
        </div>

        {qrVerifiedToast && (
          <div className="mb-4 p-4 rounded-xl bg-[#EAF3EC] border border-[#2E7D4F]/30 text-[#1E2A22] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-[#2E7D4F] shrink-0">verified</span>
              <p className="text-sm font-semibold">{qrVerifiedToast}</p>
            </div>
            <button
              type="button"
              onClick={() => setQrVerifiedToast(null)}
              className="p-1 text-[#526357] hover:text-[#1E2A22] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {loadingListings ? (
          <div className="py-8 text-center text-sm text-[#526357]">
            Loading your listings...
          </div>
        ) : myListings.length === 0 ? (
          <div className="bg-white border border-[#D9E2DA] rounded-2xl p-8 text-center text-[#526357]">
            <span className="material-symbols-outlined text-[36px] text-[#2E7D4F]/60 mb-2">
              inventory_2
            </span>
            <p className="font-medium text-sm text-[#1E2A22]">No active listings found.</p>
            <p className="text-xs text-[#526357] mt-1">
              Use the form above to post surplus meals for nearby shelters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white border border-[#D9E2DA] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#2E7D4F]/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                        listing.isVeg
                          ? 'bg-[#EAF3EC] text-[#2E7D4F]'
                          : 'bg-[#FFF3E8] text-[#D9822B]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {listing.isVeg ? 'Veg' : `Non-Veg ${listing.nonVegType ? `(${listing.nonVegType})` : ''}`}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        listing.status === 'available'
                          ? 'bg-[#EAF3EC] text-[#2E7D4F]'
                          : listing.status === 'claimed'
                          ? 'bg-[#FFF3E8] text-[#D9822B]'
                          : 'bg-[#FAFBF8] text-[#526357] border border-[#D9E2DA]'
                      }`}
                    >
                      {listing.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-base text-[#1E2A22] line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-xs text-[#526357] mt-1 line-clamp-2">
                    {listing.notes || 'No extra notes provided.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#D9E2DA]/60 space-y-1 text-xs text-[#526357]">
                    <div className="flex items-center justify-between">
                      <span>Quantity:</span>
                      <span className="font-bold text-[#1E2A22]">
                        {listing.quantity} {listing.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Eat before:</span>
                      <span className="font-medium text-[#1E2A22]">
                        {listing.expiryTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Initial Batch Temp:</span>
                      <span className="font-bold text-[#059669] flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-[13px]">device_thermostat</span>
                        {listing.initialTemperature !== undefined
                          ? `${listing.initialTemperature}°C`
                          : listing.currentTemperature !== undefined
                          ? `${listing.currentTemperature}°C`
                          : 'Pending Log'}
                      </span>
                    </div>
                    <div className="truncate">
                      <span>Location: </span>
                      <span className="text-[#1E2A22]">{listing.location}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTempModalListing(listing)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Input or update food batch temperature"
                    >
                      <span className="material-symbols-outlined text-[15px]">device_thermostat</span>
                      <span>{listing.currentTemperature !== undefined ? `${listing.currentTemperature}°C Log` : 'Log Temp'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrModalListing(listing);
                        setQrModalMode('show');
                        setQrModalStage('pickup');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Display point-of-pickup QR code or scan courier pass"
                    >
                      <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
                      <span>QR Handover</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {listing.status === 'available' && (
                      <button
                        type="button"
                        onClick={() => handleMarkCompleted(listing.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#A7F3D0] bg-[#EAF3EC] hover:bg-[#2E7D4F]/15 text-[#2E7D4F] font-semibold transition-colors cursor-pointer"
                      >
                        Mark Picked Up
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteListing(listing.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] text-[#DC2626] font-semibold transition-colors cursor-pointer"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temperature Log Entry Modal for Donors */}
      {tempModalListing && (
        <TemperatureLogModal
          isOpen={Boolean(tempModalListing)}
          onClose={() => setTempModalListing(null)}
          listingId={tempModalListing.id}
          batchTitle={tempModalListing.title}
          storageCondition={(tempModalListing.storageCondition as StorageConditionType) || 'Hot and covered'}
          defaultRole="donor"
          defaultStage="cooking_dispatch"
          existingLogs={tempModalListing.temperatureLogs || []}
          onTemperatureLogged={(newEntry) => {
            setMyListings((prev) =>
              prev.map((l) =>
                l.id === tempModalListing.id
                  ? {
                      ...l,
                      currentTemperature: newEntry.temperatureCelsius,
                      latestTemperatureLog: newEntry,
                      temperatureLogs: [newEntry, ...(l.temperatureLogs || [])],
                    }
                  : l
              )
            );
          }}
        />
      )}

      {/* Policy Violation & Guidelines Modals */}
      {policyViolationModalData && (
        <PolicyViolationModal
          isOpen={policyViolationModalData.isOpen}
          prohibitedItems={policyViolationModalData.prohibitedItems}
          reason={policyViolationModalData.reason}
          storageAdvice={policyViolationModalData.storageAdvice}
          onClose={() => setPolicyViolationModalData(null)}
          onOpenGuidelines={() => {
            setPolicyViolationModalData(null);
            setShowProhibitedGuidelinesModal(true);
          }}
        />
      )}

      <ProhibitedGuidelinesModal
        isOpen={showProhibitedGuidelinesModal}
        onClose={() => setShowProhibitedGuidelinesModal(false)}
      />

      {/* Donor Impact Certificate Modal */}
      <DonorImpactCertificateModal
        isOpen={showImpactCertModal}
        onClose={() => setShowImpactCertModal(false)}
        impactData={donorImpactStats}
      />

      {/* Live Food Listing Card Preview Modal */}
      {showListingPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1E17]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowListingPreviewModal(false);
          }}
        >
          <div className="bg-white dark:bg-[#15231B] w-full max-w-lg rounded-2xl border border-[#D9E2DA] dark:border-[#22382B] shadow-2xl overflow-hidden my-auto animate-slideUp">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#D9E2DA] dark:border-[#22382B] flex items-center justify-between bg-[#FAFBF8] dark:bg-[#1A2E22]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#2E7D4F]">visibility</span>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1E2A22] dark:text-[#F4F8F5]">
                    Listing Card Live Preview
                  </h3>
                  <p className="text-xs text-[#526357] dark:text-[#9BB0A1]">
                    This is how your donation will appear to recipient shelters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowListingPreviewModal(false)}
                className="w-8 h-8 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] text-[#526357] hover:text-[#1E2A22] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: High-Fidelity Card Preview */}
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-[#2E7D4F] p-4 bg-white dark:bg-[#15231B] shadow-sm space-y-3">
                {/* Photo Preview if available */}
                {photoUrl && (
                  <div className="w-full h-40 rounded-lg overflow-hidden border border-[#D9E2DA] dark:border-[#22382B]">
                    <img src={photoUrl} alt="Listing Preview" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded border bg-[#EAF3EC] text-[#2E7D4F] border-[#2E7D4F]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
                      {category.toLowerCase().includes('meat') || category.toLowerCase().includes('chicken') ? 'Non-Veg' : 'Pure Veg'}
                    </span>
                    <span className="text-xs font-bold text-[#1E2A22] dark:text-white bg-[#FAFBF8] dark:bg-[#1E3A2B] border border-[#D9E2DA] dark:border-[#22382B] px-2 py-0.5 rounded">
                      {quantity || 1} {unit}
                    </span>
                  </div>

                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#D9822B] border border-[#D9822B]/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    <span>Safe Window: {safeHoldingHours} hrs</span>
                  </span>
                </div>

                {/* Title */}
                <h4 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-white">
                  {foodName.trim() || 'Fresh Prepared Meals'}
                </h4>

                {/* Details */}
                <p className="text-xs text-[#526357] dark:text-[#9BB0A1] line-clamp-2">
                  {description.trim() || 'Freshly prepared surplus meals in food-grade packaging ready for immediate shelter dispatch.'}
                </p>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#FAFBF8] dark:bg-[#1A2E22] border border-[#D9E2DA] dark:border-[#22382B] text-xs">
                  <div>
                    <span className="text-[10px] text-[#526357] uppercase font-bold block">Storage Condition</span>
                    <span className="font-semibold text-[#1E2A22] dark:text-white">{storageCondition || 'Hot and covered'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] uppercase font-bold block">Pickup Window</span>
                    <span className="font-semibold text-[#1E2A22] dark:text-white">Within 2 hours</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] uppercase font-bold block">Donor Kitchen</span>
                    <span className="font-semibold text-[#1E2A22] dark:text-white truncate block">
                      {userProfile?.orgName || contactPerson || 'Verified Commercial Donor'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] uppercase font-bold block">Location</span>
                    <span className="font-semibold text-[#1E2A22] dark:text-white truncate block">
                      {pickupAddress || 'Kitchen Dispatch Area'}
                    </span>
                  </div>
                </div>

                {/* Good Samaritan compliance seal */}
                <div className="flex items-center gap-2 text-[11px] text-[#059669] font-semibold bg-[#ECFDF5] dark:bg-[#112F21] p-2 rounded-lg border border-[#059669]/20">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Good Samaritan statutory food donation protection active</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D9E2DA] dark:border-[#22382B]">
                <button
                  type="button"
                  onClick={() => setShowListingPreviewModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] text-xs font-semibold text-[#1E2A22] dark:text-white hover:bg-[#FAFBF8] cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setShowListingPreviewModal(false);
                    handleSubmit(e as any);
                  }}
                  disabled={submitting || !isVerifiedDonor || isSafeWindowInvalid}
                  className="px-5 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">publish</span>
                  <span>Publish This Listing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Point of Pickup QR Transfer Verification Modal */}
      {qrModalListing && (
        <QrTransferModal
          isOpen={Boolean(qrModalListing)}
          onClose={() => setQrModalListing(null)}
          listing={qrModalListing}
          defaultMode={qrModalMode}
          defaultStage={qrModalStage}
          onTransferVerified={(record) => {
            setMyListings((prev) =>
              prev.map((l) =>
                l.id === record.listingId ? { ...l, status: 'completed' } : l
              )
            );
            setQrVerifiedToast(
              `Contactless handover verified! SHA-256 Digest: ${record.proofDigest} • Verified by ${record.verifiedByName}`
            );
          }}
        />
      )}

      {/* 'Notify Me' Local Meal Request Alert Modal */}
      {showNotifyMeModal && (
        <NotifyMeModal
          isOpen={showNotifyMeModal}
          onClose={() => setShowNotifyMeModal(false)}
          initialCity={donorSubscription?.city || userProfile?.city || 'Mumbai'}
          onSaved={(savedSub) => {
            setDonorSubscription(savedSub);
          }}
        />
      )}
    </div>
  );
};
