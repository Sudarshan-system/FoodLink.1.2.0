# FoodLink Security Hardening & Vulnerability Remediation

Comprehensive audit and hardening of FoodLink's database access controls, authentication privilege management, and backend API endpoints to protect against data tampering, unauthorized escalation, and denial-of-service risks.

### User Review & Critical Decisions

> [!IMPORTANT]
> The security policies below directly reflect your clarified preferences:
> - **Firestore Rules**: Hardened for authenticated write and ownership verification, while keeping meal requests readable for public food discovery.
> - **Administrative Access**: Presentation demo role switcher is preserved for pitches/reviews, while patching production privilege escalation so arbitrary user registrations cannot claim admin privileges.
> - **API Endpoints**: Fortified with rate limiting, payload size caps, security headers, and sanitized error disclosures.

- **Confirmed Decision 1**: Production-hardened Firestore security rules with authenticated ownership checks and read-only public discovery for meal listings.
- **Confirmed Decision 2**: Retain demo presentation capabilities in the client while strictly isolating production admin authorization.
- **Confirmed Decision 3**: Server-side comprehensive protection including rate limiting, request payload limits, and defense-in-depth security headers.

---

### 1. Overview & Core Concept

- **What It Does**: Hardens the entire FoodLink application stack against the OWASP Top 10 vulnerabilities (Broken Access Control, Security Misconfiguration, Injection, and Denial of Service).
- **Target Audience / Persona**: Donors, recipient charities/community members, and administrators interacting safely without risking data corruption, unauthorized claims, or server starvation.
- **Key Value**: Provides enterprise-grade data protection and platform resilience while maintaining a seamless demo and presentation workflow.

---

### 2. User Experience & Security Architecture

- **Public Food Discovery**:
  - Unauthenticated and authenticated community members can freely browse active food donation listings without login friction.
  - Creating a donation, claiming food, or subscribing to local area notifications requires a valid authenticated session.
- **Role & Ownership Enforcement**:
  - Donors can only update or cancel listings they personally published (`donorId == request.auth.uid`).
  - Notification subscriptions can only be created, read, or deleted by their verified recipient owner (`userId == request.auth.uid`).
  - User profile documents (`/users/{uid}`) can only be modified by the respective authenticated owner, preventing profile overwrites.
- **Presentation & Demo Isolation**:
  - Demo accounts (Donor, Volunteer, Admin) remain instantly selectable in presentation mode for rapid UI demonstration.
  - Real user registration and profile initialization strictly default to standard roles (`donor` or `recipient`), closing the arbitrary email string match loophole.
- **Defensive API Protection**:
  - Client requests exceeding sensible JSON limits (1MB) are rejected immediately.
  - Rate limiting protects API endpoints against automated brute-force attacks and resource exhaustion.
  - Safe error masking prevents system stack traces and environment internals from leaking to client responses.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Firestore Rule Granularity**
  - *Chosen Approach*: Granular collection-level rules for `users`, `mealRequests`, `donations`, and `notifications`.
  - *Why*: Blanket `allow read, write: if true;` or loose wildcards permit unauthorized wiping or tampering of charity donations.
  - *Alternatives Considered*: Complete lockdown requiring login for everything — rejected to preserve community discovery of available meals.

- **Decision 2: Admin Privilege Validation**
  - *Chosen Approach*: Whitelist-guarded admin roles with explicit demo account boundaries.
  - *Why*: Previous client code checked `email.includes('admin')`, which allowed any attacker signing up with an address like `admin@attacker.com` to gain administrator power.
  - *Alternatives Considered*: Storing admin flags in client localStorage only — rejected because client storage can be freely edited via dev tools.

- **Decision 3: Server Protection Layer**
  - *Chosen Approach*: Middleware pipeline with custom or standard rate limiting, strict payload size bounds, and security headers tailored for AI Studio preview iframe compatibility.
  - *Why*: Prevents server exhaustion and clickjacking attacks without breaking the embedded development container.
  - *Alternatives Considered*: Edge CDN rules — not directly controllable within the node runtime.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Vite React SPA)                  │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Public Discovery View │       │ Auth & Profile Store  │  │
│  │ (Read meal listings)  │       │ (Protected Roles)     │  │
│  └──────────┬────────────┘       └──────────┬────────────┘  │
└─────────────┼───────────────────────────────┼───────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Firestore Rules                 │
│                                                             │
│  - /mealRequests/{id}: read public, write if donor/owner    │
│  - /users/{uid}: read auth, write if request.auth.uid == uid│
│  - /notifications/{id}: read/write if owner userId          │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Server                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Security Middlewares:                                 │  │
│  │  - Rate Limiter (Sliding Window per IP)               │  │
│  │  - Payload Cap (1MB body-parser limit)                │  │
│  │  - Headers: X-Content-Type-Options, Referrer-Policy   │  │
│  │  - Global Error Sanitizer (Mask internal traces)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Execution Plan

1. **Firestore Security Rules Overhaul (`firestore.rules`)**:
   - Define helper functions: `isAuthenticated()`, `isOwner(userId)`, `isAdmin()`.
   - Apply specific access rules per collection:
     - `users`: Authenticated read; write only if `request.auth.uid == userId`.
     - `mealRequests`: Public read for open food sharing; create/update/delete restricted to authenticated owners or authorized claimers.
     - `notifications` & `pushSubscriptions`: Restricted strictly to matching `userId`.
   - Validate data types and reject unexpected malicious fields.
   - Deploy updated rules to Firebase project via deployment tool.

2. **Client-Side Privilege Escalation Remediation (`src/AuthContext.tsx` & `src/AdminLoginPage.tsx`)**:
   - Patch `fetchOrCreateProfile` to prevent arbitrary user emails from automatically obtaining the `admin` role.
   - Maintain the demo switcher for presentation mode while segregating mock presentation states from genuine Firestore authentication.
   - Ensure role changes require authenticated admin verification.

3. **Backend API Hardening (`server.ts`)**:
   - Configure body parsers with explicit `limit: '1mb'` to prevent memory exhaustion attacks.
   - Add rate limiting middleware for `/api/*` endpoints to thwart spam and automated scraping.
   - Inject essential HTTP security headers (`X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy: strict-origin-when-cross-origin`).
   - Add centralized error handler that logs detailed diagnostic information on the server while returning clean, sanitized error messages to the client.

4. **Verification & Audit Testing**:
   - Compile and verify applet integrity.
   - Verify unauthenticated public browsing of meal listings works smoothly.
   - Test that unauthorized updates to other users' profiles or listings fail securely.
