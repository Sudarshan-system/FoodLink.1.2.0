import React from 'react';
import { useTheme } from './ThemeContext';

interface LegalPageProps {
  type: 'privacy' | 'terms';
  onNavigateHome: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ type, onNavigateHome }) => {
  const { isDark } = useTheme();
  const isPrivacy = type === 'privacy';

  return (
    <div className="site-container py-10 sm:py-16 max-w-4xl">
      <div className="mb-6">
        <button
          type="button"
          onClick={onNavigateHome}
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${
            isDark ? 'text-[#D1DDD5] hover:text-[#FAFBF8]' : 'text-[#526357] hover:text-[#1E2A22]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Home</span>
        </button>
      </div>

      <article
        className={`p-6 sm:p-10 rounded-2xl border ${
          isDark
            ? 'bg-[#18241C] border-[#2D4436] text-[#FAFBF8]'
            : 'bg-[#FFFFFF] border-[#D9E2DA] text-[#1E2A22]'
        }`}
      >
        <header className="border-b pb-6 mb-8 border-[#D9E2DA] dark:border-[#2D4436]">
          <span className="text-xs uppercase tracking-wider font-bold text-[#2E7D4F] block mb-2">
            Legal Documentation
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-3">
            {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
          </h1>
          <p className={`text-sm ${isDark ? 'text-[#95A89C]' : 'text-[#526357]'}`}>
            Effective date: March 2026 • FoodLink India
          </p>
        </header>

        {isPrivacy ? (
          <div className="space-y-6 text-sm sm:text-base leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">1. Information We Collect</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                We collect contact information (name, email, phone number, address) provided during registration and food surplus dispatch. For food businesses and recipient organizations, we also collect license and registration details required for verification.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">2. How We Use Information</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                Information is used solely to coordinate food pickups, verify participating food establishments and shelters, and ensure food safety compliance. We do not sell or monetize personal information.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">3. Data Security and Retention</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                Your data is stored securely using encrypted cloud infrastructure. You may request access, correction, or deletion of your profile data at any time by contacting our support desk.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">4. Contact Information</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                For privacy inquiries or data requests, write to privacy@foodlink.org.
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-6 text-sm sm:text-base leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">1. Platform Scope</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                FoodLink connects verified food donors with verified charitable shelters, orphanages, and community kitchens. FoodLink does not prepare or package meals directly.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">2. Food Safety &amp; Good Samaritan Guidelines</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                All donors must declare the freshness, storage temperature, preparation timestamp, and allergen details for every listing. Donors acting in good faith without gross negligence are protected under Good Samaritan food donation guidelines.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">3. Verification Requirements</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                Listing surplus food and claiming batches requires an active account with verified organizational credentials. Submissions may be suspended if verification documentation is invalid or unreadable.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-serif text-xl font-bold">4. Governing Law</h2>
              <p className={isDark ? 'text-[#D1DDD5]' : 'text-[#526357]'}>
                These terms are governed by the laws and food safety regulations applicable across India.
              </p>
            </section>
          </div>
        )}
      </article>
    </div>
  );
};
