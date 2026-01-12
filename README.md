# 📱 RVM User Web App

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Vue 3](https://img.shields.io/badge/Vue.js-3.5-4FC08D?style=flat&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat&logo=supabase)

A mobile-first web application designed for **recyclers** using the Smart Waste Sorting System. This app allows users to track their environmental impact, find nearby Reverse Vending Machines (RVMs), and manage their reward points.

---

## 🚀 Key Features

### 👤 **User Dashboard**
- **Impact Tracking:** View lifetime recycled weight (kg) and total points earned.
- **Balance & Withdrawals:** Check current point balance and request withdrawals/redemptions.
- **Activity History:** Detailed logs of every recycling transaction (Date, Machine, Weight, Points).

### 📍 **Machine Locator**
- **Nearby Stations:** Automatically finds the closest RVMs using the device's GPS.
- **Live Status:** See if a machine is Online/Offline and view compartment fullness before visiting.
- **Navigation:** Get address details and distance to machines.

### 🔐 **Authentication & Profile**
- **Secure Login:** Phone number verification via OTP (Firebase Auth).
- **Profile Management:** Update nickname and avatar.
- **Card Binding:** Link physical IC cards to the digital account via QR code.

### 📱 **Mobile Experience**
- **Responsive Design:** Optimized for mobile browsers (PWA-ready).
- **Touch Gestures:** Swipeable banners and touch-friendly controls.

---

## 🛠️ Tech Stack

- **Framework:** [Vue 3](https://vuejs.org/) (Composition API)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Auth:** [Firebase Auth](https://firebase.google.com/) (Phone/OTP)
- **Database:** [Supabase](https://supabase.com/) (User data & Merchant linking)
- **UI Components:** [Swiper.js](https://swiperjs.com/) (Sliders), [Lucide Vue](https://lucide.dev/) (Icons)
- **API Integration:** Axios + Vercel Serverless Functions

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### 1. Clone the Repository
```
git clone [https://github.com/your-org/rvm-web.git](https://github.com/your-org/rvm-web.git)
cd rvm-web
```

### 2. Install Dependencies
```
npm install
```

### 3. Environment Configuration
```
# ------------------------------
# 1. Supabase Configuration
# ------------------------------
VITE_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
VITE_SUPABASE_ANON_KEY=your-public-anon-key

# ------------------------------
# 2. Firebase Configuration (For Phone Auth)
# ------------------------------
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# ------------------------------
# 3. RVM API & Backend (Vercel)
# ------------------------------
# Used by the serverless proxy to talk to the machine network
VITE_MERCHANT_NO=....
VITE_API_SECRET=your_api_secret_key
```

### 4. Run Development Server
```
npm run dev
```

Note on API Proxy: > In development, vite.config.js proxies /api requests to http://localhost:3000. You may need to run the Vercel dev server (vercel dev) to handle the serverless functions locally.

---

## 🔌 API Integration
This app consumes the Smart Waste Sorting System API to interact with physical machines. To ensure security (hiding API secrets) and solve CORS issues, calls are routed through a proxy (/api/proxy).
### Key Endpoints (User Context)

| Feature | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Sync Account** | `/api/open/v1/user/account/sync` | `POST` | Syncs user data (nickname, avatar) with the RVM network. |
| **Recycling Logs** | `/api/open/v1/put` | `GET` | Fetches the user's personal recycling history. |
| **Nearby RVMs** | `/api/open/video/v2/nearby` | `GET` | Finds machines based on lat/long coordinates. |
| **Machine Status** | `/api/open/v1/device/position` | `GET` | Checks specific machine details (bin levels, status). |
| **Remote Open** | `/api/open/v1/open` | `POST` | Allows opening a bin remotely (if authorized). |
| **Bind Card** | `/api/open/v1/code/auth/bindCard` | `GET` | Links a physical RFID card to the current phone number. |

---

## 📂 Project Structure
```
src/
├── api/             # Vercel Serverless Functions (Proxy)
├── assets/          # Static assets (CSS, Images)
├── components/      # UI Components (NavBar, RVMCard, etc.)
├── composables/     # Logic Hooks (useHomeLogic, useUserDashboard)
├── firebase/        # Firebase initialization config
├── pages/           # Route Views (HomePage, Profile, Dashboard)
├── router/          # Vue Router configuration
├── services/        # API Wrappers (autogcm.js, supabase.js)
└── App.vue          # Root component
```
---
## 🚢 Deployment
The project is configured for Vercel (vercel.json).

1. Connect repository to Vercel.

2. Add all Environment Variables (Supabase, Firebase, and RVM API Keys) in the Vercel Dashboard.

3. Deploy.

---

## 📄 License
This project is proprietary software developed for HMA Digital Systems. Unauthorized copying or distribution is strictly prohibited.
