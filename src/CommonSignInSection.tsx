import React, { useState, useEffect } from 'react';
import { useAuth, DEMO_USERS, UserRole, DonorSubType, RecipientSubType } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useTranslation } from './LanguageContext';
import { FoodLinkLogo } from './FoodLinkLogo';

export type SignInRoleOption = 'all' | 'donor' | 'recipient' | 'volunteer' | 'admin';

export interface CommonSignInSectionProps {
  initialRole?: SignInRoleOption;
  onSuccessRoute?: (role: 'donor' | 'recipient' | 'volunteer' | 'admin') => void;
  onSwitchToSignUp?: (role?: 'donor' | 'recipient' | 'volunteer') => void;
  onNavigateHome?: () => void;
  isModal?: boolean;
}

interface RoleConfig {
  id: SignInRoleOption;
  label: string;
  badge: string;
  icon: string;
  description: string;
  emailPlaceholder: string;
  accentColor: string;
  borderActive: string;
  bgLight: string;
  bgDark: string;
  demoKey?: 'restaurant' | 'ngo' | 'volunteer' | 'admin';
  demoName?: string;
  demoSubtitle?: string;
}

const ROLE_CONFIGS: Record<SignInRoleOption, RoleConfig> = {
  all: {
    id: 'all',
    label: 'All Accounts',
    badge: 'Universal',
    icon: 'groups',
    description: 'Sign in to any verified account (Donor, Shelter, Courier, or Admin)',
    emailPlaceholder: 'e.g. chef@bistrodelight.com, courier@foodlink.org, or saved User ID',
    accentColor: '#059669',
    borderActive: 'border-[#059669]',
    bgLight: 'bg-[#ECFDF5]',
    bgDark: 'bg-[#132A1F]',
  },
  donor: {
    id: 'donor',
    label: 'Food Donor',
    badge: 'Kitchens & Banquets',
    icon: 'restaurant',
    description: 'Hotels, banquet halls, restaurants, caterers & event organizers',
    emailPlaceholder: 'e.g. chef@bistrodelight.com or registered donor email',
    accentColor: '#D97706',
    borderActive: 'border-[#D97706]',
    bgLight: 'bg-[#FEF3C7]/70',
    bgDark: 'bg-[#2E2010]',
    demoKey: 'restaurant',
    demoName: 'Chef Marcus',
    demoSubtitle: 'The Grand Bistro & Banquet',
  },
  recipient: {
    id: 'recipient',
    label: 'Shelter / NGO',
    badge: 'Charity & Kitchens',
    icon: 'volunteer_activism',
    description: 'Community shelters, orphanages, elder care, schools & langars',
    emailPlaceholder: 'e.g. caretaker@hopeshelter.org or registered NGO email',
    accentColor: '#0F6E56',
    borderActive: 'border-[#0F6E56]',
    bgLight: 'bg-[#E6F4EA]',
    bgDark: 'bg-[#102920]',
    demoKey: 'ngo',
    demoName: 'Sister Mary',
    demoSubtitle: 'Hope Community Shelter',
  },
  volunteer: {
    id: 'volunteer',
    label: 'Volunteer Courier',
    badge: 'Delivery Runner',
    icon: 'directions_bike',
    description: 'Community volunteers transporting inspected batches to shelters',
    emailPlaceholder: 'e.g. courier@foodlink-volunteer.org or courier handle',
    accentColor: '#2E7D4F',
    borderActive: 'border-[#2E7D4F]',
    bgLight: 'bg-[#EAF3EC]',
    bgDark: 'bg-[#182C22]',
    demoKey: 'volunteer',
    demoName: 'Rahul Verma',
    demoSubtitle: 'Eco Courier Runner (Bengaluru)',
  },
  admin: {
    id: 'admin',
    label: 'Platform Admin',
    badge: 'Operations & Safety',
    icon: 'admin_panel_settings',
    description: 'National operations, verification review & statutory compliance',
    emailPlaceholder: 'e.g. admin@foodlink.org (Administrative access)',
    accentColor: '#2C485E',
    borderActive: 'border-[#4B799E]',
    bgLight: 'bg-[#EDF3F8]',
    bgDark: 'bg-[#1A2630]',
    demoKey: 'admin',
    demoName: 'Central Admin Officer',
    demoSubtitle: 'FoodLink National HQ',
  },
};

export const CommonSignInSection: React.FC<CommonSignInSectionProps> = ({
  initialRole = 'all',
  onSuccessRoute,
  onSwitchToSignUp,
  onNavigateHome,
  isModal = false,
}) => {
  const {
    signInWithEmail,
    signInWithGoogle,
    signInAsDemo,
    savedUserId,
    savedAccountInfo,
    recentAccounts,
    rememberUserId,
    setRememberUserId,
    removeSavedAccount,
    quickReLogin,
    resetPassword,
  } = useAuth();

  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Role selector state: Which option the user chooses to sign in as
  const [selectedRole, setSelectedRole] = useState<SignInRoleOption>(initialRole);

  // Sync if initialRole changes externally
  useEffect(() => {
    if (initialRole) {
      setSelectedRole(initialRole);
    }
  }, [initialRole]);

  // Form credentials state
  const [identifier, setIdentifier] = useState(savedUserId || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password inline panel
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetStatusMsg, setResetStatusMsg] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Handle standard submit (Email or User ID + Password)
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage(t('auth.enterEmailOrId', 'Please enter your registered email address or User ID.'));
      return;
    }
    if (!password) {
      setErrorMessage(t('auth.enterPassword', 'Please enter your account password.'));
      return;
    }

    setLoading(true);
    try {
      const profile = await signInWithEmail(cleanId, password);

      // Determine appropriate landing dashboard
      let targetDashboard: 'donor' | 'recipient' | 'volunteer' | 'admin' = 'donor';
      if (profile?.role === 'admin') {
        targetDashboard = 'admin';
      } else if (profile?.role === 'volunteer') {
        targetDashboard = 'volunteer';
      } else if (profile?.role === 'ngo' || profile?.role === 'recipient') {
        targetDashboard = 'recipient';
      } else {
        targetDashboard = 'donor';
      }

      setSuccessMessage(
        `Welcome back, ${profile?.displayName || profile?.orgName || 'Member'}! Directing to dashboard...`
      );

      if (onSuccessRoute) {
        setTimeout(() => {
          onSuccessRoute(targetDashboard);
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to sign in. Please verify your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Fast Re-login with Stored User ID
  const handleOneClickReLogin = async (idToUse?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const profile = await quickReLogin(idToUse || savedUserId || undefined);
      if (profile) {
        let targetRole: 'donor' | 'recipient' | 'volunteer' | 'admin' = 'donor';
        if (profile.role === 'admin') targetRole = 'admin';
        else if (profile.role === 'volunteer') targetRole = 'volunteer';
        else if (profile.role === 'ngo' || profile.role === 'recipient') targetRole = 'recipient';
        else targetRole = 'donor';

        setSuccessMessage(`Welcome back, ${profile.displayName || 'Member'}! Signed in.`);
        if (onSuccessRoute) {
          setTimeout(() => {
            onSuccessRoute(targetRole);
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Please enter your password to sign in with this ID.');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      let targetRole: 'donor' | 'recipient' | 'volunteer' | 'admin' = 'donor';
      if (result.profile?.role === 'admin') targetRole = 'admin';
      else if (result.profile?.role === 'volunteer') targetRole = 'volunteer';
      else if (result.profile?.role === 'ngo' || result.profile?.role === 'recipient') targetRole = 'recipient';
      else targetRole = 'donor';

      setSuccessMessage('Signed in with Google successfully!');
      if (onSuccessRoute) {
        setTimeout(() => {
          onSuccessRoute(targetRole);
        }, 400);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in was interrupted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Persona 1-Click Login
  const handleDemoPersonaSignIn = async (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => {
    setErrorMessage(null);
    setActiveDemo(role);
    setLoading(true);

    try {
      const profile = await signInAsDemo(role);
      let targetRole: 'donor' | 'recipient' | 'volunteer' | 'admin' = 'donor';
      if (role === 'admin') targetRole = 'admin';
      else if (role === 'volunteer') targetRole = 'volunteer';
      else if (role === 'ngo') targetRole = 'recipient';
      else targetRole = 'donor';

      setSuccessMessage(`Signed in as ${profile.displayName}! Redirecting...`);
      if (onSuccessRoute) {
        setTimeout(() => {
          onSuccessRoute(targetRole);
        }, 400);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not launch demo persona.');
    } finally {
      setActiveDemo(null);
      setLoading(false);
    }
  };

  // Demo Pre-fill helper
  const handlePreFillDemo = (role: 'restaurant' | 'ngo' | 'volunteer' | 'admin') => {
    const demo = DEMO_USERS[role];
    if (demo) {
      setIdentifier(demo.email);
      setPassword(demo.password);
      if (role === 'restaurant') setSelectedRole('donor');
      else if (role === 'ngo') setSelectedRole('recipient');
      else if (role === 'volunteer') setSelectedRole('volunteer');
      else if (role === 'admin') setSelectedRole('admin');
      setErrorMessage(null);
    }
  };

  // Send Password Reset
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatusMsg(null);
    if (!resetEmailInput.trim()) {
      setResetStatusMsg('Please enter your registered email address.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmailInput.trim());
      setResetStatusMsg('Password reset instructions sent! Please check your email inbox.');
    } catch (err: any) {
      setResetStatusMsg(err.message || 'Unable to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const currentConfig = ROLE_CONFIGS[selectedRole];

  return (
    <div className={`w-full ${isModal ? '' : 'site-container py-8 sm:py-12'}`}>
      <div
        className={`w-full max-w-4xl mx-auto rounded-2xl transition-colors ${
          isModal
            ? 'bg-transparent'
            : isDark
            ? 'bg-[#14231E] border border-[#233833] p-6 sm:p-8 shadow-xl'
            : 'bg-white border border-[#D9E2DA] p-6 sm:p-8 shadow-md'
        }`}
      >
        {/* Top Header & Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9E2DA]/60 dark:border-[#233833]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] inline-block animate-pulse"></span>
              <span className="text-xs font-black uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
                FoodLink Common Sign-In Portal
              </span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                isDark ? 'text-[#F4F8F5]' : 'text-[#0F1E17]'
              }`}
            >
              Sign In to FoodLink
            </h1>
            <p className={`text-sm mt-1 max-w-[65ch] ${isDark ? 'text-[#A0B8AB]' : 'text-[#526357]'}`}>
              One unified sign-in section for everyone. Choose your account option below and authenticate with email, Google, or instant test personas.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-[#D9E2DA] dark:border-[#233833] text-[#526357] dark:text-[#A0B8AB] hover:text-[#0F1E17] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#182C22] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back to Home</span>
              </button>
            )}

            {onSwitchToSignUp && (
              <button
                type="button"
                onClick={() =>
                  onSwitchToSignUp(
                    selectedRole === 'donor'
                      ? 'donor'
                      : selectedRole === 'recipient'
                      ? 'recipient'
                      : selectedRole === 'volunteer'
                      ? 'volunteer'
                      : undefined
                  )
                }
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#059669]/10 text-[#059669] dark:text-[#34D399] hover:bg-[#059669]/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>New? Register →</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-semibold flex items-start gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">error</span>
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:opacity-75 p-0.5 cursor-pointer font-bold"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#ECFDF5] dark:bg-[#112F21] border border-[#A7F3D0] dark:border-[#059669]/40 text-[#065F46] dark:text-[#34D399] text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[20px] text-[#059669] shrink-0">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* =========================================================================
            SECTION 1: CHOOSE HOW YOU WANT TO SIGN IN (ROLE OPTION PICKER)
           ========================================================================= */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#4B6356] dark:text-[#A0B8AB] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>1. Choose Who is Signing In (Role Option):</span>
            </label>
            <span className="text-[11px] text-[#526357] dark:text-[#8BA396]">
              Select an option to customize the login view
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
            {(Object.keys(ROLE_CONFIGS) as SignInRoleOption[]).map((roleKey) => {
              const cfg = ROLE_CONFIGS[roleKey];
              const isSelected = selectedRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => {
                    setSelectedRole(roleKey);
                    setErrorMessage(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between gap-2 cursor-pointer relative ${
                    isSelected
                      ? `${cfg.borderActive} ${isDark ? cfg.bgDark : cfg.bgLight} ring-2 ring-offset-1 ${
                          isDark ? 'ring-offset-[#14231E]' : 'ring-offset-white'
                        } ring-[#059669]/40 shadow-xs`
                      : isDark
                      ? 'border-[#233833] bg-[#101C16] hover:border-[#059669]/60 hover:bg-[#15251E]'
                      : 'border-[#D9E2DA] bg-[#F9FBFA] hover:border-[#059669]/60 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${cfg.accentColor}20`,
                        color: cfg.accentColor,
                      }}
                    >
                      <span className="material-symbols-outlined text-[19px]">{cfg.icon}</span>
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>

                  <div>
                    <div
                      className={`text-[13px] font-extrabold truncate ${
                        isDark ? 'text-[#F4F8F5]' : 'text-[#0F1E17]'
                      }`}
                    >
                      {cfg.label}
                    </div>
                    <div className="text-[10.5px] font-medium text-[#526357] dark:text-[#9FBDB0] truncate">
                      {cfg.badge}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Role explanation bar */}
          <div
            className={`mt-2.5 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              isDark ? currentConfig.bgDark : currentConfig.bgLight
            } ${currentConfig.borderActive}/40`}
          >
            <div className="flex items-center gap-2 text-[#0F1E17] dark:text-[#F4F8F5] min-w-0">
              <span className="material-symbols-outlined text-[17px] shrink-0" style={{ color: currentConfig.accentColor }}>
                {currentConfig.icon}
              </span>
              <span className="truncate">
                <strong className="font-bold">{currentConfig.label}:</strong> {currentConfig.description}
              </span>
            </div>

            {currentConfig.demoKey && (
              <button
                type="button"
                onClick={() => handlePreFillDemo(currentConfig.demoKey!)}
                className="text-[11px] font-bold text-[#059669] dark:text-[#34D399] hover:underline shrink-0 cursor-pointer flex items-center gap-1"
                title={`Prefill ${currentConfig.label} demo credentials`}
              >
                <span>Prefill {currentConfig.label} credentials</span>
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: CHOOSE YOUR AUTHENTICATION METHOD
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6 pt-5 border-t border-[#D9E2DA]/60 dark:border-[#233833]">
          {/* LEFT: PRIMARY CREDENTIALS FORM */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4B6356] dark:text-[#A0B8AB] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">key</span>
                <span>2. Sign In with Credentials:</span>
              </span>
              <span className="text-[11px] text-[#526357] dark:text-[#8BA396]">
                Accepts Email, User ID, or Role Keyword
              </span>
            </div>

            {/* A. 1-Click Saved User Re-Login (if device has remembered user) */}
            {savedUserId && (
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-gradient-to-br from-[#12241C] to-[#182C22] border-[#254A37]'
                    : 'bg-gradient-to-br from-[#ECFDF5] to-[#F0FDF4] border-[#A7F3D0]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {savedAccountInfo?.displayName ? savedAccountInfo.displayName.charAt(0).toUpperCase() : '👤'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-extrabold text-[#0F1E17] dark:text-[#F4F8F5]">
                          {savedAccountInfo?.displayName || 'Remembered Member'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#059669]/15 text-[#059669] dark:text-[#34D399]">
                          Saved ID
                        </span>
                      </div>
                      <div className="text-[11px] text-[#4B6356] dark:text-[#A0B8AB] font-mono">
                        {savedAccountInfo?.identifier || savedUserId} {savedAccountInfo?.role ? `• ${savedAccountInfo.role.toUpperCase()}` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSavedAccount(savedUserId)}
                    className="text-slate-400 hover:text-rose-500 p-1 text-xs cursor-pointer"
                    title="Forget saved account on this device"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleOneClickReLogin(savedAccountInfo?.identifier || savedUserId)}
                    className="flex-1 h-[42px] bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    {loading ? (
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                    )}
                    <span>1-Click Fast Re-login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(savedAccountInfo?.identifier || savedUserId || '');
                      setPassword('');
                    }}
                    className="px-3 h-[42px] rounded-xl border border-[#D9E2DA] dark:border-[#233833] text-xs font-bold hover:bg-white dark:hover:bg-[#1A2E24] cursor-pointer"
                    title="Fill into input form"
                  >
                    Prefill
                  </button>
                </div>
              </div>
            )}

            {/* Recent Accounts Switcher */}
            {recentAccounts && recentAccounts.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-bold text-[#526357] dark:text-[#8BA396] shrink-0">
                  Switch Saved Account:
                </span>
                {recentAccounts.map((acc) => (
                  <button
                    key={acc.uid || acc.identifier}
                    type="button"
                    onClick={() => {
                      setIdentifier(acc.identifier);
                      handleOneClickReLogin(acc.identifier);
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 hover:border-[#059669] cursor-pointer bg-white dark:bg-[#12221B]"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center text-[9px] font-bold">
                      {acc.displayName ? acc.displayName.charAt(0) : 'U'}
                    </span>
                    <span className="truncate max-w-[100px]">{acc.displayName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* B. Standard Sign-In Form */}
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              {/* Email / User ID Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="common-auth-identifier"
                    className={`text-[13px] font-bold ${isDark ? 'text-[#F4F8F5]' : 'text-[#0F1E17]'}`}
                  >
                    {selectedRole === 'donor'
                      ? 'Donor Email or User ID'
                      : selectedRole === 'recipient'
                      ? 'Shelter / NGO Email or User ID'
                      : selectedRole === 'volunteer'
                      ? 'Courier Volunteer Email or Handle'
                      : selectedRole === 'admin'
                      ? 'Administrator Email'
                      : 'Email Address or User ID'}
                  </label>
                  {savedUserId && (
                    <span className="text-[11px] text-[#059669] dark:text-[#34D399] font-medium">
                      ✓ Saved ID active
                    </span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span
                    className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                      isDark ? 'text-[#7B9487]' : 'text-[#827A72]'
                    }`}
                  >
                    badge
                  </span>
                  <input
                    id="common-auth-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={currentConfig.emailPlaceholder}
                    className={`w-full h-[46px] rounded-xl pl-11 pr-4 text-[14px] border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#F9FBFA] text-[#0E1715] border-[#D9E2DA] placeholder:text-[#827A72]'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="common-auth-password"
                    className={`text-[13px] font-bold ${isDark ? 'text-[#F4F8F5]' : 'text-[#0F1E17]'}`}
                  >
                    Security Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(!showForgotPassword);
                      setResetEmailInput(identifier.includes('@') ? identifier : '');
                      setResetStatusMsg(null);
                    }}
                    className="text-[12px] font-bold text-[#059669] dark:text-[#34D399] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span
                    className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
                      isDark ? 'text-[#7B9487]' : 'text-[#827A72]'
                    }`}
                  >
                    key
                  </span>
                  <input
                    id="common-auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account security password"
                    className={`w-full h-[46px] rounded-xl pl-11 pr-12 text-[14px] border focus:outline-none focus:border-[#059669] transition-all ${
                      isDark
                        ? 'bg-[#121E1C] text-[#F2F7F4] border-[#233833] placeholder:text-[#7B9487]'
                        : 'bg-[#F9FBFA] text-[#0E1715] border-[#D9E2DA] placeholder:text-[#827A72]'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-2 w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer ${
                      isDark ? 'text-[#B8CCC1] hover:bg-[#1C2E2A]' : 'text-[#4D5C56] hover:bg-[#DEEAE2]'
                    }`}
                    aria-label="Toggle password visibility"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember User ID Checkbox */}
              <div className="flex items-center justify-between py-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberUserId}
                    onChange={(e) => setRememberUserId(e.target.checked)}
                    className="w-4 h-4 rounded text-[#059669] focus:ring-[#059669] cursor-pointer"
                  />
                  <span className={`text-[12.5px] font-semibold ${isDark ? 'text-[#D1E3D7]' : 'text-[#2C3E34]'}`}>
                    Remember User ID for 1-click re-login on this device
                  </span>
                </label>
              </div>

              {/* Forgot Password Inline Modal */}
              {showForgotPassword && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 animate-in fade-in ${
                    isDark ? 'bg-[#162720] border-[#234533]' : 'bg-[#EBF7EE] border-[#C2E5CC]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#059669] dark:text-[#34D399]">
                      Send Password Reset Link
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="text-xs text-slate-500 hover:text-black dark:hover:text-white"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={resetEmailInput}
                      onChange={(e) => setResetEmailInput(e.target.value)}
                      placeholder="Enter registered email address"
                      className="flex-1 px-3 py-2 rounded-lg border text-xs bg-white dark:bg-[#101C16] text-black dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={handleSendResetLink}
                      className="px-4 py-2 bg-[#059669] text-white rounded-lg font-bold hover:bg-[#047857] cursor-pointer disabled:opacity-60"
                    >
                      {resetLoading ? 'Sending...' : 'Send Link'}
                    </button>
                  </div>
                  {resetStatusMsg && <span className="text-[11.5px] font-semibold text-[#059669]">{resetStatusMsg}</span>}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-extrabold text-[14.5px] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer mt-2"
              >
                {loading && !activeDemo ? (
                  <span className="material-symbols-outlined animate-spin text-[19px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[19px]">login</span>
                )}
                <span>
                  {selectedRole === 'all'
                    ? 'Sign In to FoodLink'
                    : `Sign In as ${currentConfig.label}`}
                </span>
              </button>
            </form>

            {/* Google Sign-In Option */}
            <div className="pt-2">
              <div className="relative my-3 flex items-center justify-center">
                <div className={`w-full h-[1px] ${isDark ? 'bg-[#233833]' : 'bg-[#DDE7E1]'}`}></div>
                <span
                  className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                    isDark ? 'bg-[#14231E] text-[#7B9487]' : 'bg-white text-[#827A72]'
                  }`}
                >
                  or continue with
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className={`w-full h-[46px] border active:scale-[0.99] font-bold text-[13.5px] rounded-xl shadow-2xs flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer ${
                  isDark
                    ? 'bg-[#182C22] hover:bg-[#20382B] text-white border-[#2A4B3A]'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-[#D1E3D7]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>

          {/* RIGHT: 1-CLICK INSTANT TEST PERSONAS (FOR PRESENTING & TESTING) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#059669] dark:text-[#34D399] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>3. 1-Click Test Personas:</span>
              </span>
              <span className="text-[11px] text-[#526357] dark:text-[#8BA396]">
                Instant demo access
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-[#A0B8AB]' : 'text-[#526357]'}`}>
              Use these four pre-verified personas to test and present all platform workflows instantly without typing:
            </p>

            <div className="space-y-2.5">
              {/* Persona 1: Restaurant Donor */}
              <div
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  selectedRole === 'donor'
                    ? 'border-[#D97706] ring-1 ring-[#D97706]/40 bg-[#FEF3C7]/40 dark:bg-[#2A1E11]'
                    : isDark
                    ? 'border-[#233833] bg-[#101C16] hover:border-[#D97706]'
                    : 'border-[#D9E2DA] bg-[#F9FBFA] hover:border-[#D97706]'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleDemoPersonaSignIn('restaurant')}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#D97706]/15 text-[#D97706] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">restaurant</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                        Restaurant Donor
                      </span>
                      <span className="text-[9.5px] px-1 py-0.2 rounded bg-[#D97706]/15 text-[#D97706] font-bold">
                        Verified
                      </span>
                    </div>
                    <div className="text-[11px] text-[#526357] dark:text-[#A0B8AB] truncate">
                      Chef Marcus • The Grand Bistro
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreFillDemo('restaurant')}
                    className="px-2 py-1 text-[11px] font-bold rounded text-slate-500 hover:text-[#D97706] cursor-pointer"
                    title="Prefill into form"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoPersonaSignIn('restaurant')}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white flex items-center gap-1 cursor-pointer"
                    title="Sign in instantly"
                  >
                    {activeDemo === 'restaurant' ? (
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">flash_on</span>
                    )}
                    <span>Login</span>
                  </button>
                </div>
              </div>

              {/* Persona 2: Shelter NGO Recipient */}
              <div
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  selectedRole === 'recipient'
                    ? 'border-[#0F6E56] ring-1 ring-[#0F6E56]/40 bg-[#E6F4EA]/40 dark:bg-[#11241B]'
                    : isDark
                    ? 'border-[#233833] bg-[#101C16] hover:border-[#0F6E56]'
                    : 'border-[#D9E2DA] bg-[#F9FBFA] hover:border-[#0F6E56]'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleDemoPersonaSignIn('ngo')}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0F6E56]/15 text-[#0F6E56] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                        Shelter / NGO Recipient
                      </span>
                      <span className="text-[9.5px] px-1 py-0.2 rounded bg-[#0F6E56]/15 text-[#0F6E56] font-bold">
                        Darpan ✓
                      </span>
                    </div>
                    <div className="text-[11px] text-[#526357] dark:text-[#A0B8AB] truncate">
                      Sister Mary • Hope Community Shelter
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreFillDemo('ngo')}
                    className="px-2 py-1 text-[11px] font-bold rounded text-slate-500 hover:text-[#0F6E56] cursor-pointer"
                    title="Prefill into form"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoPersonaSignIn('ngo')}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#0F6E56] hover:bg-[#0A5240] text-white flex items-center gap-1 cursor-pointer"
                    title="Sign in instantly"
                  >
                    {activeDemo === 'ngo' ? (
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">flash_on</span>
                    )}
                    <span>Login</span>
                  </button>
                </div>
              </div>

              {/* Persona 3: Voluntary Courier */}
              <div
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  selectedRole === 'volunteer'
                    ? 'border-[#2E7D4F] ring-1 ring-[#2E7D4F]/40 bg-[#EAF3EC]/40 dark:bg-[#182C22]'
                    : isDark
                    ? 'border-[#233833] bg-[#101C16] hover:border-[#2E7D4F]'
                    : 'border-[#D9E2DA] bg-[#F9FBFA] hover:border-[#2E7D4F]'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleDemoPersonaSignIn('volunteer')}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#2E7D4F]/15 text-[#2E7D4F] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">directions_bike</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                        Voluntary Courier Runner
                      </span>
                      <span className="text-[9.5px] px-1 py-0.2 rounded bg-[#2E7D4F]/15 text-[#2E7D4F] font-bold">
                        Pledge ✓
                      </span>
                    </div>
                    <div className="text-[11px] text-[#526357] dark:text-[#A0B8AB] truncate">
                      Rahul Verma • Eco Runner
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreFillDemo('volunteer')}
                    className="px-2 py-1 text-[11px] font-bold rounded text-slate-500 hover:text-[#2E7D4F] cursor-pointer"
                    title="Prefill into form"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoPersonaSignIn('volunteer')}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white flex items-center gap-1 cursor-pointer"
                    title="Sign in instantly"
                  >
                    {activeDemo === 'volunteer' ? (
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">flash_on</span>
                    )}
                    <span>Login</span>
                  </button>
                </div>
              </div>

              {/* Persona 4: Platform Admin */}
              <div
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  selectedRole === 'admin'
                    ? 'border-[#4B799E] ring-1 ring-[#4B799E]/40 bg-[#EDF3F8]/40 dark:bg-[#1C2833]'
                    : isDark
                    ? 'border-[#233833] bg-[#101C16] hover:border-[#4B799E]'
                    : 'border-[#D9E2DA] bg-[#F9FBFA] hover:border-[#4B799E]'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleDemoPersonaSignIn('admin')}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#2C485E]/15 text-[#2C485E] dark:text-[#8BB4D9] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                        Platform Administrator
                      </span>
                      <span className="text-[9.5px] px-1 py-0.2 rounded bg-[#2C485E]/15 text-[#2C485E] dark:text-[#8BB4D9] font-bold">
                        Officer
                      </span>
                    </div>
                    <div className="text-[11px] text-[#526357] dark:text-[#A0B8AB] truncate">
                      Central Admin Officer • Ops HQ
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreFillDemo('admin')}
                    className="px-2 py-1 text-[11px] font-bold rounded text-slate-500 hover:text-[#2C485E] cursor-pointer"
                    title="Prefill into form"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoPersonaSignIn('admin')}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#2C485E] hover:bg-[#1E3445] text-white flex items-center gap-1 cursor-pointer"
                    title="Sign in instantly"
                  >
                    {activeDemo === 'admin' ? (
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">flash_on</span>
                    )}
                    <span>Login</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick helper note */}
            <div
              className={`p-3 rounded-xl border text-[11.5px] leading-relaxed flex items-start gap-2 ${
                isDark
                  ? 'bg-[#101C16] border-[#233833] text-[#8BA396]'
                  : 'bg-[#F9FBFA] border-[#D9E2DA] text-[#526357]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#059669] shrink-0 mt-0.5">info</span>
              <span>
                All personas reflect realistic Indian statutory credentials including FSSAI food business numbers, NITI Aayog NGO Darpan IDs, and courier thermal crates.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
