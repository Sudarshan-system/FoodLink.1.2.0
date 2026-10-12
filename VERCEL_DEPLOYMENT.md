# FoodLink - Vercel Deployment Guide

This guide ensures that your FoodLink application, Firebase Authentication (Google Sign-In), and Firestore Database function seamlessly after pushing to GitHub and deploying to Vercel.

---

## 1. Push to GitHub

1. Initialize git and commit all project files:
   ```bash
   git add .
   git commit -m "Deploy FoodLink to Vercel with Firebase Firestore and Google Sign-In"
   ```
2. Push to your GitHub repository:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

---

## 2. Deploy on Vercel

1. Log in to [Vercel](https://vercel.com) and click **"Add New" > "Project"**.
2. Select your imported GitHub repository.
3. Vercel automatically detects the Vite framework using the included `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. (Optional) In **Environment Variables**, you can add your keys:
   - `GEMINI_API_KEY`: Your Gemini API key for real-time food safety inspections.
   - `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps key for live transit maps.
   *(Firebase configuration is already auto-loaded from `firebase-applet-config.json`, or you can set `VITE_FIREBASE_*` variables if you prefer keeping credentials in Vercel settings).*
5. Click **Deploy**.

---

## 3. Enable Google Sign-In for Your Vercel Domain (CRITICAL)

Google Firebase Authentication enforces an **Authorized Domains** allowlist for security. To make Google Sign-In work on your Vercel URL:

1. Open the [Firebase Console](https://console.firebase.google.com/project/atomic-subject-c3skh/authentication/settings).
2. In the left navigation, click **Build > Authentication**.
3. Go to the **Settings** tab at the top.
4. Select **Authorized domains** from the left menu.
5. Click **"Add domain"** and enter your Vercel deployment hostname:
   ```
   your-project-name.vercel.app
   ```
   *(Also add any custom domain if you connect one, e.g. `foodlink.org`).*
6. Click **Save**.

Your Google Sign-In and Firestore database operations will now be fully active on Vercel!

---

## 4. Built-in SPA Routing & Serverless Endpoints

- **SPA Rewrites**: Handled by `vercel.json` so navigating to `/browse`, `/donor`, `/courier`, `/requests`, `/admin`, or `/ledger` will never trigger a 404 on refresh.
- **Serverless API Routes**: Located in `/api` (`/api/safety-check` and `/api/send-push-notification`), executing serverless functions directly on Vercel.
- **Database Persistence**: Firestore operations run directly on Google Cloud Firestore (`ai-studio-c3a10e35-4891-482f-bd4d-8ff978e63a3e`).
