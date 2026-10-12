import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useTranslation } from './LanguageContext';
import {
  requestFCMToken,
  setupFCMForegroundListener,
  triggerStatusNotification,
  playNotificationChime,
} from './fcmService';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'urgent_listing' | 'courier_dispatch' | 'meal_request' | 'listing_claimed' | 'delivery_confirmed' | 'system';
  timestamp: number;
  read: boolean;
  linkTab?: string;
  badge?: string;
}

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_1',
    title: '🎉 Listing Claimed: Dal Makhani & Rotis',
    message: 'Sneha Sadan Community Kitchen claimed your surplus batch (65 plates). Pickup Code: #4829.',
    type: 'listing_claimed',
    timestamp: Date.now() - 5 * 60 * 1000,
    read: false,
    linkTab: 'donor',
    badge: 'Claimed',
  },
  {
    id: 'notif_2',
    title: '🌟 Delivery Confirmed: Veg Pulao (80 kg)',
    message: 'Volunteer courier Rahul Verma safely delivered food batch to Akshaya Patra Youth Shelter.',
    type: 'delivery_confirmed',
    timestamp: Date.now() - 30 * 60 * 1000,
    read: false,
    linkTab: 'ledger',
    badge: 'Delivered',
  },
  {
    id: 'notif_3',
    title: '🚨 Urgent Surplus Batch Available',
    message: 'The Grand Bistro posted 50 veg dinner meals in Mumbai needing rescue before 10:30 PM.',
    type: 'urgent_listing',
    timestamp: Date.now() - 60 * 60 * 1000,
    read: true,
    linkTab: 'courier',
    badge: '50 plates',
  },
];

interface NotificationCenterProps {
  onNavigateTab: (tab: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigateTab }) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'claims' | 'deliveries'>('all');
  const [fcmToken, setFcmToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('foodlink_fcm_token');
    } catch {
      return null;
    }
  });

  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('foodlink_notifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_NOTIFICATIONS;
  });

  // Listen for FCM foreground push notifications
  useEffect(() => {
    let unsubscribe: any = () => {};
    setupFCMForegroundListener((payload) => {
      const newNotif: AppNotification = {
        id: 'fcm_' + Date.now(),
        title: payload.title,
        message: payload.body,
        type: (payload.data?.type as any) || 'system',
        timestamp: Date.now(),
        read: false,
        linkTab: payload.data?.linkTab || 'ledger',
        badge: payload.data?.badge || 'FCM Push',
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore notifications collection in real-time
  useEffect(() => {
    try {
      const notifRef = collection(db, 'notifications');
      const q = query(notifRef, orderBy('createdAt', 'desc'), limit(15));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetched: AppNotification[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              // Show notification if it's targeted to current user or if broadcast/relevant
              const isRelevant =
                !data.targetUserId ||
                (currentUser && data.targetUserId === currentUser.uid) ||
                (userProfile && data.targetUserId === userProfile.uid);

              if (isRelevant) {
                fetched.push({
                  id: docSnap.id,
                  title: data.title || 'FoodLink Alert',
                  message: data.message || data.body || '',
                  type: data.type || 'system',
                  timestamp: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
                  read: Boolean(data.read),
                  linkTab: data.linkTab || 'ledger',
                  badge: data.badge,
                });
              }
            });

            if (fetched.length > 0) {
              setNotifications((prev) => {
                const combined = [...fetched, ...prev.filter((p) => !fetched.some((f) => f.id === p.id))];
                return combined.slice(0, 20);
              });
            }
          }
        },
        () => {
          // ignore error if offline or permissions restrict
        }
      );
      return () => unsubscribe();
    } catch {
      // fallback to local state
    }
  }, [currentUser, userProfile]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('foodlink_notifications', JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRequestPush = async () => {
    const res = await requestFCMToken(currentUser?.uid);
    if (res.permission === 'granted') {
      setPushEnabled(true);
      setFcmToken(res.token);
      playNotificationChime();

      const welcomeNotif: AppNotification = {
        id: 'fcm_enabled_' + Date.now(),
        title: '🔔 FCM Push Notifications Active',
        message: 'You will receive instant push notifications whenever food listings are claimed or deliveries are confirmed.',
        type: 'system',
        timestamp: Date.now(),
        read: false,
        badge: 'FCM Active',
      };
      setNotifications((prev) => [welcomeNotif, ...prev]);

      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          new Notification('FoodLink FCM Connected', {
            body: 'Push notifications are live for real-time status updates!',
            icon: '/favicon.svg',
          });
        } catch {
          // Ignore
        }
      }
    } else {
      alert('Push notification permission denied. Please allow notifications in browser site settings.');
    }
  };

  const handleSendTestNotification = async (type: 'claimed' | 'completed') => {
    const isClaim = type === 'claimed';
    await triggerStatusNotification({
      listingId: 'demo_test_' + Date.now(),
      listingTitle: isClaim ? 'Mixed Biryani & Salan' : 'Steamed Rice & Paneer Gravy',
      status: isClaim ? 'claimed' : 'completed',
      donorId: currentUser?.uid || 'donor_demo',
      donorName: userProfile?.displayName || 'Chef Marcus Vance',
      recipientId: currentUser?.uid || 'shelter_demo',
      recipientName: 'Sneha Sadan Relief Shelter',
      quantity: 50,
      unit: 'plates',
      handoffCode: '7492',
      shelterName: 'Sneha Sadan Relief Shelter',
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = (notif: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.linkTab) {
      onNavigateTab(notif.linkTab);
      setIsOpen(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'claims') return n.type === 'listing_claimed';
    if (activeFilter === 'deliveries') return n.type === 'delivery_confirmed' || n.type === 'courier_dispatch';
    return true;
  });

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[#4B6356] dark:text-[#A7C2B4] hover:bg-[#ECFDF5] dark:hover:bg-[#112019] transition-colors cursor-pointer"
        title="FCM Notifications & Live Status Alerts"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#EA580C] text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-3.5 border-b border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between bg-[#F8FAF8] dark:bg-[#162720]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#059669]">
                  notifications_active
                </span>
                <h4 className="font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5]">
                  {t('notif.title', 'Notifications')}
                </h4>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EA580C] text-white">
                    {unreadCount}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-[#059669] hover:underline cursor-pointer"
                >
                  {t('notif.markAllRead', 'Mark all read')}
                </button>
              )}
            </div>

            {/* FCM Status Banner */}
            <div className="p-3 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border-b border-[#D1E3D7] dark:border-[#244535] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      pushEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[11px] font-bold text-[#065F46] dark:text-[#6EE7B7] truncate">
                    {pushEnabled ? t('notif.pushEnabled', 'Push Notifications Active') : t('notif.enablePush', 'Enable Push Notifications')}
                  </span>
                </div>

                {!pushEnabled ? (
                  <button
                    type="button"
                    onClick={handleRequestPush}
                    className="px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-[10px] shrink-0 cursor-pointer shadow-xs"
                  >
                    {t('notif.enablePush', 'Enable Push Notifications')}
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    <span>{t('common.active', 'Active')}</span>
                  </span>
                )}
              </div>

              {/* Quick simulation buttons for donors and recipients */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[#526357] dark:text-[#95A89C]">Test Status:</span>
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('claimed')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-[#1E3A2B] border border-[#A7F3D0] text-[#059669] hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="Simulate listing claimed notification"
                >
                  + Test Claimed
                </button>
                <button
                  type="button"
                  onClick={() => handleSendTestNotification('completed')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-[#1E3A2B] border border-[#A7F3D0] text-[#059669] hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="Simulate delivery confirmed notification"
                >
                  + Test Delivered
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-[#13231B] border-b border-[#D1E3D7]/60 dark:border-[#244535]/60 flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#526357] dark:text-[#95A89C] hover:bg-slate-200/60 dark:hover:bg-[#1E3A2B]'
                }`}
              >
                {t('notif.allTab', 'All')} ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('claims')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeFilter === 'claims'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#526357] dark:text-[#95A89C] hover:bg-slate-200/60 dark:hover:bg-[#1E3A2B]'
                }`}
              >
                {t('notif.claimsTab', 'Claims')}
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('deliveries')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeFilter === 'deliveries'
                    ? 'bg-[#059669] text-white'
                    : 'text-[#526357] dark:text-[#95A89C] hover:bg-slate-200/60 dark:hover:bg-[#1E3A2B]'
                }`}
              >
                {t('notif.deliveriesTab', 'Deliveries')}
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-76 overflow-y-auto divide-y divide-[#D1E3D7]/60 dark:divide-[#244535]/60">
              {filteredNotifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {t('notif.noNotifications', 'No notifications in this filter.')}
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-[#182C22] flex items-start gap-3 ${
                      !n.read ? 'bg-[#ECFDF5]/50 dark:bg-[#064E3B]/15' : ''
                    }`}
                  >
                    <span
                      className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                        !n.read ? 'bg-[#059669]' : 'bg-transparent'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-xs text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                          {n.title}
                        </span>
                        {n.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              n.type === 'meal_request'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                : n.type === 'listing_claimed'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                : n.type === 'delivery_confirmed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {n.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#526357] dark:text-[#95A89C] leading-snug line-clamp-2">
                        {n.message}
                      </p>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {new Date(n.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[#059669] font-semibold hover:underline">
                          View details →
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-[#F8FAF8] dark:bg-[#162720] border-t border-[#D1E3D7] dark:border-[#244535] text-center">
              <span className="text-[10px] text-slate-500">
                FCM Messaging Sender ID: 799494278662 • Instant Push Sync
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

