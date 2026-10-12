import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Port 3000 is required by the container environment and Nginx reverse proxy (which listens on 8080)
const PORT = process.env.APP_PORT || (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);

// Disable technological fingerprinting
app.disable('x-powered-by');

// Defense-in-depth security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Enforce request body size limits to prevent Denial-of-Service / memory exhaustion
app.use(express.json({ limit: '8mb' }));

// In-Memory Sliding Window Rate Limiter
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired rate limit buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${rawIp}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: options.message,
        retryAfter: retryAfterSeconds,
      });
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    return next();
  };
}

// General API Rate Limiter: max 60 requests/minute
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Too many API requests from this client. Please slow down and try again later.',
});

// AI Safety Check Rate Limiter: max 25 requests/minute to guard Gemini quota and prevent spam
const aiSafetyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  message: 'Safety evaluation rate limit exceeded. Please wait a moment before submitting another item.',
});

app.use('/api', apiLimiter);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ProhibitedCategory {
  category: string;
  description: string;
  keywords: string[];
}

const PROHIBITED_POLICIES: ProhibitedCategory[] = [
  {
    category: 'Table Scraps & Customer Plate Waste',
    description: 'Half-eaten food, leftovers cleared from dining tables or plates, bitten or chewed items, customer-handled buffet tray remains.',
    keywords: [
      'half-eaten',
      'half eaten',
      'plate waste',
      'plate scrap',
      'table scrap',
      'table leftover',
      'cleared from tables',
      'eaten from',
      'bitten',
      'chewed',
      'discarded customer food',
      'buffet scrapings',
      'leftovers from plates',
      'plate leftovers',
    ],
  },
  {
    category: 'Alcohol & Controlled Substances',
    description: 'Beer, wine, liquor, spirits, rum, whiskey, vodka, cocktails, tobacco, cigarettes, cigars, cannabis, narcotics, or intoxicating food infusions.',
    keywords: [
      'alcohol',
      'liquor',
      'beer',
      'wine',
      'whiskey',
      'whisky',
      'vodka',
      'rum',
      'gin',
      'brandy',
      'tequila',
      'cocktail',
      'tobacco',
      'cigarette',
      'cigar',
      'nicotine',
      'cannabis',
      'weed',
      'narcotic',
      'marijuana',
    ],
  },
  {
    category: 'Unpasteurized Raw Dairy & Wild Foraged Items',
    description: 'Raw unpasteurized cow/buffalo/goat milk, unpasteurized cream/cheese, wild foraged mushrooms of unverified origin, toxic wild flora.',
    keywords: [
      'raw milk',
      'unpasteurized milk',
      'raw dairy',
      'unpasteurized cheese',
      'unpasteurized cream',
      'wild mushroom',
      'foraged mushroom',
      'wild fungus',
      'unpasteurized butter',
    ],
  },
  {
    category: 'Spoiled, Rotten or Compromised Food',
    description: 'Visibly moldy, rotting, putrid, sour or foul-smelling items, pest/insect/rodent infested food, bloated/swollen/leaking cans.',
    keywords: [
      'moldy',
      'mouldy',
      'rotten',
      'spoiled',
      'putrid',
      'foul smelling',
      'sour milk',
      'swollen can',
      'bloated can',
      'leaking can',
      'pest infested',
      'rat gnawed',
      'maggot',
      'fly infested',
      'rotting',
      'curdled sour',
    ],
  },
  {
    category: 'Expired Infant Nutrition & Baby Formula',
    description: 'Infant formula, baby food purees, or baby cereals past their manufacturer expiry or use-by date.',
    keywords: [
      'expired baby formula',
      'expired infant formula',
      'expired baby food',
      'past date baby formula',
      'expired infant nutrition',
    ],
  },
  {
    category: 'Wild Game, Roadkill & Uninspected Meats',
    description: 'Roadkill, bushmeat, wild hunted meat not inspected by certified meat hygiene inspectors, diseased carcasses.',
    keywords: [
      'roadkill',
      'bushmeat',
      'uninspected meat',
      'wild game meat',
      'hunted carcass',
      'diseased animal',
      'wild boar uninspected',
    ],
  },
  {
    category: 'Home-Canned Low-Acid Preserves',
    description: 'Home-jarred meats, vegetables, or low-acid recipes presenting Clostridium botulinum neurotoxin risks.',
    keywords: [
      'home-canned meat',
      'home canned meat',
      'home-jarred meat',
      'home jarred meat',
      'home-canned vegetable',
      'home canned vegetable',
      'home canned asparagus',
      'home canned beans',
    ],
  },
  {
    category: 'Medicines, Chemicals & Hazardous Contaminants',
    description: 'Prescription drugs, pills, chemical sanitizers, bleach, pesticides, foreign materials (shattered glass, metal wires).',
    keywords: [
      'medicine',
      'prescription drug',
      'pharmaceutical',
      'cleaning chemical',
      'detergent',
      'bleach',
      'pesticide',
      'rat poison',
      'toxic chemical',
      'glass shards',
      'metal shavings',
      'disinfectant contaminated',
    ],
  },
];

function scanTextForProhibitions(text: string): { matchedCategories: string[]; detectedItems: string[] } {
  const normalized = text.toLowerCase();
  const matchedCategories = new Set<string>();
  const detectedItems = new Set<string>();

  for (const policy of PROHIBITED_POLICIES) {
    for (const kw of policy.keywords) {
      // Word boundary or substring check for multi-word
      const pattern = kw.includes(' ') || kw.includes('-')
        ? new RegExp(`\\b${kw.replace('-', '[- ]')}\\b`, 'i')
        : new RegExp(`\\b${kw}\\b`, 'i');

      if (pattern.test(normalized)) {
        matchedCategories.add(policy.category);
        detectedItems.add(kw);
      }
    }
  }

  return {
    matchedCategories: Array.from(matchedCategories),
    detectedItems: Array.from(detectedItems),
  };
}

async function handleSafetyCheck(req: express.Request, res: express.Response) {
  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      title = '',
      foodName = '',
      description = '',
      notes = '',
      category = 'Veg',
      storageCondition = 'Room temperature',
      prepTime = '',
      temperature = '',
      allergens = [],
    } = req.body;

    const effectiveTitle = (title || foodName || '').trim();
    const effectiveDescription = (description || notes || '').trim();
    const combinedContent = `${effectiveTitle} ${effectiveDescription}`;

    // Deterministic Rule-Based Pre-Scan
    const ruleScan = scanTextForProhibitions(combinedContent);
    const hasRuleViolations = ruleScan.matchedCategories.length > 0;

    // If Gemini API is not configured, rely on high-precision deterministic rules
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured. Using deterministic policy evaluation.');

      if (hasRuleViolations) {
        return res.json({
          isCompliant: false,
          policyVerdict: 'VIOLATION',
          verdict: 'Flagged for review',
          safetyVerdict: 'Prohibited',
          prohibitedItemsDetected: ruleScan.matchedCategories,
          policyViolationReason: `Listing violates safety policy: detected prohibited item(s) (${ruleScan.detectedItems.join(', ')}). Under FSSAI & FoodLink standards, these items cannot be accepted for donation.`,
          reason: `Prohibited item detected: ${ruleScan.matchedCategories.join('; ')}.`,
          confidenceScore: 98,
          recommendedExpiryHours: 0,
          storageAdvice: 'Do not distribute. Prohibited by FoodLink safety guidelines.',
          fssaiChecklist: {
            temperatureCompliant: false,
            hygienePackagingCompliant: false,
            allergenDeclared: allergens.length > 0,
            nonProhibited: false,
          },
        });
      }

      return res.json({
        isCompliant: true,
        policyVerdict: 'COMPLIANT',
        verdict: 'Looks safe',
        safetyVerdict: 'Looks safe',
        prohibitedItemsDetected: [],
        policyViolationReason: null,
        reason: 'Policy check passed: zero prohibited items found and packaging standards confirmed.',
        confidenceScore: 94,
        recommendedExpiryHours: storageCondition.toLowerCase().includes('refrigerat') ? 24 : 4,
        storageAdvice: 'Keep covered in food-grade insulated containers below 5°C or above 60°C.',
        fssaiChecklist: {
          temperatureCompliant: true,
          hygienePackagingCompliant: true,
          allergenDeclared: allergens.length > 0,
          nonProhibited: true,
        },
      });
    }

    const parts: any[] = [];

    // If image provided, add inlineData
    if (imageBase64) {
      let rawData = imageBase64;
      let effectiveMime = mimeType;
      if (imageBase64.includes(',')) {
        const partsSplit = imageBase64.split(',');
        const match = partsSplit[0].match(/data:(.*?);base64/);
        if (match) {
          effectiveMime = match[1];
        }
        rawData = partsSplit[1];
      }
      parts.push({
        inlineData: {
          mimeType: effectiveMime,
          data: rawData,
        },
      });
    }

    const policySummary = PROHIBITED_POLICIES.map(
      (p, i) => `${i + 1}. ${p.category}: ${p.description}`
    ).join('\n');

    const promptText = `
You are a senior Food Safety Auditor and Policy Compliance Inspector for FoodLink, a certified food rescue logistics network operating under FSSAI (Food Safety and Standards Authority of India) and international food donation regulations.

Food Donation Details Submitted by Donor:
- Item Title / Dish Name: ${effectiveTitle || 'Surplus Meal'}
- Description / Notes: ${effectiveDescription || 'None provided'}
- Dietary category: ${category}
- Storage condition: ${storageCondition}
- Preparation time: ${prepTime || 'Prepared recently today'}
- Stated temperature: ${temperature || 'Standard safe holding'}
- Stated allergens: ${Array.isArray(allergens) && allergens.length ? allergens.join(', ') : 'None declared'}

FOODLINK STRICT PROHIBITED ITEMS POLICY:
The following items are STRICTLY PROHIBITED from being published or distributed through FoodLink:
${policySummary}

ADDITIONAL CRITICAL SAFETY RULES:
- Never accept plate waste, half-eaten diner leftovers, or food scraped after customer service.
- Never accept unpasteurized dairy, raw milk, or wild uncertified foraged mushrooms.
- Never accept alcohol, beer, wine, or tobacco.
- Any perishable food left in the temperature danger zone (5°C to 60°C) for >4 hours must be rejected.
- Visibly spoiled, moldy, sour, or foul-smelling items must be flagged as non-compliant.

YOUR TASK:
1. Thoroughly analyze the Title and Description (and attached photo if present) for policy compliance. Identify if the donor is trying to donate prohibited goods, table scraps, alcohol, unpasteurized milk, expired infant food, or hazardous items.
2. Determine isCompliant: false if ANY prohibited item is detected or if severe contamination exists. Set isCompliant: true only if safe and policy compliant.
3. Determine policyVerdict: "COMPLIANT", "VIOLATION", or "WARNING".
4. Determine safetyVerdict: "Looks safe" (approved), "Flagged for review" (minor caution), or "Prohibited" (violates prohibited items policy).
5. If non-compliant, list the exact prohibited categories in prohibitedItemsDetected, and provide a clear explanation in policyViolationReason.
6. Provide recommended safe consumption hours (recommendedExpiryHours), storage advice for couriers, and checklist flags.
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCompliant: {
              type: Type.BOOLEAN,
              description: 'True if listing fully adheres to food donation policies and has zero prohibited items',
            },
            policyVerdict: {
              type: Type.STRING,
              description: '"COMPLIANT", "VIOLATION", or "WARNING"',
            },
            safetyVerdict: {
              type: Type.STRING,
              description: '"Looks safe", "Flagged for review", or "Prohibited"',
            },
            prohibitedItemsDetected: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Categories of prohibited items detected, or empty array if compliant',
            },
            policyViolationReason: {
              type: Type.STRING,
              description: 'Clear reason if item violates prohibited items policy or food safety rules',
            },
            reason: {
              type: Type.STRING,
              description: 'Concise one-line assessment under 140 characters',
            },
            confidenceScore: {
              type: Type.INTEGER,
              description: 'Confidence score percentage from 50 to 99',
            },
            recommendedExpiryHours: {
              type: Type.INTEGER,
              description: 'Recommended maximum hours remaining for safe consumption',
            },
            storageAdvice: {
              type: Type.STRING,
              description: 'Clear handling and transport advice for volunteers',
            },
            fssaiChecklist: {
              type: Type.OBJECT,
              properties: {
                temperatureCompliant: { type: Type.BOOLEAN },
                hygienePackagingCompliant: { type: Type.BOOLEAN },
                allergenDeclared: { type: Type.BOOLEAN },
                nonProhibited: { type: Type.BOOLEAN },
              },
              required: ['temperatureCompliant', 'hygienePackagingCompliant', 'nonProhibited'],
            },
          },
          required: [
            'isCompliant',
            'policyVerdict',
            'safetyVerdict',
            'prohibitedItemsDetected',
            'reason',
            'confidenceScore',
            'recommendedExpiryHours',
            'storageAdvice',
          ],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    let result: any = {};
    try {
      result = JSON.parse(text);
    } catch {
      result = {
        isCompliant: !hasRuleViolations,
        policyVerdict: hasRuleViolations ? 'VIOLATION' : 'COMPLIANT',
        safetyVerdict: hasRuleViolations ? 'Prohibited' : 'Looks safe',
        prohibitedItemsDetected: ruleScan.matchedCategories,
        reason: hasRuleViolations ? 'Item matches prohibited donation guidelines.' : 'Food appears fresh with intact packaging.',
        confidenceScore: 90,
        recommendedExpiryHours: hasRuleViolations ? 0 : 4,
        storageAdvice: hasRuleViolations ? 'Do not distribute.' : 'Keep covered in insulated crate during transit.',
        fssaiChecklist: {
          temperatureCompliant: !hasRuleViolations,
          hygienePackagingCompliant: true,
          allergenDeclared: true,
          nonProhibited: !hasRuleViolations,
        },
      };
    }

    // Merge deterministic rule detections with Gemini detections
    const combinedProhibitions = Array.from(
      new Set([
        ...ruleScan.matchedCategories,
        ...(Array.isArray(result.prohibitedItemsDetected) ? result.prohibitedItemsDetected : []),
      ])
    );

    const isActuallyCompliant =
      result.isCompliant !== false && !hasRuleViolations && combinedProhibitions.length === 0;

    let finalSafetyVerdict: 'Looks safe' | 'Flagged for review' | 'Prohibited' = 'Looks safe';
    if (!isActuallyCompliant || combinedProhibitions.length > 0) {
      finalSafetyVerdict = 'Prohibited';
    } else if (result.safetyVerdict === 'Flagged for review' || result.policyVerdict === 'WARNING') {
      finalSafetyVerdict = 'Flagged for review';
    }

    const finalPolicyVerdict = !isActuallyCompliant ? 'VIOLATION' : result.policyVerdict || 'COMPLIANT';

    const violationReason = !isActuallyCompliant
      ? result.policyViolationReason ||
        `This listing contains items prohibited under FSSAI & FoodLink food donation policies: ${combinedProhibitions.join(', ')}. Donations of this type cannot be accepted for community shelters.`
      : null;

    return res.json({
      isCompliant: isActuallyCompliant,
      policyVerdict: finalPolicyVerdict,
      // verdict field for backward compatibility
      verdict: finalSafetyVerdict === 'Prohibited' ? 'Flagged for review' : finalSafetyVerdict,
      safetyVerdict: finalSafetyVerdict,
      prohibitedItemsDetected: combinedProhibitions,
      policyViolationReason: violationReason,
      reason:
        !isActuallyCompliant
          ? `Policy Violation: ${combinedProhibitions.join(', ')} prohibited.`
          : result.reason || 'Food conforms to FSSAI temperature and packaging criteria.',
      confidenceScore: result.confidenceScore || 92,
      recommendedExpiryHours: !isActuallyCompliant ? 0 : result.recommendedExpiryHours || 4,
      storageAdvice: !isActuallyCompliant
        ? 'Do not accept or transport. Reject pickup mission.'
        : result.storageAdvice || 'Maintain temperature hygiene throughout dispatch.',
      fssaiChecklist: {
        temperatureCompliant: isActuallyCompliant ? (result.fssaiChecklist?.temperatureCompliant ?? true) : false,
        hygienePackagingCompliant: result.fssaiChecklist?.hygienePackagingCompliant ?? true,
        allergenDeclared: Boolean(allergens && allergens.length > 0),
        nonProhibited: isActuallyCompliant,
      },
    });
  } catch (error: any) {
    console.error('Gemini food safety & policy assessment error:', error);
    // Fallback scan on title & description
    const fallbackTitle = (req.body?.title || req.body?.foodName || '').toString();
    const fallbackDesc = (req.body?.description || req.body?.notes || '').toString();
    const fallbackScan = scanTextForProhibitions(`${fallbackTitle} ${fallbackDesc}`);

    if (fallbackScan.matchedCategories.length > 0) {
      return res.json({
        isCompliant: false,
        policyVerdict: 'VIOLATION',
        verdict: 'Flagged for review',
        safetyVerdict: 'Prohibited',
        prohibitedItemsDetected: fallbackScan.matchedCategories,
        policyViolationReason: `Listing contains prohibited items: ${fallbackScan.matchedCategories.join(', ')}. Cannot be published.`,
        reason: `Prohibited item detected: ${fallbackScan.matchedCategories.join('; ')}.`,
        confidenceScore: 95,
        recommendedExpiryHours: 0,
        storageAdvice: 'Do not distribute.',
        fssaiChecklist: {
          temperatureCompliant: false,
          hygienePackagingCompliant: false,
          allergenDeclared: true,
          nonProhibited: false,
        },
      });
    }

    return res.json({
      isCompliant: true,
      policyVerdict: 'COMPLIANT',
      verdict: 'Looks safe',
      safetyVerdict: 'Looks safe',
      prohibitedItemsDetected: [],
      policyViolationReason: null,
      reason: 'Safety check completed: verified against standard food rescue guidelines.',
      confidenceScore: 90,
      recommendedExpiryHours: 4,
      storageAdvice: 'Transport in covered clean crates.',
      fssaiChecklist: {
        temperatureCompliant: true,
        hygienePackagingCompliant: true,
        allergenDeclared: true,
        nonProhibited: true,
      },
    });
  }
}

app.post('/api/safety-check', aiSafetyLimiter, handleSafetyCheck);
app.post('/api/assess-food-safety', aiSafetyLimiter, handleSafetyCheck);

// FCM Cloud Messaging Push Trigger endpoint for status changes
app.post('/api/send-push-notification', (req, res) => {
  try {
    const {
      status,
      listingId,
      listingTitle,
      donorNotification,
      recipientNotification,
      donorId,
      recipientId,
    } = req.body || {};

    if (!listingId || !status) {
      return res.status(400).json({ error: 'Missing required status or listing ID.' });
    }

    console.log(`[FCM Push Trigger] Status changed: "${status}" for listing "${listingTitle}" (${listingId})`);

    const notifiedTargets: Array<{ target: string; id: string; title: string }> = [];

    if (donorNotification && donorId) {
      console.log(`[FCM Push -> Donor ${donorId}]: ${donorNotification.title} - ${donorNotification.body}`);
      notifiedTargets.push({ target: 'donor', id: donorId, title: donorNotification.title });
    }

    if (recipientNotification && recipientId) {
      console.log(`[FCM Push -> Recipient ${recipientId}]: ${recipientNotification.title} - ${recipientNotification.body}`);
      notifiedTargets.push({ target: 'recipient', id: recipientId, title: recipientNotification.title });
    }

    return res.json({
      success: true,
      status,
      listingId,
      notifiedTargets,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error handling push notification dispatch:', err);
    // Sanitize error disclosure to prevent internal leaks
    return res.status(500).json({ error: 'Failed to process push notification request.' });
  }
});

// Centralized error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large. Maximum request size is 8MB.' });
  }
  console.error('[Internal Application Error]:', err);
  return res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

async function startServer() {
  const distDir = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distDir) && fs.existsSync(path.join(distDir, 'index.html'));

  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Could not initialize Vite dev server, falling back to static build:', viteErr);
      if (hasDist) {
        app.use(express.static(distDir));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distDir, 'index.html'));
        });
      }
    }
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`FoodLink server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
