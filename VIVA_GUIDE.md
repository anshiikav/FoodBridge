# 🎓 FoodBridge — College Viva & Project Demonstration Guide

This guide is designed to help you confidently present your project and answer all questions during your **college viva examination**. Keep explanations simple, direct, and structured.

---

## 1. Project Overview
- **Project Name:** FoodBridge
- **Tagline:** *"Bridging surplus food with those in need."*
- **Summary:** FoodBridge is a full-stack web platform connecting commercial restaurants with local NGOs to redirect surplus, edible food to underprivileged communities, preventing food waste and fostering hunger relief.
- **Key Beneficiaries:** 
  1. **Restaurants:** Easily list surplus food, track pickups, adhere to food safety protocols, and receive impact certificates.
  2. **NGOs:** Discover local surplus meals, receive smart automated recommendations, claim donations, and coordinate volunteer pickups.
  3. **Communities:** Receive fresh, safe meals efficiently.

---

## 2. Problem Statement
- **The Issue:** Millions of tons of edible food prepared by restaurants, banquets, and cafes are discarded daily, while millions face food insecurity.
- **Why It Happens:** Lack of real-time communication, absence of safe verification during handover, logistical hurdles (location/distance mismatch), and strict consumption time windows.
- **The Solution:** A centralized, transparent platform with real-time status tracking, rule-based smart matching, and QR-based handover confirmation.

---

## 3. Why I Selected This Project
- **Social Impact:** Addresses United Nations Sustainable Development Goals (SDG 2: Zero Hunger, SDG 12: Responsible Consumption and Production).
- **Practical Engineering:** Demonstrates complete full-stack concepts: authentication, role-based access control, algorithmic decision-making, transactional state management, and real-time database queries.
- **Explainability:** Unlike black-box external AI APIs, the matching logic and calculations are transparent, deterministic, and fully explainable to an examiner.

---

## 4. Technologies Used

| Tier | Technology | Why Chosen? |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) | Direct DOM manipulation without heavy frontend framework abstractions (React/Angular); fast load times and clean code. |
| **Backend** | Node.js & Express.js (TypeScript) | Asynchronous, event-driven architecture with strong static typing to avoid runtime bugs. |
| **Database** | MongoDB with Mongoose | Flexible document schema well-suited for varying food items, pickup coordinates, and nested metadata. |
| **Security** | `bcryptjs` & `jsonwebtoken` (JWT) | Industry-standard password hashing with cryptographic salt and stateless, token-based authorization. |
| **Utilities** | `qrcode` | Generating client-verifiable QR codes for physical food handovers. |

---

## 5. Frontend & Backend Architecture

- **Separation of Concerns:** Static files served from `frontend/` directory; REST endpoints served under `/api/*`.
- **Stateless Communication:** No server-side sessions; every authenticated request carries an `Authorization: Bearer <token>` header.

---

## 6. Database Design & Schemas

The database contains four primary collections:

1. **`User` Schema:**
   - Common fields: `name`, `email`, `password` (hashed), `phone`, `role` (`restaurant` | `ngo` | `admin`), `address`, `city`, `pincode`, `location` (GeoJSON coordinates), `isVerified`.
   - Role-specific profiles: `restaurantDetails` (FSSAI license, average surplus), `ngoDetails` (registration number, dietary preference, beneficiaries served, pickup vehicle availability).

2. **`Donation` Schema:**
   - `foodName`, `description`, `category` (Cooked Meals, Bakery, etc.), `dietType` (Vegetarian, Non-Veg, Vegan).
   - `quantity` (servings), `preparationTime`, `pickupDeadline`.
   - `status`: Lifecycle enum (`available` $\to$ `accepted` $\to$ `picked_up` $\to$ `completed` $\to$ `cancelled` $\to$ `expired`).
   - `restaurantId` (Ref: User), `acceptedByNGO` (Ref: User), `assignedVolunteer` (Ref: Volunteer).
   - Handover Verification: `pickupCode` (unique 6-character string), `qrCodeDataUrl` (Base64 QR image).

3. **`Notification` Schema:** In-app alerts with read/unread statuses.
4. **`Volunteer` Schema:** Assigned NGO pickup personnel with contact information.

---

## 7. Authentication & Authorization (RBAC)
- **Password Security:** Passwords are never stored in plain text. Salted hash generated using `bcrypt.hash(password, 10)`.
- **JWT Authentication:** Upon successful login, the server issues a signed JSON Web Token containing `{ id, role }` with a 7-day expiration.
- **Role Guards:** Middleware (`authorize(['restaurant'])`, `authorize(['ngo'])`, `authorize(['admin'])`) inspects the decrypted token payload on incoming requests and rejects unauthorized access with HTTP 403 Forbidden.

---

## 8. REST API Structure

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/auth/register` | POST | Public | Registers Restaurant or NGO with validation |
| `/api/auth/login` | POST | Public | Validates credentials, returns JWT & user object |
| `/api/donations` | GET | Public / NGO | Lists available food with search, category & diet filters |
| `/api/donations` | POST | Restaurant | Creates a new surplus donation with safety checklist |
| `/api/donations/:id/accept` | POST | Verified NGO | Atomically claims a donation; generates QR & pickup code |
| `/api/donations/:id/verify-pickup` | POST | Restaurant/NGO | Verifies pickup code/QR, completes handover |
| `/api/matching/donation/:id` | GET | Restaurant | Computes top 3 matching NGOs for a donation |
| `/api/matching/recommendations` | GET | NGO | Computes highest-scoring available donations for current NGO |
| `/api/impact/stats` | GET | Public | Live database aggregations: meals rescued, kg avoided |

---

## 9. Smart NGO Matching System (The Core Algorithm)

> **Viva Key Point:** Emphasize that this is a **deterministic, explainable rule-based algorithm**, avoiding external black-box API costs and hallucination.

Located in: `backend/src/utils/matching.ts`

### Formula:
$$\text{Match Score} = (\text{Distance Score} \times 0.40) + (\text{Food Compatibility Score} \times 0.35) + (\text{Pickup Availability Score} \times 0.25)$$

1. **Distance Score (40% Weight):**
   - Haversine Formula calculates geodesic distance between Restaurant coordinates and NGO coordinates.
   - Scaled linearly: $\le 2\text{ km} = 100$, $\le 5\text{ km} = 85$, $\le 10\text{ km} = 70$, $\le 20\text{ km} = 50$, $> 30\text{ km} = 10$.
2. **Food Compatibility Score (35% Weight):**
   - Dietary check: If donation is Non-Veg and NGO accepts Vegetarian only $\to$ Incompatible (Score = 0).
   - Quantity ratio: Compares donation servings to NGO beneficiary capacity. Ideal match $(80\% - 120\%)$ receives 100 points.
3. **Pickup Availability Score (25% Weight):**
   - Computes hours remaining before `pickupDeadline`.
   - If NGO operates a vehicle and has $\ge 2$ hours $\to 100$ points. If $< 1$ hour remaining $\to 30$ points.
   - Automatic Exclusion: Expired donations are disqualified immediately.

---

## 10. Donation Status Lifecycle

- Available $\to$ Accepted $\to$ Picked Up $\to$ Completed (or Expired / Cancelled)
- **Race Condition Prevention:** When an NGO clicks "Accept", the backend uses an atomic database condition (`findOneAndUpdate({ _id: id, status: 'available' })`). If two requests arrive simultaneously, the second fails gracefully.

---

## 11. QR-Based Pickup Confirmation
- **Why it matters:** Solves the physical handover trust gap (prevents unauthorized collection or false claims of delivery).
- **How it works:**
  1. Once accepted, a random 6-character cryptographic pickup code (e.g. `FB-8942`) is stored on the donation.
  2. The `qrcode` library encodes this unique verification string into a Base64 Data URL.
  3. At collection time, the NGO displays the QR code; the restaurant verifies it (or enters the 6-character PIN manually).
  4. The status updates atomically to `picked_up`.

---

## 12. Food Safety & Expiry Features
- **Mandatory Safety Checklist:** Restaurants must verify 4 checklist items before listing: preparation time within safe window, temperature-controlled storage, clean food-grade containers, and sensory freshness.
- **Dynamic Deadline Countdown:** Client UI calculates real-time remaining minutes with color-coded urgency badges (Normal $\to$ Warning $< 2\text{h}$ $\to$ Urgent $< 1\text{h}$).
- **Disclaimer:** The platform explicitly displays a disclaimer clarifying that FoodBridge facilitates connections and does not replace local municipal food safety regulations (FSSAI).

---

## 13. Important Code Files

- `backend/src/server.ts`: Server bootstrap, middleware loading, and zero-setup MongoDB fallback.
- `backend/src/routes/donation.routes.ts`: Complete donation lifecycle state transitions and QR verification logic.
- `backend/src/utils/matching.ts`: The smart matching mathematical implementation and natural language reasoning generator.
- `backend/src/utils/seed.ts`: Realistic demonstration seed data (restaurants, NGOs, active donations, historical records).
- `frontend/js/dashboard.js`: Interactive client controller for restaurant and NGO workflows.
- `frontend/js/i18n.js`: Bilingual English/Hindi translation dictionary and DOM switcher.

---

## 14. Limitations & Future Scope

### Current Limitations:
- Real-time communication relies on polling/refreshes rather than WebSockets.
- Route distance calculation uses Euclidean/Haversine distance rather than live Google Maps traffic APIs.

### Future Scope:
- **IoT Smart Containers:** Temperature sensors logging food storage temperature directly to the donation record.
- **Direct Route Optimization:** Integrating OpenStreetMap/Google Directions API for volunteer vehicle routing.
- **Automated WhatsApp / SMS Gateway:** Instant SMS alerts for NGOs when a high-compatibility donation is listed nearby.

---

## 🎯 Top 5 Examiner Questions & Model Answers

**Q1: Why did you not use React or Next.js for the frontend?**  
> *"For this project, I chose vanilla HTML5, CSS3, and JavaScript to demonstrate mastery of core web fundamentals—DOM manipulation, state management, asynchronous fetch calls, and responsive CSS grid/flexbox—without the unnecessary overhead, abstraction, and heavy bundle sizes of a framework."*

**Q2: How do you prevent two NGOs from claiming the same donation at the same second?**  
> *"We handle concurrency at the database level using an atomic query: `Donation.findOneAndUpdate({ _id: donationId, status: 'available' }, { status: 'accepted', ... })`. If two requests arrive simultaneously, MongoDB locks the document; the first succeeds and sets the status to 'accepted', causing the second query to return null and fail gracefully."*

**Q3: Is the smart matching using AI or machine learning?**  
> *"No, and that was a conscious design choice. It is a deterministic, rule-based algorithmic scoring model (40% distance, 35% food compatibility, 25% time availability). This ensures 100% transparency, zero API cost, explainable recommendations, and eliminates AI hallucinations in food safety-critical scenarios."*

**Q4: How do you ensure passwords and data remain secure?**  
> *"Passwords are never stored in plain text; they are hashed using bcrypt with a salt factor of 10. API endpoints are secured using stateless JSON Web Tokens (JWT) verified via middleware, and sensitive fields like password hashes are excluded from API responses using Mongoose projection (`select: false`)."*

**Q5: How does the application run if MongoDB is not installed locally on the evaluation machine?**  
> *"The backend includes an automatic fallback mechanism: if an external MongoDB connection is not detected, it boots an embedded, in-memory MongoDB engine (`mongodb-memory-server`) and seeds it with realistic demonstration data, guaranteeing that the project can be demonstrated seamlessly in any offline evaluation setting."*
