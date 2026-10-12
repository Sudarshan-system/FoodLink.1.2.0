import React from 'react';

export interface ProhibitedPolicyItem {
  category: string;
  badge: string;
  examples: string;
  rationale: string;
}

export const PROHIBITED_GUIDELINES: ProhibitedPolicyItem[] = [
  {
    category: 'Table Scraps & Customer Plate Waste',
    badge: 'Contamination Risk',
    examples: 'Half-eaten food, leftovers cleared from customer tables, bitten rolls, customer-handled buffet tray remains.',
    rationale: 'High bacterial cross-contamination risk and violates basic human dignity standards for relief feeding.',
  },
  {
    category: 'Alcohol & Controlled Substances',
    badge: 'Regulatory Violation',
    examples: 'Beer, wine, liquor, spirits, cocktails, tobacco, cigarettes, cannabis, narcotics, liquor-soaked pastries.',
    rationale: 'Relief feeding recipients include minors, children, and vulnerable families in shelters where substances are strictly banned.',
  },
  {
    category: 'Unpasteurized Raw Dairy & Wild Mushrooms',
    badge: 'Pathogen Danger',
    examples: 'Raw unpasteurized cow/buffalo/goat milk, unpasteurized cream/cheese, wild foraged uncertified mushrooms.',
    rationale: 'Severe risk of Listeria, Salmonella, E. coli, and lethal mycotoxins without lab-grade pasteurization or commercial sourcing.',
  },
  {
    category: 'Spoiled, Moldy, or Compromised Food',
    badge: 'Decomposition',
    examples: 'Visibly moldy produce, rotting fruit, sour milk, bloated/swollen or deeply dented cans, pest-infested grains.',
    rationale: 'Anaerobic botulism risks and bacterial food poisoning. Canned foods with swollen lids indicate active microbial gas production.',
  },
  {
    category: 'Expired Infant Formula & Baby Food',
    badge: 'Statutory Prohibition',
    examples: 'Baby formula, infant cereals, opened baby puree jars past manufacturer expiration date.',
    rationale: 'Nutrient degradation and fragile infant immune systems strictly mandate 100% in-date infant nutrition under food safety law.',
  },
  {
    category: 'Wild Game, Roadkill & Uninspected Meats',
    badge: 'Zoonotic Risk',
    examples: 'Roadkill, bushmeat, wild hunted game not slaughtered in government-certified abattoirs.',
    rationale: 'Zoonotic diseases, parasite transmission, and lack of veterinary ante-mortem inspection.',
  },
  {
    category: 'Home-Canned Low-Acid Preserves',
    badge: 'Botulism Hazard',
    examples: 'Home-jarred meats, home-canned green beans, asparagus, corn, soups, or low-acid recipes without pressure-canning certification.',
    rationale: 'Clostridium botulinum spore germination produces lethal neurotoxins in low-acid anaerobic environments.',
  },
  {
    category: 'Medicines, Chemicals & Foreign Contaminants',
    badge: 'Toxic Hazard',
    examples: 'Prescription drugs, pills, cleaning detergents, bleach sanitizers, broken glass shards, metal wire scourer fragments.',
    rationale: 'Immediate physical and toxic trauma hazard.',
  },
];

interface PolicyViolationModalProps {
  isOpen: boolean;
  prohibitedItems: string[];
  reason: string;
  storageAdvice?: string;
  onClose: () => void;
  onOpenGuidelines: () => void;
}

export const PolicyViolationModal: React.FC<PolicyViolationModalProps> = ({
  isOpen,
  prohibitedItems,
  reason,
  storageAdvice,
  onClose,
  onOpenGuidelines,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#112019] rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/60 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">gavel</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/25 text-white">
                FSSAI &amp; FoodLink Policy
              </span>
              <span className="text-xs text-white/80 font-medium">Submission Blocked</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1 leading-tight">
              Prohibited Food Item Detected
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-[#1E2A22] dark:text-[#E2EDE5]">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300 leading-relaxed">
              Our automated safety inspector detected items that violate food rescue regulations. To protect recipient shelters and community kitchens, this listing cannot be published in its current form.
            </p>
          </div>

          {/* Detected items tags */}
          {prohibitedItems && prohibitedItems.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#526357] dark:text-[#95A89C] uppercase tracking-wider mb-2">
                Flagged Prohibited Category
              </div>
              <div className="flex flex-wrap gap-2">
                {prohibitedItems.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 font-bold text-xs border border-red-300 dark:border-red-800"
                  >
                    <span className="material-symbols-outlined text-[15px]">block</span>
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Violation Details */}
          <div>
            <div className="text-xs font-bold text-[#526357] dark:text-[#95A89C] uppercase tracking-wider mb-1.5">
              Auditor Assessment &amp; Reason
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#182C23] border border-slate-200 dark:border-[#244535] text-xs leading-relaxed text-[#1E2A22] dark:text-[#F4F8F5]">
              {reason}
            </div>
          </div>

          {storageAdvice && (
            <div className="text-xs text-[#526357] dark:text-[#95A89C] italic">
              <strong>Advisory:</strong> {storageAdvice}
            </div>
          )}

          {/* Quick advice */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[16px]">help</span>
              <span>How to proceed</span>
            </div>
            <p className="leading-relaxed">
              Ensure donated surplus meals are untouched batch food prepared freshly in hygienic containers. Plate leftovers, raw dairy, and alcoholic items must be safely discarded or composted locally instead of donated.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-[#0E1A14] border-t border-slate-200 dark:border-[#244535] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onOpenGuidelines}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-[#2E7D4F] dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>View Full Prohibited List</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            <span>Edit Listing Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProhibitedGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProhibitedGuidelinesModal: React.FC<ProhibitedGuidelinesModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-[#112019] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#244535] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1E2A22] to-[#2E7D4F] text-white flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div className="flex-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
              FSSAI &amp; Community Guidelines
            </span>
            <h3 className="text-lg font-bold text-white mt-1">
              FoodLink Safe Donation &amp; Prohibited Items Policy
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Standards enforced by automated AI inspection and on-site courier verification
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* List of items */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-[#1E2A22] dark:text-[#E2EDE5]">
          <p className="text-xs text-[#526357] dark:text-[#95A89C]">
            To safeguard community shelters and recipient children, FoodLink does not permit the donation of the following categories:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROHIBITED_GUIDELINES.map((guide, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-[#244535] bg-slate-50/60 dark:bg-[#15271E] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <h4 className="font-bold text-xs text-[#1E2A22] dark:text-[#F4F8F5] leading-snug">
                    {guide.category}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 shrink-0">
                    {guide.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#526357] dark:text-[#95A89C]">
                  <strong>Examples:</strong> {guide.examples}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-0.5">
                  <strong>Why:</strong> {guide.rationale}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-bold">What is welcomed:</span> Fresh untouched commercial batch meals, packaged grains, breads, fresh produce, safely held hot gravies, pasteurized milk packages, and properly sealed hotel surplus.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-[#0E1A14] border-t border-slate-200 dark:border-[#244535] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#2E7D4F] hover:bg-[#1F5C39] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            I Understand the Guidelines
          </button>
        </div>
      </div>
    </div>
  );
};
