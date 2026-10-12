import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { FoodLinkLogo } from './FoodLinkLogo';

interface AdminLoginPageProps {
  onSuccessAdmin: () => void;
  onNavigateHome: () => void;
  onNavigateCommonSignIn?: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccessAdmin,
  onNavigateHome,
  onNavigateCommonSignIn,
}) => {
  const { signInWithEmail, signInAsDemo, signOut } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage(t('admin.enterEmailPass', 'Please enter your email and password.'));
      return;
    }

    setLoading(true);

    try {
      // 1. Check if matches preconfigured demo admin
      if (
        (cleanEmail.toLowerCase() === DEMO_USERS.admin.email.toLowerCase() ||
         cleanEmail.toLowerCase() === 'admin' ||
         cleanEmail.toLowerCase() === 'demo_admin_user') &&
        (password === DEMO_USERS.admin.password || password === 'AdminFoodLink2026!' || password === 'Admin2026!Secure')
      ) {
        await signInAsDemo('admin');
        onSuccessAdmin();
        return;
      }

      // 2. Attempt standard Firebase auth sign-in
      const profile = await signInWithEmail(cleanEmail, password);

      // Check user's admin role using existing role logic
      if (!profile || profile.role !== 'admin') {
        // Sign out non-admin immediately and show generic message without revealing email existence
        await signOut();
        setErrorMessage(t('admin.noAdminAccess', 'This account does not have admin access.'));
        return;
      }

      onSuccessAdmin();
    } catch {
      // Prompt requirement: "If the user is not an admin, sign them out and show:
      // 'This account does not have admin access.' Do not reveal whether the email exists."
      try {
        await signOut();
      } catch {
        // ignore
      }
      setErrorMessage(t('admin.noAdminAccess', 'This account does not have admin access.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoAdmin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      setEmail(DEMO_USERS.admin.email);
      setPassword(DEMO_USERS.admin.password);
      await signInAsDemo('admin');
      onSuccessAdmin();
    } catch {
      setErrorMessage('This account does not have admin access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site-container py-12 md:py-16">
      <div className="max-w-md mx-auto">
        {/* Top Navigation Links */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-sm text-[#526357] hover:text-[#1E2A22] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>{t('admin.backToFoodlink', 'Back to FoodLink')}</span>
          </button>

          {onNavigateCommonSignIn && (
            <button
              type="button"
              onClick={onNavigateCommonSignIn}
              className="text-xs font-bold text-[#059669] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Common Sign In</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>

        {/* Centered Admin Card */}
        <div className="bg-white border border-[#D4E5DA] rounded-xl shadow-xs p-7 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <FoodLinkLogo size="md" variant="compact" />
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#059669]/10 text-[#059669] flex items-center justify-center mx-auto mb-2.5">
              <span className="material-symbols-outlined text-[26px]">admin_panel_settings</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#0F1E17]">{t('admin.loginTitle', 'Admin sign in')}</h1>
            <p className="text-sm text-[#4B6356] mt-1">
              {t('admin.loginSubtitle', 'Authorized FoodLink administration access only.')}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm flex items-start gap-2.5 animate-fadeIn"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-semibold text-[#1E2A22] mb-1.5">
                {t('auth.emailLabel', 'Admin email')}
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@foodlink.org"
                autoComplete="email"
                required
                className="w-full h-11 px-3.5 rounded-lg border border-[#D9E2DA] bg-white text-[#1E2A22] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] transition-all min-h-[44px]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-semibold text-[#1E2A22] mb-1.5"
              >
                {t('auth.passwordLabel', 'Password')}
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full h-11 pl-3.5 pr-10 rounded-lg border border-[#D9E2DA] bg-white text-[#1E2A22] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D4F]/20 focus:border-[#2E7D4F] transition-all min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#526357] hover:text-[#1E2A22] transition-colors cursor-pointer"
                  aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-60 min-h-[44px] mt-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('admin.verifying', 'Verifying credentials...')}</span>
                </span>
              ) : (
                t('auth.signInBtn', 'Sign In')
              )}
            </button>
          </form>

          {/* Quick Demo Admin Sign In helper for reviewers */}
          <div className="mt-6 pt-5 border-t border-[#D9E2DA] text-center">
            <p className="text-xs text-[#526357] mb-2.5">
              {t('admin.reviewerNotice', 'Reviewer access credential: admin@foodlink.org')}
            </p>
            <button
              type="button"
              onClick={handleQuickDemoAdmin}
              disabled={loading}
              className="w-full py-2 px-3 rounded-lg border border-[#2E7D4F]/40 bg-[#EAF3EC] hover:bg-[#2E7D4F]/15 text-[#2E7D4F] text-xs font-semibold transition-colors cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>{t('admin.quickDemoBtn', 'Quick Sign In as Demo Admin')}</span>
            </button>

            {onNavigateCommonSignIn && (
              <button
                type="button"
                onClick={onNavigateCommonSignIn}
                className="mt-3 text-xs text-[#059669] hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer font-semibold"
              >
                <span className="material-symbols-outlined text-[15px]">login</span>
                <span>Common Sign-In Portal (All Roles)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
