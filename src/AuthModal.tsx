import React, { useState, useEffect } from 'react';
import {
  useAuth,
  DonorSubType,
  RecipientSubType,
  RECEIVER_CATEGORIES_CONFIG,
  isProfileComplete,
} from './AuthContext';
import { useTheme } from './ThemeContext';
import { useTranslation } from './LanguageContext';
import { INDIAN_CITIES } from './cities';
import { FOODLINK_DISCLAIMER_TEXT } from './TermsPolicyModal';
import { FoodLinkLogo } from './FoodLinkLogo';
import { CommonSignInSection } from './CommonSignInSection';

export type ModalRole = 'donor' | 'recipient' | 'volunteer' | 'admin';
export type ModalStep =
  | 'role_select'
  | 'auth_options'
  | 'verification'
  | 'signin'
  | 'volunteer_signin'
  | 'admin_signin';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
  initialRole?: ModalRole | null;
  initialStep?: ModalStep;
  onSuccessRoute?: (role: ModalRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signup',
  initialRole = null,
  initialStep,
  onSuccessRoute,
}) => {
  const {
    signInWithEmail,
    signUpWithVerification,
    signInWithGoogle,
    signInAsDemo,
    saveVerificationProfile,
    currentUser,
    userProfile,
    setUserProfile,
    savedUserId,
    savedAccountInfo,
    recentAccounts,
    rememberUserId,
    setRememberUserId,
    removeSavedAccount,
    quickReLogin,
    resetPassword,
    error: authError,
    clearError,
  } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Mode: Sign In vs Create Account
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>(defaultMode || 'signin');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetStatusMsg, setResetStatusMsg] = useState<string | null>(null);

  // Selected Role: If initialRole was passed, use it; otherwise null
  const [selectedRole, setSelectedRole] = useState<ModalRole | null>(initialRole || null);

  // Modal navigation step
  const [step, setStep] = useState<ModalStep>(
    initialStep ||
      (defaultMode === 'signin'
        ? 'signin'
        : initialRole === 'volunteer'
        ? 'volunteer_signin'
        : initialRole === 'admin'
        ? 'admin_signin'
        : initialRole
        ? 'auth_options'
        : 'signin')
  );

  // Sub-type for Donor
  const [donorSubType, setDonorSubType] = useState<DonorSubType>('restaurant');

  // Mandatory Platform Liability & Safety Declaration
  const [liabilityConsentAccepted, setLiabilityConsentAccepted] = useState(false);

  // Common user credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Contact Phone & City (MANDATORY fields for all user profiles)
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [customCity, setCustomCity] = useState('');

  // Form Fields: Donor -> Restaurant / Food Business
  const [businessName, setBusinessName] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [fssaiFile, setFssaiFile] = useState<{ name: string; size: number; dataUrl?: string } | null>(null);

  // Form Fields: Donor -> Individual / Event
  const [govIdType, setGovIdType] = useState<'Aadhaar' | 'PAN'>('Aadhaar');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selfDeclaration, setSelfDeclaration] = useState(false);

  // Form Fields: Recipient -> Receiver Variety (NGO, Hospital, School, Community Kitchen, etc.)
  const [recipientSubType, setRecipientSubType] = useState<RecipientSubType>('ngo_shelter');
  const [ngoOrgName, setNgoOrgName] = useState('');
  const [receiverDocNumber, setReceiverDocNumber] = useState('');
  const [ngoDarpanId, setNgoDarpanId] = useState('');
  const [regCertNumber, setRegCertNumber] = useState('');
  const [regCertFile, setRegCertFile] = useState<{ name: string; size: number; dataUrl?: string } | null>(null);
  const [tax12A80GNumber, setTax12A80GNumber] = useState('');

  // Status & states
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<'restaurant' | 'ngo' | 'volunteer' | 'admin' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync when modal opens or initial parameters change
  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        setSelectedRole(initialRole);
      }
      if (initialStep) {
        setStep(initialStep);
      } else if (initialRole === 'volunteer') {
        setSelectedRole('volunteer');
        setStep('volunteer_signin');
      } else if (initialRole === 'admin') {
        setSelectedRole('admin');
        setStep('admin_signin');
      } else if (currentUser && (!userProfile || !isProfileComplete(userProfile))) {
        // If signed in (e.g. through Google) but profile is incomplete, directly show verification
        const effectiveRole =
          initialRole ||
          (userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
            ? 'recipient'
            : userProfile?.role === 'volunteer'
            ? 'volunteer'
            : userProfile?.role === 'admin'
            ? 'admin'
            : 'donor');
        setSelectedRole(effectiveRole);
        if (effectiveRole === 'volunteer') {
          setStep('volunteer_signin');
        } else if (effectiveRole === 'admin') {
          setStep('admin_signin');
        } else {
          setStep('verification');
        }
      } else if (initialRole) {
        setStep('auth_options');
      } else {
        setSelectedRole(null);
        setStep(defaultMode === 'signup' ? 'role_select' : 'signin');
      }

      // Pre-fill fields from saved user ID, authenticated user, or profile
      if (savedUserId && !email) {
        setEmail(savedUserId);
      } else if (currentUser?.email) {
        setEmail(currentUser.email);
      }
      if (currentUser?.displayName) {
        if (!businessName) setBusinessName(currentUser.displayName);
        if (!ngoOrgName) setNgoOrgName(currentUser.displayName);
      }
      if (userProfile?.phone && !phone) {
        setPhone(userProfile.phone);
      }
      if (userProfile?.city && !city) {
        setCity(userProfile.city);
      }

      setLocalError(null);
      setLiabilityConsentAccepted(false);
      clearError();
    }
  }, [isOpen, initialRole, initialStep, currentUser, userProfile]);

  if (!isOpen) return null;

  const displayError = localError || authError;

  // File upload handler
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'fssai' | 'regCert'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setLocalError('File size exceeds 10MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        name: file.name,
        size: file.size,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      };
      if (type === 'fssai') {
        setFssaiFile(fileData);
      } else {
        setRegCertFile(fileData);
      }
      setLocalError(null);
    };
    reader.readAsDataURL(file);
  };

  // Step 1: Picking role
  const handleSelectRole = (role: ModalRole) => {
    setSelectedRole(role);
    setLocalError(null);
    clearError();
    if (role === 'volunteer') {
      setStep('volunteer_signin');
    } else if (role === 'admin') {
      setStep('admin_signin');
    } else {
      // Move to auth options (Google shortcut / Verification form) for that role
      setStep('auth_options');
    }
  };

  // Step 2: Google Sign-in for the chosen role
  const handleGoogleSignIn = async () => {
    if (!selectedRole) {
      setLocalError('Please choose whether to continue as Donor or Recipient first.');
      setStep('role_select');
      return;
    }

    clearError();
    setLocalError(null);
    setLoading(true);

    try {
      const result = await signInWithGoogle();
      const currentRole = selectedRole;

      // Check whether a /users/{uid} profile document with the required fields
      // (role, organization/contact name, phone, city) exists.
      const hasCompleteProfile = result.existsInDb && result.profile && isProfileComplete(result.profile);

      if (!hasCompleteProfile) {
        // Profile does NOT exist or is incomplete in Firestore.
        // Redirect the user straight into the verification form to complete their profile
        // before they can do anything else. Do not sign them out, just block all dashboard access until the form is submitted.

        if (result.user.displayName) {
          if (currentRole === 'donor') {
            setBusinessName(result.user.displayName);
            setEventName(`${result.user.displayName} Surplus Food Drive`);
          } else {
            setNgoOrgName(result.user.displayName);
          }
        }
        if (result.user.email) {
          setEmail(result.user.email);
        }

        // Direct user straight to verification form
        setStep('verification');
        setSuccessToast(
          `Signed in as ${result.user.email}. Verification required: Please complete your ${
            currentRole === 'donor' ? 'Donor' : 'Recipient'
          } details below before accessing the dashboard.`
        );
        setTimeout(() => setSuccessToast(null), 5000);
      } else {
        // User already has a complete profile in Firestore!
        const targetDashboard =
          result.role === 'ngo' || result.role === 'recipient' ? 'recipient' : 'donor';
        setSuccessToast(`Welcome back! Routing to your ${targetDashboard === 'donor' ? 'Donor' : 'Recipient'} Dashboard...`);
        if (onSuccessRoute) {
          onSuccessRoute(targetDashboard);
        }
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      console.error('[Google Auth Debug Error]:', err);
      setLocalError(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verification form submission
  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const effectiveRole = selectedRole || 'donor';

    // Validate account credentials if not already authenticated
    if (!currentUser) {
      if (!email.trim() || !password.trim()) {
        setLocalError('Please provide your email address and a password to create your account.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
    }

    // Validate Contact Phone Number (required for all roles)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setLocalError('Please enter a valid primary contact phone number (at least 8-10 digits).');
      return;
    }

    // Validate Operating City (required for all roles)
    const effectiveCity = city === 'other' ? customCity.trim() : city.trim();
    if (!effectiveCity) {
      setLocalError('Please select or specify your primary city/region.');
      return;
    }

    // Mandatory Liability and Safety Consent check
    if (!liabilityConsentAccepted) {
      setLocalError(
        'Please check and accept the mandatory FoodLink liability & safety declaration before submitting verification.'
      );
      return;
    }

    // Role-specific validation
    if (effectiveRole === 'donor') {
      if (donorSubType === 'restaurant') {
        if (!businessName.trim()) {
          setLocalError('Please enter your Business / Restaurant name.');
          return;
        }
        const cleanFssai = fssaiNumber.replace(/\D/g, '');
        if (cleanFssai.length !== 14) {
          setLocalError('FSSAI License Number must be exactly 14 digits (e.g. 10012011000123).');
          return;
        }
        if (!fssaiFile) {
          setLocalError('Please upload your FSSAI license document.');
          return;
        }
      } else {
        // Individual / Event
        if (!govIdNumber.trim()) {
          setLocalError(`Please enter your valid ${govIdType} Number.`);
          return;
        }
        if (govIdType === 'Aadhaar') {
          const cleanAadhaar = govIdNumber.replace(/\D/g, '');
          if (cleanAadhaar.length !== 12) {
            setLocalError('Aadhaar Number must be 12 digits.');
            return;
          }
        }
        if (govIdType === 'PAN') {
          const cleanPan = govIdNumber.trim().toUpperCase();
          if (cleanPan.length !== 10) {
            setLocalError('PAN Number must be 10 characters (e.g. ABCDE1234F).');
            return;
          }
        }
        if (!eventName.trim()) {
          setLocalError('Please enter the event name (e.g. Wedding Banquet, Private Reception).');
          return;
        }
        if (!eventDate) {
          setLocalError('Please select the event date.');
          return;
        }
        if (!selfDeclaration) {
          setLocalError('You must confirm the food safety self-declaration checklist before proceeding.');
          return;
        }
      }
    } else {
      // Recipient -> Receiver Variety (NGO, Hospital, School, Community Kitchen, Disaster Relief)
      if (!ngoOrgName.trim()) {
        setLocalError('Please enter your Organization / Facility name.');
        return;
      }
      const activeDocVal = receiverDocNumber.trim() || ngoDarpanId.trim();
      const catConfig = RECEIVER_CATEGORIES_CONFIG[recipientSubType];
      if (!activeDocVal || activeDocVal.length < 5) {
        setLocalError(`Please enter a valid ${catConfig.title} verification ID/license number (e.g. ${catConfig.verificationFieldPlaceholder}).`);
        return;
      }
    }

    setLoading(true);
    try {
      // Build verificationDocs object
      const verificationDocs: Record<string, any> = {
        submittedAt: new Date().toISOString(),
      };

      const catConfig = RECEIVER_CATEGORIES_CONFIG[recipientSubType];
      const effectiveDocNum = (receiverDocNumber.trim() || ngoDarpanId.trim()).toUpperCase();

      if (effectiveRole === 'donor') {
        if (donorSubType === 'restaurant') {
          verificationDocs.businessName = businessName.trim();
          verificationDocs.fssaiNumber = fssaiNumber.replace(/\D/g, '');
          verificationDocs.fssaiDocName = fssaiFile?.name;
          verificationDocs.fssaiDocSize = fssaiFile?.size;
          verificationDocs.fssaiDocUrl = fssaiFile?.dataUrl;
        } else {
          verificationDocs.govIdType = govIdType;
          verificationDocs.govIdNumber = govIdNumber.trim().toUpperCase();
          verificationDocs.eventName = eventName.trim();
          verificationDocs.eventDate = eventDate;
          verificationDocs.selfDeclaration = selfDeclaration;
        }
      } else {
        verificationDocs.orgName = ngoOrgName.trim();
        verificationDocs.recipientCategory = recipientSubType;
        verificationDocs.receiverVerificationDocType = catConfig.verificationDocTitle;
        verificationDocs.receiverVerificationDocNumber = effectiveDocNum;
        verificationDocs.receiverVerificationBadge = catConfig.badgeLabel;
        verificationDocs.ngoDarpanId = recipientSubType === 'ngo_shelter' ? effectiveDocNum : undefined;
        verificationDocs.hospitalCeaNumber = recipientSubType === 'hospital' ? effectiveDocNum : undefined;
        verificationDocs.schoolUdiseCode = recipientSubType === 'school' ? effectiveDocNum : undefined;
        verificationDocs.trustRegistrationNumber = recipientSubType === 'community_kitchen' ? effectiveDocNum : undefined;
        verificationDocs.disasterAuthId = recipientSubType === 'disaster_relief' ? effectiveDocNum : undefined;
        verificationDocs.registrationCertificateNumber = regCertNumber.trim() || effectiveDocNum;
        verificationDocs.regCertificateDocName = regCertFile?.name;
        verificationDocs.regCertificateDocSize = regCertFile?.size;
        verificationDocs.regCertificateDocUrl = regCertFile?.dataUrl;
        if (tax12A80GNumber.trim()) {
          verificationDocs.tax12A80GNumber = tax12A80GNumber.trim().toUpperCase();
        }
      }

      const orgDisplayName =
        effectiveRole === 'donor'
          ? donorSubType === 'restaurant'
            ? businessName.trim()
            : eventName.trim()
          : ngoOrgName.trim();

      const profilePayload = {
        role: (effectiveRole === 'donor'
          ? donorSubType === 'restaurant'
            ? 'restaurant'
            : 'donor'
          : 'ngo') as any,
        donorType: effectiveRole === 'donor' ? donorSubType : undefined,
        recipientType: effectiveRole === 'recipient' ? recipientSubType : undefined,
        recipientCategoryTitle: effectiveRole === 'recipient' ? catConfig.title : undefined,
        receiverVerificationDocNumber: effectiveRole === 'recipient' ? effectiveDocNum : undefined,
        receiverVerificationBadge: effectiveRole === 'recipient' ? catConfig.badgeLabel : undefined,
        verificationDocs,
        verificationStatus: 'verified' as const,
        orgName: orgDisplayName,
        displayName: orgDisplayName,
        phone: cleanPhone,
        city: effectiveCity,
        address: effectiveCity,
        liabilityConsentAccepted: true,
        consentTimestamp: new Date().toISOString(),
      };

      if (currentUser) {
        await saveVerificationProfile(profilePayload);
      } else {
        await signUpWithVerification(email.trim(), password, profilePayload);
      }

      setSuccessToast(
        effectiveRole === 'donor' && donorSubType === 'individual_event'
          ? 'Profile registered! Your listings will be marked with a Self-Declared safety badge.'
          : 'Verification submitted! Your profile is set to Pending Verification.'
      );

      if (onSuccessRoute) {
        onSuccessRoute(effectiveRole);
      }

      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[Verification Submit Error]:', err);
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // Quick Sign In for existing users
  const handleQuickSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signInWithEmail(email.trim(), password);
      if (profile && !profile.role && !profile.isDemo) {
        setStep('role_select');
        setLocalError('Please select your role and submit verification details.');
        setLoading(false);
        return;
      }

      let targetRole: ModalRole = 'donor';
      if (profile?.role === 'admin') {
        targetRole = 'admin';
      } else if (profile?.role === 'volunteer') {
        targetRole = 'volunteer';
      } else if (profile?.role === 'ngo' || profile?.role === 'recipient') {
        targetRole = 'recipient';
      }

      setSuccessToast('Signed in successfully!');
      if (onSuccessRoute) {
        onSuccessRoute(targetRole);
      }
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 800);
    } catch (err: any) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Re-Login with stored / remembered User ID
  const handleOneClickReLogin = async (identifierOrUid?: string) => {
    clearError();
    setLocalError(null);
    setLoading(true);

    try {
      const profile = await quickReLogin(identifierOrUid);
      if (profile) {
        let targetRole: ModalRole = 'donor';
        if (profile.role === 'admin') targetRole = 'admin';
        else if (profile.role === 'volunteer') targetRole = 'volunteer';
        else if (profile.role === 'ngo' || profile.role === 'recipient') targetRole = 'recipient';

        setSuccessToast(`Welcome back, ${profile.displayName || profile.orgName || 'Member'}! Signed in.`);
        if (onSuccessRoute) {
          onSuccessRoute(targetRole);
        }
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Please enter your password to sign in.');
    } finally {
      setLoading(false);
    }
  };

  // Fill credentials helper for demo personas
  const handleFillDemoCredentials = (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => {
    if (role === 'restaurant') {
      setEmail('chef@bistrodelight.com');
      setPassword('DemoRestaurant2026!');
    } else if (role === 'ngo') {
      setEmail('caretaker@hopeshelter.org');
      setPassword('DemoNGOShelter2026!');
    } else if (role === 'volunteer') {
      setEmail('courier@foodlink-volunteer.org');
      setPassword('DemoVolunteer2026!');
    } else if (role === 'admin') {
      setEmail('admin@foodlink.org');
      setPassword('AdminFoodLink2026!');
    }
    setStep('signin');
    setLocalError(null);
    clearError();
  };

  // Instant Demo Sign-in: Logs in as persona, routes to right dashboard, closes modal
  const handleDemoSignIn = async (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => {
    clearError();
    setLocalError(null);
    setActiveDemo(role);

    try {
      await signInAsDemo(role);

      // Route directly to that persona's dashboard
      let targetDashboard: ModalRole = 'donor';
      if (role === 'admin') targetDashboard = 'admin';
      else if (role === 'volunteer') targetDashboard = 'volunteer';
      else if (role === 'ngo') targetDashboard = 'recipient';
      else targetDashboard = 'donor';

      if (onSuccessRoute) {
        onSuccessRoute(targetDashboard);
      }

      onClose();
    } catch (err: any) {
      console.warn('Demo persona sign in notice:', err);
    } finally {
      setActiveDemo(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-xl lg:max-w-4xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative my-auto border max-h-[92vh] overflow-y-auto transition-colors ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-4 pb-3 border-b ${
            isDark ? 'border-[#233833]' : 'border-[#DDE7E1]'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <div className="mb-0.5">
              <FoodLinkLogo size="sm" variant="compact" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#059669] inline-block animate-pulse"></span>
              <h2
                className={`text-[20px] sm:text-[22px] font-extrabold tracking-tight ${
                  isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                }`}
              >
                {step === 'role_select'
                  ? t('auth.modalTitleJoin', 'Join FoodLink • Select Role')
                  : step === 'volunteer_signin'
                  ? t('auth.modalTitleCourier', 'Voluntary Courier Sign In')
                  : step === 'admin_signin'
                  ? t('auth.modalTitleAdmin', 'Platform Admin Sign In')
                  : step === 'auth_options'
                  ? t('auth.modalTitleAuthOptions', `Sign In as ${selectedRole === 'donor' ? 'Food Donor' : 'Recipient NGO'}`)
                  : step === 'verification'
                  ? t('auth.modalTitleVerification', `Verification: ${selectedRole === 'donor' ? 'Donor Verification' : 'Recipient NGO Verification'}`)
                  : t('auth.modalTitleWelcomeBack', 'Welcome Back to FoodLink')}
              </h2>
            </div>
            <p className={`text-[13.5px] leading-snug ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
              {step === 'role_select'
                ? t('auth.selectRoleSubtitle', 'Select whether you are donating food, claiming for a shelter, volunteering to deliver, or administering.')
                : step === 'volunteer_signin'
                ? t('auth.roleCourierDesc', 'Sign in as a community volunteer courier to pick up and deliver surplus food.')
                : step === 'admin_signin'
                ? t('auth.roleAdminDesc', 'Sign in with administrative credentials to review verifications and manage listings.')
                : step === 'auth_options'
                ? `Choose your preferred sign-in method for your ${selectedRole === 'donor' ? 'Donor' : 'Recipient'} account.`
                : step === 'verification'
                ? 'Provide verification details to ensure food safety and regulatory compliance.'
                : t('auth.resetPasswordDesc', 'Sign in to manage your active food rescue listings.')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 cursor-pointer ${
              isDark
                ? 'bg-[#1C2E2A] hover:bg-[#233833] text-[#F2F7F4]'
                : 'bg-[#DEEAE2] hover:bg-[#CFDED5] text-[#0E1715]'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="mt-3 p-3 rounded-xl bg-[#D97706]/15 border border-[#D97706]/40 text-[#D97706] flex items-center gap-2 text-[14px] font-semibold animate-in fade-in">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Error Notification Banner */}
        {displayError && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#ffdad6] border border-[#ffb598] text-[#93000a] text-[13px] leading-relaxed flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#ba1a1a] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">
              <span className="font-bold block">Notice:</span>
              <span>{displayError}</span>
            </div>
            <button
              onClick={() => {
                clearError();
                setLocalError(null);
              }}
              className="text-[#93000a] hover:opacity-75 font-bold cursor-pointer"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Two-Column Layout on Desktop: Comfortable Form Width on Left, Helper Panel on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-4">
          <div className={`${
            (step === 'signin' || step === 'volunteer_signin' || step === 'admin_signin')
              ? 'lg:col-span-12 xl:col-span-12'
              : 'lg:col-span-7 xl:col-span-7'
          } space-y-4`}>

            {/* Quick Top Navigation: Sign In vs Create Account Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#EAF2ED] dark:bg-[#12221B] border border-[#CFDED5] dark:border-[#223B2F]">
              <button
                type="button"
                onClick={() => {
                  setStep('signin');
                  setSelectedRole(null);
                  setLocalError(null);
                  clearError();
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  step === 'signin' || step === 'volunteer_signin' || step === 'admin_signin'
                    ? 'bg-[#2E7D4F] text-white shadow-xs'
                    : 'text-[#4B6356] dark:text-[#9FBDB0] hover:text-[#0F1E17] dark:hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">login</span>
                <span>{t('auth.signInBtn', 'Sign In')} {savedUserId ? '• Saved ID' : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('role_select');
                  setSelectedRole(null);
                  setLocalError(null);
                  clearError();
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  step === 'role_select' || step === 'auth_options' || step === 'verification'
                    ? 'bg-[#2E7D4F] text-white shadow-xs'
                    : 'text-[#4B6356] dark:text-[#9FBDB0] hover:text-[#0F1E17] dark:hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">person_add</span>
                <span>{t('auth.signUpBtn', 'Create Account')} / Roles</span>
              </button>
            </div>

        {/* =========================================================================
            VIEW 1: NO ROLE SELECTED YET -> REQUIRE PICKING ROLE FIRST
           ========================================================================= */}
        {step === 'role_select' && (
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#D97706]">
                {t('auth.selectRoleSubtitle', 'Pick your role to get started:')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setStep('signin');
                }}
                className="text-[13px] font-semibold text-[#D97706] hover:underline cursor-pointer"
              >
                {t('auth.alreadyHaveAccount', 'Existing member?')} {t('auth.signInLink', 'Sign In')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Role Card 1: Continue as Donor */}
              <button
                type="button"
                onClick={() => handleSelectRole('donor')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#D97706]'
                    : 'bg-[#FEF3C7]/60 hover:bg-[#FEF3C7] border-[#CFDED5] hover:border-[#D97706]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#D97706] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">restaurant</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      {t('auth.roleDonorTitle', 'Continue as Donor')}
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      {t('auth.roleDonorDesc', 'For restaurants, commercial food businesses, caterers, or private weddings & events.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#D97706] text-[13px] font-bold">
                  <span>{t('auth.roleDonorTitle', 'Sign In / Register as Donor')}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 2: Continue as Recipient */}
              <button
                type="button"
                onClick={() => handleSelectRole('recipient')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#0F6E56]'
                    : 'bg-[#DCEEE8]/50 hover:bg-[#DCEEE8] border-[#CFDED5] hover:border-[#0F6E56]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#0F6E56] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">volunteer_activism</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      {t('auth.roleRecipientTitle', 'Continue as Recipient')}
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      {t('auth.roleRecipientDesc', 'For registered NGOs, orphanages, old age homes, shelters, and community kitchens.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#0F6E56] text-[13px] font-bold">
                  <span>{t('auth.roleRecipientTitle', 'Sign In / Register as Recipient')}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 3: Voluntary Courier Sign In (NEW) */}
              <button
                type="button"
                onClick={() => handleSelectRole('volunteer')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1A2B27] hover:bg-[#233833] border-[#233833] hover:border-[#2E7D4F]'
                    : 'bg-[#EAF3EC] hover:bg-[#D9EBDC] border-[#CFDED5] hover:border-[#2E7D4F]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#2E7D4F] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">directions_bike</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      {t('auth.roleCourierTitle', 'Voluntary Sign In')}
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      {t('auth.roleCourierDesc', 'For community volunteers, bike couriers, and drivers helping transport surplus meals to shelters.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#2E7D4F] text-[13px] font-bold">
                  <span>{t('auth.modalTitleCourier', 'Voluntary Courier Sign In')}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>

              {/* Role Card 4: Admin Sign In (NEW) */}
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shadow-xs ${
                  isDark
                    ? 'bg-[#1E262C] hover:bg-[#28333B] border-[#2E3C45] hover:border-[#4B799E]'
                    : 'bg-[#EDF3F8] hover:bg-[#DEE9F2] border-[#CFDED5] hover:border-[#4B799E]'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-12 h-12 rounded-xl bg-[#2C485E] text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
                  </div>
                  <div>
                    <h3
                      className={`text-[17px] font-extrabold ${
                        isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                      }`}
                    >
                      {t('auth.roleAdminTitle', 'Admin Sign In')}
                    </h3>
                    <p
                      className={`text-[12.5px] leading-relaxed mt-1 ${
                        isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'
                      }`}
                    >
                      {t('auth.roleAdminDesc', 'Authorized portal for operations team, charity document verification, and listings audit.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#CFDED5]/30 text-[#2C485E] dark:text-[#8BB4D9] text-[13px] font-bold">
                  <span>{t('auth.modalTitleAdmin', 'Platform Admin Sign In')}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: ROLE IS SELECTED -> SHOW REGISTRATION (PRIMARY) & GOOGLE SIGN-IN SHORTCUT
           ========================================================================= */}
        {step === 'auth_options' && selectedRole && (
          <div className="flex flex-col gap-4 mt-4">
            {/* Role Header Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                selectedRole === 'donor'
                  ? isDark
                    ? 'bg-[#2B2312]/60 border-[#D97706]/40 text-[#F2F7F4]'
                    : 'bg-[#FEF3C7] border-[#D97706]/30 text-[#0E1715]'
                  : isDark
                  ? 'bg-[#1C3A2F]/60 border-[#2E6B56] text-[#F2F7F4]'
                  : 'bg-[#DCEEE8] border-[#A0F3D4] text-[#0E1715]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`material-symbols-outlined text-[24px] ${
                    selectedRole === 'donor' ? 'text-[#D97706]' : 'text-[#0F6E56]'
                  }`}
                >
                  {selectedRole === 'donor' ? 'storefront' : 'volunteer_activism'}
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Selected Role
                  </span>
                  <span className="text-[15px] font-extrabold">
                    {selectedRole === 'donor'
                      ? 'Food Donor (Surplus Food Provider)'
                      : 'Recipient NGO (Community Shelter / Kitchen)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setStep('role_select');
                }}
                className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#162421] border-[#233833] text-[#B8CCC1] hover:text-white'
                    : 'bg-white border-[#CFDED5] text-[#4D5C56] hover:text-[#0E1715]'
                }`}
              >
                Change Role
              </button>
            </div>

            {/* SECTION 1: PRIMARY ACTION FOR NEW USERS -> VERIFICATION FORM */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-[#D97706]">
                <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                <span>New {selectedRole === 'donor' ? 'Donor' : 'Recipient'} Registration (Required)</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('verification')}
                className="w-full py-4 px-4 bg-[#D97706] hover:bg-[#B45309] active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-between gap-3 shadow-sm transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">assignment</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-black leading-tight">
                      Fill {selectedRole === 'donor' ? 'Donor' : 'Recipient'} Verification Details
                    </div>
                    <div className="text-[12px] text-white/85 font-normal mt-0.5 truncate">
                      Required form for food safety standards &amp; profile activation
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform shrink-0">
                  arrow_forward
                </span>
              </button>
            </div>

            {/* Clear Divider */}
            <div className="relative my-1 flex items-center justify-center">
              <div className={`w-full h-[1px] ${isDark ? 'bg-[#233833]' : 'bg-[#DDE7E1]'}`}></div>
              <span
                className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? 'bg-[#162421] text-[#7B9487]' : 'bg-[#FFFFFF] text-[#827A72]'
                }`}
              >
                Already Registered?
              </span>
            </div>

            {/* SECTION 2: SIGN-IN SHORTCUT FOR ALREADY REGISTERED USERS */}
            <div className="flex flex-col gap-2.5">
              <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                If you already registered and verified your profile on FoodLink:
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className={`w-full h-[50px] border active:scale-[0.99] font-bold text-[14.5px] rounded-xl shadow-xs flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer ${
                  isDark
                    ? 'bg-[#1C2E2A] border-[#233833] text-[#F2F7F4] hover:bg-[#233833]'
                    : 'bg-[#FFFFFF] border-[#CFDED5] text-[#0E1715] hover:bg-[#EBF2ED]'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Already registered? Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('signin')}
                className="text-[12.5px] font-bold text-[#D97706] hover:underline self-center mt-0.5 cursor-pointer"
              >
                Or sign in with existing email &amp; password
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: SUB-TYPE VERIFICATION FORM
           ========================================================================= */}
        {step === 'verification' && selectedRole && (
          <form onSubmit={handleSubmitVerification} className="flex flex-col gap-4 mt-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#CFDED5]/40">
              <button
                type="button"
                onClick={() => setStep('auth_options')}
                className="flex items-center gap-1 text-[13px] font-bold text-[#D97706] hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#D97706]">
                Verification Form ({selectedRole === 'donor' ? 'Donor' : 'Recipient'})
              </span>
            </div>

            {/* Google Account Linked Status (if authenticated via Google) */}
            {currentUser && (
              <div className="p-3 rounded-xl bg-[#D97706]/10 border border-[#D97706]/30 flex items-center justify-between text-[13px] gap-2">
                <div className="flex items-center gap-2.5 text-[#D97706] min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">mark_email_read</span>
                  <div className="min-w-0">
                    <span className="font-bold block truncate">Google Account: {currentUser.email}</span>
                    <span className="text-[11px] opacity-80 block truncate">Complete verification details below to activate dashboard access</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D97706] text-white text-[10px] font-black uppercase shrink-0">
                  Step 2 of 2
                </span>
              </div>
            )}

            {/* DONOR FLOW */}
            {selectedRole === 'donor' && (
              <div className="flex flex-col gap-4">
                {/* Sub-type switcher */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-[14px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                    Donor Sub-Type
                  </label>
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 p-1 rounded-xl border text-[13px] font-semibold ${
                      isDark
                        ? 'bg-[#0E1715] border-[#233833]'
                        : 'bg-[#F4F8F5] border-[#CFDED5]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDonorSubType('restaurant')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        donorSubType === 'restaurant'
                          ? isDark
                            ? 'bg-[#1A2B27] text-[#D97706] shadow-xs font-bold'
                            : 'bg-[#FFFFFF] text-[#D97706] shadow-2xs font-bold'
                          : isDark
                          ? 'text-[#A09A90] hover:text-[#F2F7F4]'
                          : 'text-[#4D5C56] hover:text-[#0E1715]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">storefront</span>
                      <span>Restaurant / Food Business</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonorSubType('individual_event')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        donorSubType === 'individual_event'
                          ? isDark
                            ? 'bg-[#1A2B27] text-[#D97706] shadow-xs font-bold'
                            : 'bg-[#FFFFFF] text-[#D97706] shadow-2xs font-bold'
                          : isDark
                          ? 'text-[#A09A90] hover:text-[#F2F7F4]'
                          : 'text-[#4D5C56] hover:text-[#0E1715]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">celebration</span>
                      <span>Individual / Event Host</span>
                    </button>
                  </div>
                </div>

                {/* Sub-type 1: Restaurant / Food Business */}
                {donorSubType === 'restaurant' && (
                  <div className="flex flex-col gap-3.5 animate-in fade-in">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="business-name"
                        className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                      >
                        Business / Establishment Name *
                      </label>
                      <input
                        id="business-name"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. The Grand Bistro & Caterers"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Required Contact Phone & Operating City */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="restaurant-phone"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          Primary Phone Number *
                        </label>
                        <input
                          id="restaurant-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="restaurant-city"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          Operating Metro City *
                        </label>
                        <select
                          id="restaurant-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all cursor-pointer ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} ({c.state})
                            </option>
                          ))}
                          <option value="other">Other City...</option>
                        </select>
                      </div>
                    </div>

                    {city === 'other' && (
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Specify City / Region Name *
                        </label>
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          placeholder="e.g. Surat, Lucknow, Indore"
                          required
                          className={`w-full h-[44px] rounded-xl px-3.5 text-[14px] border focus:outline-none focus:border-[#D97706] ${
                            isDark ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]' : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="fssai-num"
                          className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                        >
                          FSSAI License Number (14-digit format) *
                        </label>
                        <span className="text-[11px] font-mono text-[#D97706]">
                          {fssaiNumber.replace(/\D/g, '').length}/14 digits
                        </span>
                      </div>
                      <input
                        id="fssai-num"
                        type="text"
                        maxLength={14}
                        value={fssaiNumber}
                        onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="14-digit number e.g. 10012011000123"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono border focus:outline-none focus:border-[#D97706] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Upload Field for FSSAI License Document */}
                    <div className="flex flex-col gap-1.5">
                      <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        FSSAI License Document *
                      </label>
                      <div
                        className={`border-2 border-dashed rounded-xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-colors relative cursor-pointer ${
                          fssaiFile
                            ? isDark
                              ? 'border-[#4ADE80] bg-[#1C3A2F]/30'
                              : 'border-[#0F6E56] bg-[#DCEEE8]/30'
                            : isDark
                            ? 'border-[#233833] hover:border-[#D97706] bg-[#121E1C]'
                            : 'border-[#CFDED5] hover:border-[#D97706] bg-[#EBF2ED]'
                        }`}
                      >
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileUpload(e, 'fssai')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {fssaiFile ? (
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F6E56] dark:text-[#4ADE80]">
                            <span className="material-symbols-outlined text-[22px]">check_circle</span>
                            <span>{fssaiFile.name} ({(fssaiFile.size / 1024).toFixed(0)} KB)</span>
                            <span className="text-[11px] underline ml-2 text-[#D97706]">Change</span>
                          </div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[26px] text-[#D97706]">
                              upload_file
                            </span>
                            <span className={`text-[13px] font-medium ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                              Click or drag &amp; drop to upload FSSAI Certificate (PDF, PNG, JPG)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-type 2: Individual / Event */}
                {donorSubType === 'individual_event' && (
                  <div className="flex flex-col gap-3.5 animate-in fade-in">
                    <div className="p-3 rounded-xl bg-[#D97706]/10 border border-[#D97706]/30 text-[12px] flex items-center gap-2 text-[#D97706]">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>
                        No FSSAI license required. Your donations will display a verified <strong>"Self-Declared"</strong> safety badge.
                      </span>
                    </div>

                    {/* Organizer / Contact Name */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="individual-name" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        Host / Contact Person Name *
                      </label>
                      <input
                        id="individual-name"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        required
                        className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                          isDark
                            ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                    </div>

                    {/* Phone & City for Individual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="individual-phone" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Contact Phone Number *
                        </label>
                        <input
                          id="individual-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor="individual-city" className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          City / Metro Region *
                        </label>
                        <select
                          id="individual-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all cursor-pointer ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} ({c.state})
                            </option>
                          ))}
                          <option value="other">Other City...</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Government ID Type *
                        </label>
                        <select
                          value={govIdType}
                          onChange={(e) => setGovIdType(e.target.value as 'Aadhaar' | 'PAN')}
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        >
                          <option value="Aadhaar">Aadhaar Card (UIDAI)</option>
                          <option value="PAN">PAN Card (Income Tax Dept)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          {govIdType} Number *
                        </label>
                        <input
                          type="text"
                          value={govIdNumber}
                          onChange={(e) => setGovIdNumber(e.target.value)}
                          placeholder={govIdType === 'Aadhaar' ? '12-digit Aadhaar' : '10-char PAN (ABCDE1234F)'}
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] uppercase font-mono border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Event Name *
                        </label>
                        <input
                          type="text"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder="e.g. Wedding Reception, Corporate Banquet"
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                          Event Date *
                        </label>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          required
                          className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                            isDark
                              ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                              : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Self-declaration checkbox */}
                    <label
                      className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                        selfDeclaration
                          ? isDark
                            ? 'bg-[#2B2312]/60 border-[#D97706]'
                            : 'bg-[#FEF3C7] border-[#D97706]'
                          : isDark
                          ? 'bg-[#121E1C] border-[#233833]'
                          : 'bg-[#EBF2ED] border-[#CFDED5]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selfDeclaration}
                        onChange={(e) => setSelfDeclaration(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-[#D97706] rounded focus:ring-[#D97706] cursor-pointer"
                        required
                      />
                      <span className={`text-[13px] font-medium leading-relaxed ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                        <strong>Mandatory Declaration:</strong> "I confirm this food was prepared/stored safely and is fit for donation."
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* RECIPIENT FLOW - RECEIVER VARIETY (NGO, HOSPITAL, SCHOOL, COMMUNITY KITCHEN, ETC.) */}
            {selectedRole === 'recipient' && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                {/* 1. Category Selector: Select Organization Type */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="receiver-category"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Which organization category are you from? *
                    </label>
                    <span className="text-[11px] font-bold text-[#D97706] bg-[#D97706]/15 px-2 py-0.5 rounded-full">
                      {RECEIVER_CATEGORIES_CONFIG[recipientSubType].badgeLabel}
                    </span>
                  </div>

                  {/* Dropdown Select Option */}
                  <select
                    id="receiver-category"
                    value={recipientSubType}
                    onChange={(e) => {
                      const nextType = e.target.value as RecipientSubType;
                      setRecipientSubType(nextType);
                      setReceiverDocNumber('');
                    }}
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[14.5px] font-bold border focus:outline-none focus:border-[#D97706] transition-all cursor-pointer ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                    }`}
                  >
                    {Object.values(RECEIVER_CATEGORIES_CONFIG).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>

                  {/* Visual Category Quick Select Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {Object.values(RECEIVER_CATEGORIES_CONFIG).map((cat) => {
                      const isSelected = recipientSubType === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setRecipientSubType(cat.id);
                            setReceiverDocNumber('');
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-[12px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#D97706] bg-[#D97706]/15 text-[#D97706] ring-1 ring-[#D97706]'
                              : isDark
                              ? 'border-[#233833] bg-[#121E1C] text-[#B8CCC1] hover:border-[#7B9487]'
                              : 'border-[#CFDED5] bg-[#FFFFFF] text-[#4D5C56] hover:border-[#D97706]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-[#D97706] shrink-0">
                            {cat.icon}
                          </span>
                          <span className="truncate">{cat.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className={`text-[12px] leading-relaxed ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].description}
                  </p>
                </div>

                {/* 2. Facility / Organization Name */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="ngo-name"
                    className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                  >
                    {recipientSubType === 'hospital'
                      ? 'Hospital / Clinic / Medical Ward Name *'
                      : recipientSubType === 'school'
                      ? 'School / Academy / Education Center Name *'
                      : recipientSubType === 'community_kitchen'
                      ? 'Community Kitchen / Langar / Trust Name *'
                      : recipientSubType === 'disaster_relief'
                      ? 'Relief Camp / Municipal Ward Station Name *'
                      : recipientSubType === 'restaurant_canteen'
                      ? 'Restaurant / Canteen / Eatery Name *'
                      : 'Organization / NGO Shelter Name *'}
                  </label>
                  <input
                    id="ngo-name"
                    type="text"
                    value={ngoOrgName}
                    onChange={(e) => setNgoOrgName(e.target.value)}
                    placeholder={
                      recipientSubType === 'hospital'
                        ? 'e.g. St. Jude Charitable Hospital & Patient Canteen'
                        : recipientSubType === 'school'
                        ? 'e.g. Prerna Vidya Mandir & Community School'
                        : recipientSubType === 'community_kitchen'
                        ? 'e.g. Seva Annadanam & Langar Trust'
                        : recipientSubType === 'disaster_relief'
                        ? 'e.g. Ward 4 Emergency Transit Relief Station'
                        : recipientSubType === 'restaurant_canteen'
                        ? 'e.g. Annapurna Community Bistro & Redistribution Kitchen'
                        : 'e.g. Hope Community Shelter & Care Home'
                    }
                    required
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                </div>

                {/* 3. Phone & City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ngo-phone"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Primary Contact Phone *
                    </label>
                    <input
                      id="ngo-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="ngo-city"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      Operating Metro City *
                    </label>
                    <select
                      id="ngo-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] border focus:outline-none focus:border-[#D97706] transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833]'
                          : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5]'
                      }`}
                    >
                      {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.state})
                        </option>
                      ))}
                      <option value="other">Other City...</option>
                    </select>
                  </div>
                </div>

                {/* 4. Respective Mandatory Verification ID */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="receiver-doc-number"
                      className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}
                    >
                      {RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationDocTitle}
                    </label>
                    <span className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Respective Verification</span>
                    </span>
                  </div>
                  <input
                    id="receiver-doc-number"
                    type="text"
                    value={receiverDocNumber}
                    onChange={(e) => setReceiverDocNumber(e.target.value.toUpperCase())}
                    placeholder={RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationFieldPlaceholder}
                    required
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono font-bold border focus:outline-none focus:border-[#D97706] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                  <span className={`text-[11.5px] ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].verificationHint}
                  </span>
                </div>

                {/* 5. Upload Field for Registration Certificate / License */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-[13.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                    Upload Registration Certificate / Establishment License *
                  </label>
                  <p className={`text-[11.5px] ${isDark ? 'text-[#7B9487]' : 'text-[#827A72]'}`}>
                    {RECEIVER_CATEGORIES_CONFIG[recipientSubType].regCertHelp}
                  </p>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center flex flex-col items-center justify-center gap-2 transition-colors relative cursor-pointer ${
                      regCertFile
                        ? isDark
                          ? 'border-[#4ADE80] bg-[#1C3A2F]/30'
                          : 'border-[#0F6E56] bg-[#DCEEE8]/30'
                        : isDark
                        ? 'border-[#233833] hover:border-[#D97706] bg-[#121E1C]'
                        : 'border-[#CFDED5] hover:border-[#D97706] bg-[#EBF2ED]'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'regCert')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {regCertFile ? (
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F6E56] dark:text-[#4ADE80]">
                        <span className="material-symbols-outlined text-[22px]">check_circle</span>
                        <span>{regCertFile.name} ({(regCertFile.size / 1024).toFixed(0)} KB)</span>
                        <span className="text-[11px] underline ml-2 text-[#D97706]">Change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[12.5px] text-[#7B9487]">
                        <span className="material-symbols-outlined text-[24px] text-[#D97706]">upload_file</span>
                        <span>Click to browse Certificate / License (PDF, PNG, JPG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional 12A / 80G number field */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="tax-12a"
                    className={`text-[13.5px] font-bold flex items-center justify-between ${
                      isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'
                    }`}
                  >
                    <span>12A / 80G Registration Number</span>
                    <span className="text-[11px] font-normal text-[#7B9487] bg-[#F4F8F5] dark:bg-[#0E1715] px-2 py-0.5 rounded">
                      Optional
                    </span>
                  </label>
                  <input
                    id="tax-12a"
                    type="text"
                    value={tax12A80GNumber}
                    onChange={(e) => setTax12A80GNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AAAT0123EF20211 (Optional for tax receipts)"
                    className={`w-full h-[46px] rounded-xl px-3.5 text-[15px] font-mono border focus:outline-none focus:border-[#D97706] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#EBF2ED] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Account Credentials (if not logged in) */}
            {!currentUser && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-3 pt-3 mt-1 ${
                  isDark
                    ? 'bg-[#0E1715] border-[#233833]'
                    : 'bg-[#F4F8F5]/60 border-[#CFDED5]'
                }`}
              >
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#D97706]">
                  Account Sign-In Credentials
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className={`text-[12.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                      Email address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@organization.org"
                      required
                      className={`w-full h-[44px] rounded-xl px-3 text-[14px] border focus:outline-none focus:border-[#D97706] transition-all ${
                        isDark
                          ? 'bg-[#162421] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                          : 'bg-[#FFFFFF] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className={`text-[12.5px] font-bold ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                      Create Password (6+ chars) *
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Secure password"
                        required
                        className={`w-full h-[44px] rounded-xl pl-3 pr-10 text-[14px] border focus:outline-none focus:border-[#D97706] transition-all ${
                          isDark
                            ? 'bg-[#162421] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                            : 'bg-[#FFFFFF] text-[#0E1715] border-[#CFDED5] placeholder:text-[#827A72]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 text-[#7B9487] hover:text-[#0E1715] dark:hover:text-white"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mandatory Platform Liability & Food Safety Declaration */}
            <label
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors mt-1 ${
                liabilityConsentAccepted
                  ? isDark
                    ? 'bg-[#2B2312]/60 border-[#D97706]'
                    : 'bg-[#FEF3C7] border-[#D97706]'
                  : isDark
                  ? 'bg-[#121E1C] border-[#233833]'
                  : 'bg-[#EBF2ED] border-[#CFDED5]'
              }`}
            >
              <input
                type="checkbox"
                checked={liabilityConsentAccepted}
                onChange={(e) => setLiabilityConsentAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#D97706] rounded focus:ring-[#D97706] cursor-pointer shrink-0"
                required
              />
              <span className={`text-[12.5px] font-medium leading-relaxed ${isDark ? 'text-[#F2F7F4]' : 'text-[#0E1715]'}`}>
                <strong>Mandatory Safety &amp; Compliance Declaration:</strong> I certify all registration details are authentic. I agree to uphold FoodLink food safety protocols, hygiene, temperature guidelines, and platform terms for all surplus food activities.
              </span>
            </label>

            {/* Submit Verification Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#D97706] hover:bg-[#B45309] active:scale-[0.99] text-white font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer mt-1"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              )}
              <span>Submit Verification &amp; Access Dashboard</span>
            </button>
          </form>
        )}



        {/* =========================================================================
            COMMON SIGN-IN SECTION (UNIFIED FOR ALL ROLES & AUTH METHODS)
           ========================================================================= */}
        {(step === 'signin' || step === 'volunteer_signin' || step === 'admin_signin') && (
          <div className="mt-2">
            <CommonSignInSection
              initialRole={
                step === 'volunteer_signin' || selectedRole === 'volunteer'
                  ? 'volunteer'
                  : step === 'admin_signin' || selectedRole === 'admin'
                  ? 'admin'
                  : selectedRole === 'donor'
                  ? 'donor'
                  : selectedRole === 'recipient'
                  ? 'recipient'
                  : 'all'
              }
              isModal={true}
              onSuccessRoute={(role) => {
                setSuccessToast('Signed in successfully!');
                if (onSuccessRoute) {
                  onSuccessRoute(role);
                }
                setTimeout(() => {
                  setSuccessToast(null);
                  onClose();
                }, 600);
              }}
              onSwitchToSignUp={(role) => {
                if (role) {
                  setSelectedRole(role);
                  setStep('auth_options');
                } else {
                  setSelectedRole(null);
                  setStep('role_select');
                }
              }}
              onNavigateHome={() => onClose()}
            />
          </div>
        )}
      </div>

      {/* Right Helper Column on wide screens (For Registration Steps) */}
      {!(step === 'signin' || step === 'volunteer_signin' || step === 'admin_signin') && (
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-5 flex-col gap-4 sticky top-0">
        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#EAF3EC] border-[#D9E2DA]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#2E7D4F] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
            <span>Why FoodLink Verifies Accounts</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#526357]'}`}>
            To protect donors and recipient shelters, FoodLink verifies government credentials (FSSAI licenses for commercial food donors and NGO Darpan or trust certificates for charities).
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#2E7D4F] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">shield</span>
            <span>Good Samaritan Protection</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#526357]'}`}>
            Food donations made in good faith are shielded from liability under Food Safety and Standards Authority of India (FSSAI) guidelines.
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border transition-colors ${
            isDark ? 'bg-[#121E1C] border-[#233833]' : 'bg-[#FFFFFF] border-[#CFDED5]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-[#2E7D4F] font-bold text-sm">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            <span>Automated Tax Receipts</span>
          </div>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#B8CCC1]' : 'text-[#526357]'}`}>
            Every verified rescue automatically generates 80G tax receipts and CSR impact certificates for audit compliance.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-transparent border border-dashed border-[#CFDED5] dark:border-[#233833] text-xs text-[#526357] dark:text-[#B8CCC1]">
          <span className="font-bold text-[#1E2A22] dark:text-[#FAFBF8] block mb-1">Assistance Helpline</span>
          <span>Need help signing in or verifying your organization? Call toll-free 1800-555-FOOD.</span>
        </div>
      </div>
      )}
    </div>
      </div>
    </div>
  );
};
