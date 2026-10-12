import React, { useState, useEffect } from 'react';
import { INDIAN_CITIES, CityInfo } from './cities';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useTranslation } from './LanguageContext';
import {
  MealRequestSubscription,
  getDonorMealSubscription,
  saveDonorMealSubscription,
} from './mealRequestSubscriptionService';
import { requestFCMToken, playNotificationChime } from './fcmService';

interface NotifyMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCity?: string;
  onSaved?: (subscription: MealRequestSubscription) => void;
}

export const NotifyMeModal: React.FC<NotifyMeModalProps> = ({
  isOpen,
  onClose,
  initialCity,
  onSaved,
}) => {
  const { currentUser, userProfile, signInAsDemo } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const effectiveDonorId = currentUser?.uid || userProfile?.uid || 'demo_donor_default';
  const effectiveDonorName =
    userProfile?.displayName || currentUser?.displayName || 'Chef Marcus Vance';
  const effectiveDonorOrg = userProfile?.orgName || 'Taj Grand Banquets';

  // Form State
  const [city, setCity] = useState<string>(initialCity || userProfile?.city || 'Mumbai');
  const [area, setArea] = useState<string>('All local areas');
  const [radiusKm, setRadiusKm] = useState<number | 'all'>(10);
  const [dietaryPreference, setDietaryPreference] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [minPortions, setMinPortions] = useState<number>(20);
  const [active, setActive] = useState<boolean>(true);
  const [notifySound, setNotifySound] = useState<boolean>(true);

  // Permission & Saving Status
  const [pushStatus, setPushStatus] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';
  });
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [testSent, setTestSent] = useState<boolean>(false);

  // Available hubs for selected city
  const selectedCityInfo = INDIAN_CITIES.find(
    (c) => c.name.toLowerCase() === city.toLowerCase() || c.id.toLowerCase() === city.toLowerCase()
  );
  const availableHubs = selectedCityInfo?.hubs || [];

  // Load existing subscription if present
  useEffect(() => {
    if (!isOpen) return;

    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }

    const loadSub = async () => {
      const existing = await getDonorMealSubscription(effectiveDonorId);
      if (existing) {
        setCity(existing.city || initialCity || 'Mumbai');
        setArea(existing.area || 'All local areas');
        setRadiusKm(existing.radiusKm !== undefined ? existing.radiusKm : 10);
        setDietaryPreference(existing.dietaryPreference || 'all');
        setMinPortions(existing.minPortions || 20);
        setActive(existing.active !== undefined ? existing.active : true);
        setNotifySound(existing.notifySound !== undefined ? existing.notifySound : true);
      } else if (initialCity) {
        setCity(initialCity);
      }
    };

    loadSub();
  }, [isOpen, effectiveDonorId, initialCity]);

  if (!isOpen) return null;

  const handleRequestPushPermission = async () => {
    try {
      setIsRequestingPermission(true);
      const res = await requestFCMToken(currentUser?.uid);
      setPushStatus(res.permission);

      if (res.permission === 'granted') {
        playNotificationChime();
        setSuccessToast('Browser push notifications enabled! You will receive local meal alerts.');
        setTimeout(() => setSuccessToast(null), 3500);

        // Send a test notification
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            new Notification('🔔 FoodLink Local Alerts Active', {
              body: `You are now subscribed to receive meal requests for ${city} and nearby shelters.`,
              icon: '/favicon.svg',
            });
          } catch {
            // Ignore inside restricted iframe
          }
        }
      } else if (res.permission === 'denied') {
        alert('Push notifications are blocked in your browser settings. Please allow notifications for this site to receive instant alerts.');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSendTestNotification = () => {
    setTestSent(true);
    playNotificationChime();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🍲 [Test Alert] New Meal Request in ${city}!`, {
          body: `Sneha Sadan Child Care Home needs 60 Dinner meals (${dietaryPreference === 'veg' ? 'Pure Veg' : 'All types'}) in ${area === 'All local areas' ? city : area}.`,
          icon: '/favicon.svg',
        });
      } catch {
        // Fallback
      }
    }

    setSuccessToast(`Test notification simulated for ${city}! Chime sound played.`);
    setTimeout(() => {
      setSuccessToast(null);
      setTestSent(false);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const subscription: MealRequestSubscription = {
      donorId: effectiveDonorId,
      donorName: effectiveDonorName,
      donorOrg: effectiveDonorOrg,
      donorEmail: currentUser?.email || 'donor@foodlink.org',
      donorPhone: userProfile?.phone || '+91 98200 55442',
      city,
      area,
      radiusKm,
      dietaryPreference,
      minPortions: Number(minPortions) || 10,
      browserPermissionGranted: pushStatus === 'granted',
      active,
      notifySound,
    };

    try {
      await saveDonorMealSubscription(subscription);
      if (onSaved) {
        onSaved(subscription);
      }

      setSuccessToast(
        active
          ? `Subscribed! You will be alerted when meal requests appear in ${city}.`
          : 'Alert preferences updated (Alerts currently paused).'
      );
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving subscription:', err);
      alert('Could not save subscription. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-me-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-3xl shadow-2xl overflow-hidden transition-all my-8">
        {/* Modal Top Header with Icon and Close Button */}
        <div className="p-6 sm:p-7 border-b border-[#D1E3D7] dark:border-[#244535] bg-gradient-to-r from-[#ECFDF5] via-white to-[#ECFDF5] dark:from-[#0E2419] dark:via-[#112019] dark:to-[#0E2419]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center shadow-md shrink-0">
                <span className="material-symbols-outlined text-[26px]">notifications_active</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="notify-me-modal-title"
                    className="font-serif text-xl sm:text-2xl font-bold text-[#0F1E17] dark:text-[#F4F8F5]"
                  >
                    Notify Me • Local Meal Alerts
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#059669]/15 text-[#059669] dark:text-[#34D399]">
                    Push
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#4B6356] dark:text-[#B2CDC0] mt-1">
                  Get instant push notifications when local shelters and orphanages post hunger needs in your area.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#0F1E17] dark:text-[#F4F8F5] flex items-center justify-center cursor-pointer transition-colors shrink-0"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
          {/* Active Status Switch */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                  active ? 'bg-[#059669] animate-pulse' : 'bg-slate-400'
                }`}
              />
              <div>
                <div className="text-sm font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                  {active ? 'Alerts are Active' : 'Alerts are Paused'}
                </div>
                <div className="text-xs text-[#4B6356] dark:text-[#B2CDC0]">
                  {active
                    ? 'You will be notified immediately when matching requests are submitted.'
                    : 'Turn on to start receiving notifications.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                active ? 'bg-[#059669]' : 'bg-slate-300 dark:bg-slate-600'
              }`}
              role="switch"
              aria-checked={active}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Area & City Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* City */}
            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">location_city</span>
                <span>Operational City <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setArea('All local areas');
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-sm text-[#0F1E17] dark:text-[#F4F8F5] focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
              >
                {INDIAN_CITIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </div>

            {/* Local Hub / Specific Area */}
            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">near_me</span>
                <span>Local Area / District</span>
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-sm text-[#0F1E17] dark:text-[#F4F8F5] focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
              >
                <option value="All local areas">All local neighborhoods in {city}</option>
                {availableHubs.map((hub) => (
                  <option key={hub} value={hub}>
                    {hub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proximity Radius */}
          <div>
            <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#059669]">radar</span>
              <span>Proximity Range</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '5 km', val: 5 },
                { label: '10 km', val: 10 },
                { label: '20 km', val: 20 },
                { label: 'Entire City', val: 'all' as const },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setRadiusKm(opt.val)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                    radiusKm === opt.val
                      ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                      : 'bg-white dark:bg-[#112019] text-slate-700 dark:text-slate-200 border-[#D1E3D7] dark:border-[#244535] hover:bg-slate-50 dark:hover:bg-[#182C22]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferences: Dietary and Min Portions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">restaurant</span>
                <span>Dietary Capability</span>
              </label>
              <select
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value as any)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-sm text-[#0F1E17] dark:text-[#F4F8F5]"
              >
                <option value="all">Any Dietary Type</option>
                <option value="veg">Pure Veg Requests Only</option>
                <option value="non-veg">Non-Veg / Egg Included</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">groups</span>
                <span>Minimum Meal Size</span>
              </label>
              <select
                value={minPortions}
                onChange={(e) => setMinPortions(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-sm text-[#0F1E17] dark:text-[#F4F8F5]"
              >
                <option value={10}>Any Request (10+ people)</option>
                <option value={30}>Medium Batches (30+ people)</option>
                <option value={50}>Large Batches (50+ people)</option>
                <option value={100}>Mass Hunger Relief (100+ people)</option>
              </select>
            </div>
          </div>

          {/* Browser Notification Permission Strip */}
          <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-[#0E2419] border border-[#059669]/30 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-[#059669] shrink-0">
                  {pushStatus === 'granted' ? 'notifications_active' : 'notifications_off'}
                </span>
                <div>
                  <div className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                    Browser Web Push Status
                  </div>
                  <div className="text-[11px] text-[#4B6356] dark:text-[#B2CDC0]">
                    {pushStatus === 'granted'
                      ? 'Push notifications are enabled in your browser.'
                      : pushStatus === 'denied'
                      ? 'Notifications are blocked. Please allow in your browser URL bar.'
                      : 'Permission not yet granted. Click to activate.'}
                  </div>
                </div>
              </div>

              {pushStatus === 'granted' ? (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shrink-0 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check</span>
                  <span>Active</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPushPermission}
                  disabled={isRequestingPermission}
                  className="px-3 py-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isRequestingPermission ? 'Requesting...' : 'Allow Push'}
                </button>
              )}
            </div>

            {/* Test alert button and audio chime toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#059669]/20 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#4B6356] dark:text-[#B2CDC0]">
                <input
                  type="checkbox"
                  checked={notifySound}
                  onChange={(e) => setNotifySound(e.target.checked)}
                  className="rounded text-[#059669] focus:ring-[#059669]"
                />
                <span>Play audible chime alert</span>
              </label>

              <button
                type="button"
                onClick={handleSendTestNotification}
                className="text-[#059669] hover:text-[#047857] dark:text-[#34D399] font-bold underline cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">volume_up</span>
                <span>Send Test Alert</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#182C22] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[17px]">
                {isSaving ? 'sync' : 'notification_add'}
              </span>
              <span>{isSaving ? 'Saving Preferences...' : 'Save Notification Alerts'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
