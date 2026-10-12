import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import {
  TemperatureLogEntry,
  TemperatureStage,
  StorageConditionType,
  evaluateTemperatureSafety,
  logBatchTemperature,
  getStageTitle,
} from './temperatureLogService';

interface TemperatureLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  batchTitle: string;
  storageCondition: StorageConditionType;
  defaultRole?: 'donor' | 'courier' | 'inspector' | 'shelter';
  defaultStage?: TemperatureStage;
  existingLogs?: TemperatureLogEntry[];
  onTemperatureLogged?: (newEntry: TemperatureLogEntry) => void;
}

export const TemperatureLogModal: React.FC<TemperatureLogModalProps> = ({
  isOpen,
  onClose,
  listingId,
  batchTitle,
  storageCondition = 'Hot and covered',
  defaultRole = 'donor',
  defaultStage = 'cooking_dispatch',
  existingLogs = [],
  onTemperatureLogged,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isDark } = useTheme();

  // Role detection
  const detectedRole: 'donor' | 'courier' | 'inspector' | 'shelter' =
    userProfile?.role === 'volunteer'
      ? 'courier'
      : userProfile?.role === 'donor' || userProfile?.role === 'restaurant'
      ? 'donor'
      : userProfile?.role === 'ngo' || userProfile?.role === 'recipient'
      ? 'shelter'
      : defaultRole;

  // Initial default temperature based on storage condition
  const defaultTemp =
    storageCondition === 'Hot and covered'
      ? 68.5
      : storageCondition === 'Refrigerated'
      ? 4.0
      : 22.0;

  const [temperature, setTemperature] = useState<number>(defaultTemp);
  const [stage, setStage] = useState<TemperatureStage>(defaultStage);
  const [probeMethod, setProbeMethod] = useState<TemperatureLogEntry['probeMethod']>(
    'Calibrated Probe Thermometer'
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<TemperatureLogEntry[]>(existingLogs);

  if (!isOpen) return null;

  const verdict = evaluateTemperatureSafety(temperature, storageCondition);

  // Quick preset suggestions based on condition
  const presets =
    storageCondition === 'Hot and covered'
      ? [
          { label: 'Fresh Cooked (78°C)', temp: 78.0 },
          { label: 'Hot Holding (68°C)', temp: 68.0 },
          { label: 'FSSAI Min (60°C)', temp: 60.0 },
          { label: 'Marginal (56°C)', temp: 56.0 },
        ]
      : storageCondition === 'Refrigerated'
      ? [
          { label: 'Deep Chilled (2°C)', temp: 2.0 },
          { label: 'Standard Cold (4°C)', temp: 4.0 },
          { label: 'Cold Max (5°C)', temp: 5.0 },
          { label: 'Warm Chilled (7°C)', temp: 7.0 },
        ]
      : [
          { label: 'Cool Ambient (18°C)', temp: 18.0 },
          { label: 'Room Temp (22°C)', temp: 22.0 },
          { label: 'Warm Bakery (25°C)', temp: 25.0 },
          { label: 'Summer Warm (29°C)', temp: 29.0 },
        ];

  const handleAdjust = (delta: number) => {
    setTemperature((prev) => Math.max(0, Math.min(100, Math.round((prev + delta) * 10) / 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);

    const loggedByName =
      userProfile?.displayName ||
      currentUser?.displayName ||
      (detectedRole === 'donor'
        ? 'Donor Kitchen Staff'
        : detectedRole === 'courier'
        ? 'Courier Food Runner'
        : 'Safety Inspector');

    const loggedByUserId = currentUser?.uid || `demo_${detectedRole}_${Date.now()}`;

    try {
      const entry = await logBatchTemperature(listingId, {
        batchTitle,
        temperatureCelsius: temperature,
        stage,
        storageCondition,
        loggedByRole: detectedRole,
        loggedByName,
        loggedByUserId,
        probeMethod,
        notes,
      });

      setLocalHistory((prev) => [entry, ...prev]);
      setSuccessMessage(`Logged ${entry.temperatureCelsius}°C for ${entry.stageLabel}! Published to Public Ledger.`);

      if (onTemperatureLogged) {
        onTemperatureLogged(entry);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed to log temperature:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-xl rounded-2xl border shadow-2xl p-6 sm:p-7 overflow-hidden my-8 max-h-[90vh] flex flex-col ${
          isDark
            ? 'bg-[#112019] border-[#244535] text-[#F4F8F5]'
            : 'bg-white border-[#D1E3D7] text-[#0F1E17]'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#D1E3D7] dark:border-[#244535] shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#059669]/15 text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">device_thermostat</span>
            </span>
            <div>
              <h2 id="temp-modal-title" className="font-bold text-lg leading-tight">
                Log Batch Temperature
              </h2>
              <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] mt-0.5">
                Food Safety Transparency &amp; FSSAI Public Ledger Audit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-5 pr-1">
          {/* Batch Context Card */}
          <div className="p-3.5 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[10.5px] uppercase font-bold text-[#4B6356] dark:text-[#B2CDC0] block">
                Food Batch
              </span>
              <p className="font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                {batchTitle}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10.5px] uppercase font-bold text-[#4B6356] dark:text-[#B2CDC0] block">
                Storage Method
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-[#059669] dark:text-[#34D399]">
                <span className="material-symbols-outlined text-[14px]">
                  {storageCondition === 'Hot and covered'
                    ? 'local_fire_department'
                    : storageCondition === 'Refrigerated'
                    ? 'ac_unit'
                    : 'inventory_2'}
                </span>
                {storageCondition}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Stage Selector */}
            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1.5">
                Inspection Stage
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'cooking_dispatch', label: '1. Kitchen Packaging / Dispatch', icon: 'restaurant' },
                  { id: 'courier_pickup', label: '2. Courier Pickup Verification', icon: 'directions_bike' },
                  { id: 'in_transit', label: '3. In-Transit Thermal Check', icon: 'route' },
                  { id: 'shelter_delivery', label: '4. Shelter Handover Inspection', icon: 'volunteer_activism' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStage(s.id as TemperatureStage)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                      stage === s.id
                        ? 'border-[#059669] bg-[#ECFDF5] dark:bg-[#182C22] text-[#059669] dark:text-[#34D399] font-bold shadow-2xs'
                        : 'border-[#D1E3D7] dark:border-[#244535] hover:bg-slate-50 dark:hover:bg-[#182C22]/60 text-[#4B6356] dark:text-[#B2CDC0]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0">{s.icon}</span>
                    <span className="truncate text-[11.5px]">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Temperature Input & Dial */}
            <div className="p-4 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-[#F8FAF8]/50 dark:bg-[#182C22]/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5]">
                  Measured Temperature (°Celsius)
                </label>
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${verdict.badgeColorClass} ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
                >
                  <span className="material-symbols-outlined text-[13px]">{verdict.icon}</span>
                  {verdict.badgeLabel}
                </span>
              </div>

              {/* Digital Stepper & Input Display */}
              <div className="flex items-center justify-center gap-4 py-2">
                <button
                  type="button"
                  onClick={() => handleAdjust(-5)}
                  className="w-10 h-10 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22] flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
                  title="Decrease 5°C"
                >
                  -5°
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(-1)}
                  className="w-10 h-10 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22] flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
                  title="Decrease 1°C"
                >
                  -1°
                </button>

                <div className="flex items-baseline gap-1 bg-white dark:bg-[#112019] border-2 border-[#059669] px-6 py-2 rounded-2xl shadow-xs">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                    className="w-24 text-center font-mono font-black text-3xl text-[#0F1E17] dark:text-[#F4F8F5] bg-transparent focus:outline-none"
                  />
                  <span className="font-bold text-lg text-[#059669] dark:text-[#34D399]">°C</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjust(1)}
                  className="w-10 h-10 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22] flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
                  title="Increase 1°C"
                >
                  +1°
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(5)}
                  className="w-10 h-10 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] font-bold text-sm text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-slate-100 dark:hover:bg-[#182C22] flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
                  title="Increase 5°C"
                >
                  +5°
                </button>
              </div>

              {/* Range slider */}
              <input
                type="range"
                min={storageCondition === 'Refrigerated' ? 0 : 40}
                max={storageCondition === 'Refrigerated' ? 20 : 95}
                step="0.5"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 dark:bg-[#244535] accent-[#059669] cursor-pointer"
              />

              {/* Visual Safe Zone Thermal Indicator Scale */}
              <div className="space-y-1">
                <div className="h-3 w-full rounded-full overflow-hidden flex text-[8px] font-bold text-white shadow-inner">
                  {storageCondition === 'Hot and covered' ? (
                    <>
                      <div className="bg-red-500 w-[55%] flex items-center justify-center" title="Danger Zone (<55°C)">
                        &lt;55° Danger
                      </div>
                      <div className="bg-amber-500 w-[10%] flex items-center justify-center" title="Marginal (55-60°C)">
                        Warn
                      </div>
                      <div className="bg-emerald-600 w-[35%] flex items-center justify-center" title="Safe Hot (≥60°C)">
                        ≥60°C Safe Hot Zone
                      </div>
                    </>
                  ) : storageCondition === 'Refrigerated' ? (
                    <>
                      <div className="bg-blue-600 w-[40%] flex items-center justify-center" title="Safe Chilled (≤5°C)">
                        ≤5°C Safe Cold
                      </div>
                      <div className="bg-amber-500 w-[20%] flex items-center justify-center" title="Warning (5-8°C)">
                        Warn
                      </div>
                      <div className="bg-red-500 w-[40%] flex items-center justify-center" title="Danger (>8°C)">
                        &gt;8°C Danger
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-emerald-600 w-[50%] flex items-center justify-center" title="Safe (15-26°C)">
                        15-26°C Ambient
                      </div>
                      <div className="bg-amber-500 w-[25%] flex items-center justify-center" title="Warm (26-34°C)">
                        Warm
                      </div>
                      <div className="bg-red-500 w-[25%] flex items-center justify-center" title="Excessive (>34°C)">
                        Heat
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#4B6356] dark:text-[#B2CDC0]">
                  <span>FSSAI Minimum Standard</span>
                  <span className="font-semibold text-[#0F1E17] dark:text-[#F4F8F5]">
                    {verdict.headline}
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] text-[#4B6356] dark:text-[#B2CDC0] mr-1">Presets:</span>
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setTemperature(p.temp)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] hover:bg-[#ECFDF5] dark:hover:bg-[#182C22] cursor-pointer transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Probe Method & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                  Measuring Instrument
                </label>
                <select
                  value={probeMethod}
                  onChange={(e) => setProbeMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] focus:outline-none focus:border-[#059669]"
                >
                  <option value="Calibrated Probe Thermometer">Calibrated Needle Probe</option>
                  <option value="Infrared Non-Contact Gun">Infrared Non-Contact Laser</option>
                  <option value="Insulated Container Sensor">Insulated Crate Telemetry Sensor</option>
                  <option value="Digital Immersion Probe">Digital Immersion Probe</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                  Inspector / Role
                </label>
                <div className="px-3 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-slate-50 dark:bg-[#182C22] text-[#0F1E17] dark:text-[#F4F8F5] font-medium flex items-center justify-between">
                  <span className="truncate">
                    {userProfile?.displayName || currentUser?.displayName || 'Active User'}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#059669]/15 text-[#059669] dark:text-[#34D399]">
                    {detectedRole}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F1E17] dark:text-[#F4F8F5] mb-1">
                Field Inspection Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Core thermal temp verified with probe; cambro box sealed."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#D1E3D7] dark:border-[#244535] bg-white dark:bg-[#112019] text-[#0F1E17] dark:text-[#F4F8F5] focus:outline-none focus:border-[#059669]"
              />
            </div>

            {/* Verdict Explanation Banner */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${verdict.badgeBgClass} ${verdict.badgeBorderClass}`}
            >
              <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${verdict.badgeColorClass}`}>
                {verdict.icon}
              </span>
              <div>
                <strong className={`block ${verdict.badgeColorClass}`}>{verdict.headline}</strong>
                <p className="text-[#4B6356] dark:text-[#B2CDC0] text-[11px] leading-relaxed mt-0.5">
                  {verdict.description}
                </p>
              </div>
            </div>

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#D1E3D7] dark:border-[#244535] text-xs font-bold text-[#4B6356] dark:text-[#B2CDC0] hover:bg-slate-100 dark:hover:bg-[#182C22] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">publish</span>
                <span>{isSubmitting ? 'Recording...' : 'Publish to Public Ledger'}</span>
              </button>
            </div>
          </form>

          {/* Existing Temperature History for this Batch */}
          {localHistory.length > 0 && (
            <div className="pt-4 border-t border-[#D1E3D7] dark:border-[#244535] space-y-2">
              <h3 className="font-bold text-xs text-[#0F1E17] dark:text-[#F4F8F5] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">history</span>
                <span>Logged Temperature History for this Batch ({localHistory.length})</span>
              </h3>
              <div className="space-y-2">
                {localHistory.map((item) => {
                  const itemVerdict = evaluateTemperatureSafety(item.temperatureCelsius, item.storageCondition);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7]/60 dark:border-[#244535]/60 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${itemVerdict.badgeColorClass} ${itemVerdict.badgeBgClass}`}
                          >
                            {item.temperatureCelsius}°C
                          </span>
                          <span className="font-bold text-[#0F1E17] dark:text-[#F4F8F5] truncate">
                            {item.stageLabel}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-[#4B6356] dark:text-[#B2CDC0] mt-0.5 truncate">
                          Verified by {item.loggedByName} ({item.loggedByRole}) · {item.probeMethod}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#4B6356] dark:text-[#B2CDC0] shrink-0 font-mono">
                        {item.loggedAt}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
