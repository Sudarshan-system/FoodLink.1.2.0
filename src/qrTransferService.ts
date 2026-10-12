import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

export interface MealTransferPayload {
  version: '1.0';
  listingId: string;
  batchTitle: string;
  stage: 'pickup' | 'delivery';
  donorId: string;
  donorOrg: string;
  recipientId?: string;
  recipientOrg?: string;
  quantity: number;
  unit: string;
  handoffCode: string;
  securityToken: string;
  foodType: string;
  generatedAt: number;
  expiresAt: number;
}

export interface TransferVerificationRecord {
  id: string;
  listingId: string;
  batchTitle: string;
  stage: 'pickup' | 'delivery';
  verifiedByRole: 'donor' | 'recipient' | 'volunteer' | 'admin';
  verifiedById: string;
  verifiedByName: string;
  partnerOrg?: string;
  timestamp: string;
  temperatureCelsius?: number;
  notes?: string;
  handoffCode: string;
  proofDigest: string;
  digitalSignature: string;
  status: 'verified';
}

// Generate a deterministic SHA-256 digest
export async function computeProofDigest(input: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }
  } catch {
    // Fallback simple checksum
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return 'dig_' + Math.abs(hash).toString(16).padStart(12, '0');
}

// Create a transfer payload
export async function createTransferPayload(params: {
  listingId: string;
  batchTitle: string;
  stage: 'pickup' | 'delivery';
  donorId: string;
  donorOrg: string;
  recipientId?: string;
  recipientOrg?: string;
  quantity: number;
  unit: string;
  handoffCode?: string;
  foodType?: string;
  validityMinutes?: number;
}): Promise<MealTransferPayload> {
  const generatedAt = Date.now();
  const validityMinutes = params.validityMinutes || 120; // Valid for 2 hours
  const expiresAt = generatedAt + validityMinutes * 60 * 1000;
  const handoffCode = params.handoffCode || String(Math.floor(1000 + Math.random() * 9000));

  const rawTokenBase = `${params.listingId}-${params.stage}-${params.donorId}-${handoffCode}-${generatedAt}`;
  const securityToken = await computeProofDigest(rawTokenBase);

  return {
    version: '1.0',
    listingId: params.listingId,
    batchTitle: params.batchTitle,
    stage: params.stage,
    donorId: params.donorId,
    donorOrg: params.donorOrg,
    recipientId: params.recipientId,
    recipientOrg: params.recipientOrg,
    quantity: params.quantity,
    unit: params.unit,
    handoffCode,
    securityToken,
    foodType: params.foodType || 'Prepared Surplus',
    generatedAt,
    expiresAt,
  };
}

// Generate QR Code data URL with high resolution
export async function generateQrDataUrl(
  payload: MealTransferPayload | string,
  options?: {
    darkColor?: string;
    lightColor?: string;
    width?: number;
  }
): Promise<string> {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: options?.width || 360,
    color: {
      dark: options?.darkColor || '#059669', // Emerald theme
      light: options?.lightColor || '#FFFFFF',
    },
  });
}

// Decode QR Code from an HTMLCanvasElement
export function decodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return code ? code.data : null;
}

// Decode QR Code from an image element or file
export function decodeQrFromImage(imgElement: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.naturalWidth || imgElement.width;
  canvas.height = imgElement.naturalHeight || imgElement.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imgElement, 0, 0);
  return decodeQrFromCanvas(canvas);
}

// Parse and validate a scanned QR code payload
export function parseTransferQr(rawText: string): {
  valid: boolean;
  payload?: MealTransferPayload;
  error?: string;
} {
  try {
    const data = JSON.parse(rawText) as MealTransferPayload;
    if (!data.listingId || !data.stage || !data.donorId || !data.securityToken) {
      return { valid: false, error: 'Invalid QR format. Missing mandatory meal transfer tokens.' };
    }
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return { valid: false, error: 'Transfer QR Pass has expired. Please regenerate a fresh QR pass.' };
    }
    return { valid: true, payload: data };
  } catch {
    // If it's a plain handoff code or plain text
    if (rawText.length >= 4 && rawText.length <= 12 && /^\d+$/.test(rawText.trim())) {
      return {
        valid: false,
        error: 'Scanned numeric PIN instead of QR Pass. Please enter this PIN in the fallback code box.',
      };
    }
    return { valid: false, error: 'Could not parse QR Code data. Please align scanner steadily.' };
  }
}

// Persistent Storage Key
const LOCAL_STORAGE_VERIFICATIONS_KEY = 'foodlink_transfer_verifications';

export function getLocalVerifications(): TransferVerificationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VERIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalVerification(record: TransferVerificationRecord): void {
  try {
    const existing = getLocalVerifications();
    const updated = [record, ...existing.filter((r) => r.id !== record.id)];
    localStorage.setItem(LOCAL_STORAGE_VERIFICATIONS_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch {
    // ignore
  }
}

// Save verified transfer to Firestore and update listing status
export async function executeTransferVerification(params: {
  listingId: string;
  batchTitle: string;
  stage: 'pickup' | 'delivery';
  verifiedByRole: 'donor' | 'recipient' | 'volunteer' | 'admin';
  verifiedById: string;
  verifiedByName: string;
  partnerOrg?: string;
  handoffCode: string;
  temperatureCelsius?: number;
  notes?: string;
  location?: string;
}): Promise<TransferVerificationRecord> {
  const timestamp = new Date().toISOString();
  const rawSignature = `${params.listingId}:${params.stage}:${params.verifiedById}:${timestamp}:${params.handoffCode}`;
  const digitalSignature = await computeProofDigest(rawSignature);
  const proofDigest = `FOODLINK-TRX-${digitalSignature.slice(0, 10).toUpperCase()}`;

  const record: TransferVerificationRecord = {
    id: `verif-${params.listingId}-${params.stage}-${Date.now()}`,
    listingId: params.listingId,
    batchTitle: params.batchTitle,
    stage: params.stage,
    verifiedByRole: params.verifiedByRole,
    verifiedById: params.verifiedById,
    verifiedByName: params.verifiedByName,
    partnerOrg: params.partnerOrg,
    timestamp,
    temperatureCelsius: params.temperatureCelsius,
    notes: params.notes,
    handoffCode: params.handoffCode,
    proofDigest,
    digitalSignature,
    status: 'verified',
  };

  // 1. Save locally for instant reactivity
  saveLocalVerification(record);

  // 2. Persist to Firestore
  try {
    const verifRef = collection(db, 'transferVerifications');
    await addDoc(verifRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore transfer verification write warning:', err);
  }

  // 3. Update the listing status in Firestore
  try {
    if (!params.listingId.startsWith('sample-')) {
      const listingRef = doc(db, 'listings', params.listingId);
      if (params.stage === 'pickup') {
        await updateDoc(listingRef, {
          status: 'in_transit',
          pickupVerified: true,
          pickupVerifiedAt: timestamp,
          pickupVerifiedBy: params.verifiedByName,
          pickupTemperature: params.temperatureCelsius || null,
          transferProofHash: proofDigest,
        });
      } else {
        await updateDoc(listingRef, {
          status: 'completed',
          deliveryVerified: true,
          deliveryVerifiedAt: timestamp,
          deliveryVerifiedBy: params.verifiedByName,
          deliveryTemperature: params.temperatureCelsius || null,
          transferProofHash: proofDigest,
          completedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.warn('Listing status update warning:', err);
  }

  return record;
}
