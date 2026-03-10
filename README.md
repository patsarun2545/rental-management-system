# 🧾 Rental Management System

A back-office admin panel for managing the full lifecycle of an online dress rental system, built with the **PERN Stack** (PostgreSQL, Express.js, React.js, Node.js).

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Bootstrap |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT, RBAC |
| Tools | Postman, PM2, Ubuntu Linux |

---

## ✨ Features Overview

- Role-based access control — only `ADMIN` accounts can access the panel
- Full rental lifecycle management with status tracking
- Payment slip upload & verification system
- Deposit (มัดจำ) management with partial refund/deduction
- Penalty tracking for late returns, damage, and lost items
- Auto-generated invoices per rental
- Stock reservation conflict-checking to prevent double-booking
- Monthly revenue chart, top-10 products report, overdue tracking
- Audit log for all admin actions

---

## 🔄 System Flow

### 01 · Authentication

Only users with `role = ADMIN` can sign in to the admin panel.

```
POST /api/auth/signUp   → Register account
POST /api/auth/signIn   → Sign in (checks role === "ADMIN")
POST /api/auth/signOut  → Sign out
```

> Admin can edit profile, change password, and manage addresses from the Sidebar.

---

### 02 · Master Data Setup

Before creating rentals, admin sets up the base data:

```
Categories  →  /api/catalog/categories    (e.g. Thai dress, Western dress)
Types       →  /api/catalog/types          (linked to Category)
Sizes       →  /api/catalog/sizes
Colors      →  /api/catalog/colors
Promotions  →  /api/promotions             (discount %, date range)
```

Then creates **Products + Variants** (size/color combinations with price and stock):

```
POST /api/products                    → Create product
POST /api/products/:id/variants       → Add variant (size, color, price, stock)
```

---

### 03 · Create Rental

Admin creates a rental by selecting:

1. **Customer** — from `/api/users` (role = USER)
2. **Date range** — `startDate` / `endDate`
3. **Products** — select Variant + quantity
4. **Optional** — deposit amount, late fee per day, promotion

```
POST /api/rentals
```

> System auto-generates a **Rental Code** and creates a **Stock Reservation** automatically.

After creation, admin can:
- Add / edit / remove items (Items Tab)
- Create / manage Deposit
- Edit dates, late fee, promotion
- Cancel rental → `CANCELLED` (stock released)

---

### 04 · Rental Status Flow

```
PENDING → CONFIRMED → ACTIVE → RETURNED → COMPLETED
```

| Status | Description |
|--------|-------------|
| `PENDING` | Waiting for admin action |
| `CONFIRMED` | Admin confirmed the booking |
| `ACTIVE` | Customer has picked up the items |
| `RETURNED` | Items have been returned |
| `COMPLETED` | Rental fully closed |
| `LATE` | Past `endDate` and not yet returned (auto) |
| `CANCELLED` | Cancelled by admin — stock released |

---

### 05 · Payments

Customers upload payment slips. Admin verifies and approves or rejects.

```
POST   /api/payments               → Record payment + upload slip
PATCH  /api/payments/:id/approve   → Approve
PATCH  /api/payments/:id/reject    → Reject
```

**Payment types:**

| Type | Description |
|------|-------------|
| `RENTAL` | Rental fee |
| `DEPOSIT` | Security deposit |
| `PENALTY` | Late / damage / lost fee |

**Payment status:** `PENDING` → `APPROVED` / `REJECTED`

---

### 06 · Deposit (เงินมัดจำ)

```
POST   /api/rentals/:id/deposit          → Create deposit
PATCH  /api/rentals/:id/deposit          → Update amount
PATCH  /api/rentals/:id/deposit/refund   → Refund deposit
PATCH  /api/rentals/:id/deposit/deduct   → Deduct from deposit
```

| Status | Description |
|--------|-------------|
| `HELD` | Deposit is being held — editable |
| `REFUNDED` | Returned to customer |
| `DEDUCTED` | Deducted due to damage |

---

### 07 · Returns & Closing

```
POST   /api/rentals/:id/return      → Record return (date, condition, note)
POST   /api/rentals/:id/penalties   → Add penalty
PATCH  /api/rentals/:id/penalties/:pid → Edit penalty
DELETE /api/rentals/:id/penalties/:pid → Remove penalty
POST   /api/rentals/:id/invoice     → Generate invoice
PATCH  /api/rentals/:id/complete    → Close rental → COMPLETED
```

**Return flow:**

```
ACTIVE / LATE → RETURNED → Inspect + Penalties → Invoice → COMPLETED
```

**Item conditions:** `GOOD` / `DAMAGED` / `LOST`

**Penalty types:** `LATE` / `DAMAGE` / `LOST`

---

### 08 · Admin Tools

| Module | Description |
|--------|-------------|
| **Dashboard** | System overview, rental stats, revenue, low-stock alerts |
| **Reports** | Monthly revenue chart, top-10 rented products, overdue rentals |
| **Reservations** | View all stock reservations, check availability by date range |
| **Users** | Manage accounts, edit info, reset password, ban/unban |
| **Audit Logs** | Track all admin actions, search by action, delete old logs |

---

## 📡 API Endpoints Summary

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `/api/auth/signIn, signUp, signOut` | Authentication |
| Products | `/api/products` | CRUD products & variants |
| Catalog | `/api/catalog/categories, types` | Categories & types |
| Sizes/Colors | `/api/catalog/sizes, colors` | Size & color management |
| Promotions | `/api/promotions` | CRUD promotions |
| Rentals | `/api/rentals` | Create & manage rentals |
| Rental Items | `/api/rentals/:id/items` | Add / edit / remove items |
| Payments | `/api/payments` | Record & verify payments |
| Deposits | `/api/rentals/:id/deposit` | Create / refund / deduct |
| Penalties | `/api/rentals/:id/penalties` | Add / edit / remove penalties |
| Returns | `/api/rentals/:id/return` | Record item return |
| Invoices | `/api/rentals/:id/invoice` | Generate & view invoice |
| Reservations | `/api/admin/reservations` | View reservations, check stock |
| Users | `/api/users` | User management |
| Reports | `/api/admin/revenue, products/top, rentals/overdue` | Reports |
| Audit Logs | `/api/admin/audit` | View & delete audit logs |
| Dashboard | `/api/admin/dashboard` | System statistics |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/patsarun2545/<repo-name>.git
cd <repo-name>

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dress_rental
JWT_SECRET=your_jwt_secret
PORT=5000
```

### Run

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

---

## 👤 Author

**Patsarun Kathinthong**  
Full Stack Developer · PERN Stack  
📧 patsarun2545@gmail.com  
🔗 github.com/patsarun2545
