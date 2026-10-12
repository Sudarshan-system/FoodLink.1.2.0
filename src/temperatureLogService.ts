import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type TemperatureStage =
  | 'cooking_dispatch'
  | 'courier_pickup'
  | 'in_transit'
  | 'shelter_delivery';

export type StorageConditionType =
  | 'Hot and covered'
  | 'Refrigerated'
  | 'Room temperature sealed';

export type TemperatureSafetyStatus = 'safe' | 'warning' | 'danger';

export interface TemperatureLogEntry {
  id: string;
  listingId: string;
  batchTitle: string;
  temperatureCelsius: number;
  stage: TemperatureStage;
  stageLabel: string;
  storageCondition: StorageConditionType;
  status: TemperatureSafetyStatus;
  loggedByRole: 'donor' | 'courier' | 'inspector' | 'shelter';
  loggedByName: string;
  loggedByUserId: string;
  loggedAt: string; // Formatted date string
  loggedAtMillis: number;
  probeMethod: 'Calibrated Probe Thermometer' | 'Infrared Non-Contact Gun' | 'Insulated Container Sensor' | 'Digital Immersion Probe';
  notes?: string;
  ambientTempCelsius?: number;
}

export interface TemperatureSafetyVerdict {
  status: TemperatureSafetyStatus;
  badgeLabel: string;
  headline: string;
  description: string;
  badgeColorClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
  icon: string;
  isCompliant: boolean;
}

/**
 * FSSAI & HACCP Food Safety Guidelines:
 * - Hot food: Must be kept at or above 60°C (safe hot holding zone). Under 55°C is danger zone.
 * - Chilled food: Must be kept at or below 5°C (refrigerated cold chain). Above 8°C is danger zone.
 * - Ambient / dry food: Normal room temperature 15°C - 25°C. Over 35°C is heat-compromised.
 */
export function evaluateTemperatureSafety(
  tempCelsius: number,
  storageCondition: StorageConditionType = 'Hot and covered'
): TemperatureSafetyVerdict {
  if (storageCondition === 'Hot and covered') {
    if (tempCelsius >= 60) {
      return {
        status: 'safe',
        badgeLabel: `${tempCelsius}°C · Safe Hot`,
        headline: 'Safe Hot-Holding Zone',
        description: 'Exceeds FSSAI minimum holding threshold (≥ 60°C). Bacterial multiplication inhibited.',
        badgeColorClass: 'text-emerald-700 dark:text-emerald-300',
        badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeBorderClass: 'border-emerald-500/30',
        icon: 'local_fire_department',
        isCompliant: true,
      };
    } else if (tempCelsius >= 55) {
      return {
        status: 'warning',
        badgeLabel: `${tempCelsius}°C · Warning (Marginal)`,
        headline: 'Approaching Danger Zone',
        description: 'Between 55°C and 59.9°C. Food must be reheated immediately or consumed without delay.',
        badgeColorClass: 'text-amber-700 dark:text-amber-300',
        badgeBgClass: 'bg-amber-50 dark:bg-amber-950/40',
        badgeBorderClass: 'border-amber-500/30',
        icon: 'warning',
        isCompliant: true,
      };
    } else {
      return {
        status: 'danger',
        badgeLabel: `${tempCelsius}°C · Danger Zone!`,
        headline: 'Critical Temperature Danger Zone',
        description: 'Below 55°C. Hot food held in the bacterial incubation range (5°C - 60°C). Immediate inspection required.',
        badgeColorClass: 'text-red-700 dark:text-red-300',
        badgeBgClass: 'bg-red-50 dark:bg-red-950/40',
        badgeBorderClass: 'border-red-500/30',
        icon: 'error',
        isCompliant: false,
      };
    }
  }

  if (storageCondition === 'Refrigerated') {
    if (tempCelsius <= 5) {
      return {
        status: 'safe',
        badgeLabel: `${tempCelsius}°C · Safe Chilled`,
        headline: 'Safe Cold-Holding Zone',
        description: 'Maintained within safe refrigeration range (≤ 5°C). Cold-chain intact.',
        badgeColorClass: 'text-blue-700 dark:text-blue-300',
        badgeBgClass: 'bg-blue-50 dark:bg-blue-950/40',
        badgeBorderClass: 'border-blue-500/30',
        icon: 'ac_unit',
        isCompliant: true,
      };
    } else if (tempCelsius <= 8) {
      return {
        status: 'warning',
        badgeLabel: `${tempCelsius}°C · Chilled Warning`,
        headline: 'Marginal Cold-Chain Warning',
        description: 'Slightly above 5°C. Recommend prompt consumption or ice-pack refrigeration.',
        badgeColorClass: 'text-amber-700 dark:text-amber-300',
        badgeBgClass: 'bg-amber-50 dark:bg-amber-950/40',
        badgeBorderClass: 'border-amber-500/30',
        icon: 'warning',
        isCompliant: true,
      };
    } else {
      return {
        status: 'danger',
        badgeLabel: `${tempCelsius}°C · Danger Zone!`,
        headline: 'Cold Chain Broken',
        description: 'Exceeds 8°C. Perishable cold food entered the bacterial growth zone.',
        badgeColorClass: 'text-red-700 dark:text-red-300',
        badgeBgClass: 'bg-red-50 dark:bg-red-950/40',
        badgeBorderClass: 'border-red-500/30',
        icon: 'error',
        isCompliant: false,
      };
    }
  }

  // Room temperature sealed
  if (tempCelsius <= 26) {
    return {
      status: 'safe',
      badgeLabel: `${tempCelsius}°C · Ambient Safe`,
      headline: 'Ambient Dry Safe',
      description: 'Controlled room temperature within recommended bakery & dry storage limits.',
      badgeColorClass: 'text-teal-700 dark:text-teal-300',
      badgeBgClass: 'bg-teal-50 dark:bg-teal-950/40',
      badgeBorderClass: 'border-teal-500/30',
      icon: 'thermostat',
      isCompliant: true,
    };
  } else if (tempCelsius <= 34) {
    return {
      status: 'warning',
      badgeLabel: `${tempCelsius}°C · Warm Ambient`,
      headline: 'Warm Room Storage',
      description: 'Slightly elevated room temperature. Ensure dry packaging remains sealed.',
      badgeColorClass: 'text-amber-700 dark:text-amber-300',
      badgeBgClass: 'bg-amber-50 dark:bg-amber-950/40',
      badgeBorderClass: 'border-amber-500/30',
      icon: 'warning',
      isCompliant: true,
    };
  } else {
    return {
      status: 'danger',
      badgeLabel: `${tempCelsius}°C · Excessive Heat`,
      headline: 'Excessive Heat Warning',
      description: 'Over 34°C ambient exposure may cause rapid moisture condensation and spoilage.',
      badgeColorClass: 'text-red-700 dark:text-red-300',
      badgeBgClass: 'bg-red-50 dark:bg-red-950/40',
      badgeBorderClass: 'border-red-500/30',
      icon: 'error',
      isCompliant: false,
    };
  }
}

export function getStageTitle(stage: TemperatureStage): string {
  switch (stage) {
    case 'cooking_dispatch':
      return 'Kitchen Packaging / Dispatch';
    case 'courier_pickup':
      return 'Courier Pickup Verification';
    case 'in_transit':
      return 'In-Transit Thermal Check';
    case 'shelter_delivery':
      return 'Shelter Handover Inspection';
    default:
      return 'Temperature Check';
  }
}

/**
 * Log a temperature entry to Firestore for a specific food listing
 */
export async function logBatchTemperature(
  listingId: string,
  data: {
    batchTitle: string;
    temperatureCelsius: number;
    stage: TemperatureStage;
    storageCondition: StorageConditionType;
    loggedByRole: 'donor' | 'courier' | 'inspector' | 'shelter';
    loggedByName: string;
    loggedByUserId: string;
    probeMethod?: TemperatureLogEntry['probeMethod'];
    notes?: string;
  }
): Promise<TemperatureLogEntry> {
  const verdict = evaluateTemperatureSafety(data.temperatureCelsius, data.storageCondition);
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const entry: TemperatureLogEntry = {
    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    listingId,
    batchTitle: data.batchTitle,
    temperatureCelsius: Number(data.temperatureCelsius.toFixed(1)),
    stage: data.stage,
    stageLabel: getStageTitle(data.stage),
    storageCondition: data.storageCondition,
    status: verdict.status,
    loggedByRole: data.loggedByRole,
    loggedByName: data.loggedByName,
    loggedByUserId: data.loggedByUserId,
    loggedAt: formattedDate,
    loggedAtMillis: Date.now(),
    probeMethod: data.probeMethod || 'Calibrated Probe Thermometer',
    notes: data.notes || '',
  };

  try {
    const listingRef = doc(db, 'listings', listingId);
    await updateDoc(listingRef, {
      currentTemperature: entry.temperatureCelsius,
      latestTemperatureLog: entry,
      temperatureLogs: arrayUnion(entry),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not update Firestore listing temperature, saving locally:', err);
    // Keep local backup for demo/offline resilience
    const localKey = `foodlink_temp_logs_${listingId}`;
    try {
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.unshift(entry);
      localStorage.setItem(localKey, JSON.stringify(existing));
    } catch (e) {
      console.error('Local storage backup error:', e);
    }
  }

  return entry;
}

/**
 * Pre-seeded sample temperature audit logs for demo items
 */
export const SAMPLE_BATCH_TEMPERATURES: Record<string, TemperatureLogEntry[]> = {
  ledger_sample_1: [
    {
      id: 'temp_log_1a',
      listingId: 'ledger_sample_1',
      batchTitle: 'Surplus Dal Makhani & Jeera Rice',
      temperatureCelsius: 74.5,
      stage: 'cooking_dispatch',
      stageLabel: 'Kitchen Packaging / Dispatch',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'donor',
      loggedByName: 'Chef Marcus Vance',
      loggedByUserId: 'donor_demo_1',
      loggedAt: '30 Sep 2026, 06:15 PM',
      loggedAtMillis: Date.now() - 2 * 3600000,
      probeMethod: 'Calibrated Probe Thermometer',
      notes: 'Packaged directly from steam kettle at 74.5°C into insulated stainless vessels.',
    },
    {
      id: 'temp_log_1b',
      listingId: 'ledger_sample_1',
      batchTitle: 'Surplus Dal Makhani & Jeera Rice',
      temperatureCelsius: 68.2,
      stage: 'courier_pickup',
      stageLabel: 'Courier Pickup Verification',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'courier',
      loggedByName: 'Rahul Verma',
      loggedByUserId: 'courier_demo_1',
      loggedAt: '30 Sep 2026, 07:05 PM',
      loggedAtMillis: Date.now() - 1.2 * 3600000,
      probeMethod: 'Infrared Non-Contact Gun',
      notes: 'Container surface verified at 68.2°C. Thermal seals confirmed tight.',
    },
  ],
  ledger_sample_2: [
    {
      id: 'temp_log_2a',
      listingId: 'ledger_sample_2',
      batchTitle: 'Chicken Dum Biryani (Wedding Surplus)',
      temperatureCelsius: 78.0,
      stage: 'cooking_dispatch',
      stageLabel: 'Kitchen Packaging / Dispatch',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'donor',
      loggedByName: 'Chef Marcus Vance',
      loggedByUserId: 'donor_demo_1',
      loggedAt: '30 Sep 2026, 04:30 PM',
      loggedAtMillis: Date.now() - 4 * 3600000,
      probeMethod: 'Calibrated Probe Thermometer',
      notes: 'Hot degchi transfer. Core internal temp 78°C.',
    },
    {
      id: 'temp_log_2b',
      listingId: 'ledger_sample_2',
      batchTitle: 'Chicken Dum Biryani (Wedding Surplus)',
      temperatureCelsius: 71.5,
      stage: 'courier_pickup',
      stageLabel: 'Courier Pickup Verification',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'courier',
      loggedByName: 'Rahul Verma',
      loggedByUserId: 'courier_demo_1',
      loggedAt: '30 Sep 2026, 05:25 PM',
      loggedAtMillis: Date.now() - 3.2 * 3600000,
      probeMethod: 'Infrared Non-Contact Gun',
      notes: 'Loaded into insulated courier thermal cargo crate.',
    },
    {
      id: 'temp_log_2c',
      listingId: 'ledger_sample_2',
      batchTitle: 'Chicken Dum Biryani (Wedding Surplus)',
      temperatureCelsius: 67.0,
      stage: 'in_transit',
      stageLabel: 'In-Transit Thermal Check',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'courier',
      loggedByName: 'Rahul Verma',
      loggedByUserId: 'courier_demo_1',
      loggedAt: '30 Sep 2026, 06:10 PM',
      loggedAtMillis: Date.now() - 2.5 * 3600000,
      probeMethod: 'Insulated Container Sensor',
      notes: 'Midway transit waypoint. Thermal holding steady above 65°C.',
    },
  ],
  ledger_sample_3: [
    {
      id: 'temp_log_3a',
      listingId: 'ledger_sample_3',
      batchTitle: 'Freshly Baked Multigrain Breads & Buns',
      temperatureCelsius: 22.4,
      stage: 'cooking_dispatch',
      stageLabel: 'Kitchen Packaging / Dispatch',
      storageCondition: 'Room temperature sealed',
      status: 'safe',
      loggedByRole: 'donor',
      loggedByName: 'Chef Marcus Vance',
      loggedByUserId: 'donor_demo_1',
      loggedAt: '29 Sep 2026, 05:00 PM',
      loggedAtMillis: Date.now() - 26 * 3600000,
      probeMethod: 'Infrared Non-Contact Gun',
      notes: 'Room temperature cooled and sealed in paper cartons.',
    },
    {
      id: 'temp_log_3b',
      listingId: 'ledger_sample_3',
      batchTitle: 'Freshly Baked Multigrain Breads & Buns',
      temperatureCelsius: 23.0,
      stage: 'courier_pickup',
      stageLabel: 'Courier Pickup Verification',
      storageCondition: 'Room temperature sealed',
      status: 'safe',
      loggedByRole: 'courier',
      loggedByName: 'Rahul Verma',
      loggedByUserId: 'courier_demo_1',
      loggedAt: '29 Sep 2026, 06:45 PM',
      loggedAtMillis: Date.now() - 24.5 * 3600000,
      probeMethod: 'Digital Immersion Probe',
      notes: 'Dry, moisture-free cargo check passed.',
    },
  ],
  ledger_sample_4: [
    {
      id: 'temp_log_4a',
      listingId: 'ledger_sample_4',
      batchTitle: 'Steam Idli, Medu Vada & Sambar',
      temperatureCelsius: 76.0,
      stage: 'cooking_dispatch',
      stageLabel: 'Kitchen Packaging / Dispatch',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'donor',
      loggedByName: 'Chef Marcus Vance',
      loggedByUserId: 'donor_demo_1',
      loggedAt: '28 Sep 2026, 08:30 AM',
      loggedAtMillis: Date.now() - 50 * 3600000,
      probeMethod: 'Calibrated Probe Thermometer',
      notes: 'Morning breakfast surplus sealed in hot casserole boxes.',
    },
    {
      id: 'temp_log_4b',
      listingId: 'ledger_sample_4',
      batchTitle: 'Steam Idli, Medu Vada & Sambar',
      temperatureCelsius: 69.4,
      stage: 'courier_pickup',
      stageLabel: 'Courier Pickup Verification',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'courier',
      loggedByName: 'Rahul Verma',
      loggedByUserId: 'courier_demo_1',
      loggedAt: '28 Sep 2026, 09:15 AM',
      loggedAtMillis: Date.now() - 49 * 3600000,
      probeMethod: 'Infrared Non-Contact Gun',
      notes: 'Sambar thermal vessel at 71°C, idlis at 68°C.',
    },
    {
      id: 'temp_log_4c',
      listingId: 'ledger_sample_4',
      batchTitle: 'Steam Idli, Medu Vada & Sambar',
      temperatureCelsius: 65.8,
      stage: 'shelter_delivery',
      stageLabel: 'Shelter Handover Inspection',
      storageCondition: 'Hot and covered',
      status: 'safe',
      loggedByRole: 'shelter',
      loggedByName: 'Sister Mary Teresa (Shelter Coord)',
      loggedByUserId: 'shelter_demo_1',
      loggedAt: '28 Sep 2026, 10:00 AM',
      loggedAtMillis: Date.now() - 48.5 * 3600000,
      probeMethod: 'Calibrated Probe Thermometer',
      notes: 'Delivered hot above 65°C. Immediate distribution to 40 children.',
    },
  ],
  ledger_sample_6: [
    {
      id: 'temp_log_6a',
      listingId: 'ledger_sample_6',
      batchTitle: 'Mixed Fruit Custard & Desserts',
      temperatureCelsius: 3.8,
      stage: 'cooking_dispatch',
      stageLabel: 'Kitchen Packaging / Dispatch',
      storageCondition: 'Refrigerated',
      status: 'safe',
      loggedByRole: 'donor',
      loggedByName: 'Chef Marcus Vance',
      loggedByUserId: 'donor_demo_1',
      loggedAt: '25 Sep 2026, 02:00 PM',
      loggedAtMillis: Date.now() - 120 * 3600000,
      probeMethod: 'Calibrated Probe Thermometer',
      notes: 'Chilled display walk-in cooler holding at 3.8°C.',
    },
  ],
};
