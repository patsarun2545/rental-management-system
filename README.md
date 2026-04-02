# 🧾 Rental Management System (RMS)

A backend admin system for managing dress/costume rentals — covering inventory, rentals, payments, deposits, penalties, reports, and audit logs.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Bootstrap 5, AdminLTE |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT (Cookie + Bearer Token), RBAC |
| Alert | SweetAlert2 |
| Tools | Postman, PM2, Ubuntu Linux |

---

## 📁 Project Structure

```
root/
├── api/                          # Backend (Express.js)
│   ├── prisma/                   # Prisma schema & migrations
│   ├── src/
│   │   ├── assets/uploads/       # Uploaded images (slips, products)
│   │   ├── controllers/
│   │   │   ├── admin_controller.js      # Dashboard, Reports, Audit Log
│   │   │   ├── auth_controller.js       # Sign up, Sign in, Sign out, Me
│   │   │   ├── cart_controller.js       # Cart management
│   │   │   ├── catalog_controller.js    # Categories, Types, Sizes, Colors
│   │   │   ├── payment_controller.js    # Payments, Invoices
│   │   │   ├── product_controller.js    # Products, Variants, Images
│   │   │   ├── promotion_controller.js  # Promotions
│   │   │   ├── rental_controller.js     # Rentals, Items, Reservations
│   │   │   ├── return_controller.js     # Returns, Penalties, Deposits
│   │   │   ├── user_controller.js       # Users, Addresses
│   │   │   └── wishlist_controller.js   # Wishlist
│   │   ├── lib/
│   │   │   └── client.js         # Prisma client instance
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   ├── cors.middleware.js
│   │   │   ├── Isadmin.middleware.js
│   │   │   └── upload.middleware.js
│   │   ├── routes/
│   │   │   ├── index.js
│   │   │   ├── admin_routes.js
│   │   │   ├── auth_routes.js
│   │   │   ├── cart_routes.js
│   │   │   ├── catalog_routes.js
│   │   │   ├── payment_routes.js
│   │   │   ├── product_routes.js
│   │   │   ├── promotion_routes.js
│   │   │   ├── rental_routes.js
│   │   │   ├── user_routes.js
│   │   │   └── wishlist_routes.js
│   │   ├── utils/
│   │   │   └── response.utils.js
│   │   └── app.js
│   ├── .env
│   ├── package.json
│   ├── prisma.config.ts
│   └── server.js
│
└── frontend/                     # Frontend (React.js)
    └── src/
        ├── components/
        │   ├── AuthGuard.jsx      # Route guard — ADMIN role only
        │   ├── Footer.jsx
        │   ├── MyModal.jsx        # Reusable modal component
        │   ├── Navbar.jsx         # Top navbar with current path
        │   ├── Sidebar.jsx        # Sidebar nav + profile/password/address modals
        │   └── Wrapper.jsx        # Main content wrapper
        ├── context/
        │   └── AuthContext.jsx    # JWT auth state (localStorage)
        ├── pages/
        │   ├── AuditLogs.jsx
        │   ├── Categories.jsx
        │   ├── Dashboard.jsx
        │   ├── Deposits.jsx
        │   ├── Invoices.jsx
        │   ├── Payments.jsx
        │   ├── Products.jsx
        │   ├── Promotions.jsx
        │   ├── Rentals.jsx
        │   ├── Reports.jsx
        │   ├── Reservations.jsx
        │   ├── Returns.jsx
        │   ├── Signin.jsx
        │   ├── Signup.jsx
        │   ├── Sizescolors.jsx
        │   ├── Types.jsx
        │   └── Users.jsx
        ├── services/
        │   └── axios.js           # Axios instance + Bearer token interceptor
        └── utils/
            ├── alert.utils.jsx    # SweetAlert2 wrappers
            └── image.utils.jsx    # getImageUrl(path)
```

---

## ✨ Features Overview

- Role-based access control — only `ADMIN` users can access the Admin Panel
- Full rental lifecycle management with status tracking
- Payment slip upload and admin review/approval system
- Race condition prevention using PostgreSQL row-level locks (`FOR UPDATE`, `pg_advisory_xact_lock`)
- Deposit management — create, adjust amount, partial refund, or deduct from deposit
- Penalty tracking for late returns, damage, and lost items
- Auto-generated Invoices per rental (Invoice No format: `INV-YYYYMMDD-XXXX`)
- Stock reservation checks to prevent double-booking
- Monthly revenue reports (last 12 months), Top 10 products, and overdue rentals
- Audit log recording key admin actions (payment approve/reject, etc.)
- Admin can edit profile, change password, and manage addresses from the Sidebar
- Soft-delete for products — deleted items can be restored; prevents deletion of Categories/Types that have associated products

---

## 🔐 Middleware

| Middleware | File | Responsibility |
|-----------|------|----------------|
| Auth | `auth.middleware.js` | Validates JWT from Cookie or `Authorization: Bearer <token>` |
| Admin | `Isadmin.middleware.js` | Checks `role === "ADMIN"` — returns 403 if not |
| Upload | `upload.middleware.js` | Accepts image files (JPEG, PNG, WEBP, max 5MB) via Multer |
| CORS | `cors.middleware.js` | Allows origin from `CLIENT_URL` with credentials |

---

## 🔄 System Flow

### 01 · Authentication

Only users with `role = ADMIN` can access the Admin Panel.

```
POST /api/auth/signUp   → Register a new account
POST /api/auth/signIn   → Sign in (returns JWT token)
POST /api/auth/signOut  → Sign out (clears cookie)
GET  /api/auth/me       → Get current user info from token
```

The frontend stores the JWT in `localStorage` and sends it as `Authorization: Bearer <token>` on every request via an Axios interceptor.

---

### 02 · Master Data Setup

Configure base data before creating rentals:

```
GET/POST/PUT/DELETE /api/catalog/categories   → Categories (cannot delete if linked to Types or products)
GET/POST/PUT/DELETE /api/catalog/types        → Types, linked to a Category
GET/POST/PUT/DELETE /api/catalog/sizes        → Sizes (cannot delete if used by a variant)
GET/POST/PUT/DELETE /api/catalog/colors       → Colors + hex code (cannot delete if used by a variant)
GET/POST/PUT/DELETE /api/promotions           → Promotions (discount %, date range)
```

Then create **Products + Variants**:

```
POST   /api/products                       → Create a product
GET    /api/products                       → List products (filter, search, pagination)
GET    /api/products/:id                   → Get product + variants + images
PUT    /api/products/:id                   → Update product
PATCH  /api/products/:id/toggle-status     → Toggle product status (ACTIVE/INACTIVE)
DELETE /api/products/:id                   → Soft-delete product
PATCH  /api/products/:id/restore           → Restore soft-deleted product
GET    /api/products/deleted               → List soft-deleted products

POST   /api/products/:id/variants          → Add a variant (size, color, price, stock)
GET    /api/products/:id/variants          → List variants for a product
GET    /api/variants/:id                   → Get a single variant
PUT    /api/variants/:id                   → Update a variant
PATCH  /api/variants/:id/stock             → Update stock count
DELETE /api/variants/:id                   → Delete a variant

POST   /api/products/:id/images            → Upload product images (multiple at once)
GET    /api/products/:id/images            → List product images
PATCH  /api/images/:id/main                → Set as main image
PUT    /api/images/:id                     → Replace image (removes old file from disk)
DELETE /api/images/:id                     → Delete image
```

---

### 03 · Create Rental

Admin creates a rental by selecting:

1. **Customer** — from `/api/users` (role = USER)
2. **Date range** — `startDate` / `endDate`
3. **Items** — select Variant + quantity
4. **Extras** — deposit amount, late fee per day (`lateFeePerDay`), promotion

```
POST /api/rentals
```

The system auto-generates a **Rental Code** and creates a **Stock Reservation** automatically.

After creation, Admin can:

```
GET    /api/rentals                             → List all rentals (filter, pagination)
GET    /api/rentals/:id                         → Get rental details
PATCH  /api/rentals/:id/status                  → Update status directly
PATCH  /api/rentals/:id/cancel                  → Cancel rental (stock released automatically)
PATCH  /api/rentals/:id/confirm                 → PENDING → CONFIRMED + reserve stock
PATCH  /api/rentals/:id/activate                → CONFIRMED → ACTIVE
PATCH  /api/rentals/:id/pickup                  → Record actual customer pickup date
PATCH  /api/rentals/:id/complete                → RETURNED → COMPLETED
PATCH  /api/rentals/:id/payment-status          → Override paymentStatus directly

GET    /api/rentals/:id/items                   → List items in a rental
GET    /api/rentals/:id/items/:itemId           → Get a single rental item
POST   /api/rentals/:id/items                   → Add an item
PATCH  /api/rentals/:id/items/:itemId           → Update an item
DELETE /api/rentals/:id/items/:itemId           → Remove an item

GET    /api/rentals/handled                     → Rentals managed by the current Admin
GET    /api/admin/staff/:adminId                → Profile of any Admin
GET    /api/admin/staff/:adminId/rentals        → Rentals managed by a specific Admin
```

---

### 04 · Rental Status Flow

```
PENDING → CONFIRMED → ACTIVE → RETURNED → COMPLETED
```

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting Admin confirmation |
| `CONFIRMED` | Admin confirmed + stock reserved |
| `ACTIVE` | Customer has received the items |
| `RETURNED` | Customer has returned the items |
| `COMPLETED` | Rental closed successfully |
| `LATE` | Past `endDate` and not yet returned |
| `CANCELLED` | Cancelled by Admin — stock has been released |

---

### 05 · Payments

Customer uploads a payment slip; Admin reviews and approves or rejects it.

```
GET    /api/payments                        → List all payments (filter: status, type)
GET    /api/payments/:id                    → Get a single payment (Admin or owner)
GET    /api/payments/rental/:rentalId       → Payment history for a rental
POST   /api/payments                        → Record payment + upload slip (multipart/form-data)
PATCH  /api/payments/:id/approve            → Approve (uses row-level lock to prevent race conditions)
PATCH  /api/payments/:id/reject             → Reject
```

**Payment Types:**

| Type | Description |
|------|-------------|
| `RENTAL` | Rental fee — when `totalPrice` is fully paid, `paymentStatus` is automatically set to `APPROVED` |
| `DEPOSIT` | Security deposit — approval automatically creates a Deposit record |
| `PENALTY` | Penalty/fine |

**Payment Status:** `PENDING` → `APPROVED` / `REJECTED`

---

### 06 · Deposit (Security Deposit)

```
POST   /api/rentals/:id/deposit          → Create a deposit
GET    /api/rentals/:id/deposit          → Get deposit info for a rental
PATCH  /api/rentals/:id/deposit          → Adjust deposit amount (only when status = HELD)
PATCH  /api/rentals/:id/deposit/refund   → Refund deposit (specify refundedAmount)
PATCH  /api/rentals/:id/deposit/deduct   → Deduct from deposit (specify amount)
GET    /api/admin/deposits               → List all deposits in the system (filter: status)
```

| Status | Description |
|--------|-------------|
| `HELD` | On hold — can still be modified |
| `REFUNDED` | Refunded to the customer |
| `DEDUCTED` | Deducted due to damage or loss |

---

### 07 · Returns & Closing

```
POST   /api/rentals/:id/return                 → Record return (date, condition per item, notes)
POST   /api/rentals/:id/penalties              → Add a penalty
GET    /api/rentals/:id/penalties              → List all penalties for a rental
PATCH  /api/rentals/:id/penalties/:pid         → Update a penalty
DELETE /api/rentals/:id/penalties/:pid         → Remove a penalty

POST   /api/rentals/:id/invoice                → Generate Invoice (total = totalPrice + penalties)
GET    /api/rentals/:id/invoice                → Get Invoice for a rental
GET    /api/payments/invoices                  → List all Invoices (Admin)
GET    /api/invoices/:invoiceNo                → Get Invoice by Invoice No (Admin or owner)

PATCH  /api/rentals/:id/complete               → Close rental → COMPLETED
```

**Return Flow:**

```
ACTIVE / LATE → RETURNED → Inspect items + Add penalties → Generate Invoice → COMPLETED
```

**Item Conditions:** `GOOD` / `DAMAGED` / `LOST`

**Penalty Types:** `LATE` / `DAMAGE` / `LOST`

---

### 08 · Stock Reservations

```
GET    /api/admin/reservations              → List all reservations (filter: productVariantId)
GET    /api/admin/reservations/check        → Check stock availability by date range
GET    /api/rentals/:id/reservations        → List reservations for a specific rental
GET    /api/reservations/:id               → Get a single reservation
DELETE /api/reservations/:id               → Emergency delete reservation + release stock
```

---

### 09 · Users

```
GET    /api/users                           → List all users (Admin)
GET    /api/users/:id                       → Get user info (Admin or self)
POST   /api/auth/signUp                     → Create a new user
PUT    /api/users/:id                       → Update user info (Admin or self)
PATCH  /api/users/:id/password              → Change password (self only)
PATCH  /api/users/:id/role                  → Change role (Admin only — last Admin is protected)
DELETE /api/users/:id                       → Delete user (Admin only — cannot delete Admins)

GET    /api/users/me/rentals                → Rental history for the current user
GET    /api/users/:id/rentals               → Rental history for a specific user (Admin)

GET    /api/addresses                       → List all addresses in the system (Admin)
GET    /api/users/me/addresses              → Current user's addresses
GET    /api/users/:id/addresses             → A user's addresses (Admin)
POST   /api/users/me/addresses              → Add address for self
POST   /api/users/:id/addresses             → Add address for a user (Admin)
PUT    /api/users/me/addresses/:id          → Update own address
PUT    /api/users/:id/addresses/:id         → Update a user's address (Admin)
DELETE /api/users/me/addresses/:id          → Delete own address
DELETE /api/users/:id/addresses/:id         → Delete a user's address (Admin)
```

---

### 10 · Admin Tools

```
GET    /api/admin/dashboard           → System overview (stats, revenue, low-stock items < 3)
GET    /api/admin/revenue             → Monthly revenue for the last 12 months
GET    /api/admin/products/top        → Top N most-rented products
GET    /api/admin/rentals/overdue     → Overdue rentals + days overdue + estimated penalties
GET    /api/admin/audit               → Audit log entries (filter: action, userId)
POST   /api/admin/audit               → Create audit log entry (internal)
DELETE /api/admin/audit               → Delete old logs (specify beforeDate)
```

---

## 🖥️ Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Sign In | `/` | Login (ADMIN only) |
| Sign Up | `/signup` | Register |
| Dashboard | `/dashboard` | Main overview |
| Products | `/products` | Manage products, variants, images |
| Categories | `/categories` | Manage categories |
| Types | `/types` | Manage types |
| Sizes & Colors | `/sizes-colors` | Manage sizes and colors (combined page) |
| Rentals | `/rentals` | Manage all rentals |
| Returns | `/returns` | Record returns + penalties |
| Payments | `/payments` | Review and approve payment slips |
| Deposits | `/deposits` | Manage security deposits |
| Invoices | `/invoices` | Generate and view invoices |
| Promotions | `/promotions` | Manage promotions |
| Reservations | `/reservations` | View stock reservations + availability check |
| Reports | `/reports` | Reports |
| Audit Logs | `/audit` | Audit log |
| Users | `/users` | Manage users |

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
cd api
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Variables

Create a `.env` file in the `api/` folder:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dress_rental
SECRET_KEY=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
PORT=5000
```

Create a `config.js` file in the `frontend/` folder:

```js
export default {
  apiServer: "http://localhost:5000",
};
```

### Run

```bash
# Backend
cd api
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
