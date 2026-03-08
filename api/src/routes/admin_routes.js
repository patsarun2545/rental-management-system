const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin_controller");
const rentalController = require("../controllers/rental_controller");
const returnController = require("../controllers/return_controller");
const paymentController = require("../controllers/payment_controller");
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

// ============================================================
// INVOICES
// ============================================================
router.get("/invoices", paymentController.getAllInvoices);

// ============================================================
// AUDIT LOG
// ============================================================
router.get("/audit", adminController.getAuditLogs);
router.post("/audit", adminController.createAuditLog);
router.delete("/audit", adminController.clearAuditLogs);

module.exports = router;