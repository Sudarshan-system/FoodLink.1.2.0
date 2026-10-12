import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { FoodListing } from './DonorDashboard';
import { INDIAN_CITIES, getCityById } from './cities';
import { SAMPLE_FOOD_IMAGES } from './sampleFoodImages';
import { triggerStatusNotification } from './fcmService';
import { VERIFIED_SHELTERS, ShelterDestination, getSheltersForCity } from './shelters';
import { QrTransferModal } from './QrTransferModal';
import { TransferVerificationRecord } from './qrTransferService';
import { useTranslation } from './LanguageContext';
import { NotifyMeModal } from './NotifyMeModal';

export interface RecipientDashboardProps {
  onOpenAuth: () => void;
  onNavigateDonor: () => void;
  selectedCityId?: string;
  onSelectCity?: (cityId: string) => void;
  onOpenCsrModal?: (listing?: FoodListing) => void;
}

export interface AugmentedFoodListing extends FoodListing {
  _coords: { lat: number; lng: number };
  _distanceKm: number;
  _distanceToShelterName?: string;
  _isVeg: boolean;
}

// Helper to determine if listing is vegetarian
function checkIsVeg(listing: FoodListing): boolean {
  const text = (listing.title + ' ' + (listing.notes || '')).toLowerCase();
  return (
    !text.includes('chicken') &&
    !text.includes('mutton') &&
    !text.includes('meat') &&
    !text.includes('fish') &&
    !text.includes('egg') &&
    !text.includes('non-veg')
  );
}

const getSamplePhoto = (id: string) =>
  SAMPLE_FOOD_IMAGES.find((img) => img.id === id)?.url || '';

// Haversine distance calculator in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Map coordinates lookup or deterministic calculation
function getListingCoordinates(
  listing: FoodListing,
  index: number,
  baseCoords: { lat: number; lng: number }
): { lat: number; lng: number } {
  // If listing already has explicit coordinates, return them
  if (typeof (listing as any).lat === 'number' && typeof (listing as any).lng === 'number') {
    return { lat: (listing as any).lat, lng: (listing as any).lng };
  }
  if (typeof (listing as any).locationLat === 'number' && typeof (listing as any).locationLng === 'number') {
    return { lat: (listing as any).locationLat, lng: (listing as any).locationLng };
  }

  // Lookup well-known Mumbai metro areas for accurate geographical distance from shelters
  const loc = (listing.location || '').toLowerCase();
  if (loc.includes('andheri west')) return { lat: 19.1197, lng: 72.8464 };
  if (loc.includes('andheri east')) return { lat: 19.1150, lng: 72.8710 };
  if (loc.includes('goregaon')) return { lat: 19.1550, lng: 72.8620 };
  if (loc.includes('bandra') || loc.includes('bkc')) return { lat: 19.0665, lng: 72.8680 };
  if (loc.includes('khar')) return { lat: 19.0700, lng: 72.8340 };
  if (loc.includes('chembur')) return { lat: 19.0520, lng: 72.8990 };
  if (loc.includes('matunga')) return { lat: 19.0280, lng: 72.8550 };
  if (loc.includes('dadar')) return { lat: 19.0180, lng: 72.8430 };
  if (loc.includes('lower parel')) return { lat: 18.9950, lng: 72.8250 };
  if (loc.includes('colaba')) return { lat: 18.9067, lng: 72.8147 };
  if (loc.includes('thane')) return { lat: 19.2183, lng: 72.9781 };

  // Fallback deterministic spread relative to city center
  const charSum = (listing.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (charSum + index * 19) % 100;
  const angle = (seed / 100) * 2 * Math.PI;
  const dist = 0.02 + ((seed % 25) / 100) * 0.07;
  return {
    lat: baseCoords.lat + dist * Math.sin(angle),
    lng: baseCoords.lng + dist * Math.cos(angle) * 1.15,
  };
}

// Calculate remaining safe time and determine if urgent (#D9822B label)
function calculateTimeLeft(listing: FoodListing, now: number): {
  text: string;
  isUrgent: boolean;
  isExpired: boolean;
  remainingMinutes: number;
} {
  let safeUntilMillis = listing.safeUntilMillis;

  if (!safeUntilMillis && listing.safeUntil) {
    if (typeof listing.safeUntil.toMillis === 'function') {
      safeUntilMillis = listing.safeUntil.toMillis();
    } else if (listing.safeUntil instanceof Date) {
      safeUntilMillis = listing.safeUntil.getTime();
    } else if (typeof listing.safeUntil === 'number') {
      safeUntilMillis = listing.safeUntil;
    }
  }

  if (!safeUntilMillis && listing.createdAt) {
    const createdMillis =
      typeof listing.createdAt.toMillis === 'function'
        ? listing.createdAt.toMillis()
        : listing.createdAt instanceof Date
        ? listing.createdAt.getTime()
        : typeof listing.createdAt === 'number'
        ? listing.createdAt
        : now;
    safeUntilMillis = createdMillis + 3 * 60 * 60 * 1000;
  }

  if (!safeUntilMillis) {
    // Default 2.5 hours from listing creation or present
    safeUntilMillis = now + 150 * 60 * 1000;
  }

  const diffMs = safeUntilMillis - now;
  const remainingMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMs <= 0) {
    return {
      text: 'Expired',
      isUrgent: true,
      isExpired: true,
      remainingMinutes: 0,
    };
  }

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

  // Time left is short when under 2 hours (120 minutes)
  const isUrgent = remainingMinutes <= 120;

  if (hours > 0) {
    return {
      text: `${hours}h ${mins}m left`,
      isUrgent,
      isExpired: false,
      remainingMinutes,
    };
  }

  return {
    text: `${mins}m left`,
    isUrgent: true,
    isExpired: false,
    remainingMinutes,
  };
}

// Fallback sample listings for instant preview if Firestore is initially empty
export const FALLBACK_LISTINGS: FoodListing[] = [
  {
    id: 'sample-browse-1',
    donorId: 'donor-grand-bistro',
    donorName: 'Chef Marcus',
    donorOrg: 'The Grand Bistro & Banquet',
    donorEmail: 'contact@bistrodelight.com',
    donorPhone: '+91 98200 12345',
    title: 'Royal Palace Banquet Surplus: Dal Tadka & Jeera Rice',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 65,
    unit: 'Portions',
    pickupWindow: 'Today, 4:00 PM to 6:30 PM',
    expiryTime: 'Within 3 hours',
    location: 'Andheri West, Mumbai',
    notes: 'Pure vegetarian meal prepared for an afternoon corporate reception. Kept heated in insulated silver chafers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10019022000123',
    safeUntilMillis: Date.now() + 85 * 60 * 1000, // 1h 25m left -> urgent
    photoUrl: getSamplePhoto('curry'),
    isVeg: true,
    dietaryType: 'veg',
  },
  {
    id: 'sample-browse-2',
    donorId: 'donor-taj-caterers',
    donorName: 'Farhan Shaikh',
    donorOrg: 'Apex Hospitality Caterers',
    donorEmail: 'catering@apexhospitality.in',
    donorPhone: '+91 98201 54321',
    title: 'Wedding Reception Chicken Dum Biryani & Mirchi Salan',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 90,
    unit: 'Portions',
    pickupWindow: 'Today, 5:00 PM to 7:30 PM',
    expiryTime: 'Within 4 hours',
    location: 'Bandra Kurla Complex, Mumbai',
    notes: 'Non-veg chicken dum biryani, sealed in clean food-grade aluminum handis immediately after function closing.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10018021000456',
    safeUntilMillis: Date.now() + 190 * 60 * 1000, // 3h 10m left -> normal
    photoUrl: getSamplePhoto('biryani'),
    isVeg: false,
    dietaryType: 'non-veg',
    nonVegType: 'Chicken',
  },
  {
    id: 'sample-browse-3',
    donorId: 'donor-golden-bakery',
    donorName: 'Anita Dsouza',
    donorOrg: 'Golden Grain Artisanal Bakery',
    donorEmail: 'orders@goldengrain.com',
    donorPhone: '+91 98202 98765',
    title: 'Fresh Artisanal Sourdough & Multigrain Loaves',
    foodType: 'Bakery & Bread',
    category: 'Bakery',
    quantity: 40,
    unit: 'Loaves',
    pickupWindow: 'Today before 8:00 PM',
    expiryTime: 'Best within 24 hours',
    location: 'Khar West, Mumbai',
    notes: 'Pure veg fresh baked morning bread. Wrapped in kraft bakery bags.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10020011000789',
    safeUntilMillis: Date.now() + 240 * 60 * 1000, // 4h left -> normal
    photoUrl: getSamplePhoto('bread'),
  },
  {
    id: 'sample-browse-4',
    donorId: 'donor-organic-mandi',
    donorName: 'Ramesh Patel',
    donorOrg: 'Shetkari Sahakari Mandi',
    donorEmail: 'produce@shetkari.org',
    donorPhone: '+91 98203 11223',
    title: 'Crates of Ripe Tomatoes, Carrots & Spinach',
    foodType: 'Produce & Fruits',
    category: 'Produce',
    quantity: 50,
    unit: 'kg',
    pickupWindow: 'Today, until 7:00 PM',
    expiryTime: 'Eat fresh within 48 hours',
    location: 'Dadar Market, Mumbai',
    notes: 'Pure veg unblemished farm fresh produce sorted from morning mandi delivery.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    safeUntilMillis: Date.now() + 65 * 60 * 1000, // 1h 5m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
  {
    id: 'sample-browse-5',
    donorId: 'donor-metro-dining',
    donorName: 'Chef Sanjeev',
    donorOrg: 'Metropolis Corporate Food Court',
    donorEmail: 'admin@metrofoodcourt.com',
    donorPhone: '+91 98204 33445',
    title: 'Paneer Butter Masala with Tawa Parathas',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 55,
    unit: 'Portions',
    pickupWindow: 'Today, 4:30 PM to 6:00 PM',
    expiryTime: 'Within 2 hours',
    location: 'Lower Parel, Mumbai',
    notes: 'Pure veg lunch buffet trays, hot sealed and untouched.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10017011000321',
    safeUntilMillis: Date.now() + 50 * 60 * 1000, // 50m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
  {
    id: 'sample-browse-6',
    donorId: 'donor-punjabi-dhaba',
    donorName: 'Gurpreet Singh',
    donorOrg: 'Sher-E-Punjab Banquets',
    donorEmail: 'sherepunjab@banquets.com',
    donorPhone: '+91 98205 66778',
    title: 'Tandoori Chicken Tikka & Roomali Rotis',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 45,
    unit: 'Portions',
    pickupWindow: 'Today, 5:30 PM to 7:00 PM',
    expiryTime: 'Within 3 hours',
    location: 'Chembur, Mumbai',
    notes: 'Non-veg freshly roasted chicken starters from banquet buffet. Packed in insulated thermocol carriers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10016012000888',
    safeUntilMillis: Date.now() + 110 * 60 * 1000, // 1h 50m left -> urgent
    photoUrl: getSamplePhoto('biryani'),
  },
  {
    id: 'sample-browse-7',
    donorId: 'donor-quick-bites',
    donorName: 'Vikram Joshi',
    donorOrg: 'Sunrise Confectionery',
    donorEmail: 'vikram@sunrisebakery.in',
    donorPhone: '+91 98206 99001',
    title: 'Veg Puff Pastries & Vegetable Patties',
    foodType: 'Bakery & Bread',
    category: 'Bakery',
    quantity: 70,
    unit: 'Pieces',
    pickupWindow: 'Today until 8:30 PM',
    expiryTime: 'Within 6 hours',
    location: 'Goregaon East, Mumbai',
    notes: 'Pure veg spiced potato puff pastry, individually wrapped in greaseproof food paper.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10021022000555',
    safeUntilMillis: Date.now() + 210 * 60 * 1000, // 3h 30m left -> normal
    photoUrl: getSamplePhoto('bread'),
  },
  {
    id: 'sample-browse-8',
    donorId: 'donor-central-kitchen',
    donorName: 'Meenakshi Iyer',
    donorOrg: 'Dakshin Catering Services',
    donorEmail: 'orders@dakshincatering.com',
    donorPhone: '+91 98207 44556',
    title: 'Idlis, Medu Vada & Coconut Chutney',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 80,
    unit: 'Portions',
    pickupWindow: 'Today, 3:30 PM to 5:30 PM',
    expiryTime: 'Within 2 hours',
    location: 'Matunga, Mumbai',
    notes: 'Pure veg breakfast and lunch surplus. Freshly made with separate sambar containers.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10014022000999',
    safeUntilMillis: Date.now() + 75 * 60 * 1000, // 1h 15m left -> urgent
    photoUrl: getSamplePhoto('curry'),
  },
  {
    id: 'sample-browse-9',
    donorId: 'donor-heritage-banquet',
    donorName: 'Cyrus Wadia',
    donorOrg: 'Colaba Heritage Grand Banquet',
    donorEmail: 'events@colabaheritage.com',
    donorPhone: '+91 98208 55432',
    title: 'South Mumbai Heritage Banquet: Thali Delicacies & Rotis',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 60,
    unit: 'Portions',
    pickupWindow: 'Today, 6:00 PM to 8:30 PM',
    expiryTime: 'Within 4 hours',
    location: 'Colaba Causeway, Mumbai',
    notes: 'Pure vegetarian regional banquet thali trays with fresh chapatis, dal, and paneer curry.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10015011000777',
    safeUntilMillis: Date.now() + 160 * 60 * 1000,
    photoUrl: getSamplePhoto('curry'),
    isVeg: true,
    dietaryType: 'veg',
  },
  {
    id: 'sample-browse-10',
    donorId: 'donor-thane-techpark',
    donorName: 'Anil Deshmukh',
    donorOrg: 'Mindspace Tech Park Central Cafeteria',
    donorEmail: 'cafeteria@mindspacetech.com',
    donorPhone: '+91 98209 88990',
    title: 'Tech Park Cafeteria Surplus: Vegetable Pulao & Korma',
    foodType: 'Cooked Hot Meals',
    category: 'Cooked Hot Meals',
    quantity: 75,
    unit: 'Portions',
    pickupWindow: 'Today, 4:00 PM to 6:00 PM',
    expiryTime: 'Within 2.5 hours',
    location: 'Thane West Central Hub, Mumbai',
    notes: 'Pure veg corporate lunch surplus, preserved in temperature-monitored warming vessels.',
    status: 'available',
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    fssaiNumber: '10022022000444',
    safeUntilMillis: Date.now() + 100 * 60 * 1000,
    photoUrl: getSamplePhoto('curry'),
    isVeg: true,
    dietaryType: 'veg',
  },
];

export const RecipientDashboard: React.FC<RecipientDashboardProps> = ({
  onOpenAuth,
  onNavigateDonor,
  selectedCityId = 'mumbai',
}) => {
  const { currentUser, userProfile } = useAuth();
  const { t } = useTranslation();

  const currentCity = getCityById(selectedCityId || 'mumbai');
  const cityCenterCoords = useMemo(() => ({
    lat: currentCity.id === 'all' ? 19.0760 : currentCity.lat,
    lng: currentCity.id === 'all' ? 72.8777 : currentCity.lng,
  }), [currentCity]);

  // Firestore listings state
  const [firestoreListings, setFirestoreListings] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  // Radius filter: 5km, 10km, 20km, or 'all'
  const [distanceFilter, setDistanceFilter] = useState<number | 'all'>(10);
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>('all');
  const [showNotifyMeModal, setShowNotifyMeModal] = useState<boolean>(false);

  // Shelters for selected city
  const cityShelters = useMemo(() => {
    return getSheltersForCity(selectedCityId || 'mumbai');
  }, [selectedCityId]);

  // Selected shelter state
  const [selectedShelterId, setSelectedShelterId] = useState<string>(() => {
    if (userProfile?.role === 'ngo' && userProfile?.orgName) {
      const match = VERIFIED_SHELTERS.find(
        (s) =>
          s.name.toLowerCase().includes(userProfile.orgName!.toLowerCase()) ||
          userProfile.orgName!.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) return match.id;
    }
    return 'shelter_mum_1';
  });

  // Custom GPS shelter override if user clicked "Use GPS"
  const [customShelterLocation, setCustomShelterLocation] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    capacityMeals: number;
  } | null>(null);

  const activeShelter: ShelterDestination = useMemo(() => {
    if (customShelterLocation) {
      return {
        id: 'custom_gps_shelter',
        name: customShelterLocation.name,
        cityId: selectedCityId || 'mumbai',
        type: 'Custom GPS Shelter Anchor',
        address: customShelterLocation.address,
        contactPerson: userProfile?.displayName || 'Recipient Shelter Coordinator',
        contactPhone: userProfile?.phone || '+91 98200 00000',
        lat: customShelterLocation.lat,
        lng: customShelterLocation.lng,
        capacityMeals: customShelterLocation.capacityMeals,
        dietaryPreference: 'All',
      };
    }
    const found = VERIFIED_SHELTERS.find((s) => s.id === selectedShelterId);
    if (found) return found;
    return cityShelters[0] || VERIFIED_SHELTERS[0];
  }, [customShelterLocation, selectedShelterId, cityShelters, selectedCityId, userProfile]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomShelterLocation({
          name: 'My Device Current Location',
          address: `GPS Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          capacityMeals: 180,
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
      }
    );
  };

  // Mobile Map View Toggle (Mobile shows list first by default)
  const [showMobileMap, setShowMobileMap] = useState(false);

  // Pagination State (6 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Selected Listing for Detail Modal & Map Highlight
  const [selectedListing, setSelectedListing] = useState<AugmentedFoodListing | null>(null);

  // Inline Message when non-signed-in visitor clicks Claim
  const [claimPromptMessage, setClaimPromptMessage] = useState<string | null>(null);
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // QR Code Transfer Verification state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalListing, setQrModalListing] = useState<FoodListing | null>(null);
  const [qrModalMode, setQrModalMode] = useState<'show' | 'scan'>('scan');
  const [qrModalStage, setQrModalStage] = useState<'pickup' | 'delivery'>('delivery');
  const [lastClaimedListing, setLastClaimedListing] = useState<FoodListing | null>(null);

  // Live clock tick every minute to update remaining times accurately
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Google Maps setup
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const radiusCircleRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps API script safely if not already present
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCwhHMmXHsRmTDYF0LqSUEPPWvSzB2IUNU';
    if (!apiKey) return;

    if ((window as any).google && (window as any).google.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapsLoaded(true);
      document.head.appendChild(script);
    } else {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.addEventListener('load', () => setMapsLoaded(true));
      }
    }
  }, []);

  // Real-time Firestore subscription for active available food listings
  useEffect(() => {
    setLoading(true);
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, where('status', '==', 'available'));

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
        setFirestoreListings(items);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time listings listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Merge Firestore listings with benchmark fallback items to ensure a rich experience
  const rawListings = useMemo(() => {
    if (firestoreListings.length > 0) {
      return firestoreListings;
    }
    return FALLBACK_LISTINGS;
  }, [firestoreListings]);

  // Augment listings with calculated distance from active shelter, coordinates, and veg classification
  const augmentedListings = useMemo(() => {
    return rawListings.map((item, index) => {
      const coords = getListingCoordinates(item, index, cityCenterCoords);
      const distance = calculateDistanceKm(
        activeShelter.lat,
        activeShelter.lng,
        coords.lat,
        coords.lng
      );

      let isVeg: boolean;
      if (typeof item.isVeg === 'boolean') {
        isVeg = item.isVeg;
      } else if (item.dietaryType) {
        isVeg = item.dietaryType === 'veg';
      } else {
        const titleAndNotes = (item.title + ' ' + (item.notes || '')).toLowerCase();
        isVeg =
          !titleAndNotes.includes('chicken') &&
          !titleAndNotes.includes('mutton') &&
          !titleAndNotes.includes('meat') &&
          !titleAndNotes.includes('fish') &&
          !titleAndNotes.includes('egg') &&
          !titleAndNotes.includes('non-veg');
      }

      return {
        ...item,
        _coords: coords,
        _distanceKm: distance,
        _distanceToShelterName: activeShelter.name,
        _isVeg: isVeg,
      };
    });
  }, [rawListings, activeShelter, cityCenterCoords]);

  // Radius counts for filter chips
  const radiusCounts = useMemo(() => {
    const count5 = augmentedListings.filter((i) => i._distanceKm <= 5).length;
    const count10 = augmentedListings.filter((i) => i._distanceKm <= 10).length;
    const count20 = augmentedListings.filter((i) => i._distanceKm <= 20).length;
    const countAll = augmentedListings.length;
    return { count5, count10, count20, countAll };
  }, [augmentedListings]);

  // Apply filters: Search query, Veg/Non-Veg, Distance, Food Type
  const filteredListings = useMemo(() => {
    return augmentedListings.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(queryLower);
        const matchesLocation = item.location.toLowerCase().includes(queryLower);
        const matchesNotes = (item.notes || '').toLowerCase().includes(queryLower);
        const matchesDonor = (item.donorOrg || item.donorName || '').toLowerCase().includes(queryLower);

        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesDonor) {
          return false;
        }
      }

      // 2. Veg / Non-veg Filter
      if (vegFilter === 'veg' && !item._isVeg) return false;
      if (vegFilter === 'non-veg' && item._isVeg) return false;

      // 3. Distance Filter (Radius from recipient shelter: 5km, 10km, or 20km)
      if (typeof distanceFilter === 'number' && item._distanceKm > distanceFilter) {
        return false;
      }

      // 4. Food Type Filter
      if (foodTypeFilter !== 'all') {
        const typeLower = (item.foodType || item.category || '').toLowerCase();
        if (foodTypeFilter === 'cooked') {
          if (!typeLower.includes('cooked') && !typeLower.includes('hot') && !typeLower.includes('meal')) {
            return false;
          }
        } else if (foodTypeFilter === 'bakery') {
          if (!typeLower.includes('bakery') && !typeLower.includes('bread')) {
            return false;
          }
        } else if (foodTypeFilter === 'produce') {
          if (!typeLower.includes('produce') && !typeLower.includes('fruit') && !typeLower.includes('vegetable')) {
            return false;
          }
        } else if (foodTypeFilter === 'packaged') {
          if (!typeLower.includes('packaged') && !typeLower.includes('dry') && !typeLower.includes('canned')) {
            return false;
          }
        }
      }

      return true;
    });
  }, [augmentedListings, searchQuery, vegFilter, distanceFilter, foodTypeFilter]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, vegFilter, distanceFilter, foodTypeFilter]);

  // Paginated listings for current page
  const totalPages = Math.max(1, Math.ceil(filteredListings.length / itemsPerPage));
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredListings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredListings, currentPage]);

  // Initialize and update Google Maps instance, radius circle, and markers
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !(window as any).google?.maps) return;

    const google = (window as any).google;

    if (!googleMapInstance.current) {
      googleMapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: activeShelter.lat, lng: activeShelter.lng },
        zoom: currentCity.zoom || 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
    }

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear previous radius circle
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null);
      radiusCircleRef.current = null;
    }

    // 1. Add Shelter Marker (Distinctive Emerald Base with Home Badge)
    const shelterMarker = new google.maps.Marker({
      position: { lat: activeShelter.lat, lng: activeShelter.lng },
      map: googleMapInstance.current,
      title: `Shelter Base: ${activeShelter.name}`,
      zIndex: 500,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: '#059669',
        fillOpacity: 1,
        strokeWeight: 3.5,
        strokeColor: '#FFFFFF',
      },
    });

    const shelterInfoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 8px; max-width: 260px;">
          <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
            🏠 Your Shelter Base
          </div>
          <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #1E2A22; line-height: 1.3;">
            ${activeShelter.name}
          </h4>
          <p style="margin: 0 0 6px; font-size: 11px; color: #526357;">
            ${activeShelter.address}
          </p>
          <div style="display: flex; gap: 4px; align-items: center; font-size: 11px; font-weight: 600; color: #059669; background: #EAF3EC; padding: 3px 6px; border-radius: 4px;">
            <span>Radius:</span>
            <span>${distanceFilter === 'all' ? 'All Distances' : `${distanceFilter} km radius`}</span>
          </div>
        </div>
      `,
    });

    shelterMarker.addListener('click', () => {
      shelterInfoWindow.open(googleMapInstance.current, shelterMarker);
    });
    markersRef.current.push(shelterMarker);

    // 2. Draw Google Maps Radius Circle around active shelter
    const radiusMeters = (distanceFilter === 'all' ? 20 : distanceFilter) * 1000;
    const radiusCircle = new google.maps.Circle({
      strokeColor: '#059669',
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillColor: '#10B981',
      fillOpacity: distanceFilter === 'all' ? 0.06 : 0.12,
      map: googleMapInstance.current,
      center: { lat: activeShelter.lat, lng: activeShelter.lng },
      radius: radiusMeters,
    });
    radiusCircleRef.current = radiusCircle;

    // 3. Add markers for all filtered listings within that radius
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: activeShelter.lat, lng: activeShelter.lng });

    filteredListings.forEach((item) => {
      bounds.extend(item._coords);
      const isSelected = selectedListing?.id === item.id;

      const marker = new google.maps.Marker({
        position: item._coords,
        map: googleMapInstance.current,
        title: `${item.title} (~${item._distanceKm} km from shelter)`,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: isSelected ? 7 : 5.5,
          fillColor: isSelected ? '#1F5C39' : '#D9822B',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        zIndex: isSelected ? 100 : 1,
      });

      marker.addListener('click', () => {
        setSelectedListing(item);
      });

      markersRef.current.push(marker);
    });

    // Auto-fit bounds or smooth center
    if (radiusCircle.getBounds()) {
      bounds.union(radiusCircle.getBounds());
    }
    googleMapInstance.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [mapsLoaded, filteredListings, selectedListing, activeShelter, distanceFilter, currentCity]);

  // Handle Claim Action
  const handleClaimListing = async (listing: FoodListing) => {
    setClaimPromptMessage(null);
    setClaimSuccessMessage(null);

    // Rule: Visitors can browse without signing in. If they click "Claim", show a simple message asking them to sign in.
    if (!currentUser) {
      setClaimPromptMessage(
        'Please sign in to claim food. Only verified non-profit organizations, orphanages, and shelters can claim surplus batches.'
      );
      return;
    }

    // Check role: Only non-profit recipients can claim
    const role = userProfile?.role;
    if (role === 'restaurant' || role === 'donor') {
      setClaimPromptMessage(
        'You are currently signed in as a Donor. Only verified recipient organizations and shelters can claim food batches.'
      );
      return;
    }

    setIsClaiming(true);
    try {
      const handoffCode = String(Math.floor(1000 + Math.random() * 9000));
      const orgName = userProfile?.orgName || userProfile?.displayName || 'Registered Community Shelter';

      // Update Firestore if this is a real Firestore document
      if (listing.id && !listing.id.startsWith('sample-')) {
        const listingRef = doc(db, 'listings', listing.id);
        await updateDoc(listingRef, {
          status: 'claimed',
          claimedAt: serverTimestamp(),
          claimedBy: currentUser.uid,
          claimingOrgId: currentUser.uid,
          claimingOrgName: orgName,
          handoffCode,
        });
      }

      // Trigger FCM push notification to donor and recipient
      triggerStatusNotification({
        listingId: listing.id,
        listingTitle: listing.title,
        status: 'claimed',
        donorId: listing.donorId,
        donorName: listing.donorName || listing.donorOrg,
        recipientId: currentUser.uid,
        recipientName: orgName,
        quantity: listing.quantity,
        unit: listing.unit,
        handoffCode,
        location: listing.location,
      });

      setLastClaimedListing(listing);
      setClaimSuccessMessage(
        `Food claimed successfully! Pickup verification code is #${handoffCode}. Please present this code upon collection.`
      );
      setSelectedListing(null);
    } catch (err: any) {
      console.error('Error claiming food listing:', err);
      setClaimPromptMessage(err?.message || 'Could not claim this listing. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Seed sample data helper when Firestore has 0 listings
  const handleSeedSurplusListings = async () => {
    try {
      const listingsRef = collection(db, 'listings');
      for (const item of FALLBACK_LISTINGS) {
        const { id, ...data } = item;
        await addDoc(listingsRef, {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      setClaimSuccessMessage('Sample surplus batches added to Firestore successfully.');
    } catch (err) {
      console.error('Seed error:', err);
    }
  };

  return (
    <div className="w-full">
      {/* Notifications / Banner Messages */}
      {claimPromptMessage && (
        <div className="mb-6 p-4 rounded-lg bg-[#FFF3E8] border border-[#D9822B]/40 text-[#1E2A22] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#D9822B] shrink-0">
              lock
            </span>
            <p className="text-sm font-medium">{claimPromptMessage}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setClaimPromptMessage(null);
                onOpenAuth();
              }}
              className="px-4 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-sm font-semibold transition-colors min-h-[44px] cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setClaimPromptMessage(null)}
              className="p-2 text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {claimSuccessMessage && (
        <div className="mb-6 p-4 rounded-xl bg-[#EAF3EC] border border-[#2E7D4F]/30 text-[#1E2A22] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px] text-[#2E7D4F] shrink-0">
              check_circle
            </span>
            <div>
              <p className="text-sm font-semibold">{claimSuccessMessage}</p>
              <p className="text-xs text-[#526357]">Present your digital transfer pass or scan the donor/courier's QR code upon arrival.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastClaimedListing && (
              <button
                type="button"
                onClick={() => {
                  setQrModalListing(lastClaimedListing);
                  setQrModalMode('show');
                  setQrModalStage('pickup');
                  setQrModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                <span>Open Transfer Pass</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setClaimSuccessMessage(null)}
              className="p-1.5 text-[#526357] hover:text-[#1E2A22] cursor-pointer rounded-lg hover:bg-black/5"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* RECIPIENT SHELTER LOCATION ANCHOR BAR */}
      <div className="mb-6 p-4 sm:p-5 rounded-xl bg-white dark:bg-[#15231B] border border-[#D9E2DA] dark:border-[#22382B] shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#2E7D4F] dark:text-[#34D399] flex items-center justify-center shrink-0 border border-[#2E7D4F]/20 shadow-2xs">
              <span className="material-symbols-outlined text-[26px]">home_work</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E7D4F] dark:text-[#34D399] bg-[#EAF3EC] dark:bg-[#1E3A2B] px-2.5 py-0.5 rounded-full border border-[#2E7D4F]/20">
                  {t('browse.shelterBase', 'Recipient Shelter Base')}
                </span>
                {userProfile?.role === 'ngo' && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Your Registered Profile
                  </span>
                )}
                <span className="text-xs text-[#526357] dark:text-[#9BB0A1]">
                  {t('browse.capacity', 'Capacity')}: <strong className="text-[#1E2A22] dark:text-[#F4F8F5]">{activeShelter.capacityMeals}</strong> {t('browse.mealsPerDay', 'meals/day')}
                </span>
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1E2A22] dark:text-[#F4F8F5]">
                {activeShelter.name}
              </h3>
              <p className="text-xs text-[#526357] dark:text-[#9BB0A1] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[15px] text-[#2E7D4F]">location_on</span>
                <span>{activeShelter.address}</span>
              </p>
            </div>
          </div>

          {/* Shelter Switcher & GPS Controls */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#D9E2DA] dark:border-[#22382B]">
            <div className="relative flex-1 sm:flex-initial">
              <label htmlFor="shelter-select" className="sr-only">Select Reference Shelter</label>
              <select
                id="shelter-select"
                value={customShelterLocation ? 'custom' : selectedShelterId}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setCustomShelterLocation(null);
                    setSelectedShelterId(e.target.value);
                  }
                }}
                className="w-full sm:w-auto h-11 px-3.5 pr-8 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] text-[#1E2A22] dark:text-[#F4F8F5] text-xs font-semibold focus:outline-none focus:border-[#2E7D4F] cursor-pointer appearance-none"
              >
                {customShelterLocation && (
                  <option value="custom">📍 GPS Device Location</option>
                )}
                {VERIFIED_SHELTERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cityId.toUpperCase()})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#526357]">
                expand_more
              </span>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="h-11 px-3.5 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] hover:bg-[#EAF3EC] dark:hover:bg-[#1E3A2B] text-xs font-semibold text-[#1E2A22] dark:text-[#F4F8F5] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Use your device GPS as the shelter location anchor"
            >
              <span className="material-symbols-outlined text-[17px] text-[#2E7D4F]">my_location</span>
              <span>{t('browse.useGps', 'Use GPS Location')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQrModalListing(filteredListings[0] || null);
                setQrModalMode('scan');
                setQrModalStage('delivery');
                setQrModalOpen(true);
              }}
              className="h-11 px-3.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399] hover:bg-[#D1FAE5] dark:hover:bg-[#173D2B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Scan QR code from donor or courier to verify contactless meal handover"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>{t('browse.scanTransfer', 'Scan / Verify Transfer')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP: SEARCH BOX AND LOCATION-BASED RADIUS FILTERS */}
      <div className="bg-white dark:bg-[#15231B] p-4 sm:p-5 rounded-xl border border-[#D9E2DA] dark:border-[#22382B] shadow-2xs mb-6 sm:mb-8">
        {/* Search Input */}
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#526357] text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('browse.searchPlaceholder', 'Search by food name, area, or donor...')}
            className="w-full h-11 pl-11 pr-10 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] text-[#1E2A22] dark:text-[#F4F8F5] placeholder-[#526357] text-base focus:outline-none focus:border-[#2E7D4F] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#526357] hover:text-[#1E2A22] p-1 cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* LOCATION-BASED RADIUS FILTER SEGMENTED BUTTONS */}
        <div className="mb-4 p-3 rounded-xl bg-[#FAFBF8] dark:bg-[#1A2E22] border border-[#D9E2DA] dark:border-[#22382B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1E2A22] dark:text-[#F4F8F5]">
              <span className="material-symbols-outlined text-[18px] text-[#2E7D4F]">radar</span>
              <span>{t('browse.radiusFilterTitle', 'Location-Based Radius Filter')} (from {activeShelter.name.split(' ')[0]} Shelter):</span>
            </div>
            <span className="text-[11px] text-[#526357] dark:text-[#9BB0A1]">
              Live GPS calculation
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 5 km Radius */}
            <button
              type="button"
              onClick={() => setDistanceFilter(5)}
              className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer min-h-[42px] ${
                distanceFilter === 5
                  ? 'bg-[#2E7D4F] text-white shadow-xs ring-2 ring-[#2E7D4F]/30'
                  : 'bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] border border-[#D9E2DA] dark:border-[#22382B] hover:border-[#2E7D4F]/50 hover:bg-[#EAF3EC]/40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${distanceFilter === 5 ? 'bg-white' : 'bg-[#2E7D4F]'}`} />
                <span>{t('browse.within5km', 'Within 5 km')}</span>
              </span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  distanceFilter === 5
                    ? 'bg-white/25 text-white'
                    : 'bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#2E7D4F] dark:text-[#34D399]'
                }`}
              >
                {radiusCounts.count5}
              </span>
            </button>

            {/* 10 km Radius */}
            <button
              type="button"
              onClick={() => setDistanceFilter(10)}
              className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer min-h-[42px] ${
                distanceFilter === 10
                  ? 'bg-[#2E7D4F] text-white shadow-xs ring-2 ring-[#2E7D4F]/30'
                  : 'bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] border border-[#D9E2DA] dark:border-[#22382B] hover:border-[#2E7D4F]/50 hover:bg-[#EAF3EC]/40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${distanceFilter === 10 ? 'bg-white' : 'bg-teal-500'}`} />
                <span>{t('browse.within10km', 'Within 10 km')}</span>
              </span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  distanceFilter === 10
                    ? 'bg-white/25 text-white'
                    : 'bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#2E7D4F] dark:text-[#34D399]'
                }`}
              >
                {radiusCounts.count10}
              </span>
            </button>

            {/* 20 km Radius */}
            <button
              type="button"
              onClick={() => setDistanceFilter(20)}
              className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer min-h-[42px] ${
                distanceFilter === 20
                  ? 'bg-[#2E7D4F] text-white shadow-xs ring-2 ring-[#2E7D4F]/30'
                  : 'bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] border border-[#D9E2DA] dark:border-[#22382B] hover:border-[#2E7D4F]/50 hover:bg-[#EAF3EC]/40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${distanceFilter === 20 ? 'bg-white' : 'bg-blue-500'}`} />
                <span>{t('browse.within20km', 'Within 20 km')}</span>
              </span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  distanceFilter === 20
                    ? 'bg-white/25 text-white'
                    : 'bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#2E7D4F] dark:text-[#34D399]'
                }`}
              >
                {radiusCounts.count20}
              </span>
            </button>

            {/* All Distances */}
            <button
              type="button"
              onClick={() => setDistanceFilter('all')}
              className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer min-h-[42px] ${
                distanceFilter === 'all'
                  ? 'bg-[#2E7D4F] text-white shadow-xs ring-2 ring-[#2E7D4F]/30'
                  : 'bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] border border-[#D9E2DA] dark:border-[#22382B] hover:border-[#2E7D4F]/50 hover:bg-[#EAF3EC]/40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${distanceFilter === 'all' ? 'bg-white' : 'bg-slate-400'}`} />
                <span>{t('browse.allDistances', 'All Distances')}</span>
              </span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  distanceFilter === 'all'
                    ? 'bg-white/25 text-white'
                    : 'bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#2E7D4F] dark:text-[#34D399]'
                }`}
              >
                {radiusCounts.countAll}
              </span>
            </button>
          </div>
        </div>

        {/* Filters Row: Veg / Non-Veg, Distance Dropdown, Food Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filter 1: Veg / Non-veg */}
          <div>
            <label className="block text-xs font-semibold text-[#526357] mb-1.5 uppercase tracking-wider">
              {t('common.diet', 'Dietary Preference')}
            </label>
            <div className="grid grid-cols-3 gap-1 bg-[#FAFBF8] dark:bg-[#1A2E22] p-1 rounded-lg border border-[#D9E2DA] dark:border-[#22382B]">
              <button
                type="button"
                onClick={() => setVegFilter('all')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center ${
                  vegFilter === 'all'
                    ? 'bg-[#2E7D4F] text-white'
                    : 'text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
                }`}
              >
                {t('browse.dietaryAll', 'All')}
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('veg')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1 ${
                  vegFilter === 'veg'
                    ? 'bg-[#2E7D4F] text-white'
                    : 'text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F] inline-block" />
                {t('browse.dietaryVeg', 'Pure Veg')}
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('non-veg')}
                className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer min-h-[38px] flex items-center justify-center gap-1 ${
                  vegFilter === 'non-veg'
                    ? 'bg-[#2E7D4F] text-white'
                    : 'text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9822B] inline-block" />
                {t('browse.dietaryNonVeg', 'Non-Veg')}
              </button>
            </div>
          </div>

          {/* Filter 2: Shelter Radius Dropdown (5km, 10km, 20km, all) */}
          <div>
            <label className="block text-xs font-semibold text-[#526357] mb-1.5 uppercase tracking-wider">
              Radius from Shelter
            </label>
            <select
              value={distanceFilter === 'all' ? 'all' : String(distanceFilter)}
              onChange={(e) =>
                setDistanceFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full h-11 px-3 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] text-[#1E2A22] dark:text-[#F4F8F5] text-sm font-medium focus:outline-none focus:border-[#2E7D4F] cursor-pointer"
            >
              <option value="5">Within 5 km of shelter ({radiusCounts.count5} available)</option>
              <option value="10">Within 10 km of shelter ({radiusCounts.count10} available)</option>
              <option value="20">Within 20 km of shelter ({radiusCounts.count20} available)</option>
              <option value="all">Any distance / Show all ({radiusCounts.countAll} available)</option>
            </select>
          </div>

          {/* Filter 3: Food Type */}
          <div>
            <label className="block text-xs font-semibold text-[#526357] mb-1.5 uppercase tracking-wider">
              Food Type
            </label>
            <select
              value={foodTypeFilter}
              onChange={(e) => setFoodTypeFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] text-[#1E2A22] dark:text-[#F4F8F5] text-sm font-medium focus:outline-none focus:border-[#2E7D4F] cursor-pointer"
            >
              <option value="all">All food types</option>
              <option value="cooked">Cooked Hot Meals</option>
              <option value="bakery">Bakery &amp; Bread</option>
              <option value="produce">Fresh Produce &amp; Fruits</option>
              <option value="packaged">Packaged &amp; Dry Groceries</option>
            </select>
          </div>
        </div>

        {/* Mobile View Toggle: Show map button */}
        <div className="lg:hidden mt-4 pt-3 border-t border-[#D9E2DA] dark:border-[#22382B] flex items-center justify-between">
          <span className="text-xs text-[#526357] dark:text-[#9BB0A1] font-medium">
            {filteredListings.length} listings in radius
          </span>
          <button
            type="button"
            onClick={() => setShowMobileMap(!showMobileMap)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] text-sm font-semibold text-[#1E2A22] dark:text-[#F4F8F5] hover:bg-[#EAF3EC] transition-colors min-h-[44px] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#2E7D4F]">
              {showMobileMap ? 'format_list_bulleted' : 'map'}
            </span>
            <span>{showMobileMap ? 'Show list' : 'Show map'}</span>
          </button>
        </div>
      </div>

      {/* DONOR 'NOTIFY ME' PROMPT BANNER IN FOOD LISTING BROWSER */}
      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-[#ECFDF5] to-white dark:from-[#0E2419] dark:to-[#112019] border border-[#059669]/30 dark:border-[#244535] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">notifications_active</span>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
              <span>Are you a food donor in {currentCity.name}?</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669] dark:text-[#34D399]">
                Notify Me
              </span>
            </div>
            <div className="text-xs text-[#4B6356] dark:text-[#B2CDC0] mt-0.5">
              Sign up for push notifications when shelters in your area need emergency meals.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowNotifyMeModal(true)}
          className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">notification_add</span>
          <span>Notify Me for Local Requests</span>
        </button>
      </div>

      {/* RADIUS SUMMARY FEEDBACK STRIP */}
      <div className="mb-6 p-3 rounded-xl bg-[#EAF3EC] dark:bg-[#1E3A2B]/60 border border-[#2E7D4F]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#1E2A22] dark:text-[#F4F8F5]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0 animate-pulse" />
          <span>
            Showing <strong className="text-[#059669] font-bold text-sm">{filteredListings.length}</strong> active food donation{filteredListings.length === 1 ? '' : 's'}{' '}
            {distanceFilter === 'all' ? (
              <span>across <strong>all distances</strong></span>
            ) : (
              <span>within <strong>{distanceFilter} km radius</strong> of {activeShelter.name}</span>
            )}
            {' · '}
            <span className="text-[#526357] dark:text-[#9BB0A1]">Avg courier transit: 12–18 mins</span>
          </span>
        </div>

        {distanceFilter !== 'all' && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {distanceFilter === 5 && (
              <button
                type="button"
                onClick={() => setDistanceFilter(10)}
                className="font-semibold text-[#2E7D4F] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                Expand to 10 km ({radiusCounts.count10})
              </button>
            )}
            {distanceFilter === 10 && (
              <button
                type="button"
                onClick={() => setDistanceFilter(20)}
                className="font-semibold text-[#2E7D4F] dark:text-[#34D399] hover:underline cursor-pointer"
              >
                Expand to 20 km ({radiusCounts.count20})
              </button>
            )}
            <button
              type="button"
              onClick={() => setDistanceFilter('all')}
              className="font-semibold text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22] hover:underline cursor-pointer"
            >
              Show all ({radiusCounts.countAll})
            </button>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: LISTINGS ON LEFT, MAP ON RIGHT (DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: LISTINGS LIST (~60% on desktop) */}
        <div className={`lg:col-span-7 ${showMobileMap ? 'hidden lg:block' : 'block'}`}>
          {/* Header Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[#526357]">
              Available surplus: <span className="text-[#1E2A22] font-bold">{filteredListings.length}</span>
            </p>
            {(searchQuery || vegFilter !== 'all' || distanceFilter !== 'all' || foodTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVegFilter('all');
                  setDistanceFilter('all');
                  setFoodTypeFilter('all');
                }}
                className="text-xs text-[#2E7D4F] hover:text-[#1F5C39] font-semibold underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-[#526357] bg-white rounded-lg border border-[#D9E2DA]">
              <span className="material-symbols-outlined animate-spin text-[32px] text-[#2E7D4F] mb-2">
                progress_activity
              </span>
              <p className="text-sm">Loading available surplus listings...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="py-12 px-6 text-center bg-white rounded-lg border border-[#D9E2DA]">
              <div className="w-12 h-12 rounded-lg bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[24px]">radar</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#1E2A22] mb-1">
                {distanceFilter !== 'all'
                  ? `No food donations found within ${distanceFilter} km of ${activeShelter.name}`
                  : 'No matching food listings found'}
              </h3>
              <p className="text-sm text-[#526357] max-w-md mx-auto mb-4">
                {distanceFilter !== 'all'
                  ? `No active surplus batches right now within ${distanceFilter} km of your shelter. Try expanding the radius to 10 km or 20 km to see nearby kitchens.`
                  : 'Try widening your filters, clearing your search, or adjusting dietary preferences.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {distanceFilter === 5 && (
                  <button
                    type="button"
                    onClick={() => setDistanceFilter(10)}
                    className="px-4 py-2.5 rounded-lg bg-[#2E7D4F] text-white text-xs font-semibold hover:bg-[#1F5C39] transition-colors min-h-[40px] cursor-pointer"
                  >
                    Expand to 10 km ({radiusCounts.count10} available)
                  </button>
                )}
                {distanceFilter !== 20 && distanceFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDistanceFilter(20)}
                    className="px-4 py-2.5 rounded-lg border border-[#2E7D4F] text-[#2E7D4F] text-xs font-semibold hover:bg-[#EAF3EC] transition-colors min-h-[40px] cursor-pointer"
                  >
                    Expand to 20 km ({radiusCounts.count20} available)
                  </button>
                )}
                {distanceFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDistanceFilter('all')}
                    className="px-4 py-2.5 rounded-lg border border-[#D9E2DA] bg-[#FAFBF8] text-[#1E2A22] text-xs font-semibold hover:bg-white transition-colors min-h-[40px] cursor-pointer"
                  >
                    Show All Distances ({radiusCounts.countAll})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVegFilter('all');
                    setDistanceFilter('all');
                    setFoodTypeFilter('all');
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#526357] text-white text-xs font-semibold hover:bg-[#1E2A22] transition-colors min-h-[40px] cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedListings.map((listing) => {
                const timeLeft = calculateTimeLeft(listing, currentTime);
                const isSelected = selectedListing?.id === listing.id;

                return (
                  <div
                    key={listing.id}
                    className={`bg-white rounded-lg border p-5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#2E7D4F] ring-1 ring-[#2E7D4F]'
                        : 'border-[#D9E2DA] hover:border-[#2E7D4F]/50'
                    }`}
                  >
                    <div>
                      {/* Top Row: Tags (Veg/Non-Veg, Quantity, Radius Proximity, Time Left) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Veg / Non-veg tag */}
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded border ${
                              listing._isVeg
                                ? 'bg-[#EAF3EC] text-[#2E7D4F] border-[#2E7D4F]/30'
                                : 'bg-[#FFF3E8] text-[#D9822B] border-[#D9822B]/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                listing._isVeg ? 'bg-[#2E7D4F]' : 'bg-[#D9822B]'
                              }`}
                            />
                            {listing._isVeg ? 'Pure Veg' : 'Non-Veg'}
                          </span>

                          {/* Quantity */}
                          <span className="text-xs font-semibold text-[#1E2A22] bg-[#FAFBF8] border border-[#D9E2DA] px-2 py-0.5 rounded">
                            {listing.quantity} {listing.unit || 'portions'}
                          </span>

                          {/* Radius Proximity Badge */}
                          {listing._distanceKm <= 5 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Within 5 km
                            </span>
                          ) : listing._distanceKm <= 10 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                              Within 10 km
                            </span>
                          ) : listing._distanceKm <= 20 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              Within 20 km
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                              &gt; 20 km away
                            </span>
                          )}
                        </div>

                        {/* Time Left: Highlighted with #D9822B only when time left is short */}
                        <div
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded border ${
                            timeLeft.isUrgent
                              ? 'bg-[#FFF3E8] text-[#D9822B] border-[#D9822B]/30 font-semibold'
                              : 'bg-[#FAFBF8] text-[#526357] border-[#D9E2DA] font-medium'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {timeLeft.isUrgent ? 'alarm' : 'schedule'}
                          </span>
                          <span>{timeLeft.text}</span>
                        </div>
                      </div>

                      {/* Food Photo Banner Preview if available */}
                      {listing.photoUrl && (
                        <div
                          className="w-full h-36 rounded-lg overflow-hidden border border-[#D9E2DA] mb-3 bg-[#FAFBF8] cursor-pointer group"
                          onClick={() => setSelectedListing(listing)}
                          title="Click to preview full meal details"
                        >
                          <img
                            src={listing.photoUrl}
                            alt={listing.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Food Name */}
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1E2A22] mb-1.5 line-clamp-1">
                        {listing.title}
                      </h3>

                      {/* Area & Distance from shelter */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#526357] mb-3">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">
                            location_on
                          </span>
                          <span className="font-medium text-[#1E2A22]">{listing.location}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-[#1E2A22]">
                          <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">
                            near_me
                          </span>
                          <span>{listing._distanceKm} km from {activeShelter.name.split(' ')[0]}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#526357]">
                          <span className="material-symbols-outlined text-[15px] text-[#526357]">
                            two_wheeler
                          </span>
                          <span>ETA ~{Math.round(listing._distanceKm * 2.2 + 8)}m transit</span>
                        </div>
                        {listing.donorOrg && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-[#526357]">
                              storefront
                            </span>
                            <span className="truncate">{listing.donorOrg}</span>
                          </div>
                        )}
                      </div>

                      {listing.notes && (
                        <p className="text-sm text-[#526357] line-clamp-2 mb-4 leading-relaxed">
                          {listing.notes}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-3 border-t border-[#D9E2DA] flex items-center justify-between gap-3">
                      <span className="text-xs text-[#526357]">
                        Pickup: {listing.pickupWindow}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQrModalListing(listing);
                            setQrModalMode('scan');
                            setQrModalStage('pickup');
                            setQrModalOpen(true);
                          }}
                          className="px-2.5 py-2 rounded-lg border border-[#059669]/30 hover:border-[#059669] bg-[#ECFDF5] hover:bg-[#D1FAE5] text-xs font-bold text-[#059669] transition-colors min-h-[44px] flex items-center gap-1 cursor-pointer shrink-0"
                          title="Point-of-pickup contactless QR verification"
                        >
                          <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                          <span>QR Pass</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedListing(listing)}
                          className="px-4 py-2 rounded-lg border border-[#D9E2DA] hover:border-[#2E7D4F] bg-white hover:bg-[#EAF3EC] text-sm font-semibold text-[#1E2A22] transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shrink-0"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION AT THE BOTTOM */}
          {filteredListings.length > itemsPerPage && (
            <div className="mt-8 pt-6 border-t border-[#D9E2DA] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-[#526357]">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredListings.length)} of{' '}
                {filteredListings.length} listings
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 rounded-lg border border-[#D9E2DA] bg-white text-xs font-semibold text-[#1E2A22] hover:bg-[#FAFBF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-11 h-11 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center ${
                      currentPage === pageNum
                        ? 'bg-[#2E7D4F] text-white border border-[#2E7D4F]'
                        : 'bg-white text-[#1E2A22] border border-[#D9E2DA] hover:bg-[#FAFBF8]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-2 rounded-lg border border-[#D9E2DA] bg-white text-xs font-semibold text-[#1E2A22] hover:bg-[#FAFBF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: GOOGLE MAP (~40% on desktop, sticky) */}
        <div
          className={`lg:col-span-5 w-full ${
            showMobileMap ? 'block' : 'hidden lg:block'
          } lg:sticky lg:top-24`}
        >
          <div className="bg-white rounded-lg border border-[#D9E2DA] overflow-hidden shadow-2xs">
            {/* Map Header */}
            <div className="px-4 py-3 bg-[#FAFBF8] dark:bg-[#15231B] border-b border-[#D9E2DA] dark:border-[#22382B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2E7D4F] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2A22] dark:text-[#F4F8F5]">
                  Shelter Radius Radar
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-[#059669]">
                  {distanceFilter === 'all' ? 'All Distances' : `${distanceFilter} km radius`}
                </span>
                <span className="text-[#526357]">({filteredListings.length} pins)</span>
              </div>
            </div>

            {/* Google Map Container */}
            <div className="relative w-full h-[400px] lg:h-[580px] bg-[#EAF3EC]">
              <div ref={mapRef} className="w-full h-full" />

              {!mapsLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#FAFBF8]/90">
                  <span className="material-symbols-outlined text-[32px] text-[#2E7D4F] animate-spin mb-2">
                    progress_activity
                  </span>
                  <p className="text-xs text-[#526357]">Loading Google Maps radar...</p>
                </div>
              )}
            </div>

            {/* Selected Map Item Summary Card (if marker clicked) */}
            {selectedListing && (
              <div className="p-4 border-t border-[#D9E2DA] bg-[#FAFBF8]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2E7D4F] block">
                        {selectedListing._isVeg ? '● Pure Veg' : '● Non-Veg'}
                      </span>
                      <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        {selectedListing._distanceKm} km from {activeShelter.name.split(' ')[0]}
                      </span>
                    </div>
                    <h4 className="font-serif text-sm font-bold text-[#1E2A22] line-clamp-1 mt-0.5">
                      {selectedListing.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedListing(null)}
                    className="text-[#526357] hover:text-[#1E2A22] text-xs p-1"
                    aria-label="Close selection"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[#526357] mb-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#2E7D4F]">location_on</span>
                    <span>{selectedListing.location}</span>
                  </span>
                  <span className="font-semibold text-[#1E2A22]">
                    {selectedListing.quantity} {selectedListing.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleClaimListing(selectedListing)}
                    className="flex-1 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold transition-colors min-h-[44px] cursor-pointer"
                  >
                    Claim food
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 bg-[#1E2A22]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedListing(null);
          }}
        >
          <div className="bg-white w-full max-w-xl rounded-lg border border-[#D9E2DA] p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D9E2DA] mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border ${
                      selectedListing._isVeg
                        ? 'bg-[#EAF3EC] text-[#2E7D4F] border-[#2E7D4F]/30'
                        : 'bg-[#FFF3E8] text-[#D9822B] border-[#D9822B]/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedListing._isVeg ? 'bg-[#2E7D4F]' : 'bg-[#D9822B]'
                      }`}
                    />
                    {selectedListing._isVeg ? 'Pure Veg' : 'Non-Veg'}
                  </span>
                  <span className="text-xs font-medium text-[#526357]">
                    {selectedListing.foodType}
                  </span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1E2A22]">
                  {selectedListing.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                aria-label="Close details"
                className="w-8 h-8 rounded-lg border border-[#D9E2DA] flex items-center justify-center text-[#526357] hover:text-[#1E2A22] hover:bg-[#FAFBF8] cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4">
              {/* Photo Preview if available */}
              {selectedListing.photoUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden border border-[#D9E2DA] bg-[#FAFBF8]">
                  <img
                    src={selectedListing.photoUrl}
                    alt={selectedListing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Core Specs Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#FAFBF8] border border-[#D9E2DA] text-sm">
                <div>
                  <span className="text-xs text-[#526357] block">Available Quantity</span>
                  <span className="font-bold text-[#1E2A22]">
                    {selectedListing.quantity} {selectedListing.unit || 'portions'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#526357] block">Safe Eating Window</span>
                  <span className="font-bold text-[#D9822B]">
                    {calculateTimeLeft(selectedListing, currentTime).text}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#526357] block">Distance to Your Shelter</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-[#059669]">
                      ~{selectedListing._distanceKm} km
                    </span>
                    {selectedListing._distanceKm <= 5 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                        &lt;= 5km
                      </span>
                    ) : selectedListing._distanceKm <= 10 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded">
                        &lt;= 10km
                      </span>
                    ) : selectedListing._distanceKm <= 20 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                        &lt;= 20km
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-[#526357] block">to {activeShelter.name}</span>
                </div>
                <div>
                  <span className="text-xs text-[#526357] block">Courier Transit ETA</span>
                  <span className="font-medium text-[#1E2A22] block mt-0.5">
                    ~{Math.round(selectedListing._distanceKm * 2.2 + 8)} mins
                  </span>
                  <span className="text-[11px] text-[#526357] block">via Eco Volunteer Courier</span>
                </div>
                <div>
                  <span className="text-xs text-[#526357] block">Pickup Window</span>
                  <span className="font-medium text-[#1E2A22]">{selectedListing.pickupWindow}</span>
                </div>
                <div>
                  <span className="text-xs text-[#526357] block">Location Area</span>
                  <span className="font-medium text-[#1E2A22]">{selectedListing.location}</span>
                </div>
              </div>

              {/* Donor Organization & Safety Declaration */}
              <div>
                <h4 className="font-serif text-sm font-bold text-[#1E2A22] mb-1">
                  Food Source &amp; Preparation
                </h4>
                <p className="text-sm text-[#526357] leading-relaxed mb-3">
                  {selectedListing.notes || 'Unserved food freshly packed in food-grade containers.'}
                </p>

                {selectedListing.donorOrg && (
                  <div className="p-3 rounded-lg border border-[#D9E2DA] bg-white flex items-center justify-between text-xs text-[#526357]">
                    <span>Listed by: <strong className="text-[#1E2A22]">{selectedListing.donorOrg}</strong></span>
                    {selectedListing.fssaiNumber && (
                      <span className="text-[#2E7D4F] font-semibold">FSSAI: {selectedListing.fssaiNumber}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Safety Compliance Checklist */}
              <div className="p-3.5 rounded-lg bg-[#EAF3EC] border border-[#D9E2DA] text-xs space-y-1.5 text-[#1E2A22]">
                <div className="font-bold text-sm text-[#2E7D4F] mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Safety Inspection Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Prepared in licensed food premises and kept at regulated holding temperatures</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Packed in clean, food-grade sealed trays ready for transit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Protected under statutory Good Samaritan food redistribution rules</span>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-[#D9E2DA] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#526357]">
                Free for verified shelters and registered non-profits
              </span>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedListing;
                    setSelectedListing(null);
                    setQrModalListing(target);
                    setQrModalMode('show');
                    setQrModalStage('pickup');
                    setQrModalOpen(true);
                  }}
                  className="px-3 py-2.5 rounded-lg border border-[#059669]/40 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-xs font-bold text-[#059669] transition-colors min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Generate or scan transfer pass"
                >
                  <span className="material-symbols-outlined text-[17px]">qr_code_2</span>
                  <span>Transfer QR Pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedListing(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border border-[#D9E2DA] text-sm font-semibold text-[#1E2A22] hover:bg-[#FAFBF8] transition-colors min-h-[44px] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={() => handleClaimListing(selectedListing)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isClaiming ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">
                        progress_activity
                      </span>
                      <span>Claiming...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                      <span>Claim food</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contactless QR Code Meal Transfer Verification Modal */}
      {qrModalOpen && (
        <QrTransferModal
          isOpen={qrModalOpen}
          onClose={() => {
            setQrModalOpen(false);
            setQrModalListing(null);
          }}
          listing={qrModalListing || undefined}
          defaultMode={qrModalMode}
          defaultStage={qrModalStage}
          onTransferVerified={(record) => {
            setClaimSuccessMessage(
              `Contactless ${record.stage.toUpperCase()} transfer verified successfully! SHA-256 Digest: ${record.proofDigest}. Certified by ${record.verifiedByName}.`
            );
          }}
        />
      )}

      {/* 'Notify Me' Local Meal Request Alert Modal */}
      {showNotifyMeModal && (
        <NotifyMeModal
          isOpen={showNotifyMeModal}
          onClose={() => setShowNotifyMeModal(false)}
          initialCity={currentCity.name}
        />
      )}
    </div>
  );
};
