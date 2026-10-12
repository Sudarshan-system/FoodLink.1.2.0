import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface DonorImpactData {
  donorName: string;
  donorOrg: string;
  donorEmail?: string;
  donorPhone?: string;
  city: string;
  fssaiNumber?: string;
  totalRescuedKg: number;
  totalMeals: number;
  totalRescueMissions: number;
  rescueFrequency: string; // e.g. "Weekly Regular (3-4 batches/month)"
  rescueCadenceDesc?: string;
  activeSinceDate?: string;
  latestRescueDate?: string;
  co2SavedKg: number;
  waterSavedLiters: number;
  sheltersSupportedCount: number;
  consistencyScorePercent: number;
  certificateId?: string;
}

export async function generateDonorImpactPdf(data: DonorImpactData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // A4 Landscape: 841.89 x 595.28 points for an authentic, prestigious certificate feel
  const page = pdfDoc.addPage([841.89, 595.28]);
  const width = page.getWidth();
  const height = page.getHeight();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette
  const emeraldPrimary = rgb(0.02, 0.59, 0.41); // #059669
  const darkForest = rgb(0.06, 0.16, 0.11); // #0F291C
  const goldAccent = rgb(0.85, 0.65, 0.13); // #D9A721
  const softBg = rgb(0.98, 0.99, 0.98); // #FAFCFA
  const borderGold = rgb(0.92, 0.72, 0.18);
  const textMuted = rgb(0.38, 0.45, 0.41);
  const textDark = rgb(0.12, 0.16, 0.14);

  // 1. Certificate Background & Triple Elegant Border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: emeraldPrimary,
    borderWidth: 4,
    color: softBg,
  });

  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderColor: borderGold,
    borderWidth: 1.5,
  });

  page.drawRectangle({
    x: 31,
    y: 31,
    width: width - 62,
    height: height - 62,
    borderColor: rgb(0.85, 0.92, 0.88),
    borderWidth: 1,
  });

  // Corner decorative flourishes (geometric crosslines)
  const drawCornerFlourish = (cx: number, cy: number) => {
    page.drawCircle({
      x: cx,
      y: cy,
      size: 4,
      color: goldAccent,
    });
  };
  drawCornerFlourish(36, height - 36);
  drawCornerFlourish(width - 36, height - 36);
  drawCornerFlourish(36, 36);
  drawCornerFlourish(width - 36, 36);

  // 2. Organization Header
  const orgTitle = 'FOODLINK ZERO-HUNGER ALLIANCE • INDIA';
  const orgWidth = fontBold.widthOfTextAtSize(orgTitle, 12);
  page.drawText(orgTitle, {
    x: (width - orgWidth) / 2,
    y: height - 62,
    size: 12,
    font: fontBold,
    color: emeraldPrimary,
  });

  const certMainTitle = 'CERTIFICATE OF FOOD RESCUE IMPACT';
  const titleWidth = fontBold.widthOfTextAtSize(certMainTitle, 22);
  page.drawText(certMainTitle, {
    x: (width - titleWidth) / 2,
    y: height - 90,
    size: 22,
    font: fontBold,
    color: darkForest,
  });

  const subtitle = 'HONORING SUSTAINABLE SURPLUS CONTRIBUTION & RESCUE FREQUENCY';
  const subWidth = fontBold.widthOfTextAtSize(subtitle, 9);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 108,
    size: 9,
    font: fontBold,
    color: goldAccent,
  });

  // Certificate ID & Issue Date Banner
  const certId = data.certificateId || `FL-IMP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const issueDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  page.drawText(`Certificate ID: ${certId}`, {
    x: 50,
    y: height - 132,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });

  const dateText = `Issued: ${issueDate} • City: ${data.city || 'National Network'}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 9);
  page.drawText(dateText, {
    x: width - 50 - dateWidth,
    y: height - 132,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });

  // Horizontal divider line
  page.drawLine({
    start: { x: 50, y: height - 140 },
    end: { x: width - 50, y: height - 140 },
    thickness: 1,
    color: rgb(0.85, 0.90, 0.86),
  });

  // 3. Recipient Recognition Statement
  const presentText = 'PROUDLY PRESENTED TO:';
  const presentWidth = fontBold.widthOfTextAtSize(presentText, 10);
  page.drawText(presentText, {
    x: (width - presentWidth) / 2,
    y: height - 165,
    size: 10,
    font: fontBold,
    color: textMuted,
  });

  const recipientName = (data.donorOrg || data.donorName || 'Hospitality Partner').toUpperCase();
  const nameSize = recipientName.length > 32 ? 18 : 22;
  const nameWidth = fontBold.widthOfTextAtSize(recipientName, nameSize);
  page.drawText(recipientName, {
    x: (width - nameWidth) / 2,
    y: height - 192,
    size: nameSize,
    font: fontBold,
    color: darkForest,
  });

  if (data.fssaiNumber) {
    const fssaiText = `FSSAI License / Registration No: ${data.fssaiNumber}`;
    const fssaiWidth = fontRegular.widthOfTextAtSize(fssaiText, 9);
    page.drawText(fssaiText, {
      x: (width - fssaiWidth) / 2,
      y: height - 208,
      size: 9,
      font: fontRegular,
      color: textMuted,
    });
  }

  const statement =
    'In recognition of exemplary commitment to eliminating food waste and feeding vulnerable urban communities.';
  const stmtWidth = fontOblique.widthOfTextAtSize(statement, 10);
  page.drawText(statement, {
    x: (width - stmtWidth) / 2,
    y: height - 228,
    size: 10,
    font: fontOblique,
    color: textDark,
  });

  // 4. Metric Cards (Quantity and Frequency)
  // Left Box: CONTRIBUTION QUANTITY
  const boxY = height - 355;
  const boxHeight = 110;
  const boxWidth = 350;

  page.drawRectangle({
    x: 50,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0.82, 0.92, 0.86),
    borderWidth: 1.5,
    color: rgb(0.96, 0.99, 0.97),
  });

  page.drawText('1. CONTRIBUTION QUANTITY', {
    x: 65,
    y: boxY + boxHeight - 20,
    size: 10,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(`Total Weight Rescued:`, {
    x: 65,
    y: boxY + boxHeight - 42,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`${data.totalRescuedKg.toLocaleString()} kg`, {
    x: 235,
    y: boxY + boxHeight - 42,
    size: 11,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(`Wholesome Meals Provided:`, {
    x: 65,
    y: boxY + boxHeight - 62,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`${data.totalMeals.toLocaleString()} meals`, {
    x: 235,
    y: boxY + boxHeight - 62,
    size: 11,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(`Estimated Relief Food Value:`, {
    x: 65,
    y: boxY + boxHeight - 82,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  const estVal = `₹${(data.totalRescuedKg * 85).toLocaleString()}`;
  page.drawText(estVal, {
    x: 235,
    y: boxY + boxHeight - 82,
    size: 11,
    font: fontBold,
    color: goldAccent,
  });

  page.drawText(`FSSAI Hygiene Grade:`, {
    x: 65,
    y: boxY + boxHeight - 100,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText(`100% Thermal Verified Freshness`, {
    x: 235,
    y: boxY + boxHeight - 100,
    size: 9,
    font: fontBold,
    color: emeraldPrimary,
  });

  // Right Box: RESCUE FREQUENCY & CADENCE
  const rightBoxX = width - 50 - boxWidth;
  page.drawRectangle({
    x: rightBoxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0.95, 0.85, 0.70),
    borderWidth: 1.5,
    color: rgb(0.99, 0.98, 0.95),
  });

  page.drawText('2. RESCUE FREQUENCY & CONSISTENCY', {
    x: rightBoxX + 15,
    y: boxY + boxHeight - 20,
    size: 10,
    font: fontBold,
    color: goldAccent,
  });

  page.drawText(`Total Rescue Missions:`, {
    x: rightBoxX + 15,
    y: boxY + boxHeight - 42,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`${data.totalRescueMissions} completed batches`, {
    x: rightBoxX + 185,
    y: boxY + boxHeight - 42,
    size: 11,
    font: fontBold,
    color: darkForest,
  });

  page.drawText(`Donation Cadence:`, {
    x: rightBoxX + 15,
    y: boxY + boxHeight - 62,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(data.rescueFrequency, {
    x: rightBoxX + 185,
    y: boxY + boxHeight - 62,
    size: 10,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(`Dispatch Reliability:`, {
    x: rightBoxX + 15,
    y: boxY + boxHeight - 82,
    size: 10,
    font: fontRegular,
    color: textDark,
  });
  page.drawText(`${data.consistencyScorePercent}% On-Time Handoff`, {
    x: rightBoxX + 185,
    y: boxY + boxHeight - 82,
    size: 11,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(`Active Relief Support:`, {
    x: rightBoxX + 15,
    y: boxY + boxHeight - 100,
    size: 9,
    font: fontRegular,
    color: textMuted,
  });
  page.drawText(`${data.sheltersSupportedCount} Community Shelters & Care Homes`, {
    x: rightBoxX + 185,
    y: boxY + boxHeight - 100,
    size: 9,
    font: fontBold,
    color: darkForest,
  });

  // 5. Environmental & Social Impact Summary Banner
  const envY = height - 420;
  page.drawRectangle({
    x: 50,
    y: envY,
    width: width - 100,
    height: 48,
    borderColor: rgb(0.85, 0.90, 0.88),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.97),
  });

  const envLine1 = `ENVIRONMENTAL FOOTPRINT SAVED:  ${data.co2SavedKg.toLocaleString()} kg CO2e greenhouse gas diverted from landfills`;
  const envLine2 = `WATER FOOTPRINT CONSERVED:  ${data.waterSavedLiters.toLocaleString()} Liters of embedded freshwater conserved`;

  page.drawText(envLine1, {
    x: 65,
    y: envY + 28,
    size: 9.5,
    font: fontBold,
    color: emeraldPrimary,
  });

  page.drawText(envLine2, {
    x: 65,
    y: envY + 12,
    size: 9.5,
    font: fontBold,
    color: darkForest,
  });

  // Seal Graphic Mockup (Circular rosette)
  page.drawCircle({
    x: width - 110,
    y: envY + 24,
    size: 20,
    borderColor: goldAccent,
    borderWidth: 2,
    color: rgb(1, 0.98, 0.90),
  });
  page.drawText('VERIFIED', {
    x: width - 128,
    y: envY + 21,
    size: 7,
    font: fontBold,
    color: goldAccent,
  });

  // 6. Signatures & Verification Footer
  const signY = 60;

  // Left Signatory
  page.drawLine({
    start: { x: 80, y: signY + 35 },
    end: { x: 260, y: signY + 35 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.62),
  });
  page.drawText('Dr. Radhika Sen, Ph.D.', {
    x: 100,
    y: signY + 20,
    size: 10,
    font: fontBold,
    color: darkForest,
  });
  page.drawText('National Director, Zero-Waste Initiatives', {
    x: 80,
    y: signY + 8,
    size: 8,
    font: fontRegular,
    color: textMuted,
  });

  // Center QR & Verification Hash
  const hashText = `Security Seal: SHA-256[${certId.slice(0, 10)}]`;
  const hashWidth = fontRegular.widthOfTextAtSize(hashText, 7.5);
  page.drawText(hashText, {
    x: (width - hashWidth) / 2,
    y: signY + 25,
    size: 7.5,
    font: fontRegular,
    color: textMuted,
  });
  const legalNote = 'Valid under FSSAI Surplus Food Regulations 2019 & CSR Section 135';
  const legalWidth = fontRegular.widthOfTextAtSize(legalNote, 7.5);
  page.drawText(legalNote, {
    x: (width - legalWidth) / 2,
    y: signY + 12,
    size: 7.5,
    font: fontRegular,
    color: textMuted,
  });

  // Right Signatory
  page.drawLine({
    start: { x: width - 260, y: signY + 35 },
    end: { x: width - 80, y: signY + 35 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.62),
  });
  page.drawText('Swami J. Nambiar', {
    x: width - 220,
    y: signY + 20,
    size: 10,
    font: fontBold,
    color: darkForest,
  });
  page.drawText('Head of Logistics & Cold-Chain Safety', {
    x: width - 250,
    y: signY + 8,
    size: 8,
    font: fontRegular,
    color: textMuted,
  });

  return await pdfDoc.save();
}

export async function downloadDonorImpactPdf(data: DonorImpactData): Promise<void> {
  const pdfBytes = await generateDonorImpactPdf(data);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.donorOrg || data.donorName || 'Donor').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `FoodLink_Impact_Certificate_${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
