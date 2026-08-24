# Santrino Backend API ⚽🏟️

A high-performance Node.js & Express REST API for **Santrino Sports Arena Booking & Dynamic Pricing System**.

---

## 🚀 Features

- **Dynamic Pricing Engine**: Automated hourly pricing calculations based on day/night rates, weekends, and custom peak rules.
- **Conflict-Free Booking Slot Management**: Compound unique indexes and validation to prevent double bookings.
- **Role-Based Access Control (RBAC)**: Secure multi-tier authentication (`player`, `owner`, `admin`, `superadmin`).
- **Owner & Admin Dashboard API**: Revenue statistics, occupancy calculations, and booking management.
- **Customer Intelligence & History**: Aggregated customer spending, booking history, and direct contact helpers.
- **SuperAdmin Platform Management**: User administration, role promotions, password resets, and user impersonation.
- **Resilient MongoDB Driver**: Auto-reconnect with replica set support and retry logic.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) & BcryptJS
- **Security**: CORS, Helmet, Mongo Sanitize

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Amr-khalid/santrinoback.git
   cd santrinoback
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your MongoDB connection string and secrets:
   ```bash
   cp .env.example .env
   ```

4. **Seed Database (Optional)**:
   ```bash
   npm run seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new player account
- `POST /api/auth/login` — Login and receive JWT token
- `GET /api/auth/me` — Get current logged-in user profile
- `POST /api/auth/google` — Google OAuth authentication
- `POST /api/auth/guest` — Quick guest user registration

### 🏟️ Fields (`/api/fields`)
- `GET /api/fields/primary` — Get primary sports venue details
- `PUT /api/fields/:id` — Update field configuration (Owner/Admin)

### 📅 Bookings (`/api/bookings`)
- `GET /api/bookings/available-slots?date=YYYY-MM-DD` — Real-time available slots & dynamic prices
- `POST /api/bookings` — Create a new slot booking
- `GET /api/bookings/confirm/:token` — Verify booking confirmation token
- `GET /api/bookings/my-bookings` — Get authenticated user's booking history
- `POST /api/bookings/:id/cancel` — Cancel a booking

### 📊 Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` — Overview occupancy and revenue statistics
- `GET /api/dashboard/bookings` — Filterable bookings list
- `POST /api/dashboard/bookings/manual` — Manual phone/walk-in booking
- `PATCH /api/dashboard/bookings/:id` — Update booking status or payment
- `GET /api/dashboard/customers` — Customer list with aggregated metrics
- `GET /api/dashboard/customers/:id/bookings` — Full booking history for a specific customer
- `GET /api/dashboard/pricing` — Dynamic pricing rules
- `PUT /api/dashboard/pricing/defaults` — Update default day/night prices
- `POST /api/dashboard/pricing` — Create new pricing rule

### 🛡️ SuperAdmin (`/api/superadmin`)
- `GET /api/superadmin/stats` — Platform-wide statistics
- `GET /api/superadmin/users` — Manage platform users
- `POST /api/superadmin/users` — Create new administrator
- `PUT /api/superadmin/users/:id/role` — Update user role
- `PUT /api/superadmin/users/:id/password` — Reset user password
- `POST /api/superadmin/impersonate/:id` — Impersonate user token

---

## 📄 License
ISC © Santrino Arena
