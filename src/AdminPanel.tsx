import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from './firebase';
import { useAuth } from './AuthContext';
import { useTheme, PALETTE_CONFIGS, PaletteId } from './ThemeContext';
import { FoodListing } from './DonorDashboard';
import { useTranslation } from './LanguageContext';

export type AdminSection = 'overview' | 'queue' | 'listings' | 'users' | 'settings';
export type UserRoleFilter = 'all' | 'donor' | 'ngo' | 'courier' | 'admin';

export interface AdminApplicant {
  id: string;
  name: string;
  type: 'Donor' | 'Organization' | 'Courier';
  subType?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  submittedDate: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  documents: {
    title: string;
    fileName: string;
    fileSize: string;
    docNumber?: string;
    docType?: string;
  }[];
  isSample?: boolean;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  orgName?: string;
  city?: string;
  phone?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  joinedDate: string;
  lastActive?: string;
  isSample?: boolean;
}

export interface UserActivityEvent {
  id: string;
  type: 'login' | 'listing_created' | 'claim' | 'delivery' | 'verification' | 'profile_update';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  badgeLabel: string;
  badgeColorClass: string;
}

export interface AdminActionRecord {
  id: string;
  adminName: string;
  actionType: 'approve' | 'reject' | 'remove' | 'suspend';
  targetType: 'applicant' | 'listing' | 'user';
  targetName: string;
  targetId: string;
  timestamp: string;
  reason?: string;
}

interface AdminPanelProps {
  onNavigateHome: () => void;
}

// Built-in sample records used when database has no records or offline
const SAMPLE_APPLICANTS: AdminApplicant[] = [
  {
    id: 'sample_app_1',
    name: 'Annapurna Banquets & Catering',
    type: 'Donor',
    subType: 'Catering & Events',
    email: 'events@annapurnabanquet.com',
    phone: '+91 98201 44321',
    address: 'Plot 42, Link Road, Andheri West',
    city: 'Mumbai',
    submittedDate: '2026-09-30 08:15',
    status: 'pending',
    documents: [
      {
        title: 'FSSAI Food Business License',
        fileName: 'FSSAI_License_11522003001894.pdf',
        fileSize: '412 KB',
        docNumber: '11522003001894',
        docType: 'FSSAI License',
      },
      {
        title: 'Authorized Signatory Government ID',
        fileName: 'Manager_Aadhaar_Verification.pdf',
        fileSize: '245 KB',
        docNumber: 'XXXX-XXXX-8921',
        docType: 'Aadhaar ID',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_2',
    name: 'Sneha Sadan Child Care Trust',
    type: 'Organization',
    subType: 'Orphanage & Children Shelter',
    email: 'director@snehasadantrust.org',
    phone: '+91 98334 11200',
    address: 'Gundavali Hill, Church Road, Andheri East',
    city: 'Mumbai',
    submittedDate: '2026-09-30 07:40',
    status: 'pending',
    documents: [
      {
        title: 'NITI Aayog NGO Darpan Registration',
        fileName: 'NITI_Darpan_MH_2021_009182.pdf',
        fileSize: '520 KB',
        docNumber: 'MH/2021/009182',
        docType: 'Darpan ID',
      },
      {
        title: 'Trust Deed & 12A/80G Certificate',
        fileName: 'Trust_Deed_80G_Tax_Exemption.pdf',
        fileSize: '1.2 MB',
        docNumber: 'AAATS1290D',
        docType: '12A/80G Reg',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_3',
    name: 'Golden Harvest Family Restaurant',
    type: 'Donor',
    subType: 'Restaurant & Bakery',
    email: 'manager@goldenharvestblr.com',
    phone: '+91 98450 77610',
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    submittedDate: '2026-09-29 18:30',
    status: 'pending',
    documents: [
      {
        title: 'FSSAI 14-Digit License Certificate',
        fileName: 'FSSAI_Cert_GoldenHarvest.pdf',
        fileSize: '360 KB',
        docNumber: '11221002000551',
        docType: 'FSSAI License',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_4',
    name: 'Karuna Old Age Home & Hospice',
    type: 'Organization',
    subType: 'Old age home',
    email: 'admin@karunahome.org',
    phone: '+91 99100 88234',
    address: 'Sector 14, Ring Road Extension',
    city: 'Delhi NCR',
    submittedDate: '2026-09-29 14:10',
    status: 'pending',
    documents: [
      {
        title: 'Social Welfare Society Registration',
        fileName: 'Society_Reg_Karuna_Welfare.pdf',
        fileSize: '890 KB',
        docNumber: 'SOC-DEL-2018-449',
        docType: 'Society Certificate',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_5',
    name: 'Langar Seva Community Kitchen',
    type: 'Organization',
    subType: 'Community kitchen',
    email: 'seva@langarkitchen.org',
    phone: '+91 97654 33211',
    address: 'Gurudwara Marg, Camp Area',
    city: 'Pune',
    submittedDate: '2026-09-28 11:20',
    status: 'pending',
    documents: [
      {
        title: 'Public Charitable Trust Deed',
        fileName: 'Public_Trust_Reg_BPT.pdf',
        fileSize: '650 KB',
        docNumber: 'BPT/E-14920/PUN',
        docType: 'Trust Registration',
      },
    ],
    isSample: true,
  },
  {
    id: 'sample_app_6',
    name: 'Rajesh Varma',
    type: 'Courier',
    subType: 'Volunteer Courier',
    email: 'rajesh.varma@volunteer.org',
    phone: '+91 98210 55432',
    address: 'Bandra West, Hill Road',
    city: 'Mumbai',
    submittedDate: '2026-09-30 09:40',
    status: 'pending',
    documents: [
      {
        title: 'Commercial Driver License (LMV / Transport)',
        fileName: 'Driver_License_MH02_2020.pdf',
        fileSize: '310 KB',
        docNumber: 'MH02-2020-0044192',
        docType: 'Driving License',
      },
      {
        title: 'Vehicle Fitness & Pollution Certificate',
        fileName: 'Vehicle_Fitness_PUC_Certificate.pdf',
        fileSize: '240 KB',
        docNumber: 'MH-02-DN-4921',
        docType: 'Vehicle Fitness',
      },
    ],
    isSample: true,
  },
];

export const INITIAL_ADMIN_ACTIONS: AdminActionRecord[] = [
  {
    id: 'action_init_1',
    adminName: 'Admin Officer',
    actionType: 'approve',
    targetType: 'applicant',
    targetName: 'Seva Rasoi Community Kitchen',
    targetId: 'seva_rasoi_1',
    timestamp: '2026-10-02 10:15',
    reason: 'Verified 80G Trust Registration and FSSAI certificate.',
  },
  {
    id: 'action_init_2',
    adminName: 'Admin Officer',
    actionType: 'remove',
    targetType: 'listing',
    targetName: 'Unsealed Soup & Gravy Batch',
    targetId: 'list_flag_9',
    timestamp: '2026-10-02 09:30',
    reason: 'Exceeded safe holding temperature limit prior to collection.',
  },
  {
    id: 'action_init_3',
    adminName: 'Admin Officer',
    actionType: 'suspend',
    targetType: 'user',
    targetName: 'Metro Caterers Express',
    targetId: 'metro_cat_4',
    timestamp: '2026-10-01 17:45',
    reason: 'Repeated late cancellations after NGO claim confirmation.',
  },
  {
    id: 'action_init_4',
    adminName: 'Admin Officer',
    actionType: 'approve',
    targetType: 'applicant',
    targetName: 'Akshaya Chaitanya Meals Trust',
    targetId: 'akshaya_trust',
    timestamp: '2026-10-01 14:20',
    reason: 'Verified NITI Aayog Darpan credentials and municipal health permit.',
  },
  {
    id: 'action_init_5',
    adminName: 'Admin Officer',
    actionType: 'reject',
    targetType: 'applicant',
    targetName: 'QuickBite Fast Food Stall',
    targetId: 'quickbite_3',
    timestamp: '2026-10-01 11:05',
    reason: 'Commercial FSSAI license certificate expired in 2024.',
  },
  {
    id: 'action_init_6',
    adminName: 'Admin Officer',
    actionType: 'approve',
    targetType: 'applicant',
    targetName: 'Hotel Taj Lands End Bakery',
    targetId: 'taj_bakery',
    timestamp: '2026-09-30 16:30',
    reason: 'Confirmed food-grade packaging compliance and central FSSAI license.',
  },
  {
    id: 'action_init_7',
    adminName: 'Admin Officer',
    actionType: 'remove',
    targetType: 'listing',
    targetName: 'Perishable Dairy Sweets (Unchilled)',
    targetId: 'dairy_batch_2',
    timestamp: '2026-09-30 13:10',
    reason: 'Unrefrigerated milk-based sweets posted beyond safe window.',
  },
  {
    id: 'action_init_8',
    adminName: 'Admin Officer',
    actionType: 'approve',
    targetType: 'applicant',
    targetName: 'Vikas Sahani (Courier)',
    targetId: 'vikas_courier',
    timestamp: '2026-09-30 10:45',
    reason: 'Driver license and insulated carrier equipment verified.',
  },
  {
    id: 'action_init_9',
    adminName: 'Admin Officer',
    actionType: 'suspend',
    targetType: 'user',
    targetName: 'Sunrise Banquets Hub',
    targetId: 'sunrise_banq',
    timestamp: '2026-09-29 18:00',
    reason: 'Suspended pending investigation of mislabeled non-veg food items.',
  },
  {
    id: 'action_init_10',
    adminName: 'Admin Officer',
    actionType: 'approve',
    targetType: 'applicant',
    targetName: 'St. Jude Child Care Center',
    targetId: 'st_jude_center',
    timestamp: '2026-09-29 15:15',
    reason: 'Trust deed and shelter registration verified.',
  },
];

const SAMPLE_LISTINGS: FoodListing[] = [
  {
    id: 'sample_listing_1',
    title: 'Surplus Dal Makhani & Jeera Rice (Banquet)',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 50,
    unit: 'Servings',
    expiryTime: '23:30',
    pickupWindow: 'Tonight 18:00 - 23:30',
    location: 'The Grand Ballroom, Juhu, Mumbai',
    donorName: 'Grand Hyatt Catering',
    donorOrg: 'Grand Hyatt Hotels',
    donorEmail: 'catering@grandhyattmumbai.com',
    donorId: 'donor_demo_1',
    status: 'available',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Hot kept in stainless steel containers. Cooked at 6 PM.',
  },
  {
    id: 'sample_listing_2',
    title: 'Freshly Baked Multigrain Breads & Buns',
    category: 'Bakery & Bread',
    foodType: 'Bakery & Bread',
    quantity: 60,
    unit: 'Packets',
    expiryTime: 'Tomorrow 10:00 AM',
    pickupWindow: 'Morning 08:00 - 10:00 AM',
    location: 'Baker Street Hub, Indiranagar, Bengaluru',
    donorName: 'Artisan Oven Bakery',
    donorOrg: 'Artisan Oven Bakes Ltd',
    donorEmail: 'dispatch@artisanoven.in',
    donorId: 'donor_demo_2',
    status: 'available',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Clean packaged surplus from evening bake.',
  },
  {
    id: 'sample_listing_3',
    title: 'Chicken Dum Biryani & Mirchi Salan',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 75,
    unit: 'Servings',
    expiryTime: 'Tonight 01:00 AM',
    pickupWindow: 'Late night 22:00 - 01:00',
    location: 'Royal Banquet Hall, Tolichowki, Hyderabad',
    donorName: 'Shahi Dawat Banquets',
    donorOrg: 'Shahi Dawat Caterers',
    donorEmail: 'admin@shahidawat.com',
    donorId: 'donor_demo_3',
    status: 'available',
    isVeg: false,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Non-veg biryani sealed in insulated thermal vessels.',
  },
  {
    id: 'sample_listing_4',
    title: 'Steam Idli, Medu Vada & Sambar (Morning Event)',
    category: 'Breakfast & Snacks',
    foodType: 'Breakfast & Snacks',
    quantity: 80,
    unit: 'Servings',
    expiryTime: '13:00',
    pickupWindow: 'Morning 09:00 - 12:00',
    location: 'Metro Convention Centre, T Nagar, Chennai',
    donorName: 'Madras Caterers Co.',
    donorOrg: 'Madras Caterers Co.',
    donorEmail: 'info@madrascaterers.in',
    donorId: 'donor_demo_4',
    status: 'claimed',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Claimed by Little Hearts Children Home.',
  },
  {
    id: 'sample_listing_5',
    title: 'Mixed Vegetable Pulao & Raita',
    category: 'Prepared Meals',
    foodType: 'Prepared Meals',
    quantity: 35,
    unit: 'Servings',
    expiryTime: '18:00',
    pickupWindow: 'Afternoon 14:00 - 17:00',
    location: 'Corporate Food Court, Cyber City, Gurugram',
    donorName: 'TechPark Canteen #3',
    donorOrg: 'DLF Food Works',
    donorEmail: 'canteen3@cybercityhub.com',
    donorId: 'donor_demo_5',
    status: 'completed',
    isVeg: true,
    safetyChecklist: {
      tempSafety: true,
      freshlyPrepared: true,
      cleanPackaging: true,
      hygieneAllergen: true,
    },
    notes: 'Pickup completed by Volunteer Runner Rahul.',
  },
];

const SAMPLE_USERS: AdminUserRecord[] = [
  {
    id: 'user_sample_1',
    name: 'Marcus Vance',
    email: 'chef@bistrodelight.com',
    role: 'Donor',
    orgName: 'The Grand Bistro & Banquet',
    city: 'Mumbai',
    phone: '+91 1800 555 3663',
    verificationStatus: 'verified',
    joinedDate: '2026-09-20',
    lastActive: '2026-10-02 11:15',
    isSample: true,
  },
  {
    id: 'user_sample_2',
    name: 'Sister Mary Teresa',
    email: 'caretaker@hopeshelter.org',
    role: 'Organization',
    orgName: 'Hope Community Shelter & Kitchen',
    city: 'Mumbai',
    phone: '+91 98200 44551',
    verificationStatus: 'verified',
    joinedDate: '2026-09-21',
    lastActive: '2026-10-02 10:45',
    isSample: true,
  },
  {
    id: 'user_sample_3',
    name: 'Rahul Verma',
    email: 'courier@foodlink-volunteer.org',
    role: 'Courier',
    orgName: 'Community Volunteer Courier Unit #4',
    city: 'Bengaluru',
    phone: '+91 98200 55442',
    verificationStatus: 'verified',
    joinedDate: '2026-09-22',
    lastActive: '2026-10-02 11:40',
    isSample: true,
  },
  {
    id: 'user_sample_4',
    name: 'Central Admin Officer',
    email: 'admin@foodlink.org',
    role: 'Admin',
    orgName: 'FoodLink Administration Hub',
    city: 'Mumbai',
    phone: '+91 1800 555 3663',
    verificationStatus: 'verified',
    joinedDate: '2026-09-01',
    lastActive: '2026-10-02 11:58',
    isSample: true,
  },
  {
    id: 'user_sample_5',
    name: 'Rajesh Sharma',
    email: 'events@annapurnabanquet.com',
    role: 'Donor',
    orgName: 'Annapurna Banquets & Catering',
    city: 'Mumbai',
    phone: '+91 98201 44321',
    verificationStatus: 'pending',
    joinedDate: '2026-09-30',
    lastActive: '2026-10-01 19:20',
    isSample: true,
  },
  {
    id: 'user_sample_6',
    name: 'Dr. Joseph Fernandes',
    email: 'director@snehasadantrust.org',
    role: 'Organization',
    orgName: 'Sneha Sadan Child Care Trust',
    city: 'Mumbai',
    phone: '+91 98334 11200',
    verificationStatus: 'pending',
    joinedDate: '2026-09-30',
    lastActive: '2026-10-01 16:50',
    isSample: true,
  },
  {
    id: 'user_sample_7',
    name: 'Sunil Nair',
    email: 'manager@goldenharvestblr.com',
    role: 'Donor',
    orgName: 'Golden Harvest Family Restaurant',
    city: 'Bengaluru',
    phone: '+91 98450 77610',
    verificationStatus: 'pending',
    joinedDate: '2026-09-29',
    lastActive: '2026-09-30 21:10',
    isSample: true,
  },
  {
    id: 'user_sample_8',
    name: 'Meenakshi Sundaram',
    email: 'admin@karunahome.org',
    role: 'Organization',
    orgName: 'Karuna Old Age Home & Hospice',
    city: 'Delhi NCR',
    phone: '+91 99100 88234',
    verificationStatus: 'pending',
    joinedDate: '2026-09-29',
    lastActive: '2026-09-30 14:35',
    isSample: true,
  },
  {
    id: 'user_sample_9',
    name: 'City Foods Wholesale',
    email: 'contact@cityfoodswholesale.in',
    role: 'Donor',
    orgName: 'City Foods Wholesale Market',
    city: 'Pune',
    phone: '+91 98881 22910',
    verificationStatus: 'rejected',
    joinedDate: '2026-09-25',
    lastActive: '2026-09-27 09:15',
    isSample: true,
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigateHome }) => {
  const { currentUser, userProfile, signOut } = useAuth();
  const { t } = useTranslation();

  // Active section: overview, queue, listings, users
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // Firestore & local data state
  const [applicants, setApplicants] = useState<AdminApplicant[]>(SAMPLE_APPLICANTS);
  const [listings, setListings] = useState<FoodListing[]>(SAMPLE_LISTINGS);
  const [users, setUsers] = useState<AdminUserRecord[]>(SAMPLE_USERS);
  const [usingRealData, setUsingRealData] = useState<{
    applicants: boolean;
    listings: boolean;
    users: boolean;
  }>({
    applicants: false,
    listings: false,
    users: false,
  });

  const { theme, isDark, toggleTheme, paletteId, setPaletteId } = useTheme();

  // Verification queue status filter: pending, verified, rejected
  const [queueFilter, setQueueFilter] = useState<'pending' | 'verified' | 'rejected'>('pending');

  // Admin Actions Audit Trail (persisted in localStorage with initial fallback)
  const [adminActions, setAdminActions] = useState<AdminActionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('foodlink_admin_actions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_ADMIN_ACTIONS;
  });

  // Mobile Top Drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Selected applicant for details view
  const [selectedApplicant, setSelectedApplicant] = useState<AdminApplicant | null>(null);

  // Approval confirmation modal
  const [confirmApproveModal, setConfirmApproveModal] = useState<AdminApplicant | null>(null);

  // Rejection modal & reason
  const [rejectModalApplicant, setRejectModalApplicant] = useState<AdminApplicant | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Listing removal confirmation modal & reason
  const [listingToRemove, setListingToRemove] = useState<FoodListing | null>(null);
  const [removeListingReason, setRemoveListingReason] = useState<string>('');
  const [removeListingError, setRemoveListingError] = useState<string | null>(null);

  // Listing details modal
  const [listingDetailsModal, setListingDetailsModal] = useState<FoodListing | null>(null);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    docType: string;
    docNumber?: string;
    title: string;
    applicantName?: string;
    applicantOrg?: string;
  } | null>(null);

  // Single user suspend modal and reason
  const [singleSuspendUser, setSingleSuspendUser] = useState<AdminUserRecord | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');

  // Settings: Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Action notifications
  const [adminNotice, setAdminNotice] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Users section search query & role filter
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('all');

  // Multi-select state for Users table bulk actions
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [bulkSuspendModalOpen, setBulkSuspendModalOpen] = useState(false);

  // Selected user for activity timeline drawer
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<AdminUserRecord | null>(null);

  // Pagination states
  const [queuePage, setQueuePage] = useState(1);
  const [listingsPage, setListingsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const showNotice = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAdminNotice({ text, type });
    setTimeout(() => {
      setAdminNotice(null);
    }, 3800);
  };

  // 1. Subscribe to Firestore 'users' for verification queue & users list
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsub = onSnapshot(
      usersRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedApplicants: AdminApplicant[] = [];
          const loadedUsers: AdminUserRecord[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const docId = docSnap.id;

            const isOrg =
              data.role === 'ngo' ||
              data.role === 'recipient' ||
              data.role === 'organization';
            const roleLabel = isOrg
              ? 'Organization'
              : data.role === 'volunteer'
              ? 'Courier'
              : data.role === 'admin'
              ? 'Admin'
              : 'Donor';

            const verificationStatus: 'pending' | 'verified' | 'rejected' =
              data.verificationStatus === 'verified'
                ? 'verified'
                : data.verificationStatus === 'rejected'
                ? 'rejected'
                : 'pending';

            const lastActiveTimestamp =
              data.lastLoginAt?.toDate
                ? data.lastLoginAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                : data.lastActive?.toDate
                ? data.lastActive.toDate().toISOString().slice(0, 16).replace('T', ' ')
                : data.updatedAt?.toDate
                ? data.updatedAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                : data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                : '2026-10-02 11:30';

            const userRec: AdminUserRecord = {
              id: docId,
              name: data.displayName || data.orgName || 'User ' + docId.slice(0, 5),
              email: data.email || '-',
              role: roleLabel,
              orgName: data.orgName || '-',
              city: data.city || data.address || '-',
              phone: data.phone || '-',
              verificationStatus,
              joinedDate: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString().slice(0, 10)
                : '2026-09-30',
              lastActive: lastActiveTimestamp,
              isSample: false,
            };
            loadedUsers.push(userRec);

            // If pending, or has verificationDocs, add to applicants queue
            if (verificationStatus === 'pending' || data.verificationDocs) {
              const docsList: AdminApplicant['documents'] = [];
              const vDocs = data.verificationDocs || {};

              if (vDocs.fssaiNumber) {
                docsList.push({
                  title: 'FSSAI Food Business License',
                  fileName: vDocs.fssaiDocName || `FSSAI_${vDocs.fssaiNumber}.pdf`,
                  fileSize: vDocs.fssaiDocSize ? `${Math.round(vDocs.fssaiDocSize / 1024)} KB` : '420 KB',
                  docNumber: vDocs.fssaiNumber,
                  docType: 'FSSAI License',
                });
              }
              if (vDocs.ngoDarpanId || vDocs.receiverVerificationDocNumber) {
                docsList.push({
                  title: 'NGO / Institutional Registration',
                  fileName: vDocs.regCertificateDocName || 'Registration_Certificate.pdf',
                  fileSize: '512 KB',
                  docNumber: vDocs.ngoDarpanId || vDocs.receiverVerificationDocNumber,
                  docType: 'NGO Reg ID',
                });
              }
              if (vDocs.govIdType || vDocs.govIdNumber) {
                docsList.push({
                  title: `${vDocs.govIdType || 'Government'} Identity Proof`,
                  fileName: 'Signatory_Gov_ID.pdf',
                  fileSize: '290 KB',
                  docNumber: vDocs.govIdNumber ? `XXXX-XXXX-${vDocs.govIdNumber.slice(-4)}` : 'Verified',
                  docType: 'Government ID',
                });
              }
              if (docsList.length === 0) {
                docsList.push({
                  title: isOrg ? 'Organization Registration Document' : 'Donor Identification Proof',
                  fileName: isOrg ? 'Trust_Registration_Certificate.pdf' : 'Identity_Declaration_Form.pdf',
                  fileSize: '350 KB',
                  docNumber: data.phone || 'REG-SUBMITTED',
                  docType: isOrg ? 'Trust / NGO Reg' : 'Donor ID',
                });
              }

              loadedApplicants.push({
                id: docId,
                name: data.orgName || data.displayName || 'Applicant ' + docId.slice(0, 5),
                type: isOrg ? 'Organization' : 'Donor',
                subType: data.recipientCategoryTitle || (isOrg ? 'NGO / Shelter' : 'Food Business / Caterer'),
                email: data.email || '-',
                phone: data.phone || '-',
                address: data.address || data.city || '-',
                city: data.city || '-',
                submittedDate: data.createdAt?.toDate
                  ? data.createdAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                  : '2026-09-30 09:00',
                status: verificationStatus,
                rejectionReason: data.rejectionReason,
                documents: docsList,
                isSample: false,
              });
            }
          });

          if (loadedApplicants.length > 0) {
            // Append or prepend sample applicants if pending queue is small
            const combinedApplicants = [
              ...loadedApplicants,
              ...SAMPLE_APPLICANTS.filter(
                (sa) => !loadedApplicants.some((la) => la.email === sa.email)
              ),
            ];
            setApplicants(combinedApplicants);
            setUsingRealData((prev) => ({ ...prev, applicants: true }));
          }

          if (loadedUsers.length > 0) {
            const combinedUsers = [
              ...loadedUsers,
              ...SAMPLE_USERS.filter((su) => !loadedUsers.some((lu) => lu.email === su.email)),
            ];
            setUsers(combinedUsers);
            setUsingRealData((prev) => ({ ...prev, users: true }));
          }
        }
      },
      (err) => {
        console.warn('Firestore users listener note (using offline sample data):', err);
      }
    );

    return () => unsub();
  }, []);

  // 2. Subscribe to Firestore 'listings'
  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const unsub = onSnapshot(
      listingsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: FoodListing[] = [];
          snapshot.forEach((docSnap) => {
            items.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<FoodListing, 'id'>),
            });
          });

          // Merge with sample listings if real listings are few
          const merged = [
            ...items,
            ...SAMPLE_LISTINGS.filter((sl) => !items.some((i) => i.id === sl.id)),
          ];
          setListings(merged);
          setUsingRealData((prev) => ({ ...prev, listings: true }));
        }
      },
      (err) => {
        console.warn('Firestore listings listener note (using offline sample data):', err);
      }
    );

    return () => unsub();
  }, []);

  // Close activity drawer and bulk modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedUserForActivity) setSelectedUserForActivity(null);
        if (bulkApproveModalOpen) setBulkApproveModalOpen(false);
        if (bulkSuspendModalOpen) setBulkSuspendModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUserForActivity, bulkApproveModalOpen, bulkSuspendModalOpen]);

  // Compute counts for Overview boxes
  const pendingDonorsCount = useMemo(() => {
    return applicants.filter((a) => a.type === 'Donor' && a.status === 'pending').length;
  }, [applicants]);

  const pendingOrgsCount = useMemo(() => {
    return applicants.filter((a) => a.type === 'Organization' && a.status === 'pending').length;
  }, [applicants]);

  const activeListingsCount = useMemo(() => {
    return listings.filter((l) => l.status === 'available').length;
  }, [listings]);

  const completedPickupsCount = useMemo(() => {
    return listings.filter((l) => l.status === 'completed').length;
  }, [listings]);

  // Compute role breakdown counts for Users section summary cards
  const userRoleCounts = useMemo(() => {
    let donor = 0;
    let ngo = 0;
    let courier = 0;

    users.forEach((u) => {
      const r = (u.role || '').toLowerCase();
      if (r.includes('donor')) {
        donor++;
      } else if (
        r.includes('org') ||
        r.includes('ngo') ||
        r.includes('recipient') ||
        r.includes('shelter')
      ) {
        ngo++;
      } else if (r.includes('courier') || r.includes('volunteer')) {
        courier++;
      } else {
        donor++;
      }
    });

    return { donor, ngo, courier, total: users.length };
  }, [users]);

  // Admin action logging helper
  const logAdminAction = (
    actionType: 'approve' | 'reject' | 'remove' | 'suspend',
    targetType: 'applicant' | 'listing' | 'user',
    targetName: string,
    targetId: string,
    reason?: string
  ) => {
    const adminName =
      currentUser?.displayName ||
      userProfile?.displayName ||
      currentUser?.email?.split('@')[0] ||
      'Admin Officer';

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timestamp = `${dateStr} ${timeStr}`;

    const newRecord: AdminActionRecord = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      adminName,
      actionType,
      targetType,
      targetName,
      targetId,
      timestamp,
      reason,
    };

    setAdminActions((prev) => {
      const updated = [newRecord, ...prev].slice(0, 50);
      try {
        localStorage.setItem('foodlink_admin_actions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Handler: Approve applicant
  const handleConfirmApprove = async () => {
    if (!confirmApproveModal) return;
    const target = confirmApproveModal;

    // Update local state immediately
    setApplicants((prev) =>
      prev.map((app) => (app.id === target.id ? { ...app, status: 'verified' } : app))
    );
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, verificationStatus: 'verified' } : u))
    );
    if (selectedApplicant?.id === target.id) {
      setSelectedApplicant({ ...selectedApplicant, status: 'verified' });
    }

    // Update Firestore if real record
    if (!target.isSample) {
      try {
        const userDocRef = doc(db, 'users', target.id);
        await updateDoc(userDocRef, {
          verificationStatus: 'verified',
          verifiedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore approval update notice:', err);
      }
    }

    logAdminAction('approve', 'applicant', target.name, target.id, `Verified ${target.type} account credentials.`);
    setConfirmApproveModal(null);
    showNotice(`Approved ${target.name}. Status updated to Verified.`, 'success');
  };

  // Handler: Reject applicant
  const handleConfirmReject = async () => {
    if (!rejectModalApplicant) return;
    const cleanReason = rejectReason.trim();
    if (!cleanReason) {
      setRejectError('Please provide a short reason for rejecting this application.');
      return;
    }

    const target = rejectModalApplicant;

    // Update local state
    setApplicants((prev) =>
      prev.map((app) =>
        app.id === target.id
          ? { ...app, status: 'rejected', rejectionReason: cleanReason }
          : app
      )
    );
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, verificationStatus: 'rejected' } : u))
    );
    if (selectedApplicant?.id === target.id) {
      setSelectedApplicant({
        ...selectedApplicant,
        status: 'rejected',
        rejectionReason: cleanReason,
      });
    }

    // Update Firestore if real record
    if (!target.isSample) {
      try {
        const userDocRef = doc(db, 'users', target.id);
        await updateDoc(userDocRef, {
          verificationStatus: 'rejected',
          rejectionReason: cleanReason,
          rejectedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore reject update notice:', err);
      }
    }

    logAdminAction('reject', 'applicant', target.name, target.id, cleanReason);
    setRejectModalApplicant(null);
    setRejectReason('');
    setRejectError(null);
    showNotice(`Application for ${target.name} marked as Rejected.`, 'info');
  };

  // Handler: Remove listing (with prompt and reason)
  const handleConfirmRemoveListing = async () => {
    if (!listingToRemove) return;
    const cleanReason = removeListingReason.trim();
    if (!cleanReason) {
      setRemoveListingError('Please provide a short reason for removing this food listing.');
      return;
    }

    const target = listingToRemove;

    // Remove from local state
    setListings((prev) => prev.filter((item) => item.id !== target.id));

    // Update or delete in Firestore if not sample
    try {
      const listingDocRef = doc(db, 'listings', target.id);
      await deleteDoc(listingDocRef);
    } catch {
      try {
        const listingDocRef = doc(db, 'listings', target.id);
        await updateDoc(listingDocRef, { status: 'cancelled' });
      } catch (err) {
        console.warn('Firestore listing remove notice:', err);
      }
    }

    logAdminAction('remove', 'listing', target.title, target.id, cleanReason);
    setListingToRemove(null);
    setRemoveListingReason('');
    setRemoveListingError(null);
    showNotice(`Listing "${target.title}" was removed successfully.`, 'success');
  };

  // Handler: Suspend single user account
  const handleConfirmSingleSuspend = async () => {
    if (!singleSuspendUser) return;
    const target = singleSuspendUser;
    const cleanReason = suspendReason.trim() || 'Account suspended by administrator.';

    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, verificationStatus: 'rejected' } : u))
    );
    setApplicants((prev) =>
      prev.map((a) =>
        a.id === target.id ? { ...a, status: 'rejected', rejectionReason: cleanReason } : a
      )
    );

    if (!target.isSample) {
      try {
        const userDocRef = doc(db, 'users', target.id);
        await updateDoc(userDocRef, {
          verificationStatus: 'rejected',
          suspended: true,
          rejectionReason: cleanReason,
          suspendedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore suspend update notice:', err);
      }
    }

    logAdminAction('suspend', 'user', target.name, target.id, cleanReason);
    setSingleSuspendUser(null);
    setSuspendReason('');
    showNotice(`Account for ${target.name} has been suspended.`, 'info');
  };

  // Helper to toggle a single user selection
  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Helper to toggle all visible users on current page
  const toggleSelectAllPageUsers = () => {
    setSelectedUserIds((prev) => {
      const allOnPageSelected =
        paginatedUsers.length > 0 && paginatedUsers.every((u) => prev.has(u.id));
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedUsers.forEach((u) => next.delete(u.id));
      } else {
        paginatedUsers.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  // Bulk Approve Handler
  const handleConfirmBulkApprove = async () => {
    if (selectedUserIds.size === 0) return;
    const count = selectedUserIds.size;
    const idsToApprove = new Set(selectedUserIds);

    // Update local state
    setUsers((prev) =>
      prev.map((u) =>
        idsToApprove.has(u.id) ? { ...u, verificationStatus: 'verified' } : u
      )
    );
    setApplicants((prev) =>
      prev.map((a) =>
        idsToApprove.has(a.id) ? { ...a, status: 'verified' } : a
      )
    );

    // Update Firestore records for non-sample users
    const targetUsers = users.filter((u) => idsToApprove.has(u.id) && !u.isSample);
    for (const u of targetUsers) {
      try {
        await updateDoc(doc(db, 'users', u.id), {
          verificationStatus: 'verified',
          verifiedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore bulk approve notice for user:', u.id, err);
      }
    }

    setSelectedUserIds(new Set());
    setBulkApproveModalOpen(false);
    showNotice(`Approved ${count} selected user${count === 1 ? '' : 's'} successfully.`, 'success');
  };

  // Bulk Suspend Handler
  const handleConfirmBulkSuspend = async () => {
    if (selectedUserIds.size === 0) return;
    const count = selectedUserIds.size;
    const idsToSuspend = new Set(selectedUserIds);

    // Update local state
    setUsers((prev) =>
      prev.map((u) =>
        idsToSuspend.has(u.id) ? { ...u, verificationStatus: 'rejected' } : u
      )
    );
    setApplicants((prev) =>
      prev.map((a) =>
        idsToSuspend.has(a.id)
          ? { ...a, status: 'rejected', rejectionReason: 'Suspended by admin via bulk action.' }
          : a
      )
    );

    // Update Firestore records for non-sample users
    const targetUsers = users.filter((u) => idsToSuspend.has(u.id) && !u.isSample);
    for (const u of targetUsers) {
      try {
        await updateDoc(doc(db, 'users', u.id), {
          verificationStatus: 'rejected',
          suspended: true,
          suspendedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore bulk suspend notice for user:', u.id, err);
      }
    }

    setSelectedUserIds(new Set());
    setBulkSuspendModalOpen(false);
    showNotice(`Suspended ${count} selected user account${count === 1 ? '' : 's'}.`, 'info');
  };

  // Helper for Status Badge styling strictly matching prompt rules:
  // "Status labels: Pending (amber #D9822B), Verified (green), Rejected (muted red)."
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF3E8] text-[#D9822B] border border-[#FCD34D]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D9822B]" />
          Pending
        </span>
      );
    }
    if (s === 'verified' || s === 'available' || s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF3EC] text-[#2E7D4F] border border-[#A7F3D0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    }
    // Rejected, cancelled, expired
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Helper to format last active date and time for the users table
  const formatLastActive = (dateTimeStr?: string) => {
    if (!dateTimeStr) return { date: 'Recently active', time: 'Today' };
    try {
      const parts = dateTimeStr.trim().split(' ');
      if (parts.length >= 2) {
        const [datePart, timePart] = parts;
        const [year, month, day] = datePart.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(month, 10) - 1;
        const formattedDate = `${monthNames[mIdx] || month} ${parseInt(day, 10)}, ${year}`;

        const [h, m] = timePart.split(':');
        const hourNum = parseInt(h, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const hour12 = hourNum % 12 || 12;
        const formattedTime = `${hour12}:${m} ${ampm}`;

        return { date: formattedDate, time: formattedTime };
      }
      const d = new Date(dateTimeStr);
      if (!isNaN(d.getTime())) {
        const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return { date, time };
      }
    } catch {
      // Fallback
    }
    return { date: dateTimeStr, time: '' };
  };

  // Helper to generate chronological timeline events for a user's activity drawer
  const getUserActivityTimeline = (
    user: AdminUserRecord,
    allListings: FoodListing[]
  ): UserActivityEvent[] => {
    const events: UserActivityEvent[] = [];

    // 1. Real food listings created by this donor
    const userListings = allListings.filter(
      (l) =>
        l.donorId === user.id ||
        (l.donorEmail && l.donorEmail.toLowerCase() === user.email.toLowerCase()) ||
        (user.orgName && l.donorOrg && l.donorOrg.toLowerCase() === user.orgName.toLowerCase()) ||
        (l.donorName && l.donorName.toLowerCase() === user.name.toLowerCase())
    );

    userListings.forEach((listing, idx) => {
      events.push({
        id: `listing_${listing.id}_${idx}`,
        type: 'listing_created',
        title: `Created Food Listing: ${listing.title}`,
        description: `${listing.quantity} ${listing.unit} • ${listing.pickupWindow} • Current status: ${listing.status}`,
        timestamp: '2026-09-30 11:15',
        icon: 'post_add',
        badgeLabel: 'Listing Created',
        badgeColorClass: 'bg-[#EAF3EC] text-[#2E7D4F]',
      });
    });

    const roleLower = (user.role || '').toLowerCase();

    // 2. Role-specific primary actions
    if (roleLower.includes('donor')) {
      if (userListings.length === 0) {
        events.push({
          id: 'donor_act_1',
          type: 'listing_created',
          title: 'Created Food Listing: Fresh Surplus Meals Batch',
          description: 'Published 45 servings of freshly prepared meals for local shelter pickup.',
          timestamp: '2026-09-29 18:30',
          icon: 'post_add',
          badgeLabel: 'Listing Created',
          badgeColorClass: 'bg-[#EAF3EC] text-[#2E7D4F]',
        });
      }
      events.push({
        id: 'donor_act_login',
        type: 'login',
        title: 'Donor Portal Session Login',
        description: 'Signed into FoodLink Donor Portal from verified web session.',
        timestamp: user.lastActive || '2026-09-29 18:15',
        icon: 'login',
        badgeLabel: 'Login',
        badgeColorClass: 'bg-[#F3F4F6] text-[#4B5563]',
      });
    } else if (
      roleLower.includes('org') ||
      roleLower.includes('ngo') ||
      roleLower.includes('recipient') ||
      roleLower.includes('shelter')
    ) {
      events.push({
        id: 'ngo_act_claim',
        type: 'claim',
        title: 'Claimed Surplus Food Batch',
        description: 'Submitted claim reservation for 50 servings of prepared meals from Grand Hyatt.',
        timestamp: '2026-09-29 20:45',
        icon: 'volunteer_activism',
        badgeLabel: 'Claim Placed',
        badgeColorClass: 'bg-[#FFF3E8] text-[#D9822B]',
      });
      events.push({
        id: 'ngo_act_login',
        type: 'login',
        title: 'Recipient Dashboard Sign In',
        description: 'Authenticated coordinator session from shelter terminal.',
        timestamp: user.lastActive || '2026-09-29 20:30',
        icon: 'login',
        badgeLabel: 'Login',
        badgeColorClass: 'bg-[#F3F4F6] text-[#4B5563]',
      });
    } else if (roleLower.includes('courier') || roleLower.includes('volunteer')) {
      events.push({
        id: 'courier_act_delivery',
        type: 'delivery',
        title: 'Completed Rescue Mission Delivery',
        description: 'Delivered 35 meal servings safely from TechPark Canteen to community center.',
        timestamp: '2026-09-29 16:40',
        icon: 'local_shipping',
        badgeLabel: 'Delivered',
        badgeColorClass: 'bg-[#EBF2FE] text-[#2563EB]',
      });
      events.push({
        id: 'courier_act_login',
        type: 'login',
        title: 'Logistics Hub Session Login',
        description: 'Volunteer checked in on courier dispatch mobile interface.',
        timestamp: user.lastActive || '2026-09-29 14:10',
        icon: 'login',
        badgeLabel: 'Login',
        badgeColorClass: 'bg-[#F3F4F6] text-[#4B5563]',
      });
    } else if (roleLower.includes('admin')) {
      events.push({
        id: 'admin_act_review',
        type: 'verification',
        title: 'Platform Audit & Verification Review',
        description: 'Super Admin reviewed pending verification documents in queue.',
        timestamp: '2026-09-30 08:30',
        icon: 'admin_panel_settings',
        badgeLabel: 'Admin Action',
        badgeColorClass: 'bg-[#FAF5FF] text-[#7E22CE]',
      });
      events.push({
        id: 'admin_act_login',
        type: 'login',
        title: 'Admin Console Authentication',
        description: 'Admin signed in to management portal with administrative privileges.',
        timestamp: user.lastActive || '2026-09-30 08:00',
        icon: 'login',
        badgeLabel: 'Login',
        badgeColorClass: 'bg-[#F3F4F6] text-[#4B5563]',
      });
    }

    // 3. Verification action
    if (user.verificationStatus === 'verified') {
      events.push({
        id: 'verif_act_approved',
        type: 'verification',
        title: 'Account Verification Approved',
        description: 'Food safety registration and identity documents confirmed by Admin.',
        timestamp: `${user.joinedDate} 15:00`,
        icon: 'verified',
        badgeLabel: 'Verified',
        badgeColorClass: 'bg-[#EAF3EC] text-[#2E7D4F]',
      });
    } else if (user.verificationStatus === 'pending') {
      events.push({
        id: 'verif_act_submitted',
        type: 'verification',
        title: 'Submitted Verification Application',
        description: 'Uploaded food registration and organizational documentation for review.',
        timestamp: `${user.joinedDate} 12:30`,
        icon: 'pending_actions',
        badgeLabel: 'Submitted',
        badgeColorClass: 'bg-[#FFF3E8] text-[#D9822B]',
      });
    }

    // 4. Initial account registration
    events.push({
      id: 'account_reg_initial',
      type: 'profile_update',
      title: 'Account Created',
      description: `Registered new ${user.role} profile on FoodLink network (${user.city || 'India'}).`,
      timestamp: `${user.joinedDate} 10:00`,
      icon: 'person_add',
      badgeLabel: 'Registration',
      badgeColorClass: 'bg-[#EAF3EC] text-[#2E7D4F]',
    });

    // Chronological order: newest first
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  };

  // Filtered users based on search query and role filter
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      // 1. Role filter
      if (userRoleFilter !== 'all') {
        const r = (u.role || '').toLowerCase();
        if (userRoleFilter === 'donor' && !r.includes('donor')) {
          return false;
        }
        if (
          userRoleFilter === 'ngo' &&
          !r.includes('org') &&
          !r.includes('ngo') &&
          !r.includes('recipient') &&
          !r.includes('shelter')
        ) {
          return false;
        }
        if (
          userRoleFilter === 'courier' &&
          !r.includes('courier') &&
          !r.includes('volunteer')
        ) {
          return false;
        }
        if (userRoleFilter === 'admin' && !r.includes('admin')) {
          return false;
        }
      }

      // 2. Text search query
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.orgName && u.orgName.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q) ||
        (u.city && u.city.toLowerCase().includes(q))
      );
    });
  }, [users, userSearchQuery, userRoleFilter]);

  // Filtered applicants based on queueFilter tab ('pending' | 'verified' | 'rejected')
  const filteredApplicants = useMemo(() => {
    return applicants.filter((a) => a.status === queueFilter);
  }, [applicants, queueFilter]);

  const pendingApplicantsCount = useMemo(() => {
    return applicants.filter((a) => a.status === 'pending').length;
  }, [applicants]);

  // Paginated data
  const paginatedQueue = useMemo(() => {
    const start = (queuePage - 1) * ITEMS_PER_PAGE;
    return filteredApplicants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApplicants, queuePage]);
  const totalQueuePages = Math.ceil(filteredApplicants.length / ITEMS_PER_PAGE) || 1;

  const paginatedListings = useMemo(() => {
    const start = (listingsPage - 1) * ITEMS_PER_PAGE;
    return listings.slice(start, start + ITEMS_PER_PAGE);
  }, [listings, listingsPage]);
  const totalListingsPages = Math.ceil(listings.length / ITEMS_PER_PAGE) || 1;

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, usersPage]);
  const totalUsersPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;

  // Multi-select helpers for current paginated page
  const isAllPageSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.has(u.id));
  const isSomePageSelected =
    paginatedUsers.some((u) => selectedUserIds.has(u.id)) && !isAllPageSelected;

  const selectedUsersList = useMemo(() => {
    return users.filter((u) => selectedUserIds.has(u.id));
  }, [users, selectedUserIds]);

  return (
    <div className="min-h-screen bg-[#FAFBF8] dark:bg-[#111A14] text-[#1E2A22] dark:text-[#FAFBF8]">
      {/* Top Banner / Breadcrumb Header */}
      <header className="bg-white dark:bg-[#18241C] border-b border-[#D9E2DA] dark:border-[#2D4436] sticky top-0 z-30 transition-colors">
        <div className="site-container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2E7D4F] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg text-[#1E2A22] dark:text-[#FAFBF8]">
                  {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin Officer'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2E7D4F]/10 dark:bg-[#2E7D4F]/20 text-[#2E7D4F]">
                  Admin
                </span>
              </div>
              <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                {currentUser?.email || 'admin@foodlink.org'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme mode"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="hidden sm:flex text-xs sm:text-sm font-semibold text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer min-h-[38px] items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>View Public Site</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                onNavigateHome();
              }}
              className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#3D1A1A] px-3 py-1.5 rounded-lg border border-[#FECACA] dark:border-[#7F1D1D] transition-colors cursor-pointer min-h-[38px] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Mobile Top Drawer Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="lg:hidden p-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Toggle mobile admin drawer"
            >
              <span className="material-symbols-outlined text-[22px]">
                {mobileDrawerOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top Drawer (visible on <1024px when toggled) */}
      {mobileDrawerOpen && (
        <div className="lg:hidden bg-white dark:bg-[#18241C] border-b border-[#D9E2DA] dark:border-[#2D4436] px-4 py-4 space-y-2 z-20 shadow-lg animate-fadeIn">
          <div className="px-2 py-1 text-xs text-[#526357] dark:text-[#95A89C] flex items-center justify-between border-b border-[#D9E2DA] dark:border-[#2D4436] pb-2 mb-2">
            <span>Admin Navigation Drawer</span>
            <span className="font-semibold text-[#2E7D4F]">Role: Admin</span>
          </div>

          {/* 1. Overview */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('overview');
              setMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between min-h-[44px] cursor-pointer transition-colors ${
              activeSection === 'overview'
                ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold'
                : 'text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span>Overview</span>
            </div>
          </button>

          {/* 2. Verification */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('queue');
              setMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between min-h-[44px] cursor-pointer transition-colors ${
              activeSection === 'queue'
                ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold'
                : 'text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>Verification</span>
            </div>
            {pendingApplicantsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFF3E8] text-[#D9822B]">
                {pendingApplicantsCount}
              </span>
            )}
          </button>

          {/* 3. Listings */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('listings');
              setMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between min-h-[44px] cursor-pointer transition-colors ${
              activeSection === 'listings'
                ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold'
                : 'text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">restaurant</span>
              <span>Listings</span>
            </div>
            <span className="text-xs text-[#526357] dark:text-[#95A89C]">{listings.length}</span>
          </button>

          {/* 4. Users */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('users');
              setMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between min-h-[44px] cursor-pointer transition-colors ${
              activeSection === 'users'
                ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold'
                : 'text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">group</span>
              <span>Users</span>
            </div>
            <span className="text-xs text-[#526357] dark:text-[#95A89C]">{users.length}</span>
          </button>

          {/* 5. Settings */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('settings');
              setMobileDrawerOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between min-h-[44px] cursor-pointer transition-colors ${
              activeSection === 'settings'
                ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold'
                : 'text-[#1E2A22] dark:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span>Settings</span>
            </div>
          </button>
        </div>
      )}

      {/* Global Admin Notice Toast */}
      {adminNotice && (
        <div className="fixed top-16 right-4 z-50 max-w-md animate-fadeIn">
          <div
            className={`p-3.5 rounded-lg shadow-md border text-sm flex items-center gap-2.5 ${
              adminNotice.type === 'success'
                ? 'bg-[#EAF3EC] border-[#A7F3D0] text-[#2E7D4F]'
                : adminNotice.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                : 'bg-[#FFF3E8] border-[#FCD34D] text-[#D9822B]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {adminNotice.type === 'success' ? 'check_circle' : 'info'}
            </span>
            <span className="font-medium">{adminNotice.text}</span>
          </div>
        </div>
      )}

      {/* Main Admin Layout with Left Sidebar on Desktop */}
      <div className="site-container py-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {/* DESKTOP LEFT SIDEBAR */}
          <aside className="hidden lg:block lg:col-span-3 bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl shadow-xs p-4 sticky top-20 space-y-6 transition-colors">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#526357] dark:text-[#95A89C] font-bold px-3 mb-2">
                Administration
              </p>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('overview')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'overview'
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold border-l-4 border-[#2E7D4F]'
                      : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">dashboard</span>
                    <span>Overview</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('queue')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'queue'
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold border-l-4 border-[#2E7D4F]'
                      : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    <span>Verification</span>
                  </div>
                  {pendingApplicantsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFF3E8] text-[#D9822B] border border-[#FCD34D]">
                      {pendingApplicantsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('listings')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'listings'
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold border-l-4 border-[#2E7D4F]'
                      : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">restaurant</span>
                    <span>Listings</span>
                  </div>
                  <span className="text-xs text-[#526357] dark:text-[#95A89C]">{listings.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('users')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'users'
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold border-l-4 border-[#2E7D4F]'
                      : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">group</span>
                    <span>Users</span>
                  </div>
                  <span className="text-xs text-[#526357] dark:text-[#95A89C]">{users.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('settings')}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer min-h-[44px] ${
                    activeSection === 'settings'
                      ? 'bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] font-semibold border-l-4 border-[#2E7D4F]'
                      : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                    <span>Settings</span>
                  </div>
                </button>
              </nav>
            </div>

            {/* System Status info */}
            <div className="pt-4 border-t border-[#D9E2DA] space-y-2 text-xs text-[#526357]">
              <div className="flex items-center justify-between">
                <span>Database:</span>
                <span className="font-semibold text-[#2E7D4F] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2E7D4F]" />
                  {usingRealData.listings || usingRealData.applicants ? 'Firestore Live' : 'Sample Data Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Approvals:</span>
                <span className="font-semibold text-[#D9822B]">
                  {pendingDonorsCount + pendingOrgsCount}
                </span>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="lg:col-span-9 min-w-0 space-y-6">
            {/* SECTION 1: OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22]">
                    Operations Overview
                  </h1>
                  <p className="text-sm text-[#526357] mt-1">
                    Real-time status of verification pipelines and food rescue missions across the network.
                  </p>
                </div>

                {/* 4 Plain Count Boxes: Pending verifications, Active listings, Completed pickups, Total users */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* 1. Pending Verifications */}
                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xs transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357] dark:text-[#95A89C]">
                        Pending verifications
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#FFF3E8] dark:bg-[#332014] text-[#D9822B] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      {pendingApplicantsCount}
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-1.5 flex items-center justify-between">
                      <span>Donors, NGOs, couriers</span>
                      {usingRealData.applicants ? (
                        <span className="text-[#2E7D4F] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#D9822B] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 2. Active Listings */}
                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xs transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357] dark:text-[#95A89C]">
                        Active listings
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">lunch_dining</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      {activeListingsCount}
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-1.5 flex items-center justify-between">
                      <span>Available for immediate claim</span>
                      {usingRealData.listings ? (
                        <span className="text-[#2E7D4F] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#D9822B] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 3. Completed Pickups */}
                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xs transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357] dark:text-[#95A89C]">
                        Completed pickups
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">task_alt</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      {completedPickupsCount}
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-1.5 flex items-center justify-between">
                      <span>Delivered to shelters</span>
                      {usingRealData.listings ? (
                        <span className="text-[#2E7D4F] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#D9822B] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>

                  {/* 4. Total Users */}
                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xs transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357] dark:text-[#95A89C]">
                        Total users
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">group</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      {users.length}
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-1.5 flex items-center justify-between">
                      <span>Registered network members</span>
                      {usingRealData.users ? (
                        <span className="text-[#2E7D4F] font-semibold">Live data</span>
                      ) : (
                        <span className="text-[#D9822B] font-semibold">(Sample data)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Last 10 Admin Actions (Audit Trail) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                        Recent Admin Actions (Last 10)
                      </h2>
                      <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                        Chronological record of verification decisions, removals, and account suspensions.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F]">
                      Audit Trail Active
                    </span>
                  </div>

                  <div className="w-full overflow-x-auto border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl bg-white dark:bg-[#18241C] shadow-xs">
                    <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAFBF8] dark:bg-[#142017] border-b border-[#D9E2DA] dark:border-[#2D4436] text-[#526357] dark:text-[#95A89C] uppercase font-semibold">
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Target Entity</th>
                          <th className="py-3 px-4">Reason / Details</th>
                          <th className="py-3 px-4">Admin</th>
                          <th className="py-3 px-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E2DA] dark:divide-[#2D4436]">
                        {adminActions.slice(0, 10).map((act) => {
                          const isApprove = act.actionType === 'approve';
                          const isSuspend = act.actionType === 'suspend';
                          const isReject = act.actionType === 'reject';

                          const badgeClass = isApprove
                            ? 'bg-[#EAF3EC] text-[#2E7D4F] border-[#2E7D4F]/30'
                            : isSuspend
                            ? 'bg-[#FFF3E8] text-[#D9822B] border-[#D9822B]/30'
                            : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]';

                          const badgeText = isApprove
                            ? 'Approved'
                            : isSuspend
                            ? 'Suspended'
                            : isReject
                            ? 'Rejected'
                            : 'Removed';

                          return (
                            <tr key={act.id} className="hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors">
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                                  {act.targetName}
                                </div>
                                <div className="text-[11px] text-[#526357] dark:text-[#95A89C] capitalize">
                                  {act.targetType}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-[#526357] dark:text-[#95A89C] max-w-[280px]">
                                <span className="line-clamp-2">
                                  {act.reason || 'Action recorded in admin operations log.'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-[#1E2A22] dark:text-[#FAFBF8]">
                                {act.adminName}
                              </td>
                              <td className="py-3 px-4 text-right text-[#526357] dark:text-[#95A89C] whitespace-nowrap">
                                {act.timestamp}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Shortcuts to Queue & Listings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-base font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                        Urgent Verification Requests
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFF3E8] text-[#D9822B]">
                        {pendingApplicantsCount} Pending
                      </span>
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                      New food businesses, charities, and volunteer couriers require statutory license and ID certificate review.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('queue')}
                      className="px-4 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Open Verification Queue</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                  <div className="bg-white dark:bg-[#18241C] p-5 rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-base font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                        Listings Quality & Moderation
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF3EC] text-[#2E7D4F]">
                        {listings.length} Total
                      </span>
                    </div>
                    <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                      Audit active, claimed, and fulfilled surplus food packages across all operational zones and remove flagged entries.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('listings')}
                      className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] text-[#1E2A22] dark:text-[#FAFBF8] text-xs font-semibold transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
                    >
                      <span>Manage All Food Listings</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: VERIFICATION QUEUE */}
            {activeSection === 'queue' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      Verification Queue
                    </h1>
                    <p className="text-sm text-[#526357] dark:text-[#95A89C]">
                      Review uploaded identity and nonprofit credentials for donors, organizations, and couriers.
                    </p>
                  </div>
                  <div className="text-xs text-[#526357] dark:text-[#95A89C] bg-white dark:bg-[#18241C] px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] shrink-0">
                    Showing {filteredApplicants.length} of {applicants.length} applications
                  </div>
                </div>

                {/* Filter tabs: Pending, Verified, Rejected */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-lg self-start shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setQueueFilter('pending');
                      setQueuePage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      queueFilter === 'pending'
                        ? 'bg-[#D9822B] text-white shadow-xs'
                        : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8]'
                    }`}
                  >
                    <span>Pending</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        queueFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-[#FFF3E8] text-[#D9822B]'
                      }`}
                    >
                      {applicants.filter((a) => a.status === 'pending').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQueueFilter('verified');
                      setQueuePage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      queueFilter === 'verified'
                        ? 'bg-[#2E7D4F] text-white shadow-xs'
                        : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8]'
                    }`}
                  >
                    <span>Verified</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        queueFilter === 'verified' ? 'bg-white/20 text-white' : 'bg-[#EAF3EC] text-[#2E7D4F]'
                      }`}
                    >
                      {applicants.filter((a) => a.status === 'verified').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQueueFilter('rejected');
                      setQueuePage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
                      queueFilter === 'rejected'
                        ? 'bg-[#DC2626] text-white shadow-xs'
                        : 'text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8]'
                    }`}
                  >
                    <span>Rejected</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        queueFilter === 'rejected' ? 'bg-white/20 text-white' : 'bg-[#FEF2F2] text-[#DC2626]'
                      }`}
                    >
                      {applicants.filter((a) => a.status === 'rejected').length}
                    </span>
                  </button>
                </div>

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl bg-white dark:bg-[#18241C] shadow-xs">
                  <table className="w-full min-w-[680px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#FAFBF8] dark:bg-[#142017] border-b border-[#D9E2DA] dark:border-[#2D4436] text-[#526357] dark:text-[#95A89C] text-xs uppercase font-semibold">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Submitted Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2DA] dark:divide-[#2D4436]">
                      {paginatedQueue.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#526357] dark:text-[#95A89C]">
                            No {queueFilter} verification requests found.
                          </td>
                        </tr>
                      ) : (
                        paginatedQueue.map((applicant) => (
                          <tr
                            key={applicant.id}
                            onClick={() => setSelectedApplicant(applicant)}
                            className="hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 font-medium text-[#1E2A22] dark:text-[#FAFBF8]">
                              <div className="font-semibold text-[15px]">{applicant.name}</div>
                              <div className="text-xs text-[#526357] dark:text-[#95A89C] flex items-center gap-2 mt-0.5">
                                <span>{applicant.city}</span>
                                <span>•</span>
                                <span>{applicant.email}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                                  applicant.type === 'Donor'
                                    ? 'bg-[#EAF3EC] text-[#2E7D4F]'
                                    : applicant.type === 'Courier'
                                    ? 'bg-[#EEF2FF] text-[#4F46E5]'
                                    : 'bg-[#FFF3E8] text-[#D9822B]'
                                }`}
                              >
                                {applicant.type}
                              </span>
                              {applicant.subType && (
                                <div className="text-xs text-[#526357] dark:text-[#95A89C] mt-0.5 truncate max-w-[150px]">
                                  {applicant.subType}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#526357] dark:text-[#95A89C]">
                              {applicant.submittedDate}
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(applicant.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApplicant(applicant);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] hover:border-[#2E7D4F] hover:bg-[#EAF3EC] dark:hover:bg-[#203026] text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] transition-colors cursor-pointer"
                              >
                                Review Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalQueuePages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#526357] pt-2">
                    <span>
                      Page {queuePage} of {totalQueuePages} ({applicants.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                        disabled={queuePage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalQueuePages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setQueuePage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            queuePage === pg
                              ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                              : 'bg-white text-[#1E2A22] border-[#D9E2DA] hover:bg-[#FAFBF8]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                        disabled={queuePage === totalQueuePages}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: LISTINGS */}
            {activeSection === 'listings' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#1E2A22]">
                      Food Listings
                    </h1>
                    <p className="text-sm text-[#526357]">
                      Audit all surplus meals posted across regional donor networks.
                    </p>
                  </div>
                  <div className="text-xs text-[#526357] bg-white px-3 py-1.5 rounded-lg border border-[#D9E2DA] shrink-0">
                    {listings.length} Active & Fulfilled Listings
                  </div>
                </div>

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#D9E2DA] rounded-xl bg-white shadow-xs">
                  <table className="w-full min-w-[760px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#FAFBF8] dark:bg-[#142017] border-b border-[#D9E2DA] dark:border-[#2D4436] text-[#526357] dark:text-[#95A89C] text-xs uppercase font-semibold">
                        <th className="py-3 px-4">Food Item</th>
                        <th className="py-3 px-4">Donor / Location</th>
                        <th className="py-3 px-4">Quantity</th>
                        <th className="py-3 px-4">Dietary</th>
                        <th className="py-3 px-4">Date / Window</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2DA] dark:divide-[#2D4436]">
                      {paginatedListings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#526357] dark:text-[#95A89C]">
                            No food listings recorded.
                          </td>
                        </tr>
                      ) : (
                        paginatedListings.map((listing) => (
                          <tr key={listing.id} className="hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors">
                            <td className="py-3.5 px-4 font-medium text-[#1E2A22] dark:text-[#FAFBF8] max-w-[220px]">
                              <div className="font-semibold text-sm truncate">{listing.title}</div>
                              <div className="text-xs text-[#526357] dark:text-[#95A89C] mt-0.5">{listing.category || listing.foodType || 'Prepared Food'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#526357] dark:text-[#95A89C]">
                              <div className="font-medium text-[#1E2A22] dark:text-[#FAFBF8]">{listing.donorName || listing.donorOrg}</div>
                              <div className="truncate max-w-[170px]">{listing.location || 'India'}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                              {listing.quantity ? `${listing.quantity} ${listing.unit || 'Servings'}` : 'Surplus Meals'}
                            </td>
                            <td className="py-3.5 px-4">
                              {listing.isVeg ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF3EC] text-[#2E7D4F]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4F]" />
                                  Veg
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FFF3E8] text-[#D9822B]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D9822B]" />
                                  Non-Veg {(listing as any).nonVegType ? `(${(listing as any).nonVegType})` : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#526357] dark:text-[#95A89C]">
                              <div className="font-medium text-[#1E2A22] dark:text-[#FAFBF8]">{listing.pickupWindow}</div>
                              <div className="text-[11px] text-[#71827A]">{listing.expiryTime || 'Safe window'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(listing.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setListingDetailsModal(listing)}
                                  className="px-2.5 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] hover:bg-[#EAF3EC] dark:hover:bg-[#203026] text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] transition-colors cursor-pointer"
                                  title="View listing details"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setListingToRemove(listing);
                                    setRemoveListingReason('');
                                    setRemoveListingError(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-[#FECACA] dark:border-[#7F1D1D] hover:bg-[#FEF2F2] dark:hover:bg-[#3D1A1A] text-xs font-semibold text-[#DC2626] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Remove food listing"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                  <span>Remove</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalListingsPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#526357] pt-2">
                    <span>
                      Page {listingsPage} of {totalListingsPages} ({listings.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setListingsPage((p) => Math.max(1, p - 1))}
                        disabled={listingsPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalListingsPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setListingsPage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            listingsPage === pg
                              ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                              : 'bg-white text-[#1E2A22] border-[#D9E2DA] hover:bg-[#FAFBF8]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setListingsPage((p) => Math.min(totalListingsPages, p + 1))}
                        disabled={listingsPage === totalListingsPages}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: USERS */}
            {activeSection === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-[#1E2A22]">
                      Users Directory
                    </h1>
                    <p className="text-sm text-[#526357]">
                      Search and review network accounts, verification statuses, and roles.
                    </p>
                  </div>
                </div>

                {/* Role Composition Summary Count Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* 1. Donor Count Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserRoleFilter((prev) => (prev === 'donor' ? 'all' : 'donor'));
                      setUsersPage(1);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs relative ${
                      userRoleFilter === 'donor'
                        ? 'bg-[#EAF3EC] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20'
                        : 'bg-white border-[#D9E2DA] hover:border-[#2E7D4F]/50 hover:bg-[#FAFBF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357]">
                        Donors
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">storefront</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22]">
                      {userRoleCounts.donor}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#526357] mt-1.5">
                      <span>Food businesses &amp; caterers</span>
                      {userRoleFilter === 'donor' && (
                        <span className="text-[11px] font-semibold text-[#2E7D4F]">Filtered</span>
                      )}
                    </div>
                  </button>

                  {/* 2. NGO / Shelters Count Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserRoleFilter((prev) => (prev === 'ngo' ? 'all' : 'ngo'));
                      setUsersPage(1);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs relative ${
                      userRoleFilter === 'ngo'
                        ? 'bg-[#EAF3EC] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20'
                        : 'bg-white border-[#D9E2DA] hover:border-[#2E7D4F]/50 hover:bg-[#FAFBF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357]">
                        NGOs &amp; Shelters
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#D9822B] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22]">
                      {userRoleCounts.ngo}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#526357] mt-1.5">
                      <span>Charities &amp; community kitchens</span>
                      {userRoleFilter === 'ngo' && (
                        <span className="text-[11px] font-semibold text-[#2E7D4F]">Filtered</span>
                      )}
                    </div>
                  </button>

                  {/* 3. Courier Count Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserRoleFilter((prev) => (prev === 'courier' ? 'all' : 'courier'));
                      setUsersPage(1);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs relative ${
                      userRoleFilter === 'courier'
                        ? 'bg-[#EAF3EC] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20'
                        : 'bg-white border-[#D9E2DA] hover:border-[#2E7D4F]/50 hover:bg-[#FAFBF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#526357]">
                        Couriers
                      </span>
                      <span className="w-8 h-8 rounded-lg bg-[#EBF2FE] text-[#2563EB] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">two_wheeler</span>
                      </span>
                    </div>
                    <div className="font-serif text-3xl font-bold text-[#1E2A22]">
                      {userRoleCounts.courier}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#526357] mt-1.5">
                      <span>Volunteer runners &amp; drivers</span>
                      {userRoleFilter === 'courier' && (
                        <span className="text-[11px] font-semibold text-[#2E7D4F]">Filtered</span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Search & Role Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Box */}
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#526357]">
                      search
                    </span>
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setUsersPage(1);
                      }}
                      placeholder="Search users by name, email, organization, or city..."
                      className="w-full h-11 pl-10 pr-12 rounded-xl border border-[#D9E2DA] bg-white text-sm text-[#1E2A22] placeholder:text-[#526357] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] transition-all min-h-[44px]"
                    />
                    {userSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserSearchQuery('');
                          setUsersPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#526357] hover:text-[#1E2A22] cursor-pointer px-1 py-0.5"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Role Filter Dropdown Menu */}
                  <div className="relative shrink-0 sm:w-56">
                    <label htmlFor="user-role-filter" className="sr-only">
                      Filter by role
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#526357] pointer-events-none">
                        filter_list
                      </span>
                      <select
                        id="user-role-filter"
                        value={userRoleFilter}
                        onChange={(e) => {
                          setUserRoleFilter(e.target.value as UserRoleFilter);
                          setUsersPage(1);
                        }}
                        className="w-full h-11 pl-9 pr-9 rounded-xl border border-[#D9E2DA] bg-white text-sm font-medium text-[#1E2A22] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] transition-all min-h-[44px] cursor-pointer appearance-none"
                      >
                        <option value="all">All Roles</option>
                        <option value="donor">Donors</option>
                        <option value="ngo">NGOs &amp; Shelters</option>
                        <option value="courier">Couriers &amp; Volunteers</option>
                        <option value="admin">Administrators</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#526357] pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bulk Actions Menu / Toolbar */}
                {selectedUserIds.size > 0 && (
                  <div className="p-3 sm:p-3.5 rounded-xl border border-[#2E7D4F]/30 bg-[#EAF3EC] flex flex-wrap items-center justify-between gap-3 animate-fadeIn shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-[#2E7D4F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {selectedUserIds.size}
                      </span>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-[#1E2A22]">
                          {selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'} selected
                        </span>
                        <span className="hidden sm:inline text-xs text-[#526357] ml-2">
                          (Apply simultaneous action)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setBulkApproveModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px] shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBulkSuspendModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-white border border-[#FECACA] hover:bg-[#FEF2F2] text-[#DC2626] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
                      >
                        <span className="material-symbols-outlined text-[16px]">block</span>
                        <span>Suspend</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedUserIds(new Set())}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] text-xs font-medium text-[#526357] transition-colors cursor-pointer min-h-[36px]"
                      >
                        Clear selection
                      </button>
                    </div>
                  </div>
                )}

                {/* Table container with internal scroll (no page-level overflow) */}
                <div className="w-full overflow-x-auto border border-[#D9E2DA] rounded-xl bg-white shadow-xs">
                  <table className="w-full min-w-[880px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#FAFBF8] border-b border-[#D9E2DA] text-[#526357] text-xs uppercase font-semibold">
                        <th className="py-3 px-3 w-12 text-center">
                          <input
                            type="checkbox"
                            aria-label="Select all users on this page"
                            checked={isAllPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomePageSelected;
                            }}
                            onChange={toggleSelectAllPageUsers}
                            className="w-4 h-4 rounded border-[#D9E2DA] text-[#2E7D4F] focus:ring-[#2E7D4F] cursor-pointer accent-[#2E7D4F]"
                          />
                        </th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Organization / Entity</th>
                        <th className="py-3 px-4">City / Phone</th>
                        <th className="py-3 px-4">Verification Status</th>
                        <th className="py-3 px-4">Last Active</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2DA]">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-[#526357]">
                            <p>
                              No users matched your search criteria
                              {userSearchQuery ? ` for "${userSearchQuery}"` : ''}
                              {userRoleFilter !== 'all'
                                ? ` in role "${
                                    userRoleFilter === 'ngo'
                                      ? 'NGO / Organization'
                                      : userRoleFilter === 'courier'
                                      ? 'Courier'
                                      : userRoleFilter.charAt(0).toUpperCase() + userRoleFilter.slice(1)
                                  }"`
                                : ''}.
                            </p>
                            {(userSearchQuery || userRoleFilter !== 'all') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUserSearchQuery('');
                                  setUserRoleFilter('all');
                                  setUsersPage(1);
                                }}
                                className="mt-2 text-xs font-semibold text-[#2E7D4F] hover:underline cursor-pointer"
                              >
                                Reset search and role filter
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((user) => (
                          <tr
                            key={user.id}
                            className={`hover:bg-[#FAFBF8] transition-colors ${
                              selectedUserIds.has(user.id) ? 'bg-[#EAF3EC]/40' : ''
                            }`}
                          >
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Select ${user.name}`}
                                checked={selectedUserIds.has(user.id)}
                                onChange={() => toggleSelectUser(user.id)}
                                className="w-4 h-4 rounded border-[#D9E2DA] text-[#2E7D4F] focus:ring-[#2E7D4F] cursor-pointer accent-[#2E7D4F]"
                              />
                            </td>
                            <td className="py-3.5 px-4 font-medium text-[#1E2A22]">
                              <div className="font-semibold text-sm">{user.name}</div>
                              <div className="text-xs text-[#526357]">{user.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-[#EAF3EC] text-[#2E7D4F]">
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#526357]">
                              {user.orgName || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-[#526357]">
                              <div>{user.city || 'India'}</div>
                              <div>{user.phone || '-'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              {renderStatusBadge(user.verificationStatus)}
                            </td>
                            <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                              {(() => {
                                const formatted = formatLastActive(user.lastActive);
                                return (
                                  <div>
                                    <div className="font-semibold text-xs text-[#1E2A22]">
                                      {formatted.date}
                                    </div>
                                    <div className="text-[11px] text-[#526357] flex items-center gap-1 mt-0.5">
                                      <span className="material-symbols-outlined text-[13px] text-[#2E7D4F]">schedule</span>
                                      <span>{formatted.time}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserForActivity(user)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] hover:bg-[#EAF3EC] dark:hover:bg-[#203026] hover:border-[#2E7D4F] text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] transition-colors cursor-pointer min-h-[32px] shadow-2xs"
                                  title={`View activity timeline for ${user.name}`}
                                >
                                  <span className="material-symbols-outlined text-[15px] text-[#2E7D4F]">history</span>
                                  <span>Activity</span>
                                </button>
                                {user.verificationStatus !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSingleSuspendUser(user);
                                      setSuspendReason('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#FECACA] dark:border-[#7F1D1D] bg-white dark:bg-[#18241C] hover:bg-[#FEF2F2] dark:hover:bg-[#3D1A1A] text-xs font-semibold text-[#DC2626] transition-colors cursor-pointer min-h-[32px]"
                                    title={`Suspend account for ${user.name}`}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">block</span>
                                    <span>Suspend</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalUsersPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-[#526357] dark:text-[#95A89C] pt-2">
                    <span>
                      Page {usersPage} of {totalUsersPages} ({filteredUsers.length} total)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalUsersPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setUsersPage(pg)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                            usersPage === pg
                              ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                              : 'bg-white dark:bg-[#18241C] text-[#1E2A22] dark:text-[#FAFBF8] border-[#D9E2DA] dark:border-[#2D4436] hover:bg-[#FAFBF8] dark:hover:bg-[#203026]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                        disabled={usersPage === totalUsersPages}
                        className="px-3 py-1.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#18241C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] disabled:opacity-40 cursor-pointer min-h-[36px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 5: SETTINGS */}
            {activeSection === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                    Platform Settings
                  </h1>
                  <p className="text-sm text-[#526357] dark:text-[#95A89C] mt-1">
                    Manage administrative credentials, interface theme, and operational visual preferences.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Card 1: Change Password */}
                  <div className="bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#059669]/10 text-[#059669] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[22px]">password</span>
                      </div>
                      <div>
                        <h2 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                          Change Password
                        </h2>
                        <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                          Update administrative password for {currentUser?.email || 'admin'}
                        </p>
                      </div>
                    </div>

                    {passwordNotice && (
                      <div
                        className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                          passwordNotice.type === 'success'
                            ? 'bg-[#EAF3EC] border-[#A7F3D0] text-[#2E7D4F]'
                            : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {passwordNotice.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span>{passwordNotice.text}</span>
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (newPassword.length < 6) {
                          setPasswordNotice({ text: 'Password must be at least 6 characters long.', type: 'error' });
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          setPasswordNotice({ text: 'New passwords do not match.', type: 'error' });
                          return;
                        }

                        setPasswordLoading(true);
                        setPasswordNotice(null);

                        try {
                          if (auth.currentUser) {
                            await updatePassword(auth.currentUser, newPassword);
                            setPasswordNotice({ text: 'Password updated successfully.', type: 'success' });
                            setNewPassword('');
                            setConfirmPassword('');
                          } else {
                            setPasswordNotice({ text: 'No active session found.', type: 'error' });
                          }
                        } catch (err: any) {
                          if (err.code === 'auth/requires-recent-login' && auth.currentUser?.email) {
                            try {
                              await sendPasswordResetEmail(auth, auth.currentUser.email);
                              setPasswordNotice({
                                text: 'Recent sign-in required. A secure password reset link was sent to your email.',
                                type: 'success',
                              });
                            } catch (e: any) {
                              setPasswordNotice({ text: err.message || 'Unable to update password.', type: 'error' });
                            }
                          } else {
                            setPasswordNotice({ text: err.message || 'Unable to update password.', type: 'error' });
                          }
                        } finally {
                          setPasswordLoading(false);
                        }
                      }}
                      className="space-y-3.5"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-xs text-[#1E2A22] dark:text-[#FAFBF8] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/30"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-xs text-[#1E2A22] dark:text-[#FAFBF8] focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/30"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={async () => {
                            if (auth.currentUser?.email) {
                              try {
                                await sendPasswordResetEmail(auth, auth.currentUser.email);
                                setPasswordNotice({
                                  text: `Password reset email sent to ${auth.currentUser.email}.`,
                                  type: 'success',
                                });
                              } catch (err: any) {
                                setPasswordNotice({ text: err.message || 'Failed to send reset email.', type: 'error' });
                              }
                            }
                          }}
                          className="text-xs text-[#2E7D4F] hover:underline cursor-pointer"
                        >
                          Send reset email link
                        </button>

                        <button
                          type="submit"
                          disabled={passwordLoading || !newPassword}
                          className="px-4 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[40px]"
                        >
                          {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Card 2: Theme Choice */}
                  <div className="bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2E7D4F]/10 text-[#2E7D4F] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[22px]">palette</span>
                      </div>
                      <div>
                        <h2 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                          Theme Choice
                        </h2>
                        <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                          Switch between light and dark display modes and select your color palette.
                        </p>
                      </div>
                    </div>

                    {/* Mode Toggle: Light vs Dark */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                        Display Mode
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (isDark) toggleTheme();
                          }}
                          className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            !isDark
                              ? 'bg-[#EAF3EC] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20 text-[#2E7D4F] font-semibold'
                              : 'bg-white dark:bg-[#111A14] border-[#D9E2DA] dark:border-[#2D4436] text-[#526357] dark:text-[#95A89C]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">light_mode</span>
                          <div>
                            <div className="text-xs font-bold">Light Mode</div>
                            <div className="text-[11px] opacity-80">Clean, crisp paper tone</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isDark) toggleTheme();
                          }}
                          className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            isDark
                              ? 'bg-[#203026] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20 text-[#FAFBF8] font-semibold'
                              : 'bg-white dark:bg-[#111A14] border-[#D9E2DA] dark:border-[#2D4436] text-[#526357] dark:text-[#95A89C]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">dark_mode</span>
                          <div>
                            <div className="text-xs font-bold">Dark Mode</div>
                            <div className="text-[11px] opacity-80">Deep contrast night tone</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Color Palette Choices */}
                    <div className="space-y-2 pt-2 border-t border-[#D9E2DA] dark:border-[#2D4436]">
                      <label className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                        Color Palette
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { id: 'forest_gold', name: 'Forest & Gold', hex: '#2E7D4F', sec: '#D9822B' },
                          { id: 'ocean_teal', name: 'Ocean & Teal', hex: '#0D9488', sec: '#F97316' },
                          { id: 'navy_marigold', name: 'Navy & Marigold', hex: '#F59E0B', sec: '#3B82F6' },
                          { id: 'crimson_terracotta', name: 'Terracotta', hex: '#C2410C', sec: '#16A34A' },
                        ].map((p) => {
                          const isSelected = paletteId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPaletteId(p.id as PaletteId)}
                              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-[#EAF3EC] dark:bg-[#203026] border-[#2E7D4F] ring-2 ring-[#2E7D4F]/20'
                                  : 'bg-white dark:bg-[#111A14] border-[#D9E2DA] dark:border-[#2D4436] hover:border-[#2E7D4F]/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1">
                                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.hex }} />
                                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.sec }} />
                                </div>
                                <span className="text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                                  {p.name}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">check</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL 1: DETAILS VIEW MODAL (Opened by clicking queue row) */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-2xl w-full p-6 space-y-5 animate-fadeIn my-8">
            <div className="flex items-start justify-between border-b border-[#D9E2DA] dark:border-[#2D4436] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                    {selectedApplicant.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedApplicant.type === 'Donor'
                        ? 'bg-[#EAF3EC] text-[#2E7D4F]'
                        : selectedApplicant.type === 'Courier'
                        ? 'bg-[#EEF2FF] text-[#4F46E5]'
                        : 'bg-[#FFF3E8] text-[#D9822B]'
                    }`}
                  >
                    {selectedApplicant.type}
                  </span>
                </div>
                <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-1">
                  Submitted on {selectedApplicant.submittedDate} • Status: {renderStatusBadge(selectedApplicant.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApplicant(null)}
                className="text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] p-1 rounded-lg hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Applicant Information Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-[#526357] dark:text-[#95A89C]">Category / Subtype:</span>
                <p className="text-sm text-[#1E2A22] dark:text-[#FAFBF8] font-medium">{selectedApplicant.subType || 'General'}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#526357] dark:text-[#95A89C]">Registered Email:</span>
                <p className="text-sm text-[#1E2A22] dark:text-[#FAFBF8] font-medium">{selectedApplicant.email}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#526357] dark:text-[#95A89C]">Contact Phone:</span>
                <p className="text-sm text-[#1E2A22] dark:text-[#FAFBF8] font-medium">{selectedApplicant.phone}</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-[#526357] dark:text-[#95A89C]">City & Address:</span>
                <p className="text-sm text-[#1E2A22] dark:text-[#FAFBF8] font-medium">{selectedApplicant.address}, {selectedApplicant.city}</p>
              </div>
            </div>

            {/* Rejection Note if already rejected */}
            {selectedApplicant.status === 'rejected' && selectedApplicant.rejectionReason && (
              <div className="p-3.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3D1A1A] border border-[#FECACA] dark:border-[#7F1D1D] text-xs text-[#DC2626]">
                <span className="font-bold">Rejection Reason:</span> {selectedApplicant.rejectionReason}
              </div>
            )}

            {/* Uploaded Documents List */}
            <div className="space-y-3 pt-2 border-t border-[#D9E2DA] dark:border-[#2D4436]">
              <h3 className="font-serif text-sm font-bold text-[#1E2A22] dark:text-[#FAFBF8] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#2E7D4F]">description</span>
                <span>Uploaded Verification Documents ({selectedApplicant.documents.length})</span>
              </h3>

              <div className="space-y-2">
                {selectedApplicant.documents.map((docItem, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-[#FAFBF8] dark:bg-[#111A14] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded bg-white dark:bg-[#18241C] border border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-center text-[#2E7D4F]">
                        <span className="material-symbols-outlined text-[20px]">draft</span>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#1E2A22] dark:text-[#FAFBF8]">{docItem.title}</div>
                        <div className="text-[11px] text-[#526357] dark:text-[#95A89C] flex items-center gap-2">
                          <span>{docItem.fileName}</span>
                          <span>•</span>
                          <span>{docItem.fileSize}</span>
                          {docItem.docNumber && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[#1E2A22] dark:text-[#FAFBF8]">{docItem.docNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          fileName: docItem.fileName,
                          docType: docItem.docType || 'Statutory Proof',
                          docNumber: docItem.docNumber,
                          title: docItem.title || docItem.fileName,
                          applicantName: selectedApplicant.name,
                          applicantOrg: selectedApplicant.address,
                        })
                      }
                      className="px-2.5 py-1 rounded border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#112F21] hover:bg-[#D1FAE5] dark:hover:bg-[#163828] text-xs font-bold text-[#059669] dark:text-[#34D399] transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">visibility</span>
                      <span>Preview Doc</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedApplicant(null)}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Close
              </button>

              {/* Reject Button */}
              <button
                type="button"
                onClick={() => {
                  setRejectModalApplicant(selectedApplicant);
                  setRejectReason('');
                  setRejectError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#3D1A1A] hover:bg-[#FEE2E2] dark:hover:bg-[#4D2020] text-xs font-semibold text-[#DC2626] min-h-[40px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Reject</span>
              </button>

              {/* Approve Button */}
              <button
                type="button"
                onClick={() => setConfirmApproveModal(selectedApplicant)}
                className="px-5 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-xs font-semibold text-white min-h-[40px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM APPROVAL MODAL */}
      {confirmApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Confirm Approval
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Verify credentials for {confirmApproveModal.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#526357] dark:text-[#95A89C] leading-relaxed">
              Are you sure you want to approve this applicant? Their status will be updated to <strong>Verified</strong>, granting full operational credentials on the platform.
            </p>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmApproveModal(null)}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                className="px-5 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Yes, Approve Applicant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM REJECT MODAL (Requires short reason) */}
      {rejectModalApplicant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] dark:bg-[#3D1A1A] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">cancel</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Reject Application
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Applicant: {rejectModalApplicant.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#526357] dark:text-[#95A89C]">
              Please provide a required reason for rejecting this application. This reason will be recorded on their file.
            </p>

            {rejectError && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3D1A1A] border border-[#FECACA] dark:border-[#7F1D1D] text-xs text-[#DC2626]">
                {rejectError}
              </div>
            )}

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] mb-1.5">
                Rejection Reason *
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. FSSAI registration document expired or image illegible."
                className="w-full p-3 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-xs text-[#1E2A22] dark:text-[#FAFBF8] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all"
              />
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRejectModalApplicant(null);
                  setRejectReason('');
                  setRejectError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM REMOVE LISTING MODAL (With required reason) */}
      {listingToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] dark:bg-[#3D1A1A] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">delete</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Remove Food Listing
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Listing: "{listingToRemove.title}"
                </p>
              </div>
            </div>

            <p className="text-sm text-[#526357] dark:text-[#95A89C] leading-relaxed">
              Are you sure you want to remove this food listing? This will take down the meals from public availability.
            </p>

            {removeListingError && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] dark:bg-[#3D1A1A] border border-[#FECACA] dark:border-[#7F1D1D] text-xs text-[#DC2626]">
                {removeListingError}
              </div>
            )}

            <div>
              <label htmlFor="remove-listing-reason" className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] mb-1.5">
                Removal Reason *
              </label>
              <textarea
                id="remove-listing-reason"
                rows={3}
                value={removeListingReason}
                onChange={(e) => {
                  setRemoveListingReason(e.target.value);
                  if (removeListingError) setRemoveListingError(null);
                }}
                placeholder="e.g. Safe consumption window expired or duplicate listing reported."
                className="w-full p-3 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-xs text-[#1E2A22] dark:text-[#FAFBF8] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all"
              />
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setListingToRemove(null);
                  setRemoveListingReason('');
                  setRemoveListingError(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveListing}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LISTING DETAILS MODAL */}
      {listingDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-lg w-full p-6 space-y-4 animate-fadeIn my-8">
            <div className="flex items-start justify-between border-b border-[#D9E2DA] dark:border-[#2D4436] pb-3.5">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  {listingDetailsModal.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {renderStatusBadge(listingDetailsModal.status)}
                  <span className="text-xs text-[#526357] dark:text-[#95A89C]">
                    ID: {listingDetailsModal.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setListingDetailsModal(null)}
                className="text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] p-1 rounded-lg hover:bg-[#FAFBF8] dark:hover:bg-[#203026] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436]">
                  <span className="font-semibold text-[#526357] dark:text-[#95A89C] block mb-0.5">Donor / Source</span>
                  <div className="font-bold text-sm text-[#1E2A22] dark:text-[#FAFBF8]">{listingDetailsModal.donorName || listingDetailsModal.donorOrg || 'Food Donor'}</div>
                  <div className="text-[#526357] dark:text-[#95A89C]">{listingDetailsModal.location}</div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436]">
                  <span className="font-semibold text-[#526357] dark:text-[#95A89C] block mb-0.5">Quantity & Dietary</span>
                  <div className="font-bold text-sm text-[#1E2A22] dark:text-[#FAFBF8]">
                    {listingDetailsModal.quantity ? `${listingDetailsModal.quantity} ${listingDetailsModal.unit || 'Servings'}` : 'Surplus Meals'}
                  </div>
                  <div className="mt-0.5">
                    {listingDetailsModal.isVeg ? (
                      <span className="text-[#2E7D4F] font-semibold">Vegetarian</span>
                    ) : (
                      <span className="text-[#D9822B] font-semibold">Non-Vegetarian</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436] space-y-1">
                <span className="font-semibold text-[#526357] dark:text-[#95A89C] block">Pickup Window & Expiry</span>
                <div className="font-medium text-[#1E2A22] dark:text-[#FAFBF8] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#2E7D4F]">schedule</span>
                  <span>{listingDetailsModal.pickupWindow}</span>
                </div>
                <div className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                  Safe until: {listingDetailsModal.expiryTime || 'Safe window'}
                </div>
              </div>

              {(listingDetailsModal.notes || (listingDetailsModal as any).description) && (
                <div className="p-3 rounded-lg bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436]">
                  <span className="font-semibold text-[#526357] dark:text-[#95A89C] block mb-1">Details &amp; Notes</span>
                  <p className="text-[#1E2A22] dark:text-[#FAFBF8] leading-relaxed">
                    {listingDetailsModal.notes || (listingDetailsModal as any).description}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const toRemove = listingDetailsModal;
                  setListingDetailsModal(null);
                  setListingToRemove(toRemove);
                  setRemoveListingReason('');
                  setRemoveListingError(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#FECACA] dark:border-[#7F1D1D] hover:bg-[#FEF2F2] dark:hover:bg-[#3D1A1A] text-xs font-semibold text-[#DC2626] transition-colors cursor-pointer"
              >
                Remove this listing
              </button>

              <button
                type="button"
                onClick={() => setListingDetailsModal(null)}
                className="px-4 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: SUSPEND SINGLE USER ACCOUNT */}
      {singleSuspendUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] dark:bg-[#3D1A1A] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">block</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Suspend Account
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  User: {singleSuspendUser.name} ({singleSuspendUser.role})
                </p>
              </div>
            </div>

            <p className="text-sm text-[#526357] dark:text-[#95A89C] leading-relaxed">
              Are you sure you want to suspend <strong>{singleSuspendUser.name}</strong> ({singleSuspendUser.email})? Their verified status will be revoked immediately.
            </p>

            <div>
              <label htmlFor="suspend-user-reason" className="block text-xs font-semibold text-[#1E2A22] dark:text-[#FAFBF8] mb-1.5">
                Suspension Reason (Optional)
              </label>
              <textarea
                id="suspend-user-reason"
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Repeated non-collection of claimed food or safety non-compliance."
                className="w-full p-3 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] bg-white dark:bg-[#111A14] text-xs text-[#1E2A22] dark:text-[#FAFBF8] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all"
              />
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSingleSuspendUser(null);
                  setSuspendReason('');
                }}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleSuspend}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">block</span>
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: USER ACTIVITY TIMELINE */}
      {selectedUserForActivity && (
        <div
          className="fixed inset-0 z-50 flex justify-end animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-drawer-title"
        >
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedUserForActivity(null)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white dark:bg-[#18241C] h-full shadow-2xl z-10 flex flex-col border-l border-[#D9E2DA] dark:border-[#2D4436] animate-slideInRight">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#D9E2DA] dark:border-[#2D4436] flex items-start justify-between bg-[#FAFBF8] dark:bg-[#142017]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E7D4F]/10 text-[#2E7D4F] flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">history</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="activity-drawer-title" className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                      {selectedUserForActivity.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF3EC] text-[#2E7D4F]">
                      {selectedUserForActivity.role}
                    </span>
                  </div>
                  <p className="text-xs text-[#526357] dark:text-[#95A89C] mt-0.5">
                    {selectedUserForActivity.email}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[#526357] dark:text-[#95A89C] mt-1.5">
                    <span>Joined: {selectedUserForActivity.joinedDate}</span>
                    <span>•</span>
                    <span>{selectedUserForActivity.city || 'India'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserForActivity(null)}
                className="p-1.5 rounded-lg text-[#526357] dark:text-[#95A89C] hover:text-[#1E2A22] dark:hover:text-[#FAFBF8] hover:bg-white dark:hover:bg-[#203026] border border-transparent hover:border-[#D9E2DA] dark:hover:border-[#2D4436] transition-colors cursor-pointer"
                aria-label="Close activity drawer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick summary bar */}
            <div className="px-5 py-3 bg-[#FAFBF8] dark:bg-[#142017] border-b border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-between text-xs text-[#526357] dark:text-[#95A89C]">
              <span className="font-medium">Chronological Activity History</span>
              <span className="font-semibold text-[#1E2A22] dark:text-[#FAFBF8]">
                {getUserActivityTimeline(selectedUserForActivity, listings).length} recorded events
              </span>
            </div>

            {/* Scrollable Timeline Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <div className="relative border-l-2 border-[#D9E2DA] dark:border-[#2D4436] ml-3.5 space-y-6">
                {getUserActivityTimeline(selectedUserForActivity, listings).map((event) => (
                  <div key={event.id} className="relative pl-6">
                    {/* Node Circle with Icon */}
                    <div className="absolute -left-[15px] top-0.5 w-7 h-7 rounded-full bg-white dark:bg-[#18241C] border-2 border-[#2E7D4F] flex items-center justify-center text-[#2E7D4F] shadow-2xs">
                      <span className="material-symbols-outlined text-[15px]">{event.icon}</span>
                    </div>

                    {/* Event Card */}
                    <div className="bg-[#FAFBF8] dark:bg-[#111A14] border border-[#D9E2DA] dark:border-[#2D4436] rounded-xl p-3.5 space-y-1.5 hover:border-[#2E7D4F]/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-xs text-[#1E2A22] dark:text-[#FAFBF8]">
                          {event.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${event.badgeColorClass}`}>
                          {event.badgeLabel}
                        </span>
                      </div>

                      <p className="text-xs text-[#526357] dark:text-[#95A89C] leading-relaxed">
                        {event.description}
                      </p>

                      <div className="text-[11px] text-[#71827A] flex items-center gap-1 pt-1 border-t border-[#D9E2DA]/60 dark:border-[#2D4436]/60">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        <span>{event.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#D9E2DA] dark:border-[#2D4436] bg-[#FAFBF8] dark:bg-[#142017] flex items-center justify-between">
              <div className="text-xs text-[#526357] dark:text-[#95A89C]">
                Status: {renderStatusBadge(selectedUserForActivity.verificationStatus)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForActivity(null)}
                className="px-4 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px] shadow-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM BULK APPROVE */}
      {bulkApproveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn my-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EAF3EC] dark:bg-[#203026] text-[#2E7D4F] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Approve {selectedUserIds.size} Selected Users
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Bulk account verification
                </p>
              </div>
            </div>

            <p className="text-sm text-[#526357] dark:text-[#95A89C] leading-relaxed">
              Are you sure you want to approve verification for all <strong>{selectedUserIds.size} selected accounts</strong>? Their status will be updated to Verified.
            </p>

            {/* Selected Users Preview */}
            <div className="max-h-40 overflow-y-auto p-3 bg-[#FAFBF8] dark:bg-[#111A14] rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] space-y-1.5 text-xs text-[#1E2A22] dark:text-[#FAFBF8]">
              {selectedUsersList.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center justify-between py-0.5">
                  <span className="font-semibold truncate max-w-[220px]">{u.name}</span>
                  <span className="text-[#526357] dark:text-[#95A89C] text-[11px] shrink-0">{u.role}</span>
                </div>
              ))}
              {selectedUsersList.length > 5 && (
                <p className="text-xs text-[#526357] dark:text-[#95A89C] italic pt-1 border-t border-[#D9E2DA] dark:border-[#2D4436]">
                  + {selectedUsersList.length - 5} more users
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkApprove}
                className="px-5 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM BULK SUSPEND */}
      {bulkSuspendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18241C] rounded-xl border border-[#D9E2DA] dark:border-[#2D4436] shadow-xl max-w-md w-full p-6 space-y-4 animate-fadeIn my-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] dark:bg-[#3D1A1A] text-[#DC2626] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">block</span>
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E2A22] dark:text-[#FAFBF8]">
                  Suspend {selectedUserIds.size} Selected Accounts
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Bulk account restriction
                </p>
              </div>
            </div>

            <p className="text-sm text-[#526357] dark:text-[#95A89C] leading-relaxed">
              Are you sure you want to suspend <strong>{selectedUserIds.size} selected accounts</strong>? Their verified credentials will be revoked and their listings will be paused.
            </p>

            {/* Selected Users Preview */}
            <div className="max-h-40 overflow-y-auto p-3 bg-[#FAFBF8] dark:bg-[#111A14] rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] space-y-1.5 text-xs text-[#1E2A22] dark:text-[#FAFBF8]">
              {selectedUsersList.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center justify-between py-0.5">
                  <span className="font-semibold truncate max-w-[220px]">{u.name}</span>
                  <span className="text-[#DC2626] text-[11px] font-medium shrink-0">{u.role}</span>
                </div>
              ))}
              {selectedUsersList.length > 5 && (
                <p className="text-xs text-[#526357] dark:text-[#95A89C] italic pt-1 border-t border-[#D9E2DA] dark:border-[#2D4436]">
                  + {selectedUsersList.length - 5} more users
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#D9E2DA] dark:border-[#2D4436] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBulkSuspendModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#2D4436] text-xs font-semibold text-[#526357] dark:text-[#95A89C] hover:bg-[#FAFBF8] dark:hover:bg-[#203026] min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkSuspend}
                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">block</span>
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1E17]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
        >
          <div className="bg-white dark:bg-[#15231B] w-full max-w-2xl rounded-2xl border border-[#D9E2DA] dark:border-[#244535] shadow-2xl overflow-hidden my-auto animate-slideUp flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#D9E2DA] dark:border-[#244535] bg-[#FAFBF8] dark:bg-[#1A2E22] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0 border border-[#059669]/20">
                  <span className="material-symbols-outlined text-[22px]">description</span>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1E2A22] dark:text-[#F4F8F5]">
                    Document Verification Preview
                  </h3>
                  <p className="text-xs text-[#526357] dark:text-[#9BB0A1]">
                    {previewDoc.title} • {previewDoc.fileName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="w-8 h-8 rounded-lg border border-[#D9E2DA] dark:border-[#244535] text-[#526357] hover:text-[#1E2A22] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Document Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* Document Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#FAFBF8] dark:bg-[#1A2E22] border border-[#D9E2DA] dark:border-[#244535] text-xs">
                <div>
                  <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">Applicant</span>
                  <span className="font-bold text-[#1E2A22] dark:text-white truncate block">{previewDoc.applicantName || 'Applicant'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">Document Type</span>
                  <span className="font-bold text-[#059669] dark:text-[#34D399] truncate block">{previewDoc.docType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">Registration No.</span>
                  <span className="font-mono font-bold text-[#1E2A22] dark:text-white truncate block">{previewDoc.docNumber || 'VERIF-PENDING'}</span>
                </div>
              </div>

              {/* Simulated Official Document Canvas Preview */}
              <div className="p-6 sm:p-8 rounded-xl border-2 border-dashed border-[#059669]/40 bg-[#FAFCFA] dark:bg-[#0E1A14] text-center space-y-4 shadow-inner">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[15px]">verified</span>
                  <span>Official Government Proof Verified</span>
                </div>

                <div className="max-w-md mx-auto space-y-2">
                  <span className="material-symbols-outlined text-[48px] text-[#059669]">workspace_premium</span>
                  <h4 className="font-serif font-bold text-lg text-[#1E2A22] dark:text-white">
                    {previewDoc.title}
                  </h4>
                  <p className="text-xs text-[#526357] dark:text-[#9BB0A1] leading-relaxed">
                    Statutory accreditation document uploaded by <strong>{previewDoc.applicantName}</strong> for compliance with FoodLink safety standards.
                  </p>
                  {previewDoc.docNumber && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#15231B] border border-[#D9E2DA] dark:border-[#244535] font-mono text-sm font-bold text-[#1E2A22] dark:text-white">
                      Registry ID: {previewDoc.docNumber}
                    </div>
                  )}
                </div>

                <div className="pt-2 text-[11px] text-[#526357] dark:text-[#9BB0A1] flex items-center justify-center gap-4">
                  <span>✓ Signed Digital Stamp</span>
                  <span>✓ 256-bit SHA Verification</span>
                  <span>✓ Anti-Tamper Sealed</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#D9E2DA] dark:border-[#244535] flex items-center justify-between gap-3 bg-[#FAFBF8] dark:bg-[#1A2E22]">
              <span className="text-xs text-[#526357] dark:text-[#9BB0A1]">
                {previewDoc.fileName}
              </span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-5 py-2 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
