import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { requestFCMToken, playNotificationChime } from './fcmService';
import { MealRequest } from './MealRequestsHub';

export interface MealRequestSubscription {
  id?: string;
  donorId: string;
  donorName: string;
  donorOrg?: string;
  donorEmail?: string;
  donorPhone?: string;
  city: string;
  area?: string;
  radiusKm?: number | 'all';
  dietaryPreference: 'all' | 'veg' | 'non-veg';
  minPortions: number;
  browserPermissionGranted: boolean;
  pushToken?: string;
  active: boolean;
  notifySound: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const STORAGE_KEY_PREFIX = 'foodlink_meal_request_sub_';

/**
 * Retrieve donor subscription from Firestore or localStorage fallback
 */
export async function getDonorMealSubscription(
  donorId: string
): Promise<MealRequestSubscription | null> {
  if (!donorId) return null;

  try {
    const docRef = doc(db, 'mealRequestSubscriptions', donorId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as MealRequestSubscription) };
    }
  } catch (err) {
    console.warn('Could not read subscription from Firestore, checking localStorage:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${donorId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse errors
  }

  return null;
}

/**
 * Save or update donor meal request subscription
 */
export async function saveDonorMealSubscription(
  subscription: MealRequestSubscription
): Promise<MealRequestSubscription> {
  const donorId = subscription.donorId;
  const payload = {
    ...subscription,
    updatedAt: serverTimestamp(),
  };

  // Cache to localStorage immediately for instant UI feedback
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${donorId}`,
      JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })
    );
    // Also save globally for general donor persona
    localStorage.setItem('foodlink_active_donor_subscription', JSON.stringify(payload));
  } catch {
    // Ignore
  }

  try {
    const docRef = doc(db, 'mealRequestSubscriptions', donorId);
    await setDoc(docRef, payload, { merge: true });
    return { ...subscription, id: donorId };
  } catch (err) {
    console.warn('Could not save subscription to Firestore, cached locally:', err);
    return { ...subscription, id: donorId };
  }
}

/**
 * Toggle active status of donor subscription
 */
export async function toggleDonorMealSubscription(
  donorId: string,
  active: boolean
): Promise<void> {
  const current = await getDonorMealSubscription(donorId);
  if (current) {
    await saveDonorMealSubscription({
      ...current,
      active,
    });
  }
}

/**
 * Query active subscriptions matching a specific city/area
 */
export async function getMatchingDonorSubscriptions(
  city: string,
  area?: string,
  dietary?: string
): Promise<MealRequestSubscription[]> {
  const subscribers: MealRequestSubscription[] = [];

  try {
    const subsRef = collection(db, 'mealRequestSubscriptions');
    // Fetch active subscriptions
    const q = query(subsRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as MealRequestSubscription;
      const matchesCity =
        data.city.toLowerCase() === 'all' ||
        data.city.toLowerCase() === city.toLowerCase() ||
        city.toLowerCase().includes(data.city.toLowerCase());

      if (matchesCity) {
        // Check dietary filter if configured
        if (dietary && data.dietaryPreference !== 'all') {
          const isVegRequest = dietary.toLowerCase().includes('veg') && !dietary.toLowerCase().includes('non');
          if (data.dietaryPreference === 'veg' && !isVegRequest) {
            return;
          }
        }
        subscribers.push({ id: docSnap.id, ...data });
      }
    });
  } catch (err) {
    console.warn('Could not query Firestore subscriptions:', err);
  }

  // Include locally saved subscription if matching
  try {
    const localRaw = localStorage.getItem('foodlink_active_donor_subscription');
    if (localRaw) {
      const localSub = JSON.parse(localRaw) as MealRequestSubscription;
      if (
        localSub.active &&
        (localSub.city.toLowerCase() === 'all' ||
          localSub.city.toLowerCase() === city.toLowerCase() ||
          city.toLowerCase().includes(localSub.city.toLowerCase()))
      ) {
        if (!subscribers.some((s) => s.donorId === localSub.donorId)) {
          subscribers.push(localSub);
        }
      }
    }
  } catch {
    // Ignore
  }

  return subscribers;
}

/**
 * Dispatches real-time alerts when an NGO posts a new Meal Request:
 * 1. Native browser Web Notification API
 * 2. Web Audio notification chime
 * 3. Records persistent notification in Firestore notifications collection
 * 4. Broadcasts custom DOM window event for in-app alert banner
 */
export async function dispatchMealRequestAlert(
  mealRequest: MealRequest,
  currentUserId?: string
): Promise<number> {
  const subscribers = await getMatchingDonorSubscriptions(
    mealRequest.city,
    undefined,
    mealRequest.dietaryPreference
  );

  const title = `🍲 New Meal Request in ${mealRequest.city}!`;
  const body = `${mealRequest.ngoName} urgently requested ${mealRequest.peopleCount} ${mealRequest.mealType} meals (${mealRequest.dietaryPreference}).`;

  // 1. Play sound chime
  playNotificationChime();

  // 2. Native Browser Push Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `meal_req_${mealRequest.id}`,
        data: {
          url: '/#requests',
          mealRequestId: mealRequest.id,
          type: 'meal_request',
        },
      });
    } catch {
      // Ignore notification constructor error inside restricted iframes
    }
  }

  // 3. Record in Firestore notifications collection for all matching subscribers
  try {
    const notifCollection = collection(db, 'notifications');
    // Save a general notification for the city feed
    await addDoc(notifCollection, {
      title,
      message: body,
      body,
      type: 'meal_request',
      city: mealRequest.city,
      mealRequestId: mealRequest.id,
      ngoName: mealRequest.ngoName,
      peopleCount: mealRequest.peopleCount,
      badge: `${mealRequest.peopleCount} meals`,
      linkTab: 'requests',
      createdAt: serverTimestamp(),
      read: false,
    });

    // Also write targeted notification for any specific subscribed donor IDs
    for (const sub of subscribers) {
      if (sub.donorId && sub.donorId !== currentUserId) {
        await addDoc(notifCollection, {
          targetUserId: sub.donorId,
          title,
          message: body,
          body,
          type: 'meal_request',
          city: mealRequest.city,
          mealRequestId: mealRequest.id,
          badge: `${mealRequest.peopleCount} meals`,
          linkTab: 'requests',
          createdAt: serverTimestamp(),
          read: false,
        });
      }
    }
  } catch (err) {
    console.warn('Could not persist meal request notification to Firestore:', err);
  }

  // 4. Dispatch browser custom event for instant in-tab banner/toast
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('foodlink-meal-request-alert', {
        detail: {
          mealRequest,
          subscribersCount: subscribers.length,
          title,
          body,
        },
      })
    );
  }

  return subscribers.length;
}
