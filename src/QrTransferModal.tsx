import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './LanguageContext';
import { FoodListing } from './DonorDashboard';
import {
  MealTransferPayload,
  TransferVerificationRecord,
  createTransferPayload,
  generateQrDataUrl,
  decodeQrFromCanvas,
  parseTransferQr,
  executeTransferVerification,
  getLocalVerifications,
} from './qrTransferService';

export interface QrTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing?: FoodListing;
  defaultMode?: 'show' | 'scan';
  defaultStage?: 'pickup' | 'delivery';
  onTransferVerified?: (record: TransferVerificationRecord) => void;
}

const DEFAULT_FALLBACK_LISTING: FoodListing = {
  id: 'quick-transfer-session',
  title: 'Direct Meal Transfer Handoff',
  foodType: 'Prepared Surplus Food',
  category: 'Prepared Meals',
  quantity: 25,
  unit: 'portions',
  isVeg: true,
  pickupWindow: 'Immediate Dispatch',
  expiryTime: 'Within 2 hours',
  location: 'Point of Handover',
  donorId: 'donor_session',
  donorName: 'Executive Chef',
  donorOrg: 'Food Donor Commercial Kitchen',
  donorEmail: 'kitchen@foodlink.org',
  status: 'claimed',
  safetyChecklist: {
    tempSafety: true,
    freshlyPrepared: true,
    cleanPackaging: true,
    hygieneAllergen: true,
  },
};

export const QrTransferModal: React.FC<QrTransferModalProps> = ({
  isOpen,
  onClose,
  listing,
  defaultMode = 'show',
  defaultStage = 'pickup',
  onTransferVerified,
}) => {
  const { userProfile, currentUser } = useAuth();
  const { t } = useTranslation();
  const activeListing = listing || DEFAULT_FALLBACK_LISTING;

  // Modal Tabs: 'show' (Display QR) | 'scan' (Camera/Upload scanner) | 'history' (Audit logs)
  const [activeTab, setActiveTab] = useState<'show' | 'scan' | 'history'>(defaultMode);
  const [stage, setStage] = useState<'pickup' | 'delivery'>(defaultStage);

  // Show QR states
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [currentPayload, setCurrentPayload] = useState<MealTransferPayload | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(true);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Camera Scanner states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<any>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Scanned verification staging state
  const [scannedPayload, setScannedPayload] = useState<MealTransferPayload | null>(null);
  const [scanVerificationError, setScanVerificationError] = useState<string | null>(null);
  const [handoverTempInput, setHandoverTempInput] = useState<string>('68.5');
  const [transferNotesInput, setTransferNotesInput] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  // Success Confirmation Certificate
  const [verifiedRecord, setVerifiedRecord] = useState<TransferVerificationRecord | null>(null);

  // Audit History state
  const [auditRecords, setAuditRecords] = useState<TransferVerificationRecord[]>([]);

  // Sound effect on scan
  const playScanBeep = () => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // AudioContext not allowed or not supported
    }
  };

  // Generate QR Code when listing or stage changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setQrLoading(true);

    const buildQr = async () => {
      const recipientOrg =
        (activeListing as any).claimingOrgName ||
        (userProfile?.role === 'ngo' ? userProfile.orgName : undefined) ||
        'Verified Community Shelter';

      const payload = await createTransferPayload({
        listingId: activeListing.id,
        batchTitle: activeListing.title,
        stage,
        donorId: activeListing.donorId,
        donorOrg: activeListing.donorOrg || activeListing.donorName || 'Donor Commercial Kitchen',
        recipientId: (activeListing as any).claimingOrgId || (userProfile?.role === 'ngo' ? currentUser?.uid : undefined),
        recipientOrg,
        quantity: activeListing.quantity,
        unit: activeListing.unit || 'portions',
        handoffCode: (activeListing as any).handoffCode || '7492',
        foodType: activeListing.foodType || (activeListing as any).category || 'Prepared Surplus',
      });

      if (!isMounted) return;
      setCurrentPayload(payload);

      const url = await generateQrDataUrl(payload, {
        width: 380,
        darkColor: stage === 'pickup' ? '#065F46' : '#1E40AF', // Emerald for pickup, Royal Blue for delivery
      });

      if (isMounted) {
        setQrDataUrl(url);
        setQrLoading(false);
      }
    };

    buildQr();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeListing, stage, userProfile, currentUser]);

  // Load audit history
  useEffect(() => {
    if (!isOpen) return;
    const all = getLocalVerifications();
    const relevant = all.filter((r) => r.listingId === activeListing.id);
    setAuditRecords(relevant);
  }, [isOpen, activeListing.id, verifiedRecord]);

  // Start live webcam scanning when 'scan' tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'scan' || scannedPayload || verifiedRecord) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, scannedPayload, verifiedRecord, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Webcam access is not supported on this device/browser. Use the photo upload or test simulation below.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        // Start scanning frames
        startScanLoop();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. You can still scan by uploading an image or using the test scan button.'
          : 'Unable to start camera feed. Please check device permissions.'
      );
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startScanLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const qrResult = decodeQrFromCanvas(canvas);
      if (qrResult) {
        handleRawQrScanned(qrResult);
      }
    }, 200); // scan 5 times per second
  };

  const handleRawQrScanned = (rawText: string) => {
    const parsed = parseTransferQr(rawText);
    if (parsed.valid && parsed.payload) {
      playScanBeep();
      stopCamera();
      setScannedPayload(parsed.payload);
      setScanVerificationError(null);
    } else {
      setScanVerificationError(parsed.error || 'Scanned QR code could not be verified.');
    }
  };

  // Image file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanVerificationError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const qrText = decodeQrFromCanvas(canvas);
          if (qrText) {
            handleRawQrScanned(qrText);
          } else {
            setScanVerificationError('No QR Code detected in uploaded image. Please upload a clear photo.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 1-Click Test Simulation
  const handleSimulateScan = async (targetStage: 'pickup' | 'delivery') => {
    playScanBeep();
    stopCamera();

    const mockPayload: MealTransferPayload = currentPayload || {
      version: '1.0',
      listingId: activeListing.id,
      batchTitle: activeListing.title,
      stage: targetStage,
      donorId: activeListing.donorId,
      donorOrg: activeListing.donorOrg || 'Grand Bistro Banquet Kitchen',
      recipientId: currentUser?.uid || 'shelter-recipient-01',
      recipientOrg: (userProfile?.orgName) || 'Hope Community Shelter',
      quantity: activeListing.quantity,
      unit: activeListing.unit || 'portions',
      handoffCode: (activeListing as any).handoffCode || '7492',
      securityToken: 'sec_sim_' + Math.random().toString(36).substring(2, 10),
      foodType: activeListing.foodType || 'Prepared Surplus Hot Meals',
      generatedAt: Date.now() - 5000,
      expiresAt: Date.now() + 7200000,
    };

    setScannedPayload({
      ...mockPayload,
      stage: targetStage,
    });
    setScanVerificationError(null);
  };

  // Confirm and Sign-Off Transfer
  const handleConfirmTransfer = async () => {
    if (!scannedPayload) return;

    setIsSubmittingTransfer(true);
    try {
      const userRole = (userProfile?.role as any) || 'recipient';
      const userName = userProfile?.displayName || userProfile?.orgName || (userRole === 'donor' ? 'Donor Lead' : 'Shelter Receiver');

      const tempVal = handoverTempInput ? parseFloat(handoverTempInput) : undefined;

      const record = await executeTransferVerification({
        listingId: scannedPayload.listingId,
        batchTitle: scannedPayload.batchTitle,
        stage: scannedPayload.stage,
        verifiedByRole: userRole,
        verifiedById: currentUser?.uid || 'user-contactless-verifier',
        verifiedByName: userName,
        partnerOrg: scannedPayload.stage === 'pickup' ? scannedPayload.donorOrg : (scannedPayload.recipientOrg || 'Shelter'),
        handoffCode: scannedPayload.handoffCode,
        temperatureCelsius: tempVal,
        notes: transferNotesInput.trim() || `Verified contactless ${scannedPayload.stage} handoff with OTP #${scannedPayload.handoffCode}`,
      });

      setVerifiedRecord(record);
      setScannedPayload(null);
      if (onTransferVerified) {
        onTransferVerified(record);
      }
    } catch (err: any) {
      console.error('Error confirming transfer:', err);
      setScanVerificationError(err?.message || 'Failed to complete verification. Please try again.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Download QR Code image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `foodlink-transfer-qr-${activeListing.id}-${stage}.png`;
    link.click();
  };

  // Copy Security Token
  const handleCopyToken = () => {
    if (!currentPayload) return;
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1E17]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#15231B] w-full max-w-2xl rounded-2xl border border-[#D9E2DA] dark:border-[#22382B] shadow-2xl relative my-auto max-h-[92vh] flex flex-col overflow-hidden animate-slideUp">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-[#D9E2DA] dark:border-[#22382B] flex items-center justify-between bg-[#FAFBF8] dark:bg-[#1A2E22]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3EC] dark:bg-[#1E3A2B] text-[#059669] dark:text-[#34D399] flex items-center justify-center border border-[#059669]/20">
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1E2A22] dark:text-[#F4F8F5] leading-snug">
                {t('qrModal.title', 'Contactless Meal Transfer Pass')}
              </h2>
              <p className="text-xs text-[#526357] dark:text-[#9BB0A1]">
                {t('qrModal.subtitle', 'Point of Pickup & Delivery Verification')} • {activeListing.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] text-[#526357] hover:text-[#1E2A22] dark:hover:text-white flex items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-[#15231B] transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="px-5 pt-3 border-b border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#15231B] flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('show');
              setScannedPayload(null);
              setVerifiedRecord(null);
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'show'
                ? 'border-[#059669] text-[#059669] dark:text-[#34D399]'
                : 'border-transparent text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">qr_code</span>
            <span>{t('qrModal.tabShow', 'Show Transfer QR Pass')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              setVerifiedRecord(null);
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'border-[#059669] text-[#059669] dark:text-[#34D399]'
                : 'border-transparent text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            <span>{t('qrModal.tabScan', 'Scan QR Code')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setScannedPayload(null);
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#059669] text-[#059669] dark:text-[#34D399]'
                : 'border-transparent text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>{t('qrModal.tabHistory', 'Audit Logs')} ({auditRecords.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: SHOW TRANSFER QR PASS */}
          {activeTab === 'show' && (
            <div className="space-y-4">
              {/* STAGE SELECTOR PILLS */}
              <div className="p-1 rounded-xl bg-[#FAFBF8] dark:bg-[#1A2E22] border border-[#D9E2DA] dark:border-[#22382B] grid grid-cols-2 gap-1 text-center">
                <button
                  type="button"
                  onClick={() => setStage('pickup')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    stage === 'pickup'
                      ? 'bg-[#059669] text-white shadow-xs'
                      : 'text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                  <span>{t('qrModal.stagePickup', '1. Point of Pickup (Kitchen Dispatch)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStage('delivery')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    stage === 'delivery'
                      ? 'bg-[#1D4ED8] text-white shadow-xs'
                      : 'text-[#526357] dark:text-[#9BB0A1] hover:text-[#1E2A22]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">home_work</span>
                  <span>{t('qrModal.stageDelivery', '2. Point of Delivery (Shelter Handover)')}</span>
                </button>
              </div>

              {/* DIGITAL PASS CARD */}
              <div className="rounded-2xl border-2 border-dashed border-[#D9E2DA] dark:border-[#22382B] p-5 bg-[#FAFBF8] dark:bg-[#1A2E22]/60 flex flex-col items-center text-center relative overflow-hidden">
                {/* Stage Badge */}
                <div className="mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      stage === 'pickup'
                        ? 'bg-[#EAF3EC] text-[#059669] border border-[#059669]/30'
                        : 'bg-blue-50 text-blue-700 border border-blue-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span>{stage === 'pickup' ? t('qrModal.stagePickup', 'Point of Pickup Pass') : t('qrModal.stageDelivery', 'Point of Delivery Pass')}</span>
                  </span>
                </div>

                {/* QR Code Canvas / Image Display */}
                <div className="w-56 h-56 sm:w-64 sm:h-64 p-3 bg-white rounded-2xl shadow-md border border-[#D9E2DA] flex items-center justify-center relative group">
                  {qrLoading ? (
                    <div className="flex flex-col items-center gap-2 text-[#526357]">
                      <span className="material-symbols-outlined animate-spin text-[32px] text-[#059669]">
                        progress_activity
                      </span>
                      <span className="text-xs font-medium">Generating encrypted pass...</span>
                    </div>
                  ) : (
                    <>
                      <img
                        src={qrDataUrl}
                        alt="Contactless Transfer QR Code"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      {/* FoodLink Watermark Badge in Center */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-lg bg-white/95 border border-[#059669]/40 shadow-xs flex items-center justify-center text-[#059669]">
                          <span className="material-symbols-outlined text-[20px]">soup_kitchen</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Fallback PIN Code */}
                <div className="mt-4 flex flex-col items-center">
                  <span className="text-[11px] text-[#526357] dark:text-[#9BB0A1] font-medium uppercase tracking-wider">
                    Fallback 4-Digit Security PIN
                  </span>
                  <div className="mt-1 px-4 py-1.5 rounded-lg bg-white dark:bg-[#15231B] border border-[#D9E2DA] dark:border-[#22382B] text-xl font-mono font-black text-[#1E2A22] dark:text-[#F4F8F5] tracking-widest shadow-2xs">
                    #{(activeListing as any).handoffCode || '7492'}
                  </div>
                </div>

                {/* Batch Information Grid */}
                <div className="mt-4 w-full grid grid-cols-2 gap-2 p-3 bg-white dark:bg-[#15231B] rounded-xl border border-[#D9E2DA] dark:border-[#22382B] text-left text-xs">
                  <div>
                    <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                      Donor Kitchen
                    </span>
                    <span className="font-bold text-[#1E2A22] dark:text-[#F4F8F5] truncate block">
                      {activeListing.donorOrg || activeListing.donorName || 'Commercial Kitchen'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                      Quantity Verified
                    </span>
                    <span className="font-bold text-[#059669] block">
                      {activeListing.quantity} {activeListing.unit || 'portions'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                      Pickup Window
                    </span>
                    <span className="font-medium text-[#1E2A22] dark:text-[#F4F8F5] truncate block">
                      {activeListing.pickupWindow}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                      Pass Expiration
                    </span>
                    <span className="font-medium text-[#D9822B] block">
                      Valid for 2 hours
                    </span>
                  </div>
                </div>

                {/* Instruction banner */}
                <p className="mt-3 text-xs text-[#526357] dark:text-[#9BB0A1] max-w-sm">
                  Present this QR code to the {stage === 'pickup' ? 'recipient / courier' : 'shelter coordinator'} to scan and record a certified contactless transfer.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#1A2E22] hover:bg-[#FAFBF8] text-xs font-semibold text-[#1E2A22] dark:text-[#F4F8F5] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#059669]">download</span>
                  <span>{t('qrModal.downloadQr', 'Save QR Image')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#1A2E22] hover:bg-[#FAFBF8] text-xs font-semibold text-[#1E2A22] dark:text-[#F4F8F5] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#059669]">content_copy</span>
                  <span>{copiedToken ? t('qrModal.copied', 'Copied to Clipboard!') : t('qrModal.copyToken', 'Copy Payload Token')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('scan')}
                  className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ml-auto"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  <span>Switch to Scanner</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SCAN QR CODE */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              {/* SCANNED CONFIRMATION SCREEN (When QR is recognized) */}
              {scannedPayload ? (
                <div className="p-5 rounded-2xl bg-[#EAF3EC] dark:bg-[#1E3A2B]/80 border-2 border-[#059669] space-y-4 animate-scaleUp">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-[#059669] text-white flex items-center justify-center font-bold text-sm">
                        ✓
                      </span>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
                          QR Pass Authenticated
                        </span>
                        <h3 className="font-serif text-base sm:text-lg font-bold text-[#1E2A22] dark:text-[#F4F8F5]">
                          Verify {scannedPayload.stage === 'pickup' ? 'Pickup Dispatch' : 'Shelter Delivery Arrival'}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScannedPayload(null)}
                      className="text-xs text-[#526357] hover:underline cursor-pointer"
                    >
                      Rescan
                    </button>
                  </div>

                  {/* Scanned Details Grid */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-white dark:bg-[#15231B] rounded-xl border border-[#D9E2DA] dark:border-[#22382B] text-xs">
                    <div>
                      <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                        Meal Batch
                      </span>
                      <span className="font-bold text-[#1E2A22] dark:text-[#F4F8F5] truncate block">
                        {scannedPayload.batchTitle}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                        Quantity
                      </span>
                      <span className="font-bold text-[#059669] block">
                        {scannedPayload.quantity} {scannedPayload.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                        Donor Kitchen
                      </span>
                      <span className="font-medium text-[#1E2A22] dark:text-[#F4F8F5] truncate block">
                        {scannedPayload.donorOrg}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#526357] dark:text-[#9BB0A1] uppercase font-bold block">
                        Security PIN
                      </span>
                      <span className="font-mono font-bold text-[#1E2A22] dark:text-[#F4F8F5] block">
                        #{scannedPayload.handoffCode}
                      </span>
                    </div>
                  </div>

                  {/* Temperature Input field for food safety compliance */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E2A22] dark:text-[#F4F8F5] mb-1">
                      Handover Holding Temperature (°C)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#059669]">
                          device_thermostat
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={handoverTempInput}
                          onChange={(e) => setHandoverTempInput(e.target.value)}
                          placeholder="e.g. 68.5"
                          className="w-full h-10 pl-10 pr-3 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] text-sm font-semibold focus:outline-none focus:border-[#059669]"
                        />
                      </div>
                      <span className="text-xs text-[#526357] dark:text-[#9BB0A1] font-medium shrink-0">
                        {parseFloat(handoverTempInput) >= 60
                          ? '🔥 Safe Hot Holding'
                          : parseFloat(handoverTempInput) <= 5
                          ? '❄️ Safe Chilled'
                          : '⚠️ Ambient (Verify FSSAI)'}
                      </span>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-xs font-bold text-[#1E2A22] dark:text-[#F4F8F5] mb-1">
                      Handoff Notes / Inspection Observations (Optional)
                    </label>
                    <input
                      type="text"
                      value={transferNotesInput}
                      onChange={(e) => setTransferNotesInput(e.target.value)}
                      placeholder="e.g. Containers clean and intact; handed over safely"
                      className="w-full h-10 px-3 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] text-xs focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  {/* Confirmation Action Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setScannedPayload(null)}
                      className="px-4 py-2.5 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] text-xs font-semibold text-[#526357] hover:text-[#1E2A22] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingTransfer}
                      onClick={handleConfirmTransfer}
                      className="px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSubmittingTransfer ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                          <span>Recording Verification...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          <span>Confirm Contactless Transfer &amp; Sign Off</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : verifiedRecord ? (
                /* VERIFICATION SUCCESS RECEIPT CARD */
                <div className="p-6 rounded-2xl bg-white dark:bg-[#15231B] border-2 border-[#059669] text-center space-y-4 shadow-lg animate-scaleUp">
                  <div className="w-14 h-14 rounded-full bg-[#EAF3EC] text-[#059669] mx-auto flex items-center justify-center text-2xl font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
                      Certified Contactless Transfer
                    </span>
                    <h3 className="font-serif text-xl font-bold text-[#1E2A22] dark:text-[#F4F8F5] mt-0.5">
                      {verifiedRecord.stage === 'pickup' ? 'Meal Pickup Completed' : 'Shelter Delivery Completed'}
                    </h3>
                    <p className="text-xs text-[#526357] dark:text-[#9BB0A1] mt-1">
                      Batch verified and locked into tamper-evident rescue audit ledger.
                    </p>
                  </div>

                  <div className="p-4 bg-[#FAFBF8] dark:bg-[#1A2E22] rounded-xl border border-[#D9E2DA] dark:border-[#22382B] text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#526357] dark:text-[#9BB0A1]">Verification Digest:</span>
                      <span className="font-mono font-bold text-[#059669]">{verifiedRecord.proofDigest}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526357] dark:text-[#9BB0A1]">Verified At:</span>
                      <span className="font-medium text-[#1E2A22] dark:text-[#F4F8F5]">
                        {new Date(verifiedRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(verifiedRecord.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526357] dark:text-[#9BB0A1]">Verified By:</span>
                      <span className="font-medium text-[#1E2A22] dark:text-[#F4F8F5]">{verifiedRecord.verifiedByName} ({verifiedRecord.verifiedByRole})</span>
                    </div>
                    {verifiedRecord.temperatureCelsius !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[#526357] dark:text-[#9BB0A1]">Handover Temperature:</span>
                        <span className="font-bold text-[#059669]">{verifiedRecord.temperatureCelsius}°C</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="px-4 py-2.5 rounded-lg border border-[#D9E2DA] text-xs font-semibold text-[#1E2A22] dark:text-[#F4F8F5] hover:bg-[#FAFBF8] cursor-pointer"
                    >
                      View Audit Trail
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* LIVE CAMERA VIEWPORT */
                <div className="space-y-4">
                  <div className="relative w-full h-64 sm:h-80 bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                    {/* Live Video Feed */}
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />

                    {/* Hidden canvas for jsQR analysis */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Viewfinder Reticle Overlay */}
                    {cameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-white/60 rounded-2xl relative flex items-center justify-center">
                          {/* Corner brackets */}
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#34D399] rounded-tl" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#34D399] rounded-tr" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#34D399] rounded-bl" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#34D399] rounded-br" />

                          {/* Animated laser scan line */}
                          <div className="w-full h-0.5 bg-[#34D399] shadow-[0_0_12px_#34D399] animate-pulse" />
                        </div>
                      </div>
                    )}

                    {/* Camera Offline / Starting Banner */}
                    {!cameraActive && !cameraError && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4 text-center">
                        <span className="material-symbols-outlined text-[32px] text-[#34D399] animate-spin mb-2">
                          progress_activity
                        </span>
                        <p className="text-xs font-semibold">Starting camera scanner...</p>
                        <p className="text-[11px] text-white/60 mt-1">Please allow camera permissions if prompted</p>
                      </div>
                    )}

                    {/* Camera Error Message */}
                    {cameraError && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white p-6 text-center">
                        <span className="material-symbols-outlined text-[32px] text-amber-400 mb-2">
                          videocam_off
                        </span>
                        <p className="text-xs font-bold text-amber-300 mb-1">Camera Stream Inactive</p>
                        <p className="text-[11px] text-white/70 max-w-sm mb-3">{cameraError}</p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold cursor-pointer"
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}

                    {/* Camera Control Overlays (Flip Camera) */}
                    {cameraActive && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                          className="px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold flex items-center gap-1 backdrop-blur-xs cursor-pointer border border-white/20"
                          title="Switch camera"
                        >
                          <span className="material-symbols-outlined text-[15px]">flip_camera_ios</span>
                          <span>Flip</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scan error notice if invalid QR */}
                  {scanVerificationError && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">warning</span>
                      <span>{scanVerificationError}</span>
                    </div>
                  )}

                  {/* ALTERNATIVE SCAN METHODS: Photo Upload & Quick Test Simulation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* File Upload Option */}
                    <div className="p-3 rounded-xl border border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="material-symbols-outlined text-[18px] text-[#059669]">upload_file</span>
                        <span className="text-xs font-bold text-[#1E2A22] dark:text-[#F4F8F5]">Scan from Photo / File</span>
                      </div>
                      <p className="text-[11px] text-[#526357] dark:text-[#9BB0A1] mb-2.5">
                        Upload a photo of the QR code from gallery or screenshot.
                      </p>
                      <label className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white dark:bg-[#15231B] border border-[#D9E2DA] dark:border-[#22382B] text-xs font-semibold text-[#1E2A22] dark:text-[#F4F8F5] hover:bg-[#EAF3EC] transition-colors cursor-pointer text-center">
                        <span>Select QR Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {/* Instant 1-Click Interactive Simulator */}
                    <div className="p-3 rounded-xl border border-[#059669]/30 bg-[#EAF3EC]/40 dark:bg-[#1E3A2B]/40 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="material-symbols-outlined text-[18px] text-[#059669]">bolt</span>
                        <span className="text-xs font-bold text-[#059669] dark:text-[#34D399]">1-Click Test Simulation</span>
                      </div>
                      <p className="text-[11px] text-[#526357] dark:text-[#9BB0A1] mb-2.5">
                        Verify instant handoff without requiring a physical second device.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSimulateScan('pickup')}
                          className="flex-1 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-bold transition-colors cursor-pointer text-center"
                        >
                          Simulate Pickup
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateScan('delivery')}
                          className="flex-1 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[11px] font-bold transition-colors cursor-pointer text-center"
                        >
                          Simulate Delivery
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {auditRecords.length === 0 ? (
                <div className="py-12 text-center text-[#526357] dark:text-[#9BB0A1] bg-[#FAFBF8] dark:bg-[#1A2E22] rounded-xl border border-[#D9E2DA] dark:border-[#22382B]">
                  <span className="material-symbols-outlined text-[36px] text-[#059669] mb-2">
                    verified_user
                  </span>
                  <p className="text-sm font-bold text-[#1E2A22] dark:text-[#F4F8F5]">
                    No verified transfers recorded yet for this batch
                  </p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">
                    Once a donor or recipient scans the transfer QR pass, tamper-evident proof digests will be logged here.
                  </p>
                </div>
              ) : (
                auditRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#15231B] shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            rec.stage === 'pickup' ? 'bg-[#059669]' : 'bg-[#1D4ED8]'
                          }`}
                        />
                        <span className="text-xs font-bold uppercase text-[#1E2A22] dark:text-[#F4F8F5]">
                          {rec.stage === 'pickup' ? 'Pickup Dispatch Handoff' : 'Shelter Delivery Arrival'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#059669]">
                        {rec.proofDigest}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#526357] dark:text-[#9BB0A1] pt-1">
                      <div>
                        <span>Verified by: </span>
                        <strong className="text-[#1E2A22] dark:text-[#F4F8F5]">{rec.verifiedByName} ({rec.verifiedByRole})</strong>
                      </div>
                      <div>
                        <span>Partner: </span>
                        <strong className="text-[#1E2A22] dark:text-[#F4F8F5]">{rec.partnerOrg || 'Authorized Party'}</strong>
                      </div>
                      <div>
                        <span>Time: </span>
                        <span>{new Date(rec.timestamp).toLocaleString()}</span>
                      </div>
                      <div>
                        <span>Holding Temp: </span>
                        <span className="font-bold text-[#059669]">{rec.temperatureCelsius ? `${rec.temperatureCelsius}°C` : 'Verified Safe'}</span>
                      </div>
                    </div>

                    {rec.notes && (
                      <p className="text-[11px] text-[#526357] dark:text-[#9BB0A1] pt-1 border-t border-[#D9E2DA]/50">
                        {rec.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-[#D9E2DA] dark:border-[#22382B] bg-[#FAFBF8] dark:bg-[#1A2E22] flex items-center justify-between text-xs text-[#526357] dark:text-[#9BB0A1]">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-[#059669]">security</span>
            <span>FoodLink Secure Contactless Verification Standard</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#D9E2DA] dark:border-[#22382B] bg-white dark:bg-[#15231B] text-[#1E2A22] dark:text-[#F4F8F5] font-semibold hover:bg-[#FAFBF8] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
