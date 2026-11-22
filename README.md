# 🌿 FoodBridge — Bridging Surplus Food With Those In Need

FoodBridge is a full-stack food donation and redistribution platform connecting commercial restaurants with local NGOs to minimize food waste and alleviate community food insecurity.

Built as a college demonstration project using clean vanilla frontend architecture, an Express/TypeScript backend, and MongoDB Mongoose persistence.

---

## ✨ Key Features

1. **Role-Based Portals:**
   - **Restaurant Dashboard:** Surplus food creation with food safety checklist, active listing management, accepted pickup monitoring, and downloadable impact certificates.
   - **NGO Dashboard:** Real-time discovery of surplus meals, smart matching recommendations, 1-click claim, interactive pickup QR verification, and volunteer assignment.
   - **Admin Panel:** Organization status verification, suspension controls, donation tracking, and system reports.

2. **Innovative Smart Matching Algorithm (`backend/src/utils/matching.ts`):**
   - Deterministic, explainable scoring:
     $$\text{Match Score} = (\text{Distance} \times 0.40) + (\text{Food Compatibility} \times 0.35) + (\text{Pickup Availability} \times 0.25)$$
   - Generates human-readable reasoning for every recommendation.

3. **QR-Based Single-Use Pickup Verification:**
   - Generates unique codes and QR codes upon acceptance.
   - Verified at pickup to transition state to completed without double-redemption risks.

4. **Live Impact Metrics & Environmental Equivalents:**
   - Aggregated in real time from database records: Meals donated, kilograms rescued, and CO₂ emissions avoided.
   - Visual monthly donation trends and category breakdown charts.

5. **Additional Capabilities:**
   - **Rule-Based Food Demand Forecasting:** Estimates upcoming food needs by neighborhood.
   - **Bilingual Interface:** Instant English / Hindi translation toggle.
   - **CSV Export:** Download monthly donation reports with a single click.

---

## 🛠 Technology Stack

- **Frontend:** HTML5, CSS3 (Custom Properties Design System), JavaScript (ES6+)
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** MongoDB with Mongoose (with automated local embedded zero-setup fallback)
- **Security:** Salted bcrypt password hashing, JSON Web Tokens (JWT)
- **Verification:** Base64 QR code generation (`qrcode`)

---

## 🚀 Quick Start on macOS

### 1. Prerequisites
- Node.js (v18 or newer)
- npm

### 2. Install & Start

```bash
# Navigate to the backend directory
cd "FoodBridge/backend"

# Install dependencies (only required on fresh clone)
npm install

# Start the application server
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

*Note on Database: The server will automatically connect to your configured `MONGODB_URI` if present. If neither local MongoDB nor Atlas is active, it seamlessly starts an embedded in-memory MongoDB instance with pre-seeded demonstration data—ensuring your presentation runs without external network dependencies.*

---

## 👥 Demo Accounts (One-Click Login on `/login`)

| Account Type | Email | Password |
|---|---|---|
| **Demo Restaurant** | `demo.restaurant@foodbridge.org` | `demo123456` |
| **Demo NGO** | `demo.ngo@foodbridge.org` | `demo123456` |
| **Demo Admin** | `admin@foodbridge.org` | `admin123456` |

---

## 📂 Project Structure

```
FoodBridge/
├── backend/
│   ├── src/
│   │   ├── models/        # Mongoose schemas: User, Donation, Notification, Volunteer
│   │   ├── routes/        # REST controllers: auth, donation, matching, impact, admin
│   │   ├── middleware/    # JWT authentication, role guards, multer upload
│   │   ├── utils/         # Smart matching algorithm, demand forecast, database seeder
│   │   └── server.ts      # Server entry point & database initialization
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── css/               # Modular CSS design system (style.css, dashboard.css, etc.)
│   ├── js/                # Client controllers (api.js, dashboard.js, available-food.js, i18n.js)
│   └── pages/             # Semantic HTML pages (index, login, register, dashboards, impact)
├── uploads/               # Uploaded food images
├── README.md
└── .env.example
```

---

## 🎓 College Viva Examination Guide

For detailed explanations of the architecture, database normalization, smart matching formula, and examiner Q&A, refer to the [College Viva & Demonstration Guide](file:///Users/aanshi/.gemini/antigravity/brain/970881d8-d93e-4cf1-aefc-d426b957d26b/viva-guide.md).
