const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin_controller");
const rentalController = require("../controllers/rental_controller");
const returnController = require("../controllers/return_controller");
const paymentController = require("../controllers/payment_controller");
const userController = require("../controllers/user_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");

// Admin only — apply middleware globally for this router
router.use(auth, isAdmin);

// ============================================================
// DASHBOARD & REPORTS
// ============================================================
router.get("/dashboard", adminController.getDashboard);
router.get("/rentals/overdue", adminController.getOverdueRentals);
router.get("/rentals/handled", rentalController.getHandledByMe);
router.get("/revenue", adminController.getRevenueReport);
router.get("/products/top", adminController.getTopProducts);

// ============================================================
// DEPOSITS
// ============================================================
router.get("/deposits", returnController.getAllDeposits);

// ============================================================
// PAYMENTS
// ============================================================
router.get("/payments", paymentController.getAll);

// ============================================================
// RESERVATIONS
// ============================================================
router.get("/reservations", rentalController.getAllReservations);
router.get("/reservations/check", rentalController.checkAvailability);
router.get("/reservations/:id", rentalController.getReservationById);
router.delete("/reservations/:id", rentalController.deleteReservation);

// ============================================================
// INVOICES
// ============================================================
router.get("/invoices", paymentController.getAllInvoices);

// ============================================================
// ADDRESSES
// ============================================================
router.get("/addresses", userController.getAllAddresses);

// ============================================================
// STAFF (Admin profiles & their rentals)
// ============================================================
router.get("/staff/:adminId", rentalController.getAdminById);
router.get("/staff/:adminId/rentals", rentalController.getRentalsByAdmin);

// ============================================================
// AUDIT LOG
// ============================================================
router.get("/audit", adminController.getAuditLogs);
router.post("/audit", adminController.createAuditLog);
router.delete("/audit", adminController.clearAuditLogs);

module.exports = router;