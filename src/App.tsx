import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { AuthModal, ModalStep, ModalRole } from './AuthModal';
import { TermsPolicyModal } from './TermsPolicyModal';
import { DonorDashboard, FoodListing } from './DonorDashboard';
import { RecipientDashboard, FALLBACK_LISTINGS } from './RecipientDashboard';
import { VerificationModule } from './VerificationModule';
import { VolunteerLogistics } from './VolunteerLogistics';
import { RescueLedgerLeaderboard } from './RescueLedgerLeaderboard';
import { AdminPanel } from './AdminPanel';
import { AdminLoginPage } from './AdminLoginPage';
import { useTheme } from './ThemeContext';
import { ThemePaletteModal } from './ThemePaletteModal';
import { CookieNotice } from './CookieNotice';
import { NotFoundPage } from './NotFoundPage';
import { LegalPage } from './LegalPage';
import { FoodLinkLogo } from './FoodLinkLogo';
import { DonationLeaderboard } from './DonationLeaderboard';
import { NotificationCenter } from './NotificationCenter';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { MealRequestsHub } from './MealRequestsHub';
import { LivePickupWindowRing } from './LivePickupWindowRing';
import { useTranslation, LANGUAGES } from './LanguageContext';
import { TopDonorsTicker } from './TopDonorsTicker';
import { QrTransferModal } from './QrTransferModal';
import { HomeLeaderboardSection } from './HomeLeaderboardSection';
import { NavbarLanguageDropdown } from './NavbarLanguageDropdown';
import { CommonSignInSection } from './CommonSignInSection';

export type TabType =
  | 'home'
  | 'browse'
  | 'donor'
  | 'courier'
  | 'requests'
  | 'leaderboard'
  | 'verify'
  | 'ledger'
  | 'admin'
  | 'admin-login'
  | 'signin'
  | 'privacy'
  | 'terms'
  | '404';

export default function App() {
  const { currentUser, userProfile, signOut } = useAuth();
  const { language, setLanguage, t, languages } = useTranslation();
  const { theme, isDark, toggleTheme, paletteId, setPaletteId } = useTheme();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [pendingRedirectTab, setPendingRedirectTab] = useState<TabType | null>(null);

  // Menus state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletMoreOpen, setTabletMoreOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialRole, setAuthModalInitialRole] = useState<ModalRole | null>(null);
  const [authModalInitialStep, setAuthModalInitialStep] = useState<ModalStep | undefined>(undefined);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isGlobalQrModalOpen, setIsGlobalQrModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Community listings state (initialized with verified fallbacks so home page never renders blank white space)
  const [communityListings, setCommunityListings] = useState<FoodListing[]>(FALLBACK_LISTINGS);
  const [loadingListings, setLoadingListings] = useState<boolean>(true);
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Google Maps Platform Demo Key Quota Monitoring
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Live Local Meal Request Alert Banner for Donors
  const [activeMealRequestAlert, setActiveMealRequestAlert] = useState<{
    mealRequest: any;
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    const handleMealAlert = (e: any) => {
      if (e.detail) {
        setActiveMealRequestAlert({
          mealRequest: e.detail.mealRequest,
          title: e.detail.title,
          body: e.detail.body,
        });
      }
    };
    window.addEventListener('foodlink-meal-request-alert', handleMealAlert);
    return () => window.removeEventListener('foodlink-meal-request-alert', handleMealAlert);
  }, []);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleOpenAuth = (role: ModalRole | null = null, step?: ModalStep) => {
    setAuthModalInitialRole(role);
    setAuthModalInitialStep(step);
    setIsAuthModalOpen(true);
    setMobileMenuOpen(false);
    setTabletMoreOpen(false);
    setProfileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    showToast('Signed out successfully.');
    // If on a protected tab, navigate back to home
    if (activeTab === 'donor' || activeTab === 'courier' || activeTab === 'ledger') {
      setActiveTab('home');
      window.location.hash = 'home';
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setTabletMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Access control handler
  const handleTabClick = (tab: TabType) => {
    if (tab === 'admin') {
      if (!currentUser || userProfile?.role !== 'admin') {
        setActiveTab('admin-login');
        window.history.pushState(null, '', '/admin-login');
        window.location.hash = 'admin-login';
        setMobileMenuOpen(false);
        setTabletMoreOpen(false);
        return;
      }
      setActiveTab('admin');
      window.history.pushState(null, '', '/admin');
      window.location.hash = 'admin';
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    if (tab === 'admin-login') {
      if (currentUser && userProfile?.role === 'admin') {
        setActiveTab('admin');
        window.history.pushState(null, '', '/admin');
        window.location.hash = 'admin';
        setMobileMenuOpen(false);
        setTabletMoreOpen(false);
        return;
      }
      setActiveTab('admin-login');
      window.history.pushState(null, '', '/admin-login');
      window.location.hash = 'admin-login';
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    if (tab === 'signin') {
      if (currentUser) {
        if (userProfile?.role === 'admin') setActiveTab('admin');
        else if (userProfile?.role === 'volunteer') setActiveTab('courier');
        else if (userProfile?.role === 'ngo' || userProfile?.role === 'recipient') setActiveTab('browse');
        else setActiveTab('donor');
        setMobileMenuOpen(false);
        setTabletMoreOpen(false);
        return;
      }
      setActiveTab('signin');
      window.history.pushState(null, '', '/signin');
      window.location.hash = 'signin';
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    if (tab === 'privacy' || tab === 'terms' || tab === '404') {
      setActiveTab(tab);
      window.history.pushState(null, '', tab === '404' ? '/404' : `/${tab}`);
      window.location.hash = tab;
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }

    const isProtected = tab === 'donor' || tab === 'courier' || tab === 'ledger';
    if (isProtected && !currentUser) {
      setPendingRedirectTab(tab);
      showToast('Please sign in to use this section.');
      handleOpenAuth(tab === 'donor' ? 'donor' : null);
      setMobileMenuOpen(false);
      setTabletMoreOpen(false);
      return;
    }
    setActiveTab(tab);
    window.history.pushState(null, '', tab === 'home' ? '/' : `/#${tab}`);
    window.location.hash = tab === 'home' ? '' : tab;
    setMobileMenuOpen(false);
    setTabletMoreOpen(false);
  };

  // Sync document title and meta description per page
  useEffect(() => {
    const titles: Record<TabType, { title: string; desc: string }> = {
      home: {
        title: 'FoodLink - Direct Food Rescue & Donation Network',
        desc: 'Connect surplus prepared meals with local shelters, community kitchens, and pantries instantly with FoodLink.',
      },
      browse: {
        title: 'Browse Available Surplus Food - FoodLink',
        desc: 'Claim verified food donations in real time for orphanages, shelters, and care homes.',
      },
      donor: {
        title: 'Donor Portal - List Surplus Food - FoodLink',
        desc: 'List fresh surplus meals from restaurants, banquet halls, and food businesses safely.',
      },
      courier: {
        title: 'Volunteer Courier Hub - FoodLink',
        desc: 'Help transport and deliver inspected surplus food to community centers and shelters.',
      },
      requests: {
        title: 'NGO Hunger Needs & Community Meal Requests - FoodLink',
        desc: 'Browse and fulfill urgent community meal requests posted by verified orphanages and shelters.',
      },
      leaderboard: {
        title: 'Food Donation Leaderboard - Top Donors & Highest Scores | FoodLink',
        desc: 'Celebrate top food donors, banquet kitchens, and restaurants ranked by highest rescue score and quantity of wholesome food shared.',
      },
      verify: {
        title: 'Verification Standards & Food Checks - FoodLink',
        desc: 'Learn about FoodLink verification requirements for donors and charitable recipient organizations.',
      },
      ledger: {
        title: 'Rescue Ledger - Your Donations & Pickups - FoodLink',
        desc: 'Track and verify surplus meals rescued, claimed, and delivered across local communities.',
      },
      admin: {
        title: 'Admin Operations Panel - FoodLink',
        desc: 'Manage verification queue, listings compliance, and user records across FoodLink.',
      },
      'admin-login': {
        title: 'Admin Sign In - FoodLink',
        desc: 'Secure administrative access portal for platform verification officers and coordinators.',
      },
      signin: {
        title: 'Sign In - Common Authentication Portal | FoodLink',
        desc: 'Common sign-in portal for FoodLink. Choose your option to sign in as a food donor, community shelter recipient, voluntary courier, or administrator.',
      },
      privacy: {
        title: 'Privacy Policy - FoodLink',
        desc: 'Read how FoodLink collects, uses, and safeguards user and organizational data.',
      },
      terms: {
        title: 'Terms of Service - FoodLink',
        desc: 'Terms of service and Good Samaritan liability protections for FoodLink users.',
      },
      '404': {
        title: 'Page Not Found (404) - FoodLink',
        desc: 'The requested page could not be found on FoodLink.',
      },
    };

    const currentMeta = titles[activeTab] || titles.home;
    document.title = currentMeta.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', currentMeta.desc);
    }
  }, [activeTab]);

  // Check URL on initial load, hashchange, and popstate
  useEffect(() => {
    const checkUrlAccess = () => {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.replace('#/', '').replace('#', '').toLowerCase();

      let targetRoute: TabType = 'home';
      if (pathname === '/admin' || pathname.startsWith('/admin/') || hash === 'admin') {
        targetRoute = 'admin';
      } else if (
        pathname === '/admin-login' ||
        pathname.startsWith('/admin-login/') ||
        hash === 'admin-login'
      ) {
        targetRoute = 'admin-login';
      } else if (
        pathname === '/signin' ||
        pathname === '/login' ||
        pathname.startsWith('/signin/') ||
        pathname.startsWith('/login/') ||
        hash === 'signin' ||
        hash === 'login'
      ) {
        targetRoute = 'signin';
      } else if (pathname === '/privacy' || hash === 'privacy') {
        targetRoute = 'privacy';
      } else if (pathname === '/terms' || hash === 'terms') {
        targetRoute = 'terms';
      } else if (pathname === '/404' || hash === '404') {
        targetRoute = '404';
      } else {
        const cleanPath = pathname.replace(/^\/+/, '').split('/')[0] as TabType;
        const validTabs: TabType[] = [
          'home',
          'browse',
          'donor',
          'courier',
          'requests',
          'leaderboard',
          'verify',
          'ledger',
          'signin',
          'privacy',
          'terms',
        ];

        if (validTabs.includes(cleanPath)) {
          targetRoute = cleanPath;
        } else if (pathname === '/' || pathname === '') {
          if (validTabs.includes(hash as TabType)) {
            targetRoute = hash as TabType;
          } else if (hash && hash !== '') {
            targetRoute = '404';
          } else {
            targetRoute = 'home';
          }
        } else {
          // Unknown pathname: fallback to home gracefully instead of blank/404 if not matched
          targetRoute = 'home';
        }
      }

      if (targetRoute === 'admin') {
        if (!currentUser || userProfile?.role !== 'admin') {
          setActiveTab('admin-login');
          window.history.replaceState(null, '', '/admin-login');
          window.location.hash = 'admin-login';
        } else {
          setActiveTab('admin');
        }
        return;
      }

      if (targetRoute === 'admin-login') {
        if (currentUser && userProfile?.role === 'admin') {
          setActiveTab('admin');
          window.history.replaceState(null, '', '/admin');
          window.location.hash = 'admin';
        } else {
          setActiveTab('admin-login');
        }
        return;
      }

      if (targetRoute === 'signin') {
        if (currentUser) {
          if (userProfile?.role === 'admin') setActiveTab('admin');
          else if (userProfile?.role === 'volunteer') setActiveTab('courier');
          else if (userProfile?.role === 'ngo' || userProfile?.role === 'recipient') setActiveTab('browse');
          else setActiveTab('donor');
        } else {
          setActiveTab('signin');
        }
        return;
      }

      const isProtected = targetRoute === 'donor' || targetRoute === 'courier' || targetRoute === 'ledger';
      if (isProtected && !currentUser) {
        setPendingRedirectTab(targetRoute);
        showToast('Please sign in to use this section.');
        handleOpenAuth(targetRoute === 'donor' ? 'donor' : null);
        setActiveTab('home');
      } else {
        setActiveTab(targetRoute);
      }
    };

    checkUrlAccess();
    window.addEventListener('hashchange', checkUrlAccess);
    window.addEventListener('popstate', checkUrlAccess);
    return () => {
      window.removeEventListener('hashchange', checkUrlAccess);
      window.removeEventListener('popstate', checkUrlAccess);
    };
  }, [currentUser, userProfile]);

  // When user signs in and a pending redirect tab was clicked, redirect to it
  useEffect(() => {
    if (currentUser && pendingRedirectTab) {
      setActiveTab(pendingRedirectTab);
      window.location.hash = pendingRedirectTab;
      setPendingRedirectTab(null);
    }
  }, [currentUser, pendingRedirectTab]);

  // Real-time listener for available listings
  useEffect(() => {
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

        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        if (items.length > 0) {
          setCommunityListings(items);
        } else {
          setCommunityListings(FALLBACK_LISTINGS);
        }
        setLoadingListings(false);
      },
      (err) => {
        console.warn('Real-time listings fallback active:', err);
        setCommunityListings(FALLBACK_LISTINGS);
        setLoadingListings(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredListings = communityListings.filter((item) => {
    if (dietaryFilter === 'veg') {
      const titleLower = (item.title + ' ' + (item.notes || '')).toLowerCase();
      return (
        !titleLower.includes('chicken') &&
        !titleLower.includes('mutton') &&
        !titleLower.includes('meat') &&
        !titleLower.includes('fish') &&
        !titleLower.includes('non-veg')
      );
    }
    if (dietaryFilter === 'non-veg') {
      const titleLower = (item.title + ' ' + (item.notes || '')).toLowerCase();
      return (
        titleLower.includes('chicken') ||
        titleLower.includes('mutton') ||
        titleLower.includes('meat') ||
        titleLower.includes('fish') ||
        titleLower.includes('non-veg')
      );
    }
    return true;
  });

  const getRoleDisplayName = () => {
    if (!userProfile?.role) return 'Member';
    if (userProfile.role === 'restaurant' || userProfile.role === 'donor') return 'Donor';
    if (userProfile.role === 'ngo' || userProfile.role === 'recipient') return 'Organization';
    if (userProfile.role === 'volunteer') return 'Courier';
    if (userProfile.role === 'admin') return 'Admin';
    return userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF8] dark:bg-[#0A130E] text-[#0F1E17] dark:text-[#F4F8F5] transition-colors duration-200">
      {/* Google Maps Quota Warning Banner (Demo Key) */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#1E2A22] text-[#FAFBF8] px-4 py-3 rounded-lg text-sm font-medium shadow-md flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#2E7D4F]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Push Alert Banner for Donors: New Meal Request in Local Area */}
      {activeMealRequestAlert && (
        <div
          role="alert"
          className="fixed top-20 right-4 z-50 max-w-sm sm:max-w-md bg-white dark:bg-[#112019] border-2 border-[#059669] text-[#0F1E17] dark:text-[#F4F8F5] p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[22px]">notifications_active</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
                🔔 Local Meal Alert
              </span>
              <button
                type="button"
                onClick={() => setActiveMealRequestAlert(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-xs"
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
            <h4 className="text-xs sm:text-sm font-bold truncate">
              {activeMealRequestAlert.title}
            </h4>
            <p className="text-[11px] text-[#4B6356] dark:text-[#B2CDC0] mt-0.5 line-clamp-2">
              {activeMealRequestAlert.body}
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveMealRequestAlert(null);
                  handleTabClick('requests');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
              >
                <span>View &amp; Pledge Food</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMealRequestAlert(null)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#182C22] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      {activeTab !== 'admin' && (
        <header className="sticky top-0 z-40 bg-[#F8FAF8] dark:bg-[#0A130E] border-b border-[#D4E5DA] dark:border-[#244535]">
        <div className="site-container h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <button
            type="button"
            onClick={() => handleTabClick('home')}
            className="flex items-center text-left cursor-pointer shrink-0 transition-opacity hover:opacity-90"
            aria-label="FoodLink Homepage"
          >
            <FoodLinkLogo size="md" variant="compact" />
          </button>

          {/* Desktop Navigation (>= 1024px: all 6 links in one row, evenly spaced) */}
          <nav className="hidden lg:flex items-center gap-6">
            {/* 1. Home */}
            <button
              type="button"
              onClick={() => handleTabClick('home')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'home'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.home', 'Home')}
            </button>

            {/* 2. Browse */}
            <button
              type="button"
              onClick={() => handleTabClick('browse')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'browse'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.browse', 'Browse')}
            </button>

            {/* 3. Donor */}
            <button
              type="button"
              onClick={() => handleTabClick('donor')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'donor'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span>{t('nav.donor', 'Donor')}</span>
            </button>

            {/* 4. Courier */}
            <button
              type="button"
              onClick={() => handleTabClick('courier')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'courier'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span>{t('nav.courier', 'Courier')}</span>
            </button>

            {/* 5. NGO Hunger Requests */}
            <button
              type="button"
              onClick={() => handleTabClick('requests')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'requests'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span>{t('nav.ngoRequests', 'NGO Requests')}</span>
            </button>

            {/* 6. Leaderboard (Highest Score & Donated Quantity) */}
            <button
              type="button"
              onClick={() => handleTabClick('leaderboard')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'leaderboard'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-[#F59E0B]">military_tech</span>
              <span>{t('nav.leaderboard', 'Leaderboard')}</span>
            </button>

            {/* 6. Verify */}
            <button
              type="button"
              onClick={() => handleTabClick('verify')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'verify'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.verify', 'Verify')}
            </button>

            {/* 7. Ledger */}
            <button
              type="button"
              onClick={() => handleTabClick('ledger')}
              className={`inline-flex items-center gap-1.5 py-2 text-[15px] font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'ledger'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span>{t('nav.ledger', 'Ledger')}</span>
            </button>
          </nav>

          {/* Tablet Navigation (768px - 1023px: compact spacing with More dropdown) */}
          <nav className="hidden md:flex lg:hidden items-center gap-3.5">
            <button
              type="button"
              onClick={() => handleTabClick('home')}
              className={`py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] flex items-center ${
                activeTab === 'home'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.home', 'Home')}
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('browse')}
              className={`py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] flex items-center ${
                activeTab === 'browse'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.browse', 'Browse')}
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('donor')}
              className={`inline-flex items-center gap-1 py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'donor'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span>{t('nav.donor', 'Donor')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('leaderboard')}
              className={`inline-flex items-center gap-1 py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                activeTab === 'leaderboard'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#F59E0B]">military_tech</span>
              <span>{t('nav.leaderboard', 'Leaderboard')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabClick('verify')}
              className={`py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] flex items-center ${
                activeTab === 'verify'
                  ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                  : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
              }`}
            >
              {t('nav.verify', 'Verify')}
            </button>

            {/* More Dropdown for Courier & Ledger */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setTabletMoreOpen(!tabletMoreOpen)}
                className={`inline-flex items-center gap-1 py-1.5 text-sm font-medium transition-colors cursor-pointer border-b-2 min-h-[44px] ${
                  activeTab === 'courier' || activeTab === 'ledger' || activeTab === 'requests'
                    ? 'text-[#059669] dark:text-[#34D399] border-[#059669] dark:border-[#34D399] font-bold'
                    : 'text-[#4B6356] dark:text-[#B2CDC0] border-transparent hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
                }`}
              >
                <span>{t('nav.more', 'More')}</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>

              {tabletMoreOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-xl shadow-lg py-1.5 z-50">
                  <button
                    type="button"
                    onClick={() => handleTabClick('courier')}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] min-h-[44px] cursor-pointer ${
                      activeTab === 'courier' ? 'text-[#059669] dark:text-[#34D399] font-bold' : 'text-[#0F1E17] dark:text-[#F4F8F5]'
                    }`}
                  >
                    <span>{t('nav.courier', 'Courier')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('requests')}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] min-h-[44px] cursor-pointer ${
                      activeTab === 'requests' ? 'text-[#059669] dark:text-[#34D399] font-bold' : 'text-[#0F1E17] dark:text-[#F4F8F5]'
                    }`}
                  >
                    <span>{t('nav.ngoRequests', 'NGO Requests')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('ledger')}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] min-h-[44px] cursor-pointer ${
                      activeTab === 'ledger' ? 'text-[#059669] dark:text-[#34D399] font-bold' : 'text-[#0F1E17] dark:text-[#F4F8F5]'
                    }`}
                  >
                    <span>{t('nav.ledger', 'Ledger')}</span>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Right Action: Notifications, Theme Switcher, Language Selector, Sign In Options or Profile Menu */}
          <div className="hidden md:flex items-center gap-2">
            {/* Contactless QR Transfer Pass Button with subtle pulse animation */}
            <button
              type="button"
              onClick={() => setIsGlobalQrModalOpen(true)}
              className="relative h-9 px-3 rounded-xl border border-[#059669]/50 bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399] hover:bg-[#D1FAE5] dark:hover:bg-[#183E2C] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs text-xs font-bold animate-qr-pulse"
              aria-label="Contactless Meal Transfer Pass & Scanner"
              title="Scan or generate QR code to verify meal pickup / delivery"
            >
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400"></span>
              </span>
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>{t('nav.qrPass', 'QR Pass')}</span>
            </button>

            {/* Real-time Activity Hub & Push Notifications */}
            <NotificationCenter onNavigateTab={(tab) => handleTabClick(tab as TabType)} />

            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              <span className="material-symbols-outlined text-[19px] text-[#059669] dark:text-[#34D399]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Theme Palette Customizer Button */}
            <button
              type="button"
              onClick={() => setIsPaletteModalOpen(true)}
              className="w-9 h-9 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              aria-label="Customize theme palette"
              title="Customize theme color palette"
            >
              <span className="material-symbols-outlined text-[19px] text-amber-500">
                palette
              </span>
            </button>

            {/* Language Selector Dropdown */}
            <NavbarLanguageDropdown />

            {currentUser ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="px-3.5 py-2 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#EAF3EC] text-sm font-medium text-[#1E2A22] flex items-center gap-2 min-h-[44px] transition-colors cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[#2E7D4F]/15 text-[#2E7D4F] flex items-center justify-center font-bold text-xs">
                    {(userProfile?.displayName || currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </span>
                  <span className="truncate max-w-[120px]">
                    {userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-[#526357]">
                    expand_more
                  </span>
                </button>

                {/* Profile Menu Dropdown */}
                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-2xl shadow-xl py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2.5 border-b border-[#D1E3D7]/60 dark:border-[#244535]/60">
                      <p className="text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                        {userProfile?.displayName || currentUser.displayName || 'FoodLink Member'}
                      </p>
                      <p className="text-xs text-[#059669] dark:text-[#34D399] font-bold mt-0.5">
                        {getRoleDisplayName()}
                      </p>
                      <p className="text-xs text-[#526357] dark:text-[#95A89C] truncate mt-0.5">
                        {currentUser.email}
                      </p>
                    </div>

                    {/* Profile Milestone Badges Display */}
                    <div className="px-4 py-2.5 bg-[#F8FAF8] dark:bg-[#182C22] border-b border-[#D1E3D7]/60 dark:border-[#244535]/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#526357] dark:text-[#95A89C]">
                        <span>{t('nav.profileBadges', 'Profile Badges')}</span>
                        <span className="text-[10px] text-[#059669] dark:text-[#34D399] font-semibold">{t('nav.activeTier', 'Active Tier')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                          title="Century Rescuer: Over 100 kg of food rescued and diverted"
                        >
                          <span className="material-symbols-outlined text-[13px] text-emerald-600">workspace_premium</span>
                          <span>{t('nav.centuryRescuer', 'Century Rescuer')}</span>
                        </span>
                        {userProfile?.role === 'volunteer' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            title="Rapid Transit Courier: Fast dispatched runs"
                          >
                            <span className="material-symbols-outlined text-[12px] text-amber-600">electric_bolt</span>
                            <span>{t('nav.rapidTransit', 'Rapid')}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30"
                            title="Zero-Waste Hero: 15+ verified donations"
                          >
                            <span className="material-symbols-outlined text-[12px] text-teal-600">eco</span>
                            <span>{t('nav.zeroWaste', 'Zero Waste')}</span>
                          </span>
                        )}
                      </div>
                      <div className="pt-1">
                        <div className="flex justify-between text-[10px] text-[#526357] dark:text-[#95A89C] font-semibold">
                          <span>Next: Half-Tonne Titan</span>
                          <span>420 / 500 kg</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-0.5">
                          <div className="h-full bg-[#059669] rounded-full" style={{ width: '84%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="py-1">
                      {userProfile?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleTabClick('admin');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#2E7D4F] hover:bg-[#EAF3EC] min-h-[40px] flex items-center gap-2 font-semibold cursor-pointer border-b border-[#D9E2DA]/60"
                        >
                          <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                          <span>{t('nav.adminPanel', 'Admin panel')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('donor');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#526357] hover:text-[#1E2A22] hover:bg-[#EAF3EC] min-h-[40px] flex items-center justify-between cursor-pointer"
                      >
                        <span>{t('nav.donorPortal', 'Donor Portal')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('donor');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#059669] hover:text-[#047857] hover:bg-[#EAF3EC] min-h-[40px] flex items-center gap-2 font-semibold cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px] text-amber-500">workspace_premium</span>
                        <span>Impact Certificate (PDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTabClick('courier');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#526357] hover:text-[#1E2A22] hover:bg-[#EAF3EC] min-h-[40px] flex items-center cursor-pointer"
                      >
                        {t('nav.courierLogistics', 'Courier Logistics')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsGlobalQrModalOpen(true);
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#059669] hover:text-[#047857] hover:bg-[#EAF3EC] min-h-[40px] flex items-center gap-2 font-semibold cursor-pointer border-t border-[#D9E2DA]/40"
                      >
                        <span className="material-symbols-outlined text-[17px]">qr_code_scanner</span>
                        <span>{t('nav.qrPass', 'QR Transfer Pass')}</span>
                      </button>
                    </div>

                    <div className="border-t border-[#D9E2DA]/60 pt-1">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#B45309] hover:bg-[#FFF3E8] min-h-[44px] flex items-center gap-1.5 font-medium cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>{t('nav.signOut', 'Sign Out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabClick('signin')}
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-[#059669] text-white hover:bg-[#047857] transition-all min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                  title="Common sign-in portal for donors, shelters, couriers, and administrators"
                >
                  <span className="material-symbols-outlined text-[19px]">login</span>
                  <span>{t('nav.signIn', 'Sign In')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Right Controls: Notification, Theme, Palette & Menu Button */}
          <div className="md:hidden flex items-center gap-1.5">
            {/* Mobile QR Pass Button with subtle pulse animation */}
            <button
              type="button"
              onClick={() => setIsGlobalQrModalOpen(true)}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-[#059669]/50 bg-[#ECFDF5] dark:bg-[#112F21] text-[#059669] dark:text-[#34D399] cursor-pointer shadow-xs animate-qr-pulse"
              aria-label="Scan or show QR transfer pass"
              title="QR Transfer Pass & Scanner"
            >
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 dark:bg-emerald-400 border border-white dark:border-[#112019]"></span>
              </span>
              <span className="material-symbols-outlined text-[19px]">qr_code_scanner</span>
            </button>

            {/* Mobile Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] cursor-pointer shadow-xs"
              aria-label="Toggle dark mode"
            >
              <span className="material-symbols-outlined text-[19px] text-[#059669] dark:text-[#34D399]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Mobile Palette Button */}
            <button
              type="button"
              onClick={() => setIsPaletteModalOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-amber-500 cursor-pointer shadow-xs"
              aria-label="Customize theme palette"
            >
              <span className="material-symbols-outlined text-[19px]">
                palette
              </span>
            </button>

            <NotificationCenter onNavigateTab={(tab) => handleTabClick(tab as TabType)} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#EAF3EC] dark:hover:bg-[#182C22] transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-[22px]">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu (links stacked vertically, min 44px tap targets, Sign In at bottom) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#0A130E] px-4 py-3 space-y-1">
            {/* Mobile Language Selector Row */}
            <div className="pb-2.5 mb-2 border-b border-[#D1E3D7] dark:border-[#244535]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#4B6356] dark:text-[#B2CDC0] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#059669]">translate</span>
                  <span>{t('nav.language', 'Language')}:</span>
                </span>
                <span className="text-[11px] font-extrabold text-[#059669] dark:text-[#34D399]">
                  {LANGUAGES.find((l) => l.code === language)?.nativeLabel}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {LANGUAGES.map((l) => {
                  const isSelected = language === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex flex-col items-center justify-center text-center ${
                        isSelected
                          ? 'bg-[#059669] text-white shadow-xs'
                          : 'bg-white dark:bg-[#112019] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535]'
                      }`}
                    >
                      <span className="text-[11.5px] truncate w-full">{l.nativeLabel}</span>
                      <span className={`text-[9px] uppercase font-mono ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {l.shortCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contactless QR Transfer Pass */}
            <button
              type="button"
              onClick={() => {
                setIsGlobalQrModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center gap-2.5 cursor-pointer transition-colors text-[#059669] dark:text-[#34D399] font-bold bg-[#ECFDF5] dark:bg-[#112F21] border border-[#059669]/20"
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span>{t('nav.qrPassFull', 'QR Transfer Pass & Scanner')}</span>
            </button>

            {/* 1. Home */}
            <button
              type="button"
              onClick={() => handleTabClick('home')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center cursor-pointer transition-colors ${
                activeTab === 'home'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              {t('nav.home', 'Home')}
            </button>

            {/* 2. Browse */}
            <button
              type="button"
              onClick={() => handleTabClick('browse')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center cursor-pointer transition-colors ${
                activeTab === 'browse'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              {t('nav.browseFood', 'Browse Available Food')}
            </button>

            {/* 3. Donor */}
            <button
              type="button"
              onClick={() => handleTabClick('donor')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === 'donor'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              <span>{t('nav.donorPortal', 'Donor Portal')}</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#059669]/10 text-[#059669] dark:text-[#34D399] font-semibold">{t('nav.postSurplus', 'Post Surplus')}</span>
            </button>

            {/* 4. Courier */}
            <button
              type="button"
              onClick={() => handleTabClick('courier')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === 'courier'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              <span>{t('nav.courierLogistics', 'Courier Logistics')}</span>
              <span className="text-xs text-[#4B6356] dark:text-[#B2CDC0]">{t('nav.activeRuns', 'Active Runs')}</span>
            </button>

            {/* 5. NGO Meal Requests */}
            <button
              type="button"
              onClick={() => handleTabClick('requests')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === 'requests'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              <span>{t('nav.ngoRequests', 'NGO Requests')}</span>
            </button>

            {/* 6. Leaderboard */}
            <button
              type="button"
              onClick={() => handleTabClick('leaderboard')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-amber-500">military_tech</span>
                <span>{t('nav.impactLeaderboard', 'Impact Leaderboard')}</span>
              </div>
            </button>

            {/* 7. Verify */}
            <button
              type="button"
              onClick={() => handleTabClick('verify')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center cursor-pointer transition-colors ${
                activeTab === 'verify'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              {t('nav.charityVerification', 'Charity Verification')}
            </button>

            {/* 8. Ledger */}
            <button
              type="button"
              onClick={() => handleTabClick('ledger')}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-base min-h-[44px] flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === 'ledger'
                  ? 'bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold'
                  : 'text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22]'
              }`}
            >
              <span>{t('nav.publicLedger', 'Public Rescue Ledger')}</span>
            </button>

            {/* Sign In / Profile at bottom of mobile menu */}
            <div className="pt-3 border-t border-[#D1E3D7] dark:border-[#244535]">
              {currentUser ? (
                <div className="space-y-2">
                  <div className="px-3.5 py-2.5 bg-white dark:bg-[#112019] rounded-xl border border-[#D1E3D7] dark:border-[#244535]">
                    <p className="text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                      {userProfile?.displayName || currentUser.displayName || t('nav.member', 'Member')}
                    </p>
                    <p className="text-xs text-[#059669] dark:text-[#34D399] font-bold">
                      {getRoleDisplayName()}
                    </p>
                    <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] truncate">
                      {currentUser.email}
                    </p>
                  </div>
                  {userProfile?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleTabClick('admin');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] border border-[#059669]/30 min-h-[44px] text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                      <span>{t('nav.adminPanel', 'Admin panel')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 rounded-xl text-base font-semibold border border-[#D1E3D7] dark:border-[#244535] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 min-h-[44px] text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>{t('nav.signOut', 'Sign Out')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleTabClick('signin');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-xl text-base font-extrabold bg-[#059669] text-white hover:bg-[#047857] min-h-[48px] text-center cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    <span>{t('nav.signIn', 'Sign In (Common Portal)')}</span>
                  </button>
                  <p className="text-center text-xs text-[#526357] dark:text-[#8BA396]">
                    One common sign-in for food donors, shelters, couriers &amp; admins.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      )}

      {/* Horizontal Rolling Bar: Top Donors Ticker */}
      {activeTab !== 'admin' && activeTab !== 'admin-login' && (
        <TopDonorsTicker onNavigateLeaderboard={() => handleTabClick('leaderboard')} />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="w-full">
            {/* HERO SECTION */}
            <section className="w-full bg-[#F8FAF8] dark:bg-[#0A130E] border-b border-[#D1E3D7]/60 dark:border-[#244535]/60">
              <div className="site-container py-8 sm:py-10 lg:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  {/* Left content */}
                  <div className="lg:col-span-7">
                    <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase text-[#059669] dark:text-[#34D399] mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#059669] dark:bg-[#34D399] animate-ping" />
                      <span>{t('hero.badge', 'Direct Surplus Food Rescue · India')}</span>
                    </div>

                    <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[50px] font-bold tracking-tight text-[#0F1E17] dark:text-[#F4F8F5] leading-[1.15] mb-4 text-balance">
                      {t('hero.title', 'Bridging surplus commercial kitchens with verified community shelters.')}
                    </h1>

                    <p className="text-base sm:text-lg text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mb-6 max-w-[65ch]">
                      {t('hero.subtitle', 'Every day, metric tonnes of fresh, unserved meals from banquet halls, catering hubs, and institutional dining are lost to landfills. FoodLink orchestrates direct, temperature-verified surplus handoffs to nearby shelters, orphanages, and community kitchens in under 45 minutes.')}
                    </p>

                    {/* Primary Actions with Strict Focal Anchor */}
                    <div className="flex flex-wrap items-center gap-3.5 mb-5">
                      <button
                        type="button"
                        onClick={() => handleTabClick('donor')}
                        className="px-6 py-3.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-base transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{t('hero.donateCta', 'Donate Surplus Food')}</span>
                        <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTabClick('browse')}
                        className="px-6 py-3.5 rounded-xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] hover:bg-[#F0FDF4] dark:hover:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5] font-bold text-base transition-all duration-200 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px] text-[#059669] dark:text-[#34D399]">explore</span>
                        <span>{t('hero.browseCta', 'Browse Available Meals')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTabClick('signin')}
                        className="px-5 py-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#182C22] border border-[#059669]/40 hover:bg-[#D1FAE5] dark:hover:bg-[#203D2F] text-[#059669] dark:text-[#34D399] font-bold text-base transition-all duration-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                        title="Common Sign-In Portal for Donors, Shelters, Couriers, and Admins"
                      >
                        <span className="material-symbols-outlined text-[20px]">login</span>
                        <span>Common Sign In</span>
                      </button>
                    </div>

                    {/* Clean Text Separated Metadata / Quick Navigation (No Pill Badges) */}
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-[#2D4536] dark:text-[#D1E3D7] pt-1">
                      <button
                        type="button"
                        onClick={() => handleTabClick('signin')}
                        className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors flex items-center gap-1.5 cursor-pointer font-bold text-[#059669] dark:text-[#34D399]"
                      >
                        <span className="material-symbols-outlined text-[16px]">account_circle</span>
                        <span>Common Sign In (All Roles)</span>
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <button
                        type="button"
                        onClick={() => handleTabClick('leaderboard')}
                        className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-amber-500">military_tech</span>
                        <span>{t('hero.linkLeaderboard', 'Donation Leaderboard')}</span>
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <button
                        type="button"
                        onClick={() => handleTabClick('requests')}
                        className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#059669] dark:text-[#34D399]">emergency_share</span>
                        <span>{t('hero.linkRequests', 'NGO Meal Requests')}</span>
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <button
                        type="button"
                        onClick={() => handleTabClick('verify')}
                        className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#059669] dark:text-[#34D399]">verified_user</span>
                        <span>{t('hero.linkVerify', 'Charity Verification')}</span>
                      </button>
                    </div>
                  </div>

                {/* Right content: Clean, interactive Live Rescue Showcase Card */}
                <div className="lg:col-span-5 w-full mt-4 lg:mt-0">
                  <div className="w-full rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] p-6 shadow-md dark:shadow-none space-y-5 transition-colors duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#D1E3D7] dark:border-[#244535]">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-[#059669]/10 text-[#059669] dark:text-[#34D399] flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">hub</span>
                        </span>
                        <div>
                          <h3 className="font-sans font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5]">{t('dispatch.title', 'Live Rescue Dispatch')}</h3>
                          <p className="text-[11px] text-[#4B6356] dark:text-[#B2CDC0]">{t('dispatch.subtitle', 'Active across Indian metro hubs')}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF3EC] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-[#34D399] animate-pulse"></span>
                        <span>{t('dispatch.activeBadge', 'Active')}</span>
                      </span>
                    </div>

                    {/* 3 Visual Stages */}
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[17px]">restaurant</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-sans text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">{t('dispatch.step1Title', '1. Kitchens Log Surplus')}</h4>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{t('dispatch.step1Badge', '60s listing')}</span>
                          </div>
                          <p className="text-[11.5px] text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mt-0.5">
                            {t('dispatch.step1Desc', 'Banquets, hotels, and cafes post unserved meals with dietary details, portion sizes, and thermal limits.')}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#059669]/15 text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[17px]">directions_bike</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-sans text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">{t('dispatch.step2Title', '2. Volunteer Couriers Transit')}</h4>
                            <span className="text-[10px] text-[#059669] dark:text-[#34D399] font-bold">{t('dispatch.step2Badge', 'Thermal crates')}</span>
                          </div>
                          <p className="text-[11.5px] text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mt-0.5">
                            {t('dispatch.step2Desc', 'Community runners verify food temperature and transport safely to nearby shelter drop-offs.')}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[17px]">volunteer_activism</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-sans text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">{t('dispatch.step3Title', '3. Shelters Feed People')}</h4>
                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">{t('dispatch.step3Badge', 'Verified NGOs')}</span>
                          </div>
                          <p className="text-[11.5px] text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mt-0.5">
                            {t('dispatch.step3Desc', 'Orphanages, elder care homes, and community langars serve hot, wholesome meals with OTP verification.')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Circular D3 Progress Ring Visualizing Time Remaining for Current Pickup Window */}
                    <LivePickupWindowRing
                      totalWindowMinutes={45}
                      initialRemainingMinutes={28}
                      batchName="Fresh Dal Makhani & Roti (45 kg)"
                      donorVenue="Grand Palace Banquets"
                      shelterDestination="Asha Sadan Shelter"
                      size={96}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

            {/* COMMUNITY LEADERBOARD SECTION (Above How It Works) */}
            <HomeLeaderboardSection
              onNavigateLeaderboard={() => handleTabClick('leaderboard')}
              onNavigateDonor={() => handleTabClick('donor')}
              onOpenAuth={(role) => handleOpenAuth(role as ModalRole)}
            />

            {/* HOW IT WORKS SECTION */}
            <section
              id="how-it-works-section"
              className="bg-[#EAF3EC] dark:bg-[#0E1A14] border-y border-[#D1E3D7] dark:border-[#244535] py-8 sm:py-10 lg:py-12"
            >
              <div className="site-container">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  {/* Left half (steps 1, 2, 3) */}
                  <div className="lg:col-span-7">
                    <div className="mb-6">
                      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-2">
                        How it works in 3 simple steps
                      </h2>
                      <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] max-w-[65ch]">
                        A transparent, accountable bridge from surplus food to local plates.
                      </p>
                    </div>

                    {/* Numbered vertical list with clean divider lines */}
                    <div className="divide-y divide-[#D1E3D7] dark:divide-[#244535] border-y border-[#D1E3D7] dark:border-[#244535]">
                      {/* Step 1 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] dark:text-[#34D399] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          1
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                            List surplus food
                          </h3>
                          <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed max-w-[65ch]">
                            A donor enters what is available, portion quantity, and the safe consumption window in 60 seconds. AI automatically screens for safety and prohibited policies.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] dark:text-[#34D399] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          2
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                            A verified organization claims it
                          </h3>
                          <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed max-w-[65ch]">
                            Only approved NGOs, orphanages, and registered community kitchens can claim surplus food batches with real-time push alerts and verification PIN codes.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="py-5 sm:py-6 flex items-start gap-5 sm:gap-6">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-[#059669] dark:text-[#34D399] w-8 sm:w-10 shrink-0 leading-none pt-0.5">
                          3
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                            Voluntary pickup and confirmation
                          </h3>
                          <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed max-w-[65ch]">
                            A voluntary courier or shelter representative collects the food, verifies temperature safety, and confirms delivery, recording transparent public ledger data.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right half: Good Samaritan & Verification Guarantee */}
                  <div className="lg:col-span-5 w-full space-y-4 lg:sticky lg:top-24">
                    <div className="rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] p-6 sm:p-7 shadow-xs">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-[#059669]/10 text-[#059669] dark:text-[#34D399] flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        </span>
                        <h4 className="font-serif text-lg font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                          Direct Institution Verification
                        </h4>
                      </div>
                      <p className="text-sm text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mb-4 max-w-[65ch]">
                        Every charity on FoodLink is verified using government credentials (NGO Darpan ID, Trust Registration, or municipal sanitation certificates) before claiming meals.
                      </p>
                      <div className="pt-3 border-t border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between text-xs text-[#4B6356] dark:text-[#B2CDC0]">
                        <span>Zero platform fee network</span>
                        <span className="font-bold text-[#059669] dark:text-[#34D399]">100% Non-Profit Initiative</span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] p-5 shadow-xs">
                      <div className="flex items-center gap-2 mb-2 text-[#059669] dark:text-[#34D399] font-bold text-sm">
                        <span className="material-symbols-outlined text-[20px]">shield</span>
                        <span>Good Samaritan Safety Guarantee</span>
                      </div>
                      <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed">
                        Surplus meals are handled in accordance with Food Safety and Standards Authority of India (FSSAI) guidelines, with temperature monitoring during courier transit.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* RECENT FOOD LISTINGS (4 cols on 2xl, 3 on lg, 2 on md, 1 on mobile) */}
            <section className="w-full py-8 sm:py-10 lg:py-12">
              <div className="site-container">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-2">
                      Recent food listings
                    </h2>
                    <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] max-w-[65ch]">
                      Current unserved meals ready for pickup by verified organizations.
                    </p>
                  </div>

                {/* Dietary Filter Buttons (Interactive Segmented Control) */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-xl self-start shadow-xs">
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      dietaryFilter === 'all'
                        ? 'bg-[#059669] text-white shadow-xs'
                        : 'text-[#4B6356] dark:text-[#B2CDC0] hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
                    }`}
                  >
                    All Meals
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('veg')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      dietaryFilter === 'veg'
                        ? 'bg-[#059669] text-white shadow-xs'
                        : 'text-[#4B6356] dark:text-[#B2CDC0] hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
                    }`}
                  >
                    Pure Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietaryFilter('non-veg')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      dietaryFilter === 'non-veg'
                        ? 'bg-[#059669] text-white shadow-xs'
                        : 'text-[#4B6356] dark:text-[#B2CDC0] hover:text-[#0F1E17] dark:hover:text-[#F4F8F5]'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>

              {loadingListings ? (
                <div className="py-12 text-center text-[#4B6356] dark:text-[#B2CDC0] text-base">
                  Loading available food listings...
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019]">
                  <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] mb-3">
                    No active listings matching your selection right now.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabClick('donor')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#059669] text-white font-bold text-sm hover:bg-[#047857] min-h-[44px] cursor-pointer shadow-xs transition-colors"
                  >
                    Post the first food listing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {filteredListings.slice(0, 8).map((listing) => {
                    const isVeg =
                      typeof (listing as any).isVeg === 'boolean'
                        ? (listing as any).isVeg
                        : (listing as any).dietaryType
                        ? (listing as any).dietaryType === 'veg'
                        : !listing.title.toLowerCase().includes('chicken') &&
                          !listing.title.toLowerCase().includes('mutton') &&
                          !listing.title.toLowerCase().includes('fish') &&
                          !listing.title.toLowerCase().includes('meat') &&
                          !listing.title.toLowerCase().includes('egg') &&
                          !listing.title.toLowerCase().includes('non-veg');

                    return (
                      <div
                        key={listing.id}
                        className="bg-white dark:bg-[#112019] p-5 rounded-2xl border border-[#D1E3D7] dark:border-[#244535] flex flex-col justify-between hover:border-[#059669] dark:hover:border-[#34D399] transition-all shadow-xs hover:shadow-md"
                      >
                        <div>
                          {/* Image preview if present */}
                          {listing.photoUrl && (
                            <div className="relative w-full h-36 -mt-1 mb-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#182C22]">
                              <img
                                src={listing.photoUrl}
                                alt={listing.title}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Zero-Pill Clean Typographic Metadata */}
                          <div className="flex items-center justify-between gap-2 mb-2.5 text-xs text-[#4B6356] dark:text-[#B2CDC0]">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isVeg ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 dark:bg-amber-400'
                                }`}
                              />
                              <span className={isVeg ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
                                {isVeg ? 'Pure Veg' : 'Non-Veg'}
                              </span>
                            </div>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                              {listing.quantity} {listing.unit || 'portions'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              Fresh
                            </span>
                          </div>

                          <h3 className="font-serif text-lg font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 line-clamp-1">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-[#4B6356] dark:text-[#B2CDC0] line-clamp-2 mb-3 max-w-[65ch]">
                            {listing.notes || 'Packed fresh in clean, food-grade thermal containers.'}
                          </p>

                          <div className="text-xs text-[#4B6356] dark:text-[#B2CDC0] space-y-1 mb-4 pt-2 border-t border-[#D1E3D7] dark:border-[#244535]">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-[#059669] dark:text-[#34D399]">
                                location_on
                              </span>
                              <span className="truncate">{listing.location || 'Local Kitchen'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-amber-500">
                                schedule
                              </span>
                              <span>Pickup: {listing.pickupWindow}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTabClick('browse')}
                          className="w-full py-2.5 px-4 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] hover:bg-[#ECFDF5] dark:hover:bg-[#244535] text-[#0F1E17] dark:text-[#F4F8F5] text-sm font-bold transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
                        >
                          View details
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => handleTabClick('browse')}
                  className="inline-flex items-center gap-2 text-base font-bold text-[#059669] dark:text-[#34D399] hover:text-[#047857] py-2 cursor-pointer transition-colors"
                >
                  <span>Browse all available listings</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>

            {/* FREQUENTLY ASKED QUESTIONS SECTION */}
            <section className="border-t border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#0A130E] py-8 sm:py-10 lg:py-12">
              <div className="site-container">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  {/* Left Column (Heading & Subtext) */}
                  <div className="lg:col-span-5">
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-3">
                      Frequently asked questions
                    </h2>
                    <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mb-6 max-w-[65ch]">
                      Answers to common questions about donation guidelines, shelter organization verification, and Good Samaritan food safety standards.
                    </p>
                    <div className="p-6 rounded-2xl bg-[#ECFDF5] dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] text-sm text-[#0F1E17] dark:text-[#F4F8F5] shadow-xs">
                      <div className="flex items-center gap-2 font-bold mb-1.5 text-[#059669] dark:text-[#34D399]">
                        <span className="material-symbols-outlined text-[20px]">support_agent</span>
                        <span>Need direct emergency assistance?</span>
                      </div>
                      <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mb-3">
                        Our coordination desk assists banquet managers, wedding caterers, and shelters with immediate surplus dispatch.
                      </p>
                      <span className="font-bold text-xs text-[#059669] dark:text-[#34D399]">Toll Free: 1800-555-FOOD (24x7 Support)</span>
                    </div>
                  </div>

                  {/* Right Column (Accordion List) */}
                  <div className="lg:col-span-7 divide-y divide-[#D1E3D7] dark:divide-[#244535] border-y border-[#D1E3D7] dark:border-[#244535]">
                    {[
                      {
                        q: 'Who can donate food through FoodLink?',
                        a: 'Restaurants, wedding halls, banquet caterers, and corporate dining facilities with surplus unserved food can post listings. All donations must be unserved and packed in food-grade containers.',
                      },
                      {
                        q: 'Who is eligible to claim food donations?',
                        a: 'Only verified organizations can claim surplus batches. This includes registered NGOs, orphanages, elder care homes, and certified community kitchens verified through official credentials like NGO Darpan or trust registration.',
                      },
                      {
                        q: 'How does FoodLink verify food safety?',
                        a: 'Donors state the prepared time and the safe consumption window (hot meals must be consumed within 4 hours). Receiving shelters inspect container integrity and temperature before confirming delivery.',
                      },
                      {
                        q: 'Can individual volunteers help with pickup and delivery?',
                        a: 'Yes. Citizens can register as Volunteer Couriers with valid identity proof to transport food packages between donors and nearby shelters using bikes, autos, or vans.',
                      },
                      {
                        q: 'Are there any platform or transaction fees?',
                        a: 'No. FoodLink is completely free to use for both donors and receiving charities. Donors also receive verified 80G tax receipts and CSR impact records.',
                      },
                    ].map((faq, idx) => {
                      const isOpen = openFaqIndex === idx;
                      return (
                        <div key={idx} className="py-4">
                          <button
                            type="button"
                            onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                            aria-expanded={isOpen}
                            className="w-full text-left flex items-center justify-between gap-4 py-2 cursor-pointer font-bold text-base text-[#0F1E17] dark:text-[#F4F8F5] hover:text-[#059669] dark:hover:text-[#34D399] transition-colors"
                          >
                            <span>{faq.q}</span>
                            <span className="material-symbols-outlined text-[20px] text-[#4B6356] dark:text-[#B2CDC0] shrink-0">
                              {isOpen ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="pt-2 pb-3 text-sm sm:text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed max-w-[65ch]">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* SAFETY NOTE */}
            <section className="border-t border-[#D1E3D7] dark:border-[#244535] bg-[#FAFBF8] dark:bg-[#0E1A14] py-8 sm:py-10 lg:py-12">
              <div className="site-container">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  <div className="lg:col-span-8">
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-3">
                      Food safety &amp; Good Samaritan protections
                    </h3>
                    <p className="text-base text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed mb-4 max-w-[65ch]">
                      Every food batch lists the prepared time and the safe holding window. Receiving organizations check container seals and food temperatures before accepting any delivery.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTabClick('verify')}
                      className="text-sm font-bold text-[#059669] dark:text-[#34D399] hover:underline cursor-pointer"
                    >
                      Read our statutory safety standards and verification process →
                    </button>
                  </div>
                  <div className="lg:col-span-4 p-6 rounded-2xl bg-[#ECFDF5] dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] text-sm text-[#0F1E17] dark:text-[#F4F8F5] shadow-xs">
                    <div className="flex items-center gap-2 font-bold mb-2 text-[#059669] dark:text-[#34D399]">
                      <span className="material-symbols-outlined text-[20px]">shield</span>
                      <span>Statutory Protection</span>
                    </div>
                    <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] leading-relaxed">
                      Food donations are protected under statutory Good Samaritan provisions, encouraging safe food redistribution without legal liability when acting in good faith.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* COMMON SIGN-IN SECTION FOR ALL USERS (Directly on Home page) */}
            {!currentUser && (
              <section
                id="common-signin-section"
                className="border-t border-[#D1E3D7] dark:border-[#244535] bg-[#F0FDF4]/40 dark:bg-[#0C1B14] py-8 sm:py-10 lg:py-12 transition-colors"
              >
                <div className="site-container">
                  <div className="mb-6 text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#059669]/10 text-[#059669] dark:text-[#34D399] text-xs font-bold mb-2">
                      <span className="material-symbols-outlined text-[15px]">login</span>
                      <span>Common Sign-In Portal</span>
                    </div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                      Sign In to FoodLink
                    </h2>
                    <p className="text-sm text-[#4B6356] dark:text-[#B2CDC0] mt-1">
                      Everyone can sign in here by choosing their preferred role option — Food Donor, Recipient Shelter, Volunteer Courier, or Platform Admin.
                    </p>
                  </div>

                  <CommonSignInSection
                    isModal={false}
                    onSuccessRoute={(role) => {
                      showToast('Signed in successfully!');
                      if (role === 'admin') handleTabClick('admin');
                      else if (role === 'volunteer') handleTabClick('courier');
                      else if (role === 'recipient') handleTabClick('browse');
                      else handleTabClick('donor');
                    }}
                    onSwitchToSignUp={(role) => {
                      handleOpenAuth(role as ModalRole, 'role_select');
                    }}
                    onNavigateHome={() => handleTabClick('home')}
                  />
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: BROWSE (Open to everyone) */}
        {activeTab === 'browse' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22]">
                  Available food listings
                </h1>
                <p className="text-sm text-[#526357]">
                  Browse active surplus food. Sign in to claim meals for your registered shelter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              >
                Back to Home
              </button>
            </div>
            <RecipientDashboard
              onOpenAuth={() => handleOpenAuth('recipient')}
              onOpenCsrModal={() => {}}
              onNavigateDonor={() => handleTabClick('donor')}
            />
          </div>
        )}

        {/* TAB 3: DONOR (Protected - Sign-in required) */}
        {activeTab === 'donor' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22]">
                  Donor Portal
                </h1>
                <p className="text-sm text-[#526357]">
                  Publish food surplus batches for immediate pickup by verified shelters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              >
                Back to Home
              </button>
            </div>
            <DonorDashboard
              onOpenAuth={() => handleOpenAuth('donor')}
              onNavigateBrowse={() => handleTabClick('browse')}
              onNavigateLedger={() => handleTabClick('ledger')}
            />
          </div>
        )}

        {/* TAB 4: COURIER (Protected - Sign-in required) */}
        {activeTab === 'courier' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22]">
                  Volunteer Courier Hub
                </h1>
                <p className="text-sm text-[#526357]">
                  Pick up inspected surplus food and deliver it to nearby shelters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              >
                Back to Home
              </button>
            </div>
            <VolunteerLogistics
              selectedCityId="mumbai"
              onSelectCity={() => {}}
              onOpenAuth={() => handleOpenAuth('volunteer' as any)}
              onNavigateVerify={() => handleTabClick('verify')}
              onOpenCsrModal={() => {}}
            />
          </div>
        )}

        {/* TAB: NGO MEAL REQUESTS (Reverse Hunger Demand Board) */}
        {activeTab === 'requests' && (
          <div className="site-container py-8 sm:py-10">
            <MealRequestsHub
              onNavigateDonor={() => handleTabClick('donor')}
              onOpenAuth={() => handleOpenAuth()}
            />
          </div>
        )}

        {/* TAB: LEADERBOARD (Public Community Honor Roll, Highest Score & Quantity Donated) */}
        {activeTab === 'leaderboard' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B6356] hover:text-[#0F1E17] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Home</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('donor')}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#059669] hover:underline cursor-pointer"
              >
                <span>List Surplus Food (+250 pts)</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
            <DonationLeaderboard
              onNavigateDonor={() => handleTabClick('donor')}
              onOpenAuth={(role) => handleOpenAuth(role)}
              onNavigateBrowse={() => handleTabClick('browse')}
            />
          </div>
        )}

        {/* TAB 5: VERIFY (Open to everyone) */}
        {activeTab === 'verify' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E2A22]">
                  Verification
                </h1>
                <p className="text-sm text-[#526357]">
                  Standards and requirements for food donors and recipient organizations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              >
                Back to Home
              </button>
            </div>
            <VerificationModule
              onOpenAuth={() => handleOpenAuth()}
              onNavigateDonor={() => handleTabClick('donor')}
              onNavigateRecipient={() => handleTabClick('browse')}
            />
          </div>
        )}

        {/* TAB 6: LEDGER (Protected - Sign-in required) */}
        {activeTab === 'ledger' && (
          <div className="site-container py-8 sm:py-10">
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-medium text-[#526357] hover:text-[#1E2A22] cursor-pointer"
              >
                Back to Home
              </button>
            </div>
            <RescueLedgerLeaderboard
              onOpenAuth={(role) => handleOpenAuth(role)}
              onNavigateTab={(tab) =>
                handleTabClick(
                  tab === 'volunteer' ? 'courier' : tab === 'donate' ? 'donor' : (tab as TabType)
                )
              }
              onNavigateDonor={() => handleTabClick('donor')}
            />
          </div>
        )}

        {/* TAB 7: ADMIN PANEL (Route /admin, admin role required) */}
        {activeTab === 'admin' && (
          <AdminPanel onNavigateHome={() => handleTabClick('home')} />
        )}

        {/* TAB 8: ADMIN SIGN IN (Route /admin-login) */}
        {activeTab === 'admin-login' && (
          <AdminLoginPage
            onSuccessAdmin={() => handleTabClick('admin')}
            onNavigateHome={() => handleTabClick('home')}
            onNavigateCommonSignIn={() => handleTabClick('signin')}
          />
        )}

        {/* TAB 8b: COMMON SIGN IN PORTAL (Route /signin or /login) */}
        {activeTab === 'signin' && (
          <div className="py-4">
            <CommonSignInSection
              isModal={false}
              onSuccessRoute={(role) => {
                showToast('Signed in successfully!');
                if (role === 'admin') handleTabClick('admin');
                else if (role === 'volunteer') handleTabClick('courier');
                else if (role === 'recipient') handleTabClick('browse');
                else handleTabClick('donor');
              }}
              onSwitchToSignUp={(role) => {
                handleOpenAuth(role as ModalRole, 'role_select');
              }}
              onNavigateHome={() => handleTabClick('home')}
            />
          </div>
        )}

        {/* TAB 9: PRIVACY POLICY PAGE (/privacy) */}
        {activeTab === 'privacy' && (
          <div className="site-container py-10 sm:py-14 max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-[#2E7D4F] bg-[#EAF3EC] px-2.5 py-1 rounded">
                Official Document
              </span>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-semibold text-[#2E7D4F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Home</span>
              </button>
            </div>

            <div className="bg-white border border-[#D9E2DA] rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
              <div>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1E2A22]">
                  Privacy Policy
                </h1>
                <p className="text-sm text-[#526357] mt-2">
                  Last updated: October 2026. Governing food surplus redistribution and account privacy under Indian law.
                </p>
              </div>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  1. Information We Collect
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  FoodLink collects organizational data required to verify donors and charities. This includes legal entity names, authorized contact names, business email addresses, telephone numbers, physical pickup/delivery addresses, and verification documents (such as FSSAI licenses, 80G certificates, and NGO Darpan certificates).
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  2. Purpose of Data Processing
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  Data collected is used exclusively to verify identity, facilitate safe food dispatch, generate automated Good Samaritan compliance receipts, prevent fraudulent claims, and enable direct coordination between donors, shelters, and couriers.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  3. Food Safety Record Retention
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  In accordance with Food Safety and Standards Authority of India (FSSAI) guidelines, digital records of food transfers, including preparation timestamps, declared consumption limits, and temperature confirmations, are stored securely to maintain a verifiable audit trail.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  4. Data Security and User Rights
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  All communication is encrypted via TLS/HTTPS. Users retain the right to review their profile data, request corrections, or request account closure by contacting our privacy compliance desk at privacy@foodlink.org.
                </p>
              </section>

              <div className="pt-6 border-t border-[#D9E2DA] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#526357]">
                  Questions about our data policy? Email privacy@foodlink.org
                </span>
                <button
                  type="button"
                  onClick={() => handleTabClick('browse')}
                  className="px-5 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold cursor-pointer shadow-xs min-h-[40px]"
                >
                  Browse Available Food
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: TERMS OF SERVICE (/terms) */}
        {activeTab === 'terms' && (
          <div className="site-container py-10 sm:py-14 max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-[#2E7D4F] bg-[#EAF3EC] px-2.5 py-1 rounded">
                Statutory Guidelines
              </span>
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="text-sm font-semibold text-[#2E7D4F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Home</span>
              </button>
            </div>

            <div className="bg-white border border-[#D9E2DA] rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
              <div>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1E2A22]">
                  Terms of Service &amp; Food Safety Protocol
                </h1>
                <p className="text-sm text-[#526357] mt-2">
                  Operating standards, donor warranties, and statutory Good Samaritan liability protections.
                </p>
              </div>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  1. Good Samaritan Protection
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  FoodLink operates under the principles of statutory Good Samaritan food protection. Registered food donors who donate edible food in good faith, adhering to temperature and hygiene standards, are shielded from civil liability for surplus food donated to verified charitable organizations.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  2. Donor Warranties and Hygiene Standards
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  Every food donor warrants that surplus food was prepared in a hygienic facility, has not been served to customers, has been stored at safe temperatures, and is packaged in food-grade, sealed containers clearly labeled with the preparation time and pickup window.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  3. Recipient Organization Responsibilities
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  Shelters and community kitchens agree to inspect containers upon arrival, verify temperature integrity, distribute food promptly within the safe consumption window, and ensure meals are served at zero cost to beneficiaries. Re-selling donated food is strictly prohibited.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                  4. Platform Role &amp; Limitation of Liability
                </h2>
                <p className="text-sm text-[#526357] leading-relaxed">
                  FoodLink serves solely as a coordination and verification platform. FoodLink does not cook, package, or transport food directly. Users acknowledge that adherence to safety standards is the mutual obligation of verified donors and recipient institutions.
                </p>
              </section>

              <div className="pt-6 border-t border-[#D9E2DA] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#526357]">
                  Need full documentation? Download our compliance guidelines.
                </span>
                <button
                  type="button"
                  onClick={() => handleTabClick('verify')}
                  className="px-5 py-2.5 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-semibold cursor-pointer shadow-xs min-h-[40px]"
                >
                  View Verification Standards
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 11: 404 NOT FOUND PAGE (/404 or unknown URL) */}
        {activeTab === '404' && (
          <div className="site-container py-16 sm:py-24 text-center max-w-2xl">
            <div className="w-20 h-20 rounded-2xl bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center mx-auto mb-6 shadow-xs">
              <span className="material-symbols-outlined text-[42px]">error</span>
            </div>
            <span className="text-xs uppercase tracking-widest font-bold text-[#526357]">
              Error 404
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1E2A22] mt-2 mb-4">
              Page Not Found
            </h1>
            <p className="text-base text-[#526357] leading-relaxed mb-8 max-w-lg mx-auto">
              The page you are looking for may have been moved, renamed, or does not exist. Please return to the homepage or explore available food listings.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => handleTabClick('home')}
                className="px-6 py-3 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[44px]"
              >
                Return to Home
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('browse')}
                className="px-6 py-3 rounded-lg bg-white border border-[#D9E2DA] hover:bg-[#FAFBF8] text-[#1E2A22] text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[44px]"
              >
                Browse Food Listings
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('verify')}
                className="px-6 py-3 rounded-lg bg-white border border-[#D9E2DA] hover:bg-[#FAFBF8] text-[#526357] text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[44px]"
              >
                Safety &amp; Verification
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER (Simple 3 columns: About, Legal, Contact, site-container inside) */}
      {activeTab !== 'admin' && (
        <footer className="border-t border-[#D4E5DA] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#0A130E] py-10 lg:py-12">
          <div className="site-container">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-10">
              {/* Column 1: About */}
              <div>
                <div className="mb-3">
                  <FoodLinkLogo size="sm" variant="compact" showSubtitle />
                </div>
                <p className="text-sm text-[#3F5348] dark:text-[#C2D6CA] leading-relaxed max-w-[65ch]">
                  FoodLink connects restaurants and wedding venues with verified orphanages, care homes, and community shelters across India to share extra food safely.
                </p>
              </div>

              {/* Column 2: Legal */}
              <div>
                <h4 className="font-serif text-base font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-3">Legal &amp; Policy</h4>
                <ul className="space-y-2 text-sm text-[#4B6356] dark:text-[#B2CDC0]">
                  <li>
                    <button
                      type="button"
                      onClick={() => handleTabClick('privacy')}
                      className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => handleTabClick('terms')}
                      className="hover:text-[#059669] dark:hover:text-[#34D399] transition-colors cursor-pointer"
                    >
                      Terms of Service
                    </button>
                  </li>
                  <li>
                    <span className="text-[#4B6356] dark:text-[#B2CDC0]">FSSAI Good Samaritan Guidelines</span>
                  </li>
                </ul>
              </div>

              {/* Column 3: Contact */}
              <div>
                <h4 className="font-serif text-base font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-3">24x7 Help Desk</h4>
                <ul className="space-y-2 text-sm text-[#4B6356] dark:text-[#B2CDC0]">
                  <li>Email: contact@foodlink.org</li>
                  <li>Help desk: 1800-555-FOOD (Toll Free)</li>
                  <li>Metro Hubs: Mumbai, Bengaluru, Delhi NCR, Hyderabad</li>
                </ul>
              </div>
            </div>

            <div className="pt-6 border-t border-[#D1E3D7] dark:border-[#244535] flex flex-col sm:flex-row items-center justify-between text-xs text-[#4B6356] dark:text-[#B2CDC0] gap-3">
              <div className="flex items-center gap-3">
                <span>© 2026 FoodLink India. All rights reserved.</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() =>
                    handleTabClick(
                      currentUser && userProfile?.role === 'admin' ? 'admin' : 'admin-login'
                    )
                  }
                  className="text-xs text-[#4B6356] dark:text-[#B2CDC0] hover:text-[#059669] dark:hover:text-[#34D399] transition-colors cursor-pointer underline underline-offset-2"
                >
                  Admin login
                </button>
              </div>
              <span>Food handling strictly adheres to Food Safety and Standards Authority of India (FSSAI) guidelines.</span>
            </div>
          </div>
        </footer>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialRole={authModalInitialRole}
        initialStep={authModalInitialStep}
        onSuccessRoute={(role) => {
          if (pendingRedirectTab) {
            handleTabClick(pendingRedirectTab);
            setPendingRedirectTab(null);
          } else if (role === 'admin') {
            handleTabClick('admin');
          } else if (role === 'volunteer') {
            handleTabClick('courier');
          } else if (role === 'donor') {
            handleTabClick('donor');
          } else if (role === 'recipient') {
            handleTabClick('browse');
          }
        }}
      />

      {/* Terms and Privacy Policy Modal */}
      <TermsPolicyModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

      {/* Theme Palette Customizer Modal */}
      <ThemePaletteModal
        isOpen={isPaletteModalOpen}
        onClose={() => setIsPaletteModalOpen(false)}
        selectedPaletteId={paletteId}
        onSelectPalette={(id) => setPaletteId(id as any)}
      />

      {/* PWA Mobile App Install Prompt */}
      <PwaInstallPrompt />

      {/* Global Contactless QR Code Meal Transfer Verification Modal */}
      {isGlobalQrModalOpen && (
        <QrTransferModal
          isOpen={isGlobalQrModalOpen}
          onClose={() => setIsGlobalQrModalOpen(false)}
          defaultMode="scan"
          defaultStage="pickup"
          onTransferVerified={(record) => {
            setToastMessage(`Transfer verified! Handoff digest: ${record.proofDigest}`);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}
    </div>
  );
}
