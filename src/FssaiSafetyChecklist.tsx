import React, { useState, useMemo } from 'react';
import { StorageConditionType } from './DonorDashboard';
import { useTranslation } from './LanguageContext';

export interface FssaiSafetyAcks {
  temperatureStandardAcknowledged: boolean;
  containerIntegrityAcknowledged: boolean;
  hygieneHandlingAcknowledged: boolean;
  nonProhibitedAcknowledged: boolean;
  dispatchTemperatureCelsius?: string;
  packagingType?: 'food_grade_sealed' | 'stainless_vessel' | 'insulated_crate' | 'tamper_evident_pack';
}

interface FssaiSafetyChecklistProps {
  storageCondition: StorageConditionType;
  temperatureReading: string;
  onTemperatureChange: (temp: string) => void;
  acknowledgments: FssaiSafetyAcks;
  onChange: (acks: FssaiSafetyAcks) => void;
  disabled?: boolean;
  hasErrors?: boolean;
}

export const FssaiSafetyChecklist: React.FC<FssaiSafetyChecklistProps> = ({
  storageCondition,
  temperatureReading,
  onTemperatureChange,
  acknowledgments,
  onChange,
  disabled = false,
  hasErrors = false,
}) => {
  const { t } = useTranslation();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Temperature validation against FSSAI thermal safety guidelines
  const tempNum = parseFloat(temperatureReading);
  const tempStatus = useMemo<{
    isValid: boolean;
    status: 'optimal' | 'warning' | 'danger';
    message: string;
    targetText: string;
  }>(() => {
    if (isNaN(tempNum)) {
      return {
        isValid: false,
        status: 'warning',
        message: 'Enter verified temperature reading in °C.',
        targetText: 'FSSAI target depends on storage class',
      };
    }

    if (storageCondition === 'Hot and covered') {
      if (tempNum >= 60) {
        return {
          isValid: true,
          status: 'optimal',
          message: `Optimal Hot Holding (${tempNum}°C ≥ 60°C). Outside bacterial danger zone.`,
          targetText: 'FSSAI Target: ≥ 60°C (140°F)',
        };
      } else if (tempNum >= 50) {
        return {
          isValid: false,
          status: 'warning',
          message: `Caution: ${tempNum}°C is below 60°C. Food must be dispatched within 60 minutes.`,
          targetText: 'FSSAI Target: ≥ 60°C',
        };
      } else {
        return {
          isValid: false,
          status: 'danger',
          message: `Critical: ${tempNum}°C is inside bacterial growth danger zone (5°C–60°C).`,
          targetText: 'FSSAI Target: ≥ 60°C',
        };
      }
    } else if (storageCondition === 'Refrigerated') {
      if (tempNum <= 5) {
        return {
          isValid: true,
          status: 'optimal',
          message: `Optimal Cold Storage (${tempNum}°C ≤ 5°C). Pathogen growth suppressed.`,
          targetText: 'FSSAI Target: ≤ 5°C (41°F)',
        };
      } else if (tempNum <= 8) {
        return {
          isValid: false,
          status: 'warning',
          message: `Warning: ${tempNum}°C exceeds 5°C. Immediate cold-chain transit required.`,
          targetText: 'FSSAI Target: ≤ 5°C',
        };
      } else {
        return {
          isValid: false,
          status: 'danger',
          message: `Critical: ${tempNum}°C is too warm for refrigerated food items.`,
          targetText: 'FSSAI Target: ≤ 5°C',
        };
      }
    } else {
      // Room temperature sealed (dry grains, bakery, whole produce)
      if (tempNum >= 15 && tempNum <= 30) {
        return {
          isValid: true,
          status: 'optimal',
          message: `Ambient Temperature (${tempNum}°C). Safe for dry sealed goods.`,
          targetText: 'FSSAI Target: Cool ambient, < 30°C',
        };
      } else {
        return {
          isValid: true,
          status: 'warning',
          message: `Ambient reading: ${tempNum}°C. Ensure direct sunlight is avoided.`,
          targetText: 'FSSAI Target: Cool, dry place',
        };
      }
    }
  }, [storageCondition, tempNum]);

  // Compute total completed mandatory checkpoints
  const completedCount = [
    acknowledgments.temperatureStandardAcknowledged,
    acknowledgments.containerIntegrityAcknowledged,
    acknowledgments.hygieneHandlingAcknowledged,
    acknowledgments.nonProhibitedAcknowledged,
  ].filter(Boolean).length;

  const allCompleted = completedCount === 4;

  const toggleAck = (key: keyof FssaiSafetyAcks) => {
    if (disabled) return;
    onChange({
      ...acknowledgments,
      [key]: !acknowledgments[key],
    });
  };

  const handleAcknowledgeAll = () => {
    if (disabled) return;
    onChange({
      ...acknowledgments,
      temperatureStandardAcknowledged: true,
      containerIntegrityAcknowledged: true,
      hygieneHandlingAcknowledged: true,
      nonProhibitedAcknowledged: true,
    });
  };

  return (
    <div className={`rounded-2xl border transition-all ${
      allCompleted
        ? 'bg-[#F0FDF4] dark:bg-[#0E2619] border-[#10B981]/50 shadow-xs'
        : hasErrors
        ? 'bg-[#FEF2F2] dark:bg-[#2A1515] border-[#F87171] shadow-xs'
        : 'bg-[#FAFBF8] dark:bg-[#112019] border-[#D1E3D7] dark:border-[#244535]'
    } p-5 sm:p-6 space-y-5`}>
      {/* Header with FSSAI Statutory Seal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D1E3D7]/80 dark:border-[#244535]/80">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base sm:text-lg text-[#0F1E17] dark:text-[#F4F8F5]">
                {t('safety.title', 'FSSAI Food Safety Compliance Checklist')}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#059669]/15 text-[#059669] dark:text-[#34D399] border border-[#059669]/30">
                {t('common.required', 'Mandatory')}
              </span>
            </div>
            <p className="text-xs text-[#4B6356] dark:text-[#B2CDC0] mt-0.5 leading-relaxed">
              {t('safety.statutoryDesc', 'Required under the Food Safety and Standards (Recovery & Distribution of Surplus Food) Regulations, 2019.')}
            </p>
          </div>
        </div>

        {/* Progress & Quick Acknowledge */}
        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            allCompleted
              ? 'bg-[#10B981] text-white border-[#10B981]'
              : 'bg-white dark:bg-[#1A2E22] text-[#4B6356] dark:text-[#B2CDC0] border-[#D1E3D7] dark:border-[#244535]'
          }`}>
            {completedCount} / 4 Verified
          </span>

          {!allCompleted && (
            <button
              type="button"
              onClick={handleAcknowledgeAll}
              disabled={disabled}
              className="text-xs font-bold text-[#059669] dark:text-[#34D399] hover:underline cursor-pointer disabled:opacity-50"
            >
              Verify All
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: LIVE TEMPERATURE READING & ACKNOWLEDGMENT */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#15281D] border border-[#D1E3D7] dark:border-[#244535] space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#059669] dark:text-[#34D399]">
              thermostat
            </span>
            <label htmlFor="fssai-temp-input" className="text-sm font-bold text-[#0F1E17] dark:text-white">
              1. Temperature Verification &amp; Danger Zone Prevention <span className="text-[#DC2626]">*</span>
            </label>
          </div>
          <span className="text-xs font-semibold text-[#4B6356] dark:text-[#8AA897]">
            {tempStatus.targetText}
          </span>
        </div>

        {/* Temperature Input Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-5 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="fssai-temp-input"
                type="number"
                step="0.5"
                value={temperatureReading}
                onChange={(e) => onTemperatureChange(e.target.value)}
                disabled={disabled}
                placeholder={storageCondition === 'Hot and covered' ? '65.0' : '4.0'}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-[#D1E3D7] dark:border-[#244535] bg-[#FAFBF8] dark:bg-[#1A2E22] text-[#0F1E17] dark:text-white font-bold text-sm focus:ring-2 focus:ring-[#059669]"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-[#4B6356] dark:text-[#8AA897]">
                °C
              </span>
            </div>
            <span className="text-xs text-[#4B6356] dark:text-[#8AA897] font-medium shrink-0">
              at dispatch
            </span>
          </div>

          <div className="sm:col-span-7">
            <div className={`p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
              tempStatus.status === 'optimal'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : tempStatus.status === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
            }`}>
              <span className="material-symbols-outlined text-[16px] shrink-0">
                {tempStatus.status === 'optimal' ? 'check_circle' : 'warning'}
              </span>
              <span className="truncate">{tempStatus.message}</span>
            </div>
          </div>
        </div>

        {/* Checkbox Acknowledgment */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            acknowledgments.temperatureStandardAcknowledged
              ? 'bg-[#ECFDF5] dark:bg-[#112F21] border-[#10B981]/50 text-[#0F1E17] dark:text-white'
              : 'bg-[#FAFBF8] dark:bg-[#1A2E22] border-[#D1E3D7] dark:border-[#244535] text-[#4B6356] dark:text-[#B2CDC0]'
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledgments.temperatureStandardAcknowledged}
            onChange={() => toggleAck('temperatureStandardAcknowledged')}
            disabled={disabled}
            className="w-4 h-4 rounded border-[#D1E3D7] text-[#059669] focus:ring-[#059669] shrink-0 mt-0.5 cursor-pointer"
          />
          <div className="text-xs leading-relaxed">
            <strong className="text-[#0F1E17] dark:text-white font-bold block mb-0.5">
              Temperature Standard Signed:
            </strong>
            I verify that hot food has been maintained at ≥60°C or refrigerated at ≤5°C, preventing the microbial danger zone (5°C–60°C).
          </div>
        </label>
      </div>

      {/* SECTION 2: CONTAINER INTEGRITY & PACKAGING STANDARDS */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#15281D] border border-[#D1E3D7] dark:border-[#244535] space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#059669] dark:text-[#34D399]">
              inventory_2
            </span>
            <span className="text-sm font-bold text-[#0F1E17] dark:text-white">
              2. Container Integrity &amp; Food-Grade Packaging <span className="text-[#DC2626]">*</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpandedItem(expandedItem === 'container' ? null : 'container')}
            className="text-[11px] font-bold text-[#059669] dark:text-[#34D399] hover:underline"
          >
            {expandedItem === 'container' ? 'Hide Specs' : 'View Specs'}
          </button>
        </div>

        {/* Packaging Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { id: 'food_grade_sealed', label: 'Food-grade Tubs', icon: 'takeout_dining' },
            { id: 'stainless_vessel', label: 'Insulated Chafers', icon: 'soup_kitchen' },
            { id: 'insulated_crate', label: 'Thermal Crates', icon: 'shelves' },
            { id: 'tamper_evident_pack', label: 'Foil Trays / Packs', icon: 'inventory' },
          ].map((pack) => {
            const isSelected = (acknowledgments.packagingType || 'food_grade_sealed') === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => onChange({ ...acknowledgments, packagingType: pack.id as any })}
                disabled={disabled}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ECFDF5] dark:bg-[#112F21] border-[#059669] text-[#059669] dark:text-[#34D399] font-bold shadow-2xs'
                    : 'bg-[#FAFBF8] dark:bg-[#1A2E22] border-[#D1E3D7] dark:border-[#244535] text-[#4B6356] dark:text-[#B2CDC0]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{pack.icon}</span>
                <span className="text-[11px] text-center leading-tight">{pack.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expanded Details on Container Requirements */}
        {expandedItem === 'container' && (
          <div className="p-3 rounded-lg bg-[#F8FAF8] dark:bg-[#182C22] border border-[#D1E3D7] dark:border-[#244535] text-xs text-[#4B6356] dark:text-[#B2CDC0] space-y-1.5 animate-fadeIn">
            <div className="font-bold text-[#0F1E17] dark:text-white">FSSAI Packaging Integrity Requirements:</div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Packaging must be clean, non-toxic, and certified food-safe (IS 9845 compliant).</li>
              <li>Containers must be hermetically sealed or tightly covered to prevent airborne particles.</li>
              <li>No single-use thin polythene bags (&lt;120 microns) or hazardous newspaper contact.</li>
            </ul>
          </div>
        )}

        {/* Checkbox Acknowledgment */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            acknowledgments.containerIntegrityAcknowledged
              ? 'bg-[#ECFDF5] dark:bg-[#112F21] border-[#10B981]/50 text-[#0F1E17] dark:text-white'
              : 'bg-[#FAFBF8] dark:bg-[#1A2E22] border-[#D1E3D7] dark:border-[#244535] text-[#4B6356] dark:text-[#B2CDC0]'
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledgments.containerIntegrityAcknowledged}
            onChange={() => toggleAck('containerIntegrityAcknowledged')}
            disabled={disabled}
            className="w-4 h-4 rounded border-[#D1E3D7] text-[#059669] focus:ring-[#059669] shrink-0 mt-0.5 cursor-pointer"
          />
          <div className="text-xs leading-relaxed">
            <strong className="text-[#0F1E17] dark:text-white font-bold block mb-0.5">
              Container Integrity Signed:
            </strong>
            I confirm containers are food-grade, sanitized, completely leak-proof, and sealed with clean lids/wraps prior to transport handover.
          </div>
        </label>
      </div>

      {/* SECTION 3 & 4: HYGIENIC HANDLING & NON-PROHIBITED ASSURANCE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Hygiene & Glove Handling */}
        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
            acknowledgments.hygieneHandlingAcknowledged
              ? 'bg-[#ECFDF5] dark:bg-[#112F21] border-[#10B981]/50 text-[#0F1E17] dark:text-white'
              : 'bg-white dark:bg-[#15281D] border-[#D1E3D7] dark:border-[#244535] text-[#4B6356] dark:text-[#B2CDC0]'
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledgments.hygieneHandlingAcknowledged}
            onChange={() => toggleAck('hygieneHandlingAcknowledged')}
            disabled={disabled}
            className="w-4 h-4 rounded border-[#D1E3D7] text-[#059669] focus:ring-[#059669] shrink-0 mt-0.5 cursor-pointer"
          />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-[#0F1E17] dark:text-white block mb-0.5">
              3. Sanitary Handling (Schedule IV) <span className="text-[#DC2626]">*</span>
            </span>
            <span>Food was prepared and portioned with clean utensils and sanitized food gloves. No bare-hand contact after cooking.</span>
          </div>
        </label>

        {/* Non-Prohibited Surplus Only */}
        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
            acknowledgments.nonProhibitedAcknowledged
              ? 'bg-[#ECFDF5] dark:bg-[#112F21] border-[#10B981]/50 text-[#0F1E17] dark:text-white'
              : 'bg-white dark:bg-[#15281D] border-[#D1E3D7] dark:border-[#244535] text-[#4B6356] dark:text-[#B2CDC0]'
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledgments.nonProhibitedAcknowledged}
            onChange={() => toggleAck('nonProhibitedAcknowledged')}
            disabled={disabled}
            className="w-4 h-4 rounded border-[#D1E3D7] text-[#059669] focus:ring-[#059669] shrink-0 mt-0.5 cursor-pointer"
          />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-[#0F1E17] dark:text-white block mb-0.5">
              4. Zero Prohibited Items Guarantee <span className="text-[#DC2626]">*</span>
            </span>
            <span>Unserved surplus only. Contains NO partially eaten customer plate leftovers, raw unpasteurized dairy, or soured foods.</span>
          </div>
        </label>
      </div>

      {/* Compliance Statutory Footer */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#4B6356] dark:text-[#8AA897]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#059669] dark:text-[#34D399]">
            verified
          </span>
          <span>FSSAI Surplus Food Regulations (2019) • Good Samaritan Legal Shield Active</span>
        </div>

        {allCompleted ? (
          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            All 4 FSSAI Quality Controls Cleared
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-400 font-bold">
            Please complete all 4 checklist points to publish
          </span>
        )}
      </div>
    </div>
  );
};
