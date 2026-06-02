# 🧾 Rental Management System

[![Live Demo](https://img.shields.io/badge/Live-Demo-000?style=flat-square&logo=vercel&logoColor=white)](https://rental-management-system-blush.vercel.app/)

A full-stack rental management system for dress/costume rentals built with React 19, Express.js, and PostgreSQL — featuring inventory management, rental lifecycle tracking, payment processing, deposit handling, and comprehensive admin reporting.

---

## 🛠️ Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | React 19, Express.js                    |
| Frontend   | React 19, Vite, React Router DOM, Axios |
| Backend    | Node.js, Express.js                     |
| Runtime    | Node.js                                 |
| Database   | PostgreSQL, Prisma ORM                  |
| Auth       | JWT (jsonwebtoken), bcryptjs, RBAC      |
| Storage    | Multer (local file upload)              |
| Validation | Manual validation (regex patterns)      |
| Caching    | None                                    |
| UI Extras  | SweetAlert2, Chart.js, react-chartjs-2  |
| Tools      | TypeScript, ESLint, Nodemon             |

---

## ✨ Features Overview

- Role-based access control (RBAC) with ADMIN and USER roles
- Authentication system with JWT tokens (4-hour expiration) stored in cookies and localStorage
- User management with profile editing, password changes, and address management
- Product catalog with categories, types, sizes, and colors
- Product management with variants, images, and soft-delete functionality
- Full rental lifecycle management (PENDING → CONFIRMED → ACTIVE → RETURNED → COMPLETED)
- Stock reservation system to prevent double-booking
- Payment slip upload with admin approval/rejection workflow
- Deposit management (create, adjust, refund, deduct)
- Penalty tracking for late returns, damage, and lost items
- Return logging with item condition tracking
- Auto-generated invoices (format: INV-YYYYMMDD-XXXX)
- Cart and wishlist functionality
- Promotion/discount management
- Admin dashboard with revenue charts, top products, and overdue rentals
- Audit log for tracking admin actions
- Race condition prevention using PostgreSQL row-level locks

---

## 📁 Project Structure

```
rental/
├── api/                                    # Backend (Express.js + TypeScript)
│   ├── prisma/
│   │   ├── schema.prisma                   # Prisma schema with all models
│   │   └── migrations/                     # Database migrations
│   ├── src/
│   │   ├── assets/uploads/                 # Uploaded images (payment slips, product images)
│   │   ├── controllers/
│   │   │   ├── admin_controller.js         # Dashboard, reports, audit logs, staff management
│   │   │   ├── auth_controller.js          # Sign up, sign in, sign out, me endpoint
│   │   │   ├── cart_controller.js          # Cart CRUD operations
│   │   │   ├── catalog_controller.js      # Categories, types, sizes, colors management
│   │   │   ├── payment_controller.js      # Payments, invoices, approval workflow
│   │   │   ├── product_controller.js      # Products, variants, images with soft-delete
│   │   │   ├── promotion_controller.js    # Promotion/discount management
│   │   │   ├── rental_controller.js       # Rentals, items, reservations, status transitions
│   │   │   ├── return_controller.js       # Returns, penalties, deposit operations
│   │   │   ├── user_controller.js         # Users, addresses, role management
│   │   │   └── wishlist_controller.js     # Wishlist operations
│   │   ├── lib/
│   │   │   └── client.js                  # Prisma client singleton
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js         # JWT validation (cookie + bearer token)
│   │   │   ├── cors.middleware.js         # CORS configuration
│   │   │   ├── Isadmin.middleware.js      # Admin role check
│   │   │   └── upload.middleware.js       # Multer file upload (images, max 5MB)
│   │   ├── routes/
│   │   │   ├── index.js                   # Main router aggregation
│   │   │   ├── admin_routes.js            # Admin endpoints (dashboard, audit, reservations)
│   │   │   ├── auth_routes.js             # Authentication endpoints
│   │   │   ├── cart_routes.js             # Cart endpoints
│   │   │   ├── catalog_routes.js          # Catalog endpoints (categories, types, sizes, colors)
│   │   │   ├── payment_routes.js          # Payment and invoice endpoints
│   │   │   ├── product_routes.js          # Product, variant, and image endpoints
│   │   │   ├── promotion_routes.js        # Promotion endpoints
│   │   │   ├── rental_routes.js           # Rental, item, and reservation endpoints
│   │   │   ├── user_routes.js             # User and address endpoints
│   │   │   └── wishlist_routes.js         # Wishlist endpoints
│   │   ├── utils/
│   │   │   └── response.utils.js          # Standardized API response helper
│   │   └── app.js                         # Express app configuration
│   ├── .env                               # Environment variables (gitignored)
│   ├── package.json                       # Backend dependencies
│   ├── prisma.config.ts                   # Prisma configuration
│   ├── server.js                          # Server entry point
│   └── tsconfig.json                      # TypeScript configuration
│
└── app/                                    # Frontend (React 19 + Vite)
    ├── public/                             # Static assets
    ├── src/
    │   ├── assets/                         # Frontend assets
    │   ├── components/
    │   │   ├── AuthGuard.jsx               # Route guard - ADMIN role only
    │   │   ├── Footer.jsx                  # Footer component
    │   │   ├── MyModal.jsx                 # Reusable modal component
    │   │   ├── Navbar.jsx                  # Top navbar with current path
    │   │   ├── Sidebar.jsx                 # Sidebar navigation with profile/password/address modals
    │   │   └── Wrapper.jsx                 # Main content wrapper
    │   ├── context/
    │   │   └── AuthContext.jsx             # JWT auth state management (localStorage)
    │   ├── layouts/
    │   │   └── BaseLayout.jsx              # Base layout with Navbar and Sidebar
    │   ├── pages/
    │   │   ├── AuditLogs.jsx               # Audit log viewer
    │   │   ├── Categories.jsx              # Category management
    │   │   ├── Dashboard.jsx               # Admin dashboard with charts
    │   │   ├── Deposits.jsx                # Deposit management
    │   │   ├── Invoices.jsx                # Invoice generation and viewing
    │   │   ├── Payments.jsx                # Payment slip review and approval
    │   │   ├── Products.jsx                # Product, variant, and image management
    │   │   ├── Promotions.jsx              # Promotion management
    │   │   ├── Rentals.jsx                 # Rental management and status updates
    │   │   ├── Reports.jsx                 # Revenue and rental reports
    │   │   ├── Reservations.jsx            # Stock reservation viewer
    │   │   ├── Returns.jsx                 # Return processing and penalty management
    │   │   ├── Signin.jsx                  # Sign in page
    │   │   ├── Signup.jsx                  # Sign up page
    │   │   ├── Sizescolors.jsx             # Sizes and colors management
    │   │   ├── Types.jsx                   # Type management
    │   │   └── Users.jsx                   # User management
    │   ├── services/
    │   │   └── axios.js                    # Axios instance with Bearer token interceptor
    │   ├── utils/
    │   │   ├── alert.utils.jsx             # SweetAlert2 wrapper functions
    │   │   └── image.utils.jsx             # Image URL helper
    │   ├── App.jsx                         # React Router configuration
    │   ├── App.css                         # Global styles
    │   ├── index.css                       # Base styles
    │   └── main.jsx                        # React entry point
    ├── .env                                # Environment variables (gitignored)
    ├── config.js                           # API server configuration
    ├── index.html                          # HTML template
    ├── package.json                        # Frontend dependencies
    ├── vite.config.js                      # Vite configuration
    └── vercel.json                         # Vercel deployment configuration
```

---

## 🗃️ Database Schema

| Model              | Description                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`             | User accounts with email, password (bcrypt hashed), name, phone, and role (USER/ADMIN)                                                       |
| `Address`          | User addresses linked to User model                                                                                                          |
| `Category`         | Product categories (e.g., dresses, costumes)                                                                                                 |
| `Type`             | Product types linked to categories (unique name per category)                                                                                |
| `Size`             | Product sizes (e.g., S, M, L, XL)                                                                                                            |
| `Color`            | Product colors with hex codes                                                                                                                |
| `Product`          | Products with name, description, brand, price, status (ACTIVE/INACTIVE), soft-delete support                                                 |
| `ProductVariant`   | Product variants combining product, size, color with price, stock, and unique SKU                                                            |
| `ProductImage`     | Product images with main image flag                                                                                                          |
| `Rental`           | Rental records with code, dates, status (PENDING/CONFIRMED/ACTIVE/RETURNED/LATE/CANCELLED/COMPLETED), payment status, pricing, and promotion |
| `RentalItem`       | Items within a rental linking to product variants with quantity                                                                              |
| `Payment`          | Payment records with amount, slip image URL, type (RENTAL/DEPOSIT/PENALTY), and status (PENDING/APPROVED/REJECTED)                           |
| `Invoice`          | Auto-generated invoices with unique invoice number and total amount                                                                          |
| `Deposit`          | Security deposits with amount and status (HELD/REFUNDED/DEDUCTED)                                                                            |
| `Penalty`          | Penalty records for late returns, damage, or lost items                                                                                      |
| `ReturnLog`        | Return records with date, condition (GOOD/DAMAGED/LOST), and notes                                                                           |
| `StockReservation` | Stock reservations preventing double-booking with date ranges                                                                                |
| `Cart`             | User shopping carts                                                                                                                          |
| `CartItem`         | Items in user carts                                                                                                                          |
| `Wishlist`         | User wishlists linking users to products                                                                                                     |
| `Promotion`        | Promotions with discount percentage and date ranges                                                                                          |
| `AuditLog`         | Audit trail recording admin actions with timestamps                                                                                          |

---

## 🔄 System Flow

### 01 · Authentication

```
Sign Up → Create User (role: USER) → Sign In → JWT Token (4h expiry) → Access Protected Routes
```

- Users can sign up with email, password, name, and phone (optional)
- Password validation: minimum 8 characters, at least 1 uppercase letter, 1 number
- Email format validation with regex
- Phone format validation (Thai format: 0XXXXXXXXX)
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens stored in httpOnly cookies and localStorage
- Token sent via Authorization: Bearer header on API requests
- Automatic redirect to sign-in on 401 responses

**User Roles:**
| Role | Description |
|------|-------------|
| `USER` | Standard user (can be promoted to ADMIN) |
| `ADMIN` | Administrator with full system access |

---

### 02 · Master Data Management

```
Create Categories → Create Types (per Category) → Create Sizes → Create Colors → Create Products → Add Variants → Upload Images
```

- Categories cannot be deleted if linked to types or products
- Types are unique within each category
- Sizes and colors cannot be deleted if used by variants
- Products support soft-delete (isDeleted flag) and can be restored
- Product variants combine product, size, and color with unique SKU
- Multiple images per product with main image flag
- Stock management at variant level

**Product Status:**
| Status | Description |
|--------|-------------|
| `ACTIVE` | Available for rental |
| `INACTIVE` | Not available for rental |

---

### 03 · Rental Creation Flow

```
Select Customer → Choose Date Range → Add Items (Variant + Quantity) → Set Deposit & Late Fee → Apply Promotion → Create Rental → Auto-generate Code & Stock Reservation
```

- Admin selects customer from user list (role: USER)
- Date range validation with stock availability check
- Multiple items per rental with quantity
- Optional deposit amount and late fee per day
- Promotion application for discounts
- Auto-generated unique rental code
- Automatic stock reservation creation
- Admin assigned as handler

---

### 04 · Rental Status Transitions

```
PENDING → CONFIRMED → ACTIVE → RETURNED → COMPLETED
         ↓
      CANCELLED
         ↓
          LATE (if past endDate)
```

| Status      | Description                        | Transitions            |
| ----------- | ---------------------------------- | ---------------------- |
| `PENDING`   | Awaiting admin confirmation        | → CONFIRMED, CANCELLED |
| `CONFIRMED` | Admin confirmed, stock reserved    | → ACTIVE               |
| `ACTIVE`    | Customer has received items        | → RETURNED, LATE       |
| `RETURNED`  | Items returned by customer         | → COMPLETED            |
| `COMPLETED` | Rental closed successfully         | -                      |
| `LATE`      | Past endDate, not returned         | → RETURNED             |
| `CANCELLED` | Cancelled by admin, stock released | -                      |

**Payment Status:**
| Status | Description |
|--------|-------------|
| `PENDING` | Payment awaiting approval |
| `APPROVED` | Payment approved |
| `REJECTED` | Payment rejected |

---

### 05 · Payment Processing

```
Customer Uploads Slip → Admin Reviews → Approve/Reject → Update Rental Payment Status
```

- Payment types: RENTAL, DEPOSIT, PENALTY
- Slip upload via multipart/form-data
- Admin approval uses row-level locks to prevent race conditions
- RENTAL payment approval sets rental paymentStatus to APPROVED when fully paid
- DEPOSIT payment approval creates Deposit record
- PENALTY payments for additional charges

**Payment Types:**
| Type | Description |
|------|-------------|
| `RENTAL` | Rental fee payment |
| `DEPOSIT` | Security deposit payment |
| `PENALTY` | Penalty/fine payment |

---

### 06 · Deposit Management

```
Create Deposit → Hold Amount → Adjust (if HELD) → Refund/Deduct → Update Status
```

- Deposit created per rental
- Status: HELD (modifiable), REFUNDED (refunded to customer), DEDUCTED (deducted due to damage/loss)
- Partial refunds supported
- Deductions for damage or loss scenarios

**Deposit Status:**
| Status | Description |
|--------|-------------|
| `HELD` | Deposit on hold, can be modified |
| `REFUNDED` | Deposit refunded to customer |
| `DEDUCTED` | Deposit deducted due to issues |

---

### 07 · Return & Penalty Flow

```
Record Return → Inspect Items → Add Penalties (if needed) → Generate Invoice → Complete Rental
```

- Return date and condition per item
- Item conditions: GOOD, DAMAGED, LOST
- Penalty types: LATE (per day), DAMAGE, LOST
- Multiple penalties per rental
- Invoice generation (total = rental price + penalties)
- Final completion closes rental

**Item Conditions:**
| Condition | Description |
|-----------|-------------|
| `GOOD` | Returned in good condition |
| `DAMAGED` | Returned with damage |
| `LOST` | Item not returned |

**Penalty Types:**
| Type | Description |
|------|-------------|
| `LATE` | Late return penalty |
| `DAMAGE` | Damage penalty |
| `LOST` | Lost item penalty |

---

### 08 · Stock Reservation System

```
Rental Created → Check Availability → Reserve Stock → Release on Cancel/Complete
```

- Reservations prevent double-booking
- Date-range based availability checking
- Automatic stock release on cancellation or completion
- Emergency reservation deletion available
- Filterable by product variant

---

### 09 · User & Address Management

```
Create User → Add Addresses → Update Profile → Change Password → Manage Role (Admin only)
```

- Users can manage own profile and addresses
- Admins can manage all users and addresses
- Role changes restricted (last admin protected)
- Admin deletion restricted (cannot delete admins)
- Password changes self-only

---

### 10 · Admin Dashboard & Reporting

```
Dashboard Overview → Revenue Charts → Top Products → Overdue Rentals → Audit Logs
```

- System statistics (total rentals, revenue, active rentals)
- Monthly revenue for last 12 months
- Top N most-rented products
- Overdue rentals with days overdue and estimated penalties
- Low stock items (< 3 units)
- Audit log filtering by action and user
- Audit log cleanup by date

---

## Caching Strategy

| Tag pattern | Scope | Revalidated on |
| ----------- | ----- | -------------- |
| None        | None  | None           |

**Note:** This application does not implement caching. All data is fetched directly from the database.

---

## 🔐 Security

- JWT authentication with 4-hour token expiration
- bcrypt password hashing (12 rounds)
- Role-based access control (RBAC) with ADMIN and USER roles
- HTTP-only cookies for token storage
- CORS configuration with credentials support
- File upload validation (JPEG, PNG, WEBP only, max 5MB)
- Manual input validation with regex patterns (email, phone, password)
- SQL injection prevention via Prisma ORM
- Admin-only route protection via middleware
- Last admin protection (cannot delete or demote last admin)
- Admin deletion restriction (cannot delete admin users)
- Automatic token expiration handling
- 401 automatic redirect to sign-in

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/patsarun2545/Rental-Management-System-react-node-express-prisma-postgresql-bootstrap-5.git
cd rental

# Install backend dependencies
cd api
npm install

# Install frontend dependencies
cd ../app
npm install
```

### Environment Variables

Create a `.env` file in the `api/` directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/rental_db
SECRET_KEY=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
PORT=5000
```

Create a `.env` file in the `app/` directory:

```env
VITE_API_SERVER=http://localhost:5000
```

### Database Setup

```bash
# Navigate to api directory
cd api

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### Run Development Servers

```bash
# Backend (in api directory)
cd api
node server.js

# Frontend (in app directory)
cd app
npm run dev
```

The backend will run on `http://localhost:5000` and the frontend on `http://localhost:5173`.

---

## 👤 Author

**Patsarun Kathinthong**  
Full Stack Developer · PERN Stack  
📧 patsarun2545@gmail.com  
🔗 github.com/patsarun2545
