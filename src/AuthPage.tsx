import React, { useState } from 'react';
import { useAuth } from './AuthContext';

interface AuthPageProps {
  initialTab?: 'signin' | 'signup';
  initialRole?: 'donor' | 'recipient' | null;
  onSuccessRoute?: (role: 'donor' | 'recipient' | 'admin') => void;
  onNavigateHome?: () => void;
}

type AuthTab = 'signin' | 'signup';
type OrgType = 'NGO' | 'Orphanage' | 'Old age home' | 'Shelter' | 'Other';

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'signin',
  initialRole = null,
  onSuccessRoute,
  onNavigateHome,
}) => {
  const {
    signInWithEmail,
    signUpWithVerification,
    signInWithGoogle,
    resetPassword,
    savedUserId,
    savedAccountInfo,
    quickReLogin,
  } = useAuth();

  // Active top tab: "Sign In" or "Create Account"
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState(savedUserId || '');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Create Account state: Step 1 (Role) or Step 2 (Form)
  const [selectedRole, setSelectedRole] = useState<'donor' | 'recipient' | null>(initialRole);
  const [createStep, setCreateStep] = useState<1 | 2>(initialRole ? 2 : 1);

  // Step 2 for Donor
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPassword, setDonorPassword] = useState('');
  const [showDonorPassword, setShowDonorPassword] = useState(false);
  const [donorIdFile, setDonorIdFile] = useState<{ name: string; size: string } | null>(null);

  // Step 2 for Organization
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('NGO');
  const [orgRegNumber, setOrgRegNumber] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgContactPerson, setOrgContactPerson] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [showOrgPassword, setShowOrgPassword] = useState(false);
  const [orgProofFile, setOrgProofFile] = useState<{ name: string; size: string } | null>(null);

  // Feedback states for Create Account
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Handle Sign In submission
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);

    if (!signInEmail.trim()) {
      setSignInError('Please enter your email address.');
      return;
    }
    if (!signInPassword) {
      setSignInError('Please enter your password.');
      return;
    }

    setSignInLoading(true);
    try {
      const profile = await signInWithEmail(signInEmail.trim(), signInPassword);
      if (onSuccessRoute) {
        if (profile?.role === 'admin') {
          onSuccessRoute('admin');
        } else if (profile?.role === 'ngo' || profile?.role === 'recipient') {
          onSuccessRoute('recipient');
        } else {
          onSuccessRoute('donor');
        }
      }
    } catch (err: any) {
      setSignInError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle Google Sign In (Sign In tab only)
  const handleGoogleSignIn = async () => {
    setSignInError(null);
    setSignInLoading(true);
    try {
      const result = await signInWithGoogle();
      if (onSuccessRoute) {
        if (result.profile?.role === 'admin') {
          onSuccessRoute('admin');
        } else if (result.profile?.role === 'ngo' || result.profile?.role === 'recipient') {
          onSuccessRoute('recipient');
        } else {
          onSuccessRoute('donor');
        }
      }
    } catch (err: any) {
      setSignInError(err.message || 'Google sign-in was interrupted.');
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle Forgot Password submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetEmail.trim()) {
      setResetError('Please enter your registered email address.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err: any) {
      setResetError(err.message || 'Could not send reset link. Please check the email.');
    } finally {
      setResetLoading(false);
    }
  };

  // Handle file uploads (converts file metadata)
  const handleDonorFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = Math.round(file.size / 1024);
      setDonorIdFile({ name: file.name, size: `${sizeKb} KB` });
    }
  };

  const handleOrgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = Math.round(file.size / 1024);
      setOrgProofFile({ name: file.name, size: `${sizeKb} KB` });
    }
  };

  // Handle Create Account submission
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError(null);
    setSignUpSuccess(null);

    if (!selectedRole) {
      setSignUpError('Please select whether you are a Donor or an Organization.');
      return;
    }

    if (selectedRole === 'donor') {
      if (!donorName.trim()) {
        setSignUpError('Please enter your full name or organization contact name.');
        return;
      }
      if (!donorPhone.trim() || donorPhone.replace(/\D/g, '').length < 8) {
        setSignUpError('Please enter a valid phone number (at least 8 digits).');
        return;
      }
      if (!donorEmail.trim()) {
        setSignUpError('Please enter a valid email address.');
        return;
      }
      if (donorPassword.length < 6) {
        setSignUpError('Password must be at least 6 characters.');
        return;
      }
      if (!donorIdFile) {
        setSignUpError('ID verification upload is required. Please upload your business ID, FSSAI license, or government ID.');
        return;
      }

      setSignUpLoading(true);
      try {
        await signUpWithVerification(donorEmail.trim(), donorPassword, {
          displayName: donorName.trim(),
          role: 'donor',
          donorType: 'restaurant',
          phone: donorPhone.trim(),
          orgName: donorName.trim(),
          verificationDocs: {
            businessName: donorName.trim(),
            fssaiDocName: donorIdFile.name,
            submittedAt: new Date().toISOString(),
          },
        });

        setSignUpSuccess('Donor account created successfully! Redirecting...');
        setTimeout(() => {
          if (onSuccessRoute) onSuccessRoute('donor');
        }, 1200);
      } catch (err: any) {
        setSignUpError(err.message || 'Failed to create account. Please check your details.');
      } finally {
        setSignUpLoading(false);
      }
    } else {
      // Organization registration
      if (!orgName.trim()) {
        setSignUpError('Please enter the organization name.');
        return;
      }
      if (!orgRegNumber.trim()) {
        setSignUpError('Please enter your registration number (e.g. NGO Darpan ID or Trust Reg. No.).');
        return;
      }
      if (!orgAddress.trim()) {
        setSignUpError('Please enter your registered premises address.');
        return;
      }
      if (!orgContactPerson.trim()) {
        setSignUpError('Please enter the primary contact person.');
        return;
      }
      if (!orgPhone.trim() || orgPhone.replace(/\D/g, '').length < 8) {
        setSignUpError('Please enter a valid contact phone number.');
        return;
      }
      if (!orgEmail.trim()) {
        setSignUpError('Please enter a valid organization email address.');
        return;
      }
      if (orgPassword.length < 6) {
        setSignUpError('Password must be at least 6 characters.');
        return;
      }
      if (!orgProofFile) {
        setSignUpError('Proof document upload is required. Please upload your registration certificate or trust deed.');
        return;
      }

      setSignUpLoading(true);
      try {
        await signUpWithVerification(orgEmail.trim(), orgPassword, {
          displayName: orgContactPerson.trim(),
          role: 'ngo',
          recipientType: 'ngo_shelter',
          orgName: orgName.trim(),
          phone: orgPhone.trim(),
          address: orgAddress.trim(),
          verificationStatus: 'pending',
          verificationDocs: {
            orgName: orgName.trim(),
            receiverVerificationDocNumber: orgRegNumber.trim(),
            regCertificateDocName: orgProofFile.name,
            submittedAt: new Date().toISOString(),
          },
        });

        setSignUpSuccess('Organization registered! Your account has been submitted for verification review.');
        setTimeout(() => {
          if (onSuccessRoute) onSuccessRoute('recipient');
        }, 1500);
      } catch (err: any) {
        setSignUpError(err.message || 'Failed to register organization.');
      } finally {
        setSignUpLoading(false);
      }
    }
  };

  return (
    <div className="site-container py-8 sm:py-12 lg:py-16">
      {/* Top Breadcrumb & Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1E2A22]">
            {activeTab === 'signin' ? 'Welcome back to FoodLink' : 'Join the FoodLink Network'}
          </h1>
          <p className="text-sm sm:text-base text-[#526357] mt-1 max-w-[65ch]">
            {activeTab === 'signin'
              ? 'Sign in to publish surplus food, track donations, or claim meals for your registered shelter.'
              : 'Create an account to start sharing unserved food or receiving batches for community welfare.'}
          </p>
        </div>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs sm:text-sm font-semibold text-[#2E7D4F] hover:text-[#1F5C39] underline cursor-pointer shrink-0"
          >
            Back to Home
          </button>
        )}
      </div>

      {/* Main Two-Column Container (Form Left, Soft Green Panel Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: THE AUTHENTICATION FORM */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white p-6 sm:p-8 rounded-lg border border-[#D9E2DA] shadow-2xs">
          {/* Two Tabs at Top: "Sign In" and "Create Account" */}
          <div className="flex border-b border-[#D9E2DA] mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setShowForgotPassword(false);
                setSignInError(null);
                setSignUpError(null);
              }}
              className={`py-3 px-6 text-base font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
                activeTab === 'signin'
                  ? 'border-[#2E7D4F] text-[#2E7D4F]'
                  : 'border-transparent text-[#526357] hover:text-[#1E2A22]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setShowForgotPassword(false);
                setSignInError(null);
                setSignUpError(null);
              }}
              className={`py-3 px-6 text-base font-bold border-b-2 transition-colors min-h-[44px] cursor-pointer ${
                activeTab === 'signup'
                  ? 'border-[#2E7D4F] text-[#2E7D4F]'
                  : 'border-transparent text-[#526357] hover:text-[#1E2A22]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {activeTab === 'signin' && (
            <div>
              {/* Forgot Password View */}
              {showForgotPassword ? (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-serif text-lg font-bold text-[#1E2A22]">Reset Password</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSuccess(null);
                        setResetError(null);
                      }}
                      className="text-xs text-[#2E7D4F] hover:text-[#1F5C39] font-semibold underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                  <p className="text-sm text-[#526357] leading-relaxed">
                    Enter the email address registered with your FoodLink account. We will send you a password reset link.
                  </p>

                  {resetSuccess && (
                    <div className="p-3.5 rounded-lg bg-[#EAF3EC] border border-[#2E7D4F]/30 text-xs font-semibold text-[#2E7D4F] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>{resetSuccess}</span>
                    </div>
                  )}

                  {resetError && (
                    <div className="p-3.5 rounded-lg bg-[#FFF3E8] border border-[#D9822B]/30 text-xs font-semibold text-[#D9822B] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="reset-email">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@organization.org"
                      className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full h-12 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {resetLoading ? 'Sending link...' : 'Send Password Reset Link'}
                  </button>
                </form>
              ) : (
                /* Standard Sign In Form */
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  {/* Inline Error Message */}
                  {signInError && (
                    <div className="p-3.5 rounded-lg bg-[#FFF3E8] border border-[#D9822B]/30 text-xs font-semibold text-[#D9822B] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                        <span>{signInError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSignInError(null)}
                        className="text-[#D9822B] hover:opacity-70 p-1"
                        aria-label="Dismiss error"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="signin-email">
                      Email Address
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="name@organization.org"
                      className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F] transition-colors"
                      required
                    />
                  </div>

                  {/* Password Field with Show/Hide Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-bold text-[#1E2A22]" htmlFor="signin-password">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs font-semibold text-[#2E7D4F] hover:text-[#1F5C39] underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="signin-password"
                        type={showSignInPassword ? 'text' : 'password'}
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F] transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#526357] hover:text-[#1E2A22] p-1 cursor-pointer"
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showSignInPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Sign In Submit Button */}
                  <button
                    type="submit"
                    disabled={signInLoading}
                    className="w-full h-12 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-2"
                  >
                    {signInLoading ? 'Signing in...' : 'Sign In'}
                  </button>

                  {/* Divider */}
                  <div className="relative my-6 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#D9E2DA]" />
                    </div>
                    <span className="relative bg-white px-3 text-xs font-medium text-[#526357] uppercase tracking-wider">
                      Or sign in with
                    </span>
                  </div>

                  {/* "Continue with Google" button (Appears on this tab only) */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={signInLoading}
                    className="w-full h-12 rounded-lg border border-[#D9E2DA] bg-white hover:bg-[#FAFBF8] text-[#1E2A22] font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center gap-3 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CREATE ACCOUNT */}
          {activeTab === 'signup' && (
            <div>
              {/* Inline Messages */}
              {signUpSuccess && (
                <div className="mb-5 p-4 rounded-lg bg-[#EAF3EC] border border-[#2E7D4F]/30 text-sm font-semibold text-[#2E7D4F] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>{signUpSuccess}</span>
                </div>
              )}

              {signUpError && (
                <div className="mb-5 p-3.5 rounded-lg bg-[#FFF3E8] border border-[#D9822B]/30 text-xs font-semibold text-[#D9822B] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                    <span>{signUpError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignUpError(null)}
                    className="text-[#D9822B] hover:opacity-70 p-1"
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* STEP 1: CHOOSE ROLE (Two large selectable options, no Admin) */}
              {createStep === 1 && (
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#1E2A22] mb-1">
                    Step 1: Choose your account type
                  </h2>
                  <p className="text-sm text-[#526357] mb-6">
                    Select how you will participate in the surplus food rescue network.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Option 1: I am a Donor */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('donor');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#D9E2DA] hover:border-[#2E7D4F] bg-white text-left transition-all hover:bg-[#FAFBF8] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">restaurant</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#1E2A22] mb-1">
                          I am a Donor
                        </h3>
                        <p className="text-xs text-[#526357] leading-relaxed">
                          For restaurants, wedding halls, banquet caterers, corporate cafeterias, and event organizers with surplus unserved food.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#D9E2DA] flex items-center justify-between text-xs font-bold text-[#2E7D4F]">
                        <span>Select Donor Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>

                    {/* Option 2: I am an Organization */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('recipient');
                        setCreateStep(2);
                      }}
                      className="p-6 rounded-lg border-2 border-[#D9E2DA] hover:border-[#2E7D4F] bg-white text-left transition-all hover:bg-[#FAFBF8] cursor-pointer group flex flex-col justify-between h-full min-h-[160px]"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-lg bg-[#EAF3EC] text-[#2E7D4F] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[26px]">volunteer_activism</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#1E2A22] mb-1">
                          I am an Organization
                        </h3>
                        <p className="text-xs text-[#526357] leading-relaxed">
                          For registered NGOs, orphanages, elder care shelters, rehabilitation centers, and certified community kitchens.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#D9E2DA] flex items-center justify-between text-xs font-bold text-[#2E7D4F]">
                        <span>Select Organization Account</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DETAILS FORM */}
              {createStep === 2 && (
                <div>
                  <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#D9E2DA]">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F]">
                        Step 2 of 2
                      </span>
                      <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                        {selectedRole === 'donor'
                          ? 'Donor Account Information'
                          : 'Organization Registration Details'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateStep(1)}
                      className="text-xs text-[#526357] hover:text-[#1E2A22] font-semibold underline cursor-pointer"
                    >
                      Change Account Type
                    </button>
                  </div>

                  <form onSubmit={handleSignUpSubmit} className="space-y-4">
                    {/* DONOR SPECIFIC FIELDS */}
                    {selectedRole === 'donor' && (
                      <>
                        {/* Name */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="donor-name">
                            Donor Name / Business Name *
                          </label>
                          <input
                            id="donor-name"
                            type="text"
                            value={donorName}
                            onChange={(e) => setDonorName(e.target.value)}
                            placeholder="e.g. Royal Banquet Hall or Chef Vikram"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="donor-phone">
                            Phone Number *
                          </label>
                          <input
                            id="donor-phone"
                            type="tel"
                            value={donorPhone}
                            onChange={(e) => setDonorPhone(e.target.value)}
                            placeholder="e.g. +91 98200 12345"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="donor-email">
                            Email Address *
                          </label>
                          <input
                            id="donor-email"
                            type="email"
                            value={donorEmail}
                            onChange={(e) => setDonorEmail(e.target.value)}
                            placeholder="donor@business.com"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="donor-password">
                            Create Password (minimum 6 characters) *
                          </label>
                          <div className="relative">
                            <input
                              id="donor-password"
                              type={showDonorPassword ? 'text' : 'password'}
                              value={donorPassword}
                              onChange={(e) => setDonorPassword(e.target.value)}
                              placeholder="Choose a strong password"
                              className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowDonorPassword(!showDonorPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#526357] hover:text-[#1E2A22] p-1 cursor-pointer"
                              aria-label={showDonorPassword ? 'Hide password' : 'Show password'}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {showDonorPassword ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* ID Verification Upload (Quick but required) */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="donor-id-file">
                            ID Verification Document (FSSAI License or Government ID) *
                          </label>
                          <div className="p-4 rounded-lg border-2 border-dashed border-[#D9E2DA] bg-[#FAFBF8] text-center">
                            {donorIdFile ? (
                              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#2E7D4F]/40">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="material-symbols-outlined text-[24px] text-[#2E7D4F]">
                                    check_circle
                                  </span>
                                  <div>
                                    <p className="text-sm font-bold text-[#1E2A22] truncate">{donorIdFile.name}</p>
                                    <p className="text-xs text-[#526357]">{donorIdFile.size}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setDonorIdFile(null)}
                                  className="text-xs text-[#D9822B] hover:underline font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="material-symbols-outlined text-[32px] text-[#2E7D4F] mb-1">
                                  upload_file
                                </span>
                                <p className="text-sm font-semibold text-[#1E2A22]">
                                  Click to upload document or photo
                                </p>
                                <p className="text-xs text-[#526357] mt-0.5">
                                  Supports PDF, JPG, PNG up to 10MB
                                </p>
                                <input
                                  id="donor-id-file"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleDonorFileUpload}
                                  className="mt-2 text-xs text-[#526357] cursor-pointer"
                                />
                                <div className="mt-3 pt-2 border-t border-[#D9E2DA]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDonorIdFile({ name: 'FSSAI_Licence_Registration_2026.pdf', size: '240 KB' })
                                    }
                                    className="text-xs font-semibold text-[#2E7D4F] hover:underline"
                                  >
                                    Use quick test verification document
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={signUpLoading}
                          className="w-full h-12 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signUpLoading ? 'Creating account...' : 'Create Donor Account'}
                        </button>
                      </>
                    )}

                    {/* ORGANIZATION SPECIFIC FIELDS */}
                    {selectedRole === 'recipient' && (
                      <>
                        {/* Note: Your organization will be reviewed before you can claim food */}
                        <div className="p-3.5 rounded-lg bg-[#FFF3E8] border border-[#D9822B]/30 text-xs font-semibold text-[#1E2A22] flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#D9822B] shrink-0 mt-0.5">
                            info
                          </span>
                          <span>
                            Note: Your organization will be reviewed before you can claim food.
                          </span>
                        </div>

                        {/* Organization Name */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-name">
                            Organization Name *
                          </label>
                          <input
                            id="org-name"
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Hope Community Shelter & Care Home"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Organization Type: NGO, orphanage, old age home, shelter, other */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-type">
                            Organization Type *
                          </label>
                          <select
                            id="org-type"
                            value={orgType}
                            onChange={(e) => setOrgType(e.target.value as OrgType)}
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] bg-white text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F] cursor-pointer"
                          >
                            <option value="NGO">NGO</option>
                            <option value="Orphanage">Orphanage</option>
                            <option value="Old age home">Old age home</option>
                            <option value="Shelter">Shelter</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        {/* Registration Number */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-reg">
                            Registration Number *
                          </label>
                          <input
                            id="org-reg"
                            type="text"
                            value={orgRegNumber}
                            onChange={(e) => setOrgRegNumber(e.target.value)}
                            placeholder="e.g. NGO Darpan ID, Trust Deed Reg, or Society No."
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Address */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-address">
                            Registered Facility Address *
                          </label>
                          <input
                            id="org-address"
                            type="text"
                            value={orgAddress}
                            onChange={(e) => setOrgAddress(e.target.value)}
                            placeholder="Street address, neighborhood, city"
                            className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                            required
                          />
                        </div>

                        {/* Contact Person & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-contact">
                              Contact Person *
                            </label>
                            <input
                              id="org-contact"
                              type="text"
                              value={orgContactPerson}
                              onChange={(e) => setOrgContactPerson(e.target.value)}
                              placeholder="Full name of representative"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-phone">
                              Phone Number *
                            </label>
                            <input
                              id="org-phone"
                              type="tel"
                              value={orgPhone}
                              onChange={(e) => setOrgPhone(e.target.value)}
                              placeholder="e.g. +91 98200 55555"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                              required
                            />
                          </div>
                        </div>

                        {/* Email & Password */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-email">
                              Organization Email *
                            </label>
                            <input
                              id="org-email"
                              type="email"
                              value={orgEmail}
                              onChange={(e) => setOrgEmail(e.target.value)}
                              placeholder="contact@shelter.org"
                              className="w-full h-12 px-3.5 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-password">
                              Password (min 6 characters) *
                            </label>
                            <div className="relative">
                              <input
                                id="org-password"
                                type={showOrgPassword ? 'text' : 'password'}
                                value={orgPassword}
                                onChange={(e) => setOrgPassword(e.target.value)}
                                placeholder="Create a password"
                                className="w-full h-12 pl-3.5 pr-11 rounded-lg border border-[#D9E2DA] text-[#1E2A22] text-base focus:outline-none focus:border-[#2E7D4F]"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowOrgPassword(!showOrgPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#526357] hover:text-[#1E2A22] p-1 cursor-pointer"
                                aria-label={showOrgPassword ? 'Hide password' : 'Show password'}
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  {showOrgPassword ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Proof Document Upload */}
                        <div>
                          <label className="block text-sm font-bold text-[#1E2A22] mb-1.5" htmlFor="org-proof-file">
                            Proof Document Upload (NGO Certificate or Trust Deed) *
                          </label>
                          <div className="p-4 rounded-lg border-2 border-dashed border-[#D9E2DA] bg-[#FAFBF8] text-center">
                            {orgProofFile ? (
                              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#2E7D4F]/40">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="material-symbols-outlined text-[24px] text-[#2E7D4F]">
                                    check_circle
                                  </span>
                                  <div>
                                    <p className="text-sm font-bold text-[#1E2A22] truncate">{orgProofFile.name}</p>
                                    <p className="text-xs text-[#526357]">{orgProofFile.size}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOrgProofFile(null)}
                                  className="text-xs text-[#D9822B] hover:underline font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="material-symbols-outlined text-[32px] text-[#2E7D4F] mb-1">
                                  drive_folder_upload
                                </span>
                                <p className="text-sm font-semibold text-[#1E2A22]">
                                  Upload Certificate, Deed, or Government Sanction
                                </p>
                                <p className="text-xs text-[#526357] mt-0.5">
                                  Supports PDF, JPG, PNG up to 10MB
                                </p>
                                <input
                                  id="org-proof-file"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={handleOrgFileUpload}
                                  className="mt-2 text-xs text-[#526357] cursor-pointer"
                                />
                                <div className="mt-3 pt-2 border-t border-[#D9E2DA]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOrgProofFile({ name: 'Trust_Registration_Certificate_2026.pdf', size: '320 KB' })
                                    }
                                    className="text-xs font-semibold text-[#2E7D4F] hover:underline"
                                  >
                                    Use quick test verification document
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={signUpLoading}
                          className="w-full h-12 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-base transition-colors min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 mt-4"
                        >
                          {signUpLoading ? 'Submitting registration...' : 'Register Organization'}
                        </button>
                      </>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SOFT GREEN PANEL (#EAF3EC) WITH CHECKLIST */}
        {/* On mobile, this automatically stacks below the form */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#EAF3EC] p-6 sm:p-7 rounded-lg border border-[#D9E2DA] space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-lg bg-[#2E7D4F] text-white flex items-center justify-center font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">checklist</span>
              </span>
              <h2 className="font-serif text-xl font-bold text-[#1E2A22]">
                What an account gives you
              </h2>
            </div>
            <p className="text-sm text-[#526357] leading-relaxed">
              FoodLink coordinates clean surplus food transfers directly between verified organizations in India.
            </p>
          </div>

          {/* Checklist */}
          <ul className="space-y-3.5 text-sm text-[#1E2A22]">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#2E7D4F]/20 text-[#2E7D4F] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Instant notifications:</strong> Real-time alerts when fresh food is listed in your area.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#2E7D4F]/20 text-[#2E7D4F] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Direct coordination:</strong> Chat directly with donors to schedule prompt pickups.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#2E7D4F]/20 text-[#2E7D4F] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Good Samaritan protection:</strong> Food handling compliance under statutory FSSAI rules.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#2E7D4F]/20 text-[#2E7D4F] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Audit receipts:</strong> Automated 80G tax certificates and annual CSR records.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#2E7D4F]/20 text-[#2E7D4F] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">check</span>
              </span>
              <span><strong>Zero fees:</strong> 100% free non-profit platform for donors and charities.</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-[#D9E2DA] space-y-2 text-xs text-[#526357]">
            <p className="leading-relaxed">
              Organization details are reviewed by our verification team within 24 hours to ensure food safety compliance.
            </p>
            <div className="flex items-center gap-1.5 font-semibold text-[#2E7D4F]">
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Need help? Call toll-free 1800-555-FOOD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
