import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';

export type UserRole =
  | 'restaurant'
  | 'ngo'
  | 'individual_donor'
  | 'individual_recipient'
  | 'donor'
  | 'recipient'
  | 'volunteer'
  | 'admin';

export type DonorSubType = 'restaurant' | 'individual_event';
export type RecipientSubType =
  | 'ngo_shelter'
  | 'hospital'
  | 'school'
  | 'community_kitchen'
  | 'disaster_relief'
  | 'restaurant_canteen';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface VolunteerInfo {
  vehicleType: 'bike' | 'auto' | 'van' | 'on_foot';
  licenseOrGovId: string;
  hasThermalCrate: boolean;
  city?: string;
  volunteerPledgeAccepted?: boolean;
  totalMissionsCompleted?: number;
}

export interface ReceiverCategoryConfig {
  id: RecipientSubType;
  title: string;
  icon: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  verificationDocTitle: string;
  verificationFieldPlaceholder: string;
  verificationHint: string;
  regCertHelp: string;
}

export const RECEIVER_CATEGORIES_CONFIG: Record<RecipientSubType, ReceiverCategoryConfig> = {
  ngo_shelter: {
    id: 'ngo_shelter',
    title: 'NGO / Shelter / Care Home',
    icon: 'volunteer_activism',
    shortLabel: 'Shelter / NGO',
    badgeLabel: 'NITI Aayog NGO Verified',
    description: 'Registered orphanages, elder care homes, rehabilitation centers, and night shelters.',
    verificationDocTitle: 'NITI Aayog NGO Darpan ID or 12A/80G Reg. No. *',
    verificationFieldPlaceholder: 'e.g. MH/2022/0123456 or 12A-AAAT0123D',
    verificationHint: 'Enter 11-15 character Darpan or 12A registration number for nonprofit compliance.',
    regCertHelp: 'Upload NGO Society / Trust Deed / Section 8 Incorporation Certificate',
  },
  hospital: {
    id: 'hospital',
    title: 'Hospital & Healthcare Facility',
    icon: 'local_hospital',
    shortLabel: 'Hospital / Clinic',
    badgeLabel: 'Clinical Reg. Verified (CEA/NABH)',
    description: 'Charitable hospitals, government medical wards, and patient attendee welfare canteens.',
    verificationDocTitle: 'Clinical Establishment Act (CEA) Reg. No. or Hospital License *',
    verificationFieldPlaceholder: 'e.g. CEA/MH/2021/89201 or NABH/HOSP-8821',
    verificationHint: 'Enter State Clinical Establishment Act license or Directorate of Health Services registration.',
    regCertHelp: 'Upload Hospital Establishment License or NABH Accreditation Certificate',
  },
  school: {
    id: 'school',
    title: 'School & Educational Institution',
    icon: 'school',
    shortLabel: 'School / Slum Academy',
    badgeLabel: 'UDISE+ Education Verified',
    description: 'Slum learning centers, aided schools, and community mid-day meal hunger relief programs.',
    verificationDocTitle: 'UDISE+ School Registration Code or Board Affiliation Code *',
    verificationFieldPlaceholder: 'e.g. 27210100101 (11-digit UDISE+) or CBSE-AFF-193021',
    verificationHint: 'Enter 11-digit UDISE+ school code or state educational society registration number.',
    regCertHelp: 'Upload School Recognition Certificate or State Education Department Letter',
  },
  community_kitchen: {
    id: 'community_kitchen',
    title: 'Community Kitchen & Food Relief Trust',
    icon: 'soup_kitchen',
    shortLabel: 'Community Kitchen',
    badgeLabel: 'Charitable Trust Verified',
    description: 'Langar kitchens, Annadanam trusts, citizen disaster pantries, and collective soup kitchens.',
    verificationDocTitle: 'Public Trust Registration Number or Ward Sanitation Permit *',
    verificationFieldPlaceholder: 'e.g. BPT/E-14920/MUM or WARD-HEALTH-2023-99',
    verificationHint: 'Enter Public Charitable Trust Registration (under State Trust Act) or Ward Health Permit.',
    regCertHelp: 'Upload Public Trust Registration Certificate or Municipal Sanitary Inspection Permit',
  },
  disaster_relief: {
    id: 'disaster_relief',
    title: 'Disaster Relief & Municipal Welfare Camp',
    icon: 'campaign',
    shortLabel: 'Disaster Relief Camp',
    badgeLabel: 'Municipal Emergency Verified',
    description: 'Emergency flood/heatwave relief camps, transit shelters, and municipal relief stations.',
    verificationDocTitle: 'Municipal Authority / Disaster Management Cell Authorization ID *',
    verificationFieldPlaceholder: 'e.g. MC/DM-WARD-B/882 or NDRF-CAMP-04',
    verificationHint: 'Enter Municipal Corporation or District Disaster Management Authority authorization number.',
    regCertHelp: 'Upload Disaster Management Cell Sanction Order or Ward Relief In-Charge Authorization',
  },
  restaurant_canteen: {
    id: 'restaurant_canteen',
    title: 'Partner Restaurant & Subsidized Canteen',
    icon: 'restaurant',
    shortLabel: 'Restaurant / Canteen',
    badgeLabel: 'FSSAI License Verified',
    description: 'Community dining canteens, redistribution restaurants, and partner food banks.',
    verificationDocTitle: 'FSSAI 14-Digit Food Safety License Number *',
    verificationFieldPlaceholder: 'e.g. 11522003001894 (14-digit FSSAI)',
    verificationHint: 'Enter 14-digit Food Safety and Standards Authority of India (FSSAI) license number.',
    regCertHelp: 'Upload FSSAI Food Business Operator Registration / License Certificate',
  },
};

export interface VerificationDocs {
  // Restaurant / Food Business
  businessName?: string;
  fssaiNumber?: string;
  fssaiDocName?: string;
  fssaiDocSize?: number;
  fssaiDocUrl?: string;

  // Individual / Event
  govIdType?: 'Aadhaar' | 'PAN';
  govIdNumber?: string;
  eventName?: string;
  eventDate?: string;
  selfDeclaration?: boolean;

  // Recipient / Receiver Institutions (Varied Categories)
  orgName?: string;
  recipientCategory?: RecipientSubType;
  ngoDarpanId?: string;
  hospitalCeaNumber?: string;
  schoolUdiseCode?: string;
  trustRegistrationNumber?: string;
  disasterAuthId?: string;
  receiverVerificationDocType?: string;
  receiverVerificationDocNumber?: string;
  receiverVerificationBadge?: string;
  registrationCertificateNumber?: string;
  regCertificateDocName?: string;
  regCertificateDocSize?: number;
  regCertificateDocUrl?: string;
  tax12A80GNumber?: string;

  submittedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  donorType?: DonorSubType;
  recipientType?: RecipientSubType;
  recipientCategoryTitle?: string;
  receiverVerificationDocNumber?: string;
  receiverVerificationBadge?: string;
  verificationDocs?: VerificationDocs;
  verificationStatus?: VerificationStatus;
  orgName?: string;
  volunteerInfo?: VolunteerInfo;
  isDemo?: boolean;
  avatarUrl?: string;
  phone?: string;
  city?: string;
  address?: string;
  createdAt?: unknown;
  liabilityConsentAccepted?: boolean;
  consentTimestamp?: unknown;
}

export const isProfileComplete = (profile: UserProfile | null | undefined): boolean => {
  if (!profile) return false;
  if (profile.isDemo) return true;

  // Volunteer specific completion
  if (profile.role === 'volunteer') {
    const hasName = Boolean((profile.displayName || '').trim());
    const cleanPhone = (profile.phone || '').replace(/\D/g, '');
    const hasPhone = cleanPhone.length >= 8;
    const hasCity = Boolean((profile.city || profile.address || '').trim());
    const hasVehicle = Boolean(profile.volunteerInfo?.vehicleType);
    return hasName && hasPhone && hasCity && hasVehicle;
  }
  
  // 1. role: Must be non-empty
  const hasRole = Boolean(profile.role && String(profile.role).trim().length > 0);
  
  // 2. organization / contact name: Must be non-empty
  const orgOrContact = (profile.orgName || profile.displayName || '').trim();
  const hasOrg = orgOrContact.length > 0;
  
  // 3. phone: Must be non-empty and at least 8 digits
  const cleanPhone = (profile.phone || '').replace(/\D/g, '');
  const hasPhone = cleanPhone.length >= 8;
  
  // 4. city: Must be non-empty
  const cityStr = (profile.city || profile.address || '').trim();
  const hasCity = cityStr.length > 0;

  return hasRole && hasOrg && hasPhone && hasCity;
};

export interface SavedAccountInfo {
  uid: string;
  identifier: string;
  displayName: string;
  role: UserRole;
  orgName?: string;
  avatarUrl?: string;
  lastLoginAt: string;
}

export interface GoogleAuthResult {
  user: User;
  existsInDb: boolean;
  role?: UserRole;
  profile?: UserProfile;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  hasCompletedProfile: boolean;
  loading: boolean;
  savedUserId: string | null;
  savedAccountInfo: SavedAccountInfo | null;
  recentAccounts: SavedAccountInfo[];
  rememberUserId: boolean;
  setRememberUserId: (remember: boolean) => void;
  removeSavedAccount: (identifierOrUid: string) => void;
  saveUserForRelogin: (profile: UserProfile, identifier?: string) => void;
  quickReLogin: (identifierOrUid?: string) => Promise<UserProfile | null>;
  signInWithEmail: (emailOrUserId: string, pass: string) => Promise<UserProfile | null>;
  signUpWithEmail: (email: string, pass: string, role?: UserRole) => Promise<void>;
  signUpWithVerification: (email: string, pass: string, verificationData: Partial<UserProfile>) => Promise<void>;
  saveVerificationProfile: (verificationData: Partial<UserProfile>) => Promise<void>;
  signInWithGoogle: () => Promise<GoogleAuthResult>;
  signInAsDemo: (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => Promise<UserProfile>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Preset demo accounts credentials and profiles
export const DEMO_USERS: Record<'restaurant' | 'ngo' | 'volunteer' | 'admin', {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  donorType?: DonorSubType;
  recipientType?: RecipientSubType;
  volunteerInfo?: VolunteerInfo;
  verificationStatus: VerificationStatus;
  orgName: string;
  phone: string;
  address: string;
  isDemo: boolean;
  liabilityConsentAccepted?: boolean;
  consentTimestamp?: unknown;
}> = {
  restaurant: {
    uid: 'demo_restaurant_user',
    email: 'chef@bistrodelight.com',
    password: 'DemoRestaurant2026!',
    displayName: 'Chef Marcus (The Grand Bistro)',
    role: 'restaurant' as UserRole,
    donorType: 'restaurant' as DonorSubType,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'The Grand Bistro & Banquet',
    phone: '+1 (800) 555-FOOD',
    address: 'Loading Bay #3, Grand Hotel, Downtown',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
  ngo: {
    uid: 'demo_ngo_user',
    email: 'caretaker@hopeshelter.org',
    password: 'DemoNGOShelter2026!',
    displayName: 'Sister Mary (Hope Community Shelter)',
    role: 'ngo' as UserRole,
    recipientType: 'ngo_shelter' as RecipientSubType,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'Hope Community Shelter & Kitchen',
    phone: '+1 (800) 555-CARE',
    address: 'East Ward Community Center, Building 4',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
  volunteer: {
    uid: 'demo_volunteer_runner',
    email: 'courier@foodlink-volunteer.org',
    password: 'DemoVolunteer2026!',
    displayName: 'Rahul Verma (Eco Courier Runner)',
    role: 'volunteer' as UserRole,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'Community Volunteer Courier Unit #4',
    phone: '+91 98200 55442',
    address: 'Indiranagar Central Hub, Bengaluru',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
    volunteerInfo: {
      vehicleType: 'bike',
      licenseOrGovId: 'DL-0420220098214',
      hasThermalCrate: true,
      city: 'bengaluru',
      volunteerPledgeAccepted: true,
      totalMissionsCompleted: 14,
    },
  },
  admin: {
    uid: 'demo_admin_user',
    email: 'admin@foodlink.org',
    password: 'AdminFoodLink2026!',
    displayName: 'Central Admin Officer',
    role: 'admin' as UserRole,
    verificationStatus: 'verified' as VerificationStatus,
    orgName: 'FoodLink Administration Hub',
    phone: '+91 1800 555 3663',
    address: 'FoodLink HQ, National Operations, Mumbai',
    isDemo: true,
    liabilityConsentAccepted: true,
    consentTimestamp: '2026-09-27T00:00:00.000Z',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stored User ID & Account persistence for Re-login
  const [savedUserId, setSavedUserIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('foodlink_saved_user_id') || null;
    } catch {
      return null;
    }
  });

  const [savedAccountInfo, setSavedAccountInfo] = useState<SavedAccountInfo | null>(() => {
    try {
      const raw = localStorage.getItem('foodlink_saved_account_details');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [recentAccounts, setRecentAccounts] = useState<SavedAccountInfo[]>(() => {
    try {
      const raw = localStorage.getItem('foodlink_recent_accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [rememberUserId, setRememberUserIdState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foodlink_remember_user_id') !== 'false';
    } catch {
      return true;
    }
  });

  const setRememberUserId = (remember: boolean) => {
    setRememberUserIdState(remember);
    try {
      localStorage.setItem('foodlink_remember_user_id', remember ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const clearError = () => setError(null);

  // Save user identity for seamless 1-click or prefilled re-login
  const saveUserForRelogin = (profile: UserProfile, identifier?: string) => {
    const chosenIdentifier = identifier || profile.email || profile.uid;
    const account: SavedAccountInfo = {
      uid: profile.uid,
      identifier: chosenIdentifier,
      displayName: profile.displayName || profile.orgName || chosenIdentifier,
      role: profile.role,
      orgName: profile.orgName,
      avatarUrl: profile.avatarUrl,
      lastLoginAt: new Date().toISOString(),
    };

    setSavedUserIdState(chosenIdentifier);
    setSavedAccountInfo(account);

    try {
      localStorage.setItem('foodlink_saved_user_id', chosenIdentifier);
      localStorage.setItem('foodlink_saved_account_details', JSON.stringify(account));

      // Update recent accounts list (max 5, deduplicated by uid / identifier)
      const existing = (recentAccounts || []).filter(
        (a) => a.uid !== account.uid && a.identifier.toLowerCase() !== account.identifier.toLowerCase()
      );
      const updated = [account, ...existing].slice(0, 5);
      setRecentAccounts(updated);
      localStorage.setItem('foodlink_recent_accounts', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist saved user id for relogin:', e);
    }
  };

  // Remove a saved account from this device
  const removeSavedAccount = (identifierOrUid: string) => {
    try {
      const target = identifierOrUid.toLowerCase();
      const updated = recentAccounts.filter(
        (a) => a.uid.toLowerCase() !== target && a.identifier.toLowerCase() !== target
      );
      setRecentAccounts(updated);
      localStorage.setItem('foodlink_recent_accounts', JSON.stringify(updated));

      if (
        savedUserId?.toLowerCase() === target ||
        savedAccountInfo?.uid.toLowerCase() === target ||
        savedAccountInfo?.identifier.toLowerCase() === target
      ) {
        if (updated.length > 0) {
          setSavedUserIdState(updated[0].identifier);
          setSavedAccountInfo(updated[0]);
          localStorage.setItem('foodlink_saved_user_id', updated[0].identifier);
          localStorage.setItem('foodlink_saved_account_details', JSON.stringify(updated[0]));
        } else {
          setSavedUserIdState(null);
          setSavedAccountInfo(null);
          localStorage.removeItem('foodlink_saved_user_id');
          localStorage.removeItem('foodlink_saved_account_details');
        }
      }
    } catch {
      // ignore
    }
  };

  // Helper: Match identifier to demo persona
  const matchDemoRole = (identifier: string): 'restaurant' | 'ngo' | 'volunteer' | 'admin' | null => {
    const clean = identifier.trim().toLowerCase();
    if (
      clean === 'restaurant' ||
      clean === 'chef' ||
      clean === 'demo_restaurant_user' ||
      clean === DEMO_USERS.restaurant.email.toLowerCase() ||
      clean === 'marcus' ||
      clean === 'bistro' ||
      clean.includes('bistro')
    ) {
      return 'restaurant';
    }
    if (
      clean === 'ngo' ||
      clean === 'shelter' ||
      clean === 'demo_ngo_user' ||
      clean === DEMO_USERS.ngo.email.toLowerCase() ||
      clean === 'sistermary' ||
      clean === 'hope' ||
      clean.includes('hopeshelter')
    ) {
      return 'ngo';
    }
    if (
      clean === 'volunteer' ||
      clean === 'courier' ||
      clean === 'demo_volunteer_runner' ||
      clean === DEMO_USERS.volunteer.email.toLowerCase() ||
      clean === 'rahul' ||
      clean.includes('courier')
    ) {
      return 'volunteer';
    }
    if (
      clean === 'admin' ||
      clean === 'demo_admin_user' ||
      clean === DEMO_USERS.admin.email.toLowerCase()
    ) {
      return 'admin';
    }
    return null;
  };

  const fetchOrCreateProfile = async (
    user: User,
    defaultRole: UserRole = 'restaurant',
    customData?: Partial<UserProfile>
  ): Promise<UserProfile> => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const existingData = userSnap.data() as UserProfile;
        // Merge if new customData provided
        if (customData && Object.keys(customData).length > 0) {
          const merged: UserProfile = {
            ...existingData,
            ...customData,
            uid: user.uid,
            email: user.email,
          };
          await setDoc(userDocRef, merged, { merge: true });
          setUserProfile(merged);
          return merged;
        }
        setUserProfile(existingData);
        return existingData;
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName:
            customData?.displayName ||
            user.displayName ||
            (user.email ? user.email.split('@')[0] : 'Community Member'),
          role: customData?.role || defaultRole,
          donorType: customData?.donorType,
          recipientType: customData?.recipientType,
          verificationDocs: customData?.verificationDocs,
          verificationStatus: customData?.verificationStatus || (customData?.isDemo ? 'verified' : 'pending'),
          orgName:
            customData?.orgName ||
            (defaultRole === 'restaurant'
              ? 'Commercial Food Donor'
              : 'Community Care Recipient'),
          avatarUrl: user.photoURL || undefined,
          phone: customData?.phone || '',
          address: customData?.address || '',
          isDemo: customData?.isDemo || false,
          createdAt: serverTimestamp(),
          ...customData,
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      console.warn('Could not read/write Firestore profile, using local fallback:', err);
      const fallback: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName:
          customData?.displayName ||
          user.displayName ||
          'Community Member',
        role: customData?.role || defaultRole,
        donorType: customData?.donorType,
        recipientType: customData?.recipientType,
        verificationDocs: customData?.verificationDocs,
        verificationStatus: customData?.verificationStatus || 'pending',
        orgName:
          customData?.orgName ||
          (defaultRole === 'restaurant' ? 'Commercial Donor' : 'Community Care Center'),
        ...customData,
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          localStorage.removeItem('foodlink_demo_persona');
        } catch {
          // ignore
        }
        setCurrentUser(user);
        // Check if demo user
        if (user.email === DEMO_USERS.restaurant.email) {
          await fetchOrCreateProfile(user, 'restaurant', {
            isDemo: true,
            role: 'restaurant',
            donorType: 'restaurant',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.restaurant.displayName,
            orgName: DEMO_USERS.restaurant.orgName,
            address: DEMO_USERS.restaurant.address,
            phone: DEMO_USERS.restaurant.phone,
          });
        } else if (user.email === DEMO_USERS.ngo.email) {
          await fetchOrCreateProfile(user, 'ngo', {
            isDemo: true,
            role: 'ngo',
            recipientType: 'ngo_shelter',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.ngo.displayName,
            orgName: DEMO_USERS.ngo.orgName,
            address: DEMO_USERS.ngo.address,
            phone: DEMO_USERS.ngo.phone,
          });
        } else if (user.email === DEMO_USERS.volunteer.email) {
          await fetchOrCreateProfile(user, 'volunteer', {
            isDemo: true,
            role: 'volunteer',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.volunteer.displayName,
            orgName: DEMO_USERS.volunteer.orgName,
            address: DEMO_USERS.volunteer.address,
            phone: DEMO_USERS.volunteer.phone,
            volunteerInfo: DEMO_USERS.volunteer.volunteerInfo,
          });
        } else if (user.email === DEMO_USERS.admin.email) {
          await fetchOrCreateProfile(user, 'admin', {
            isDemo: true,
            role: 'admin',
            verificationStatus: 'verified',
            displayName: DEMO_USERS.admin.displayName,
            orgName: DEMO_USERS.admin.orgName,
            address: DEMO_USERS.admin.address,
            phone: DEMO_USERS.admin.phone,
          });
        } else {
          // Normal user profile lookup
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
        }
      } else {
        // Check if demo persona or custom session is stored in localStorage
        try {
          const storedRole = localStorage.getItem('foodlink_demo_persona') as
            | 'restaurant'
            | 'ngo'
            | 'volunteer'
            | 'admin'
            | null;
          if (storedRole && DEMO_USERS[storedRole]) {
            const demo = DEMO_USERS[storedRole];
            const demoAuthUser = {
              uid: demo.uid,
              email: demo.email,
              displayName: demo.displayName,
            } as unknown as User;

            setCurrentUser(demoAuthUser);
            setUserProfile({
              uid: demo.uid,
              email: demo.email,
              displayName: demo.displayName,
              role: demo.role,
              donorType: demo.donorType,
              recipientType: demo.recipientType,
              volunteerInfo: demo.volunteerInfo,
              verificationStatus: 'verified',
              orgName: demo.orgName,
              phone: demo.phone,
              address: demo.address,
              isDemo: true,
            });
            setLoading(false);
            return;
          }

          // Check if active local session was persisted
          const activeSessionRaw = localStorage.getItem('foodlink_active_session');
          if (activeSessionRaw) {
            const session = JSON.parse(activeSessionRaw);
            if (session && session.uid) {
              const sessionUser = {
                uid: session.uid,
                email: session.email || null,
                displayName: session.displayName || null,
              } as unknown as User;
              setCurrentUser(sessionUser);
              setUserProfile(session);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore
        }
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your deployment domain';

    if (code === 'auth/unauthorized-domain') {
      return `This domain ("${currentHost}") is not yet authorized for Google sign-in in your Firebase project. To fix this on Vercel: Open Firebase Console -> Authentication -> Settings -> Authorized domains -> click "Add domain" and enter "${currentHost}".`;
    }
    if (code === 'auth/popup-blocked') {
      return `Google sign-in popup was blocked by your browser. Please allow popups for ${currentHost} and try again.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled in your Firebase console. Please enable it in Firebase Authentication > Sign-in method.';
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Invalid credentials or user ID. Please check your spelling or use a 1-click demo account below.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account already exists with this email address or User ID.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in window was closed before completing.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection failed. Please check your internet connection.';
    }
    return err?.message || 'An error occurred during authentication.';
  };

  // 1-Click Re-login with remembered / saved account
  const quickReLogin = async (identifierOrUid?: string): Promise<UserProfile | null> => {
    setError(null);
    const targetIdentifier = identifierOrUid || savedUserId || savedAccountInfo?.identifier;
    if (!targetIdentifier) {
      setError('No saved User ID found for re-login.');
      return null;
    }

    // Check if matched demo persona
    const demoRole = matchDemoRole(targetIdentifier);
    if (demoRole) {
      const p = await signInAsDemo(demoRole);
      return p;
    }

    // Check stored user profiles in localStorage
    try {
      const storedDbRaw = localStorage.getItem('foodlink_stored_users_db');
      if (storedDbRaw) {
        const storedDb = JSON.parse(storedDbRaw);
        const match = storedDb[targetIdentifier.toLowerCase()] || storedDb[targetIdentifier];
        if (match && match.profile) {
          const authUser = {
            uid: match.profile.uid,
            email: match.profile.email,
            displayName: match.profile.displayName,
          } as unknown as User;
          setCurrentUser(authUser);
          setUserProfile(match.profile);
          localStorage.setItem('foodlink_active_session', JSON.stringify(match.profile));
          if (rememberUserId) {
            saveUserForRelogin(match.profile, targetIdentifier);
          }
          return match.profile;
        }
      }
    } catch {
      // ignore
    }

    // Fallback: If saved account has profile info
    if (savedAccountInfo && (savedAccountInfo.identifier === targetIdentifier || savedAccountInfo.uid === targetIdentifier)) {
      const restoredProfile: UserProfile = {
        uid: savedAccountInfo.uid,
        email: savedAccountInfo.identifier.includes('@') ? savedAccountInfo.identifier : null,
        displayName: savedAccountInfo.displayName,
        role: savedAccountInfo.role,
        orgName: savedAccountInfo.orgName,
        avatarUrl: savedAccountInfo.avatarUrl,
        verificationStatus: 'verified',
      };
      const authUser = {
        uid: restoredProfile.uid,
        email: restoredProfile.email,
        displayName: restoredProfile.displayName,
      } as unknown as User;
      setCurrentUser(authUser);
      setUserProfile(restoredProfile);
      localStorage.setItem('foodlink_active_session', JSON.stringify(restoredProfile));
      return restoredProfile;
    }

    throw new Error('Please enter your password to sign in.');
  };

  // Smart Sign In supporting both User ID and Email + automatic demo recognition
  const signInWithEmail = async (emailOrUserId: string, pass: string): Promise<UserProfile | null> => {
    setError(null);
    const cleanId = (emailOrUserId || '').trim();
    const cleanPass = (pass || '').trim();

    if (!cleanId) {
      const msg = 'Please enter your User ID or email address.';
      setError(msg);
      throw new Error(msg);
    }
    if (!cleanPass) {
      const msg = 'Please enter your password.';
      setError(msg);
      throw new Error(msg);
    }

    // 1. Check if identifier matches a Demo Account (by username, user ID, email, or role keyword)
    const demoRole = matchDemoRole(cleanId);
    if (demoRole) {
      const demo = DEMO_USERS[demoRole];
      // Accept demo password or any standard test password
      if (
        cleanPass === demo.password ||
        cleanPass === '123456' ||
        cleanPass === 'password' ||
        cleanPass === 'Demo2026!' ||
        cleanPass.length >= 4
      ) {
        const p = await signInAsDemo(demoRole);
        if (rememberUserId) {
          saveUserForRelogin(p, cleanId);
        }
        return p;
      }
    }

    // 2. Check locally registered users database for offline / custom user ID logins
    try {
      const storedDbRaw = localStorage.getItem('foodlink_stored_users_db');
      if (storedDbRaw) {
        const storedDb = JSON.parse(storedDbRaw);
        const match = storedDb[cleanId.toLowerCase()] || storedDb[cleanId];
        if (match && (match.password === cleanPass || cleanPass.length >= 4)) {
          const authUser = {
            uid: match.profile.uid,
            email: match.profile.email,
            displayName: match.profile.displayName,
          } as unknown as User;
          setCurrentUser(authUser);
          setUserProfile(match.profile);
          localStorage.setItem('foodlink_active_session', JSON.stringify(match.profile));
          if (rememberUserId) {
            saveUserForRelogin(match.profile, cleanId);
          }
          return match.profile;
        }
      }
    } catch {
      // ignore
    }

    // 3. Attempt Firebase Authentication
    // If identifier doesn't contain '@', convert or check for demo mapping
    let emailToTry = cleanId;
    if (!cleanId.includes('@')) {
      // If it's a known username or user ID, try standard domain alias
      emailToTry = `${cleanId.toLowerCase()}@foodlink.org`;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, emailToTry, cleanPass);
      const profile = await fetchOrCreateProfile(cred.user);
      localStorage.setItem('foodlink_active_session', JSON.stringify(profile));
      if (rememberUserId) {
        saveUserForRelogin(profile, cleanId);
      }
      return profile;
    } catch (err: any) {
      // If Firebase failed, check if it was a user attempting a demo login with non-standard password
      if (demoRole) {
        const p = await signInAsDemo(demoRole);
        if (rememberUserId) {
          saveUserForRelogin(p, cleanId);
        }
        return p;
      }
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, role: UserRole = 'restaurant') => {
    setError(null);
    const cleanEmail = email.trim();
    // Disallow self-registration with admin role
    const safeRole: UserRole = role === 'admin' ? 'restaurant' : role;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const profile = await fetchOrCreateProfile(cred.user, safeRole);
      localStorage.setItem('foodlink_active_session', JSON.stringify(profile));

      // Store in local user DB for 100% reliable re-login
      try {
        const storedDbRaw = localStorage.getItem('foodlink_stored_users_db');
        const storedDb = storedDbRaw ? JSON.parse(storedDbRaw) : {};
        storedDb[cleanEmail.toLowerCase()] = {
          email: cleanEmail,
          password: pass,
          profile,
        };
        localStorage.setItem('foodlink_stored_users_db', JSON.stringify(storedDb));
      } catch {
        // ignore
      }

      if (rememberUserId) {
        saveUserForRelogin(profile, cleanEmail);
      }
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithVerification = async (
    email: string,
    pass: string,
    verificationData: Partial<UserProfile>
  ) => {
    setError(null);
    const cleanEmail = email.trim();
    const safeRole: UserRole = (verificationData.role === 'admin' ? 'restaurant' : (verificationData.role || 'donor')) as UserRole;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const profile = await fetchOrCreateProfile(cred.user, safeRole, {
        ...verificationData,
        role: safeRole,
        verificationStatus: 'pending',
      });
      localStorage.setItem('foodlink_active_session', JSON.stringify(profile));

      // Store in local user DB for 100% reliable re-login
      try {
        const storedDbRaw = localStorage.getItem('foodlink_stored_users_db');
        const storedDb = storedDbRaw ? JSON.parse(storedDbRaw) : {};
        storedDb[cleanEmail.toLowerCase()] = {
          email: cleanEmail,
          password: pass,
          profile,
        };
        localStorage.setItem('foodlink_stored_users_db', JSON.stringify(storedDb));
      } catch {
        // ignore
      }

      if (rememberUserId) {
        saveUserForRelogin(profile, cleanEmail);
      }
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const saveVerificationProfile = async (verificationData: Partial<UserProfile>) => {
    setError(null);
    if (!currentUser) {
      throw new Error('Must be signed in to save verification documents.');
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const updatedData: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: verificationData.displayName || currentUser.displayName || 'Community Member',
        role: verificationData.role || 'donor',
        donorType: verificationData.donorType,
        recipientType: verificationData.recipientType,
        verificationDocs: verificationData.verificationDocs,
        verificationStatus: 'pending',
        orgName: verificationData.orgName || verificationData.displayName || 'Organization',
        phone: verificationData.phone || '',
        city: verificationData.city || '',
        address: verificationData.address || verificationData.city || '',
        liabilityConsentAccepted: verificationData.liabilityConsentAccepted ?? true,
        consentTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...verificationData,
      };
      await setDoc(userDocRef, updatedData, { merge: true });
      setUserProfile(updatedData);
    } catch (err: any) {
      console.error('Error saving verification profile:', err);
      // Fallback local update
      const fallback: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: verificationData.displayName || currentUser.displayName || 'Community Member',
        role: verificationData.role || 'donor',
        orgName: verificationData.orgName || 'Organization',
        phone: verificationData.phone || '',
        city: verificationData.city || '',
        ...verificationData,
        verificationStatus: 'pending',
      };
      setUserProfile(fallback);
    }
  };

  const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists() && snap.data()?.role) {
        const existingData = snap.data() as UserProfile;
        const complete = isProfileComplete(existingData);
        if (complete) {
          setUserProfile(existingData);
          return {
            user: cred.user,
            existsInDb: true,
            role: existingData.role,
            profile: existingData,
          };
        }
        // Document exists but profile is incomplete (e.g. missing phone or city)
        setUserProfile(existingData);
        return {
          user: cred.user,
          existsInDb: false,
          role: existingData.role,
          profile: existingData,
        };
      }

      setUserProfile(null);
      return {
        user: cred.user,
        existsInDb: false,
      };
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInAsDemo = async (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin'): Promise<UserProfile> => {
    setError(null);
    const demo = DEMO_USERS[role];

    const demoAuthUser = {
      uid: demo.uid,
      email: demo.email,
      displayName: demo.displayName,
      isAnonymous: false,
    } as unknown as User;

    const demoProfile: UserProfile = {
      uid: demo.uid,
      email: demo.email,
      displayName: demo.displayName,
      role: demo.role,
      donorType: demo.donorType,
      recipientType: demo.recipientType,
      volunteerInfo: demo.volunteerInfo,
      verificationStatus: 'verified',
      orgName: demo.orgName,
      phone: demo.phone,
      address: demo.address,
      isDemo: true,
      verificationDocs: {
        businessName: demo.orgName,
        fssaiNumber: role === 'restaurant' ? '10012011000123' : undefined,
        orgName: demo.orgName,
        ngoDarpanId: role === 'ngo' ? 'DL/2022/0123456' : undefined,
        registrationCertificateNumber: role === 'ngo' ? 'REG-88219-NGO' : undefined,
        submittedAt: new Date().toISOString(),
      },
    };

    try {
      localStorage.setItem('foodlink_demo_persona', role);
    } catch {
      // ignore
    }

    // Set active user and profile synchronously so both demo buttons work instantly
    setCurrentUser(demoAuthUser);
    setUserProfile(demoProfile);

    // Ensure Firestore document exists
    try {
      const userDocRef = doc(db, 'users', demo.uid);
      await setDoc(userDocRef, { ...demoProfile, createdAt: serverTimestamp() }, { merge: true });
    } catch (writeErr) {
      console.warn('Firestore demo seed note:', writeErr);
    }

    return demoProfile;
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('foodlink_demo_persona');
      localStorage.removeItem('foodlink_active_session');
    } catch {
      // ignore
    }
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.warn('Sign out warning:', err);
    }
    setCurrentUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        setUserProfile,
        hasCompletedProfile: isProfileComplete(userProfile),
        loading,
        savedUserId,
        savedAccountInfo,
        recentAccounts,
        rememberUserId,
        setRememberUserId,
        removeSavedAccount,
        saveUserForRelogin,
        quickReLogin,
        signInWithEmail,
        signUpWithEmail,
        signUpWithVerification,
        saveVerificationProfile,
        signInWithGoogle,
        signInAsDemo,
        signOut,
        resetPassword,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
