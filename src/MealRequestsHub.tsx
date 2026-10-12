import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useLanguage } from './LanguageContext';
import { INDIAN_CITIES } from './cities';
import { dispatchMealRequestAlert } from './mealRequestSubscriptionService';
import { NotifyMeModal } from './NotifyMeModal';

export interface MealRequest {
  id: string;
  ngoName: string;
  contactPerson: string;
  phone: string;
  city: string;
  peopleCount: number;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
  neededDate: string;
  dietaryPreference: 'Pure Veg' | 'Any' | 'Egg/Non-Veg';
  urgency: 'high' | 'medium' | 'standard';
  specialNotes?: string;
  status: 'open' | 'pledged' | 'fulfilled';
  pledgedByDonor?: string;
  createdAt?: any;
}

const DEFAULT_MEAL_REQUESTS: MealRequest[] = [
  {
    id: 'req_1',
    ngoName: 'Sneha Sadan Child Care Home',
    contactPerson: 'Dr. Joseph Fernandes',
    phone: '+91 98334 11200',
    city: 'Mumbai',
    peopleCount: 80,
    mealType: 'Dinner',
    neededDate: 'This Friday',
    dietaryPreference: 'Pure Veg',
    urgency: 'high',
    specialNotes: 'Evening meals for resident children and staff in Andheri East.',
    status: 'open',
  },
  {
    id: 'req_2',
    ngoName: 'Asha Kiran Senior Citizen Shelter',
    contactPerson: 'Sunita Deshmukh',
    phone: '+91 98201 44552',
    city: 'Pune',
    peopleCount: 45,
    mealType: 'Lunch',
    neededDate: 'Tomorrow',
    dietaryPreference: 'Pure Veg',
    urgency: 'medium',
    specialNotes: 'Soft-cooked khichdi or dal rice preferred for senior citizens.',
    status: 'open',
  },
  {
    id: 'req_3',
    ngoName: 'Robin Hood Relief Kitchen Node',
    contactPerson: 'Karan Mehra',
    phone: '+91 97110 33411',
    city: 'Delhi',
    peopleCount: 120,
    mealType: 'Dinner',
    neededDate: 'Saturday',
    dietaryPreference: 'Any',
    urgency: 'high',
    specialNotes: 'Weekend food distribution at Kashmere Gate shelter.',
    status: 'open',
  },
];

interface MealRequestsHubProps {
  onNavigateDonor: () => void;
  onOpenAuth: () => void;
}

export const MealRequestsHub: React.FC<MealRequestsHubProps> = ({ onNavigateDonor, onOpenAuth }) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [requests, setRequests] = useState<MealRequest[]>(DEFAULT_MEAL_REQUESTS);
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterDiet, setFilterDiet] = useState<string>('all');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showNotifyModal, setShowNotifyModal] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form State
  const [ngoName, setNgoName] = useState(userProfile?.orgName || '');
  const [contactPerson, setContactPerson] = useState(userProfile?.displayName || '');
  const [phone, setPhone] = useState(userProfile?.phone || '+91 ');
  const [city, setCity] = useState('Mumbai');
  const [peopleCount, setPeopleCount] = useState<number>(80);
  const [mealType, setMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'>('Dinner');
  const [neededDate, setNeededDate] = useState('This Friday');
  const [dietaryPreference, setDietaryPreference] = useState<'Pure Veg' | 'Any' | 'Egg/Non-Veg'>('Pure Veg');
  const [urgency, setUrgency] = useState<'high' | 'medium' | 'standard'>('high');
  const [specialNotes, setSpecialNotes] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const q = query(collection(db, 'mealRequests'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const list: MealRequest[] = [];
            snap.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...(docSnap.data() as Omit<MealRequest, 'id'>) });
            });
            setRequests(list);
          }
        },
        () => {
          // fallback
        }
      );
      return () => unsub();
    } catch {
      // ignore
    }
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (!ngoName.trim() || peopleCount < 1) {
      alert('Please provide NGO name and number of people to feed.');
      return;
    }

    const newReq: Omit<MealRequest, 'id'> = {
      ngoName: ngoName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      city,
      peopleCount: Number(peopleCount),
      mealType,
      neededDate,
      dietaryPreference,
      urgency,
      specialNotes: specialNotes.trim(),
      status: 'open',
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'mealRequests'), newReq);
      const createdItem: MealRequest = { id: docRef.id, ...newReq };
      setRequests((prev) => [createdItem, ...prev]);
      setShowModal(false);

      // Trigger push notifications and alerts to matching subscribed donors
      const notifiedCount = await dispatchMealRequestAlert(createdItem, currentUser?.uid);
      showToast(
        notifiedCount > 0
          ? `Meal request posted! ${notifiedCount} local donor${notifiedCount === 1 ? '' : 's'} in ${city} notified via push.`
          : `Meal request posted! Local restaurant donors in ${city} have been alerted.`
      );
    } catch {
      // Local fallback
      const fallbackItem: MealRequest = { id: `req_${Date.now()}`, ...newReq };
      setRequests((prev) => [fallbackItem, ...prev]);
      setShowModal(false);
      await dispatchMealRequestAlert(fallbackItem, currentUser?.uid);
      showToast(`Meal request posted locally for ${peopleCount} people!`);
    }
  };

  const handlePledge = async (reqItem: MealRequest) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    try {
      if (reqItem.id.startsWith('req_') && !reqItem.id.includes('default')) {
        await updateDoc(doc(db, 'mealRequests', reqItem.id), {
          status: 'pledged',
          pledgedByDonor: userProfile?.orgName || currentUser?.displayName || 'Kind Hospitality Donor',
        });
      }
    } catch {
      // ignore
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqItem.id
          ? {
              ...r,
              status: 'pledged',
              pledgedByDonor: userProfile?.orgName || currentUser?.displayName || 'Kind Hospitality Donor',
            }
          : r
      )
    );

    showToast(`You pledged surplus for ${reqItem.peopleCount} people at ${reqItem.ngoName}! Thank you.`);
  };

  const filteredRequests = requests.filter((r) => {
    if (filterCity !== 'all' && r.city.toLowerCase() !== filterCity.toLowerCase()) {
      return false;
    }
    if (filterDiet !== 'all' && r.dietaryPreference !== filterDiet) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-[#059669] text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-[13px] flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#EA580C]/15 text-[#EA580C] uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
            <span>{t('requests.boardBadge', 'NGO Hunger Demand Board (Reverse Listing)')}</span>
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#0F1E17] dark:text-[#F4F8F5]">
            {t('requests.boardTitle', 'Community Meal Requests')}
          </h1>
          <p className="text-xs sm:text-sm text-[#526357] dark:text-[#95A89C] max-w-2xl leading-relaxed">
            {t('requests.boardSubtitle', 'Shelters, orphanages, and relief trusts specify their exact meal requirements in advance. Restaurant kitchens and banquet donors can match their expected surplus directly to community hunger needs.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowNotifyModal(true)}
            className="px-4 py-3 rounded-xl border border-[#059669]/40 bg-[#ECFDF5] dark:bg-[#112F21] hover:bg-[#D1FAE5] dark:hover:bg-[#163F2C] text-[#059669] dark:text-[#34D399] font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            title="Get notified when shelters post meal requests in your area"
          >
            <span className="material-symbols-outlined text-[19px]">notifications_active</span>
            <span>Notify Me (Local Alerts)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
              } else {
                setShowModal(true);
              }
            }}
            className="px-5 py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">post_add</span>
            <span>{t('requests.requestFoodBtn', 'Request Food for Shelter')}</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#526357] dark:text-[#95A89C]">{t('requests.filterCity', 'City')}:</span>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] font-semibold text-[#0F1E17] dark:text-[#F4F8F5]"
          >
            <option value="all">{t('common.all', 'All Cities')}</option>
            {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <span className="font-bold text-[#526357] dark:text-[#95A89C] ml-2">{t('requests.filterDiet', 'Diet')}:</span>
          <select
            value={filterDiet}
            onChange={(e) => setFilterDiet(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] font-semibold text-[#0F1E17] dark:text-[#F4F8F5]"
          >
            <option value="all">{t('common.all', 'All Diets')}</option>
            <option value="Pure Veg">{t('common.veg', 'Pure Veg')}</option>
            <option value="Any">{t('common.all', 'Any')}</option>
          </select>
        </div>

        <span className="text-xs text-[#526357] dark:text-[#95A89C]">
          Showing <strong>{filteredRequests.length}</strong> active shelter requests
        </span>
      </div>

      {/* Grid of Meal Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
              req.status === 'pledged'
                ? 'bg-[#F0FDF4] dark:bg-[#064E3B]/20 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-[#112019] border-[#D1E3D7] dark:border-[#244535] hover:shadow-md'
            }`}
          >
            <div className="space-y-3">
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#059669]/10 text-[#059669]">
                  {req.city}
                </span>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.urgency === 'high'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {req.urgency === 'high' ? 'High Urgency' : 'Standard'}
                  </span>

                  {req.status === 'pledged' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                      Pledged
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Organization */}
              <div>
                <h3 className="font-serif font-bold text-lg text-[#0F1E17] dark:text-[#F4F8F5] leading-snug">
                  {req.ngoName}
                </h3>
                <p className="text-xs text-[#526357] dark:text-[#95A89C]">
                  Contact: {req.contactPerson} • {req.phone}
                </p>
              </div>

              {/* Requirement Metric Box */}
              <div className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] grid grid-cols-2 gap-2 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">People to Feed</span>
                  <span className="font-serif font-black text-xl text-[#059669] dark:text-[#34D399]">
                    {req.peopleCount} people
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Timing &amp; Diet</span>
                  <span className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mt-0.5">
                    {req.neededDate} • {req.mealType}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {req.dietaryPreference}
                  </span>
                </div>
              </div>

              {req.specialNotes && (
                <p className="text-xs text-[#526357] dark:text-[#95A89C] italic">
                  "{req.specialNotes}"
                </p>
              )}
            </div>

            {/* Action Bottom */}
            <div className="mt-4 pt-3 border-t border-[#D1E3D7]/60 dark:border-[#244535]/60 flex items-center justify-between">
              {req.status === 'pledged' ? (
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>{t('requests.pledgedBadge', 'Pledged by')}: {req.pledgedByDonor}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePledge(req)}
                  className="w-full py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">volunteer_activism</span>
                  <span>{t('requests.pledgeSurplusBtn', 'Pledge Surplus Food')}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Post Request Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0E1715]/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="bg-white dark:bg-[#112019] border border-[#D1E3D7] dark:border-[#244535] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#D1E3D7] dark:border-[#244535]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#059669] text-[24px]">soup_kitchen</span>
                <h3 className="font-serif font-bold text-lg text-[#0F1E17] dark:text-[#F4F8F5]">
                  {t('requests.modalTitle', 'Post Shelter Food Requirement')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                  {t('requests.ngoNameLabel', 'Shelter / NGO Name')} *
                </label>
                <input
                  type="text"
                  required
                  value={ngoName}
                  onChange={(e) => setNgoName(e.target.value)}
                  placeholder="e.g. Sneha Sadan Youth Shelter"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('requests.contactPerson', 'Contact Coordinator')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('auth.phoneLabel', 'Phone')} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('auth.cityLabel', 'City')} *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  >
                    {INDIAN_CITIES.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('requests.peopleCountLabel', 'People to Feed')} *
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="5000"
                    required
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('requests.mealTypeLabel', 'Meal Timing')} *
                  </label>
                  <select
                    value={mealType}
                    onChange={(e: any) => setMealType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('requests.neededDateLabel', 'Needed Date')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={neededDate}
                    onChange={(e) => setNeededDate(e.target.value)}
                    placeholder="e.g. This Friday or 5th Oct"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                    {t('requests.filterDiet', 'Dietary Requirement')} *
                  </label>
                  <select
                    value={dietaryPreference}
                    onChange={(e: any) => setDietaryPreference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                  >
                    <option value="Pure Veg">{t('common.veg', 'Pure Veg')}</option>
                    <option value="Any">{t('common.all', 'Any Consumable')}</option>
                    <option value="Egg/Non-Veg">{t('common.nonVeg', 'Egg / Non-Veg')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] block mb-1">
                  Special Notes / Canteen Instructions
                </label>
                <textarea
                  rows={2}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="e.g. Soft cooked food preferred, gated compound entry dock"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8] dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5]"
                />
              </div>

              <div className="pt-3 border-t border-[#D1E3D7] dark:border-[#244535] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer font-bold"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {t('requests.postSubmitBtn', 'Submit Meal Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 'Notify Me' Local Meal Request Alert Modal */}
      {showNotifyModal && (
        <NotifyMeModal
          isOpen={showNotifyModal}
          onClose={() => setShowNotifyModal(false)}
          initialCity={filterCity !== 'all' ? filterCity : 'Mumbai'}
        />
      )}
    </div>
  );
};
