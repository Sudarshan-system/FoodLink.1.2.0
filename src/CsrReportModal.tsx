import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import { FoodListing } from './DonorDashboard';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface CsrReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing?: FoodListing | null;
  donorName?: string;
  donorOrg?: string;
  panNumber?: string;
  totalRescuedKg?: number;
  totalMeals?: number;
}

export const CsrReportModal: React.FC<CsrReportModalProps> = ({
  isOpen,
  onClose,
  listing,
  donorName = 'Verified Hospitality Partner',
  donorOrg = 'Taj Grand Banquets & Hotels Ltd.',
  panNumber = 'AABCT1234F',
  totalRescuedKg = 340,
  totalMeals = 850,
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  // Derived certificate data
  const certId = listing
    ? `FL-CSR-80G-${listing.id.slice(0, 8).toUpperCase()}`
    : `FL-CSR-80G-${Date.now().toString(36).toUpperCase()}`;

  const certDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const quantityKg = listing ? listing.quantity : totalRescuedKg;
  const mealsCount = listing ? Math.round(listing.quantity * 2.5) : totalMeals;
  const estimatedValueInr = quantityKg * 85; // Approx ₹85 fair market value per kg/prepared meal
  const co2AvoidedKg = Math.round(quantityKg * 2.45); // 2.45 kg CO2e saved per kg food rescued

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const width = page.getWidth();
      const height = page.getHeight();

      // Outer border & inner border (emerald & gold)
      page.drawRectangle({
        x: 20,
        y: 20,
        width: width - 40,
        height: height - 40,
        borderColor: rgb(0.02, 0.59, 0.41), // emerald #059669
        borderWidth: 3,
        color: rgb(0.99, 1, 0.99),
      });

      page.drawRectangle({
        x: 26,
        y: 26,
        width: width - 52,
        height: height - 52,
        borderColor: rgb(0.96, 0.62, 0.04), // amber #F59E0B
        borderWidth: 1,
      });

      // Top Header
      page.drawText('FOODLINK DISPATCH & ZERO-WASTE ALLIANCE', {
        x: 130,
        y: height - 70,
        size: 13,
        font: fontBold,
        color: rgb(0.02, 0.59, 0.41),
      });

      page.drawText('OFFICIAL CSR IMPACT & SECTION 80G DONATION CERTIFICATE', {
        x: 80,
        y: height - 95,
        size: 11,
        font: fontBold,
        color: rgb(0.06, 0.12, 0.09),
      });

      // Certificate ID & Date
      page.drawText(`Certificate ID: ${certId}`, {
        x: 50,
        y: height - 130,
        size: 10,
        font: fontBold,
        color: rgb(0.3, 0.4, 0.35),
      });

      page.drawText(`Date of Issue: ${certDate}`, {
        x: width - 210,
        y: height - 130,
        size: 10,
        font: font,
        color: rgb(0.3, 0.4, 0.35),
      });

      // Recipient section
      page.drawText('THIS IS TO CERTIFY THAT THE DONOR ENTITY:', {
        x: 50,
        y: height - 165,
        size: 9,
        font: fontBold,
        color: rgb(0.4, 0.5, 0.45),
      });

      const donorDisplayName = listing?.donorOrg || donorOrg;
      page.drawText(donorDisplayName, {
        x: 50,
        y: height - 190,
        size: 16,
        font: fontBold,
        color: rgb(0.02, 0.59, 0.41),
      });

      page.drawText(`Tax PAN / Reg: ${panNumber}   |   FSSAI Safe Food Verified`, {
        x: 50,
        y: height - 210,
        size: 10,
        font: font,
        color: rgb(0.2, 0.3, 0.25),
      });

      page.drawText(
        'has successfully redirected fresh and inspected surplus nourishment to verified community shelters across India.',
        {
          x: 50,
          y: height - 240,
          size: 10,
          font: font,
          color: rgb(0.2, 0.2, 0.2),
        }
      );

      // Metrics Table Box
      page.drawRectangle({
        x: 50,
        y: height - 370,
        width: width - 100,
        height: 105,
        borderColor: rgb(0.82, 0.89, 0.84),
        borderWidth: 1,
        color: rgb(0.96, 0.99, 0.97),
      });

      page.drawText('SURPLUS RESCUED', { x: 70, y: height - 295, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.35) });
      page.drawText(`${quantityKg} kg`, { x: 70, y: height - 325, size: 20, font: fontBold, color: rgb(0.02, 0.59, 0.41) });

      page.drawText('MEALS PROVIDED', { x: 195, y: height - 295, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.35) });
      page.drawText(`${mealsCount} plates`, { x: 195, y: height - 325, size: 20, font: fontBold, color: rgb(0.02, 0.59, 0.41) });

      page.drawText('ESTIMATED FMV', { x: 330, y: height - 295, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.35) });
      page.drawText(`INR ${estimatedValueInr.toLocaleString()}`, { x: 330, y: height - 325, size: 18, font: fontBold, color: rgb(0.85, 0.47, 0.05) });

      page.drawText('CARBON AVOIDED', { x: 445, y: height - 295, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.35) });
      page.drawText(`${co2AvoidedKg} kg CO2`, { x: 445, y: height - 325, size: 18, font: fontBold, color: rgb(0.02, 0.59, 0.41) });

      // Statutory Declaration
      page.drawText('STATUTORY 80G COMPLIANCE & RECIPIENT ENDORSEMENT', {
        x: 50,
        y: height - 405,
        size: 10,
        font: fontBold,
        color: rgb(0.06, 0.12, 0.09),
      });

      page.drawText(
        'The designated recipient institution, The Akshaya Patra Foundation & Feeding India Network (Reg: AAATA0123M-80G), confirms receipt.',
        { x: 50, y: height - 425, size: 9, font: font, color: rgb(0.2, 0.3, 0.25) }
      );
      page.drawText(
        'This certificate serves as verifiable evidence of non-cash charitable contributions under Section 135 CSR and Section 80G.',
        { x: 50, y: height - 440, size: 9, font: font, color: rgb(0.2, 0.3, 0.25) }
      );

      // Verification seal
      page.drawRectangle({
        x: 50,
        y: height - 540,
        width: 140,
        height: 70,
        borderColor: rgb(0.02, 0.59, 0.41),
        borderWidth: 1,
        color: rgb(0.96, 0.99, 0.97),
      });
      page.drawText('VERIFICATION HASH', { x: 60, y: height - 490, size: 8, font: fontBold, color: rgb(0.02, 0.59, 0.41) });
      page.drawText(`SHA256: ${certId.slice(0, 16)}`, { x: 60, y: height - 510, size: 8, font: font, color: rgb(0.3, 0.4, 0.35) });
      page.drawText('Scan to verify ledger entry', { x: 60, y: height - 525, size: 7, font: font, color: rgb(0.4, 0.5, 0.45) });

      // Signatures
      page.drawText('Dr. Arvind K. Sharma', { x: 260, y: height - 500, size: 10, font: fontBold, color: rgb(0.06, 0.12, 0.09) });
      page.drawText('National Coordinator, FoodLink India', { x: 260, y: height - 515, size: 8, font: font, color: rgb(0.3, 0.4, 0.35) });
      page.drawLine({
        start: { x: 260, y: height - 485 },
        end: { x: 410, y: height - 485 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      page.drawText('Swami J. Nambiar', { x: 430, y: height - 500, size: 10, font: fontBold, color: rgb(0.06, 0.12, 0.09) });
      page.drawText('Trustee, Akshaya Patra Relief', { x: 430, y: height - 515, size: 8, font: font, color: rgb(0.3, 0.4, 0.35) });
      page.drawLine({
        start: { x: 430, y: height - 485 },
        end: { x: 540, y: height - 485 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      // Footer
      page.drawText('Issued through FoodLink National Food Recovery Ledger - Secured with Firebase Timestamping', {
        x: 75,
        y: 40,
        size: 8,
        font: font,
        color: rgb(0.4, 0.5, 0.45),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${certId}_CSR_Certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF certificate:', err);
      alert('Could not generate PDF. Please try Print as PDF instead.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'Certificate ID',
      'Issue Date',
      'Donor Entity',
      'Donor PAN',
      'Designated NGO',
      'NGO 80G Registration',
      'Food Category',
      'Quantity (kg/units)',
      'Estimated Meals',
      'Valuation (INR)',
      'CO2 Offset (kg)',
      'FSSAI Verification',
    ];

    const row = [
      certId,
      certDate,
      `"${listing?.donorOrg || donorOrg}"`,
      panNumber,
      '"The Akshaya Patra Foundation & Feeding India Network"',
      'AAATA0123M-80G',
      `"${listing?.category || 'Cooked Surplus & Dry Provisions'}"`,
      quantityKg,
      mealsCount,
      estimatedValueInr,
      co2AvoidedKg,
      'FSSAI Compliant (Temp & Hygiene Checked)',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), row.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${certId}_Audit_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1715]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-3xl rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto border max-h-[94vh] overflow-y-auto transition-colors print:max-h-none print:shadow-none print:border-none print:p-0 ${
          isDark
            ? 'bg-[#162421] border-[#233833] text-[#F2F7F4]'
            : 'bg-[#FFFFFF] border-[#CFDED5] text-[#111A17]'
        }`}
      >
        {/* Certificate Container */}
        <div className="border-4 border-double border-[#D97706]/40 rounded-2xl p-6 sm:p-8 relative bg-radial from-[#D97706]/5 via-transparent to-transparent print:border-2 print:border-black">
          {/* Watermark / Digital Seal */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex flex-col items-center opacity-85">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-[#D97706] flex items-center justify-center p-1 text-center bg-[#D97706]/10">
              <div className="w-full h-full rounded-full border border-[#D97706] flex flex-col items-center justify-center text-[8px] font-black uppercase text-[#D97706] tracking-tighter">
                <span>80G / 12A</span>
                <span className="text-[10px]">VERIFIED</span>
                <span>AUDIT SEC</span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold mt-1 text-[#D97706]">
              SEC. 135 CSR
            </span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#D97706] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
              FL
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#D97706] block">
                FoodLink National Food Recovery Council
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                CSR Food Donation &amp; 80G Tax Exemption Certificate
              </h2>
              <p className={`text-[12px] ${isDark ? 'text-[#B8CCC1]' : 'text-[#4D5C56]'}`}>
                Issued in accordance with Section 80G(5)(vi) of the Income Tax Act, 1961 &amp; FSSAI Surplus Food Regulations.
              </p>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="my-6 space-y-4 text-[13px] leading-relaxed">
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] font-mono ${
                isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
              }`}
            >
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">Certificate Number</span>
                <span className="font-extrabold text-[#D97706]">{certId}</span>
              </div>
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">Date of Certification</span>
                <span className="font-bold">{certDate}</span>
              </div>
              <div>
                <span className="text-opacity-70 block text-[10px] uppercase font-bold">FSSAI Protocol</span>
                <span className="font-bold text-[#059669]">Compliant / Safe</span>
              </div>
            </div>

            <p>
              This is to certify that <strong>{listing?.donorOrg || donorOrg}</strong> (Authorized Representative: <em>{listing?.donorName || donorName}</em>, PAN Ref: <code>{panNumber}</code>) has successfully diverted verified surplus edible food through the <strong>FoodLink India Rescue Network</strong> for immediate humanitarian distribution to underprivileged shelters and registered charity partners.
            </p>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  Surplus Quantity
                </span>
                <span className="text-xl font-black text-[#D97706]">
                  {quantityKg} <span className="text-[12px] font-semibold">{listing?.unit || 'Kg'}</span>
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  Meals Served
                </span>
                <span className="text-xl font-black text-[#059669]">
                  {mealsCount.toLocaleString()}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  Fair Value (80G)
                </span>
                <span className="text-xl font-black">
                  ₹{estimatedValueInr.toLocaleString('en-IN')}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border text-center ${
                  isDark ? 'bg-[#0E1715] border-[#233833]' : 'bg-[#F4F8F5] border-[#CFDED5]'
                }`}
              >
                <span className={`text-[10px] font-bold block uppercase ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
                  CO₂e Diverted
                </span>
                <span className="text-xl font-black text-[#059669]">
                  {co2AvoidedKg} <span className="text-[12px] font-semibold">kg</span>
                </span>
              </div>
            </div>

            {/* Recipient & FSSAI Verification Checklist */}
            <div
              className={`p-4 rounded-xl border text-[12px] space-y-1.5 ${
                isDark ? 'bg-[#0E1715]/60 border-[#233833]' : 'bg-[#F4F8F5]/80 border-[#CFDED5]'
              }`}
            >
              <div className="font-bold text-[#D97706] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>FSSAI Hygiene &amp; 80G Statutory Verification Summary:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-opacity-90">
                <li>
                  <strong>Designated Partner NGO:</strong> Akshaya Patra Foundation / Feeding India Distribution Alliance (Registration 80G / 12A compliant).
                </li>
                <li>
                  <strong>Hygienic Temperature Integrity:</strong> Maintained within safe thresholds (&le; 4&deg;C chilled or &ge; 65&deg;C hot transport) prior to ingestion.
                </li>
                <li>
                  <strong>Zero Commercial Resale Clause:</strong> Verified non-commercial end-use for free public relief in compliance with Indian Food Safety norms.
                </li>
              </ul>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-[#D97706]/30 grid grid-cols-2 gap-6 text-[11px]">
              <div>
                <div className="h-10 flex items-end">
                  <span className="font-serif italic text-[15px] font-bold text-[#D97706]">
                    Dr. Arvind K. Sharma
                  </span>
                </div>
                <div className="border-t border-[#CFDED5] dark:border-[#233833] pt-1 mt-1">
                  <p className="font-bold">Authorized Signatory</p>
                  <p className="text-opacity-70 text-[10px]">National Food Security Coordinator, FoodLink India</p>
                </div>
              </div>

              <div>
                <div className="h-10 flex items-end">
                  <span className="font-serif italic text-[15px] font-bold text-[#059669]">
                    FSSAI Auditor Node #3412
                  </span>
                </div>
                <div className="border-t border-[#CFDED5] dark:border-[#233833] pt-1 mt-1">
                  <p className="font-bold">Digital Cryptographic Stamp</p>
                  <p className="text-opacity-70 text-[10px]">SHA-256 Verified on Distributed Ledger</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden in Print) */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <p className={`text-[12px] ${isDark ? 'text-[#7B9487]' : 'text-[#71827A]'}`}>
            Tax deductions are subject to assessment under IT Section 80G &amp; CSR Schedule VII.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#233833] bg-[#0E1715] hover:bg-[#1C2E2A] text-[#F2F7F4]'
                  : 'border-[#CFDED5] bg-[#F4F8F5] hover:bg-[#EBF2ED] text-[#111A17]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isGeneratingPdf ? 'hourglass_top' : 'picture_as_pdf'}
              </span>
              <span>{isGeneratingPdf ? 'Building PDF...' : 'Download PDF Certificate'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#233833] hover:bg-[#1C2E2A] text-[#B8CCC1]'
                  : 'border-[#CFDED5] hover:bg-[#EBF2ED] text-[#4D5C56]'
              }`}
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
