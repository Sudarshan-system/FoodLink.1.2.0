import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import { DonorImpactData, downloadDonorImpactPdf } from './donorCertificateService';

interface DonorImpactCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  impactData: DonorImpactData;
}

export const DonorImpactCertificateModal: React.FC<DonorImpactCertificateModalProps> = ({
  isOpen,
  onClose,
  impactData,
}) => {
  const { isDark } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadDonorImpactPdf(impactData);
    } catch (err) {
      console.error('Error generating PDF impact certificate:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-[#112019] rounded-3xl shadow-2xl border border-[#D1E3D7] dark:border-[#244535] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F291C] via-[#059669] to-[#047857] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-amber-300">workspace_premium</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                  Official CSR &amp; ESG Document
                </span>
                <span className="text-xs text-white/80 font-semibold hidden sm:inline">
                  Generated with pdf-lib
                </span>
              </div>
              <h3 className="text-lg font-bold text-white truncate">
                Donor Impact Certificate Preview
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F291C] font-black text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[17px]">
                {isDownloading ? 'sync' : 'download'}
              </span>
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Certificate Visual Canvas Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 dark:bg-[#0B1510] flex justify-center">
          <div className="w-full max-w-3xl bg-white rounded-2xl p-6 sm:p-8 border-4 border-[#059669] shadow-xl relative text-[#1E2A22]">
            {/* Inner Gold Border */}
            <div className="border border-amber-400 p-6 sm:p-8 rounded-xl bg-[#FAFCFA] relative space-y-6">
              {/* Top Watermark / Badge */}
              <div className="text-center space-y-1">
                <div className="text-[11px] font-black text-[#059669] uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">eco</span>
                  <span>FoodLink Zero-Hunger Alliance • India</span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F291C] tracking-tight">
                  Certificate of Food Rescue Impact
                </h1>
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                  Honoring Sustainable Surplus Contribution &amp; Rescue Frequency
                </p>
                <div className="text-[10px] text-slate-500 pt-1">
                  Certificate ID: <strong className="text-slate-700">{impactData.certificateId || 'FL-IMP-2026-TajBanquets'}</strong> • City: {impactData.city}
                </div>
              </div>

              {/* Presented To */}
              <div className="text-center py-2 border-y border-[#D1E3D7]/70 space-y-1">
                <div className="text-[10px] font-bold text-[#526357] uppercase tracking-wider">
                  Proudly Presented To
                </div>
                <div className="font-serif text-2xl font-black text-[#0F291C]">
                  {impactData.donorOrg || impactData.donorName}
                </div>
                {impactData.fssaiNumber && (
                  <div className="text-[11px] text-slate-500">
                    FSSAI Reg / License: <span className="font-semibold text-slate-700">{impactData.fssaiNumber}</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 italic max-w-lg mx-auto pt-1">
                  In recognition of verified surplus food diversion, steadfast rescue frequency, and humanitarian support for vulnerable community shelters.
                </p>
              </div>

              {/* Two Core Pillars: 1. Contribution Quantity & 2. Rescue Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pillar 1: Contribution Quantity */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">scale</span>
                    <span>1. Contribution Quantity</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Food Rescued:</span>
                      <strong className="text-emerald-700 font-bold text-sm">{impactData.totalRescuedKg.toLocaleString()} kg</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Wholesome Meals:</span>
                      <strong className="text-emerald-700 font-bold text-sm">{impactData.totalMeals.toLocaleString()} meals</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Estimated Food Value:</span>
                      <strong className="text-amber-700 font-bold">₹{(impactData.totalRescuedKg * 85).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Thermal Freshness:</span>
                      <span className="text-emerald-700 font-semibold">100% Certified Safe</span>
                    </div>
                  </div>
                </div>

                {/* Pillar 2: Rescue Frequency & Cadence */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">history_toggle_drop</span>
                    <span>2. Rescue Frequency</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Completed Missions:</span>
                      <strong className="text-slate-900 font-bold text-sm">{impactData.totalRescueMissions} dispatches</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Donation Frequency:</span>
                      <strong className="text-emerald-700 font-bold">{impactData.rescueFrequency}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Handoff Reliability:</span>
                      <strong className="text-emerald-700 font-bold">{impactData.consistencyScorePercent}% On-Time</strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Shelters Benefited:</span>
                      <span className="text-slate-800 font-semibold">{impactData.sheltersSupportedCount} Community Homes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Environmental Footprint Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5 text-slate-700">
                  <div className="font-bold text-emerald-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">forest</span>
                    <span>Environmental Impact: {impactData.co2SavedKg.toLocaleString()} kg CO2e emissions prevented</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Water footprint conserved: <strong>{impactData.waterSavedLiters.toLocaleString()} Liters</strong> of embedded agricultural water.
                  </div>
                </div>

                <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] uppercase tracking-wider shrink-0 border border-amber-300">
                  Verified CSR Certified
                </div>
              </div>

              {/* Signatures & Seal */}
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-center text-xs">
                <div className="space-y-1">
                  <div className="w-36 h-0.5 bg-slate-400 mx-auto" />
                  <div className="font-bold text-[#0F291C]">Dr. Radhika Sen</div>
                  <div className="text-[10px] text-slate-500">National Director, Zero-Waste</div>
                </div>

                <div className="space-y-0.5">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-400 bg-amber-50 flex items-center justify-center mx-auto text-amber-700 font-black text-[9px]">
                    SEAL
                  </div>
                  <div className="text-[9px] text-slate-400">Section 80G Compliant</div>
                </div>

                <div className="space-y-1">
                  <div className="w-36 h-0.5 bg-slate-400 mx-auto" />
                  <div className="font-bold text-[#0F291C]">Swami J. Nambiar</div>
                  <div className="text-[10px] text-slate-500">Head of Cold-Chain Logistics</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-[#112019] border-t border-[#D1E3D7] dark:border-[#244535] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#526357] dark:text-[#95A89C]">
            Formatted as an official A4 landscape PDF document for CSR reporting and ESG audits.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl border border-[#D1E3D7] dark:border-[#244535] hover:bg-slate-50 dark:hover:bg-[#182C22] text-xs font-bold text-[#1E2A22] dark:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-5 py-2 rounded-xl bg-[#2E7D4F] hover:bg-[#1F5C39] text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isDownloading ? 'sync' : 'download'}
              </span>
              <span>{isDownloading ? 'Generating PDF...' : 'Download Official Certificate'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
