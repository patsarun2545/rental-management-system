const express = require("express");
const router = express.Router();

const rentalController = require("../controllers/rental_controller");
const returnController = require("../controllers/return_controller");
const paymentController = require("../controllers/payment_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");
// ============================================================
// RENTAL
// ============================================================
router.get("/", auth, rentalController.getAll);
router.get("/handled", auth, isAdmin, rentalController.getHandledByMe);
router.get("/:id", auth, rentalController.getById);
router.post("/", auth, rentalController.create);
router.patch("/:id/status", auth, isAdmin, rentalController.updateStatus);
router.patch("/:id/cancel", auth, rentalController.cancel);
router.patch("/:id/complete", auth, isAdmin, rentalController.complete);

// ============================================================
// RENTAL ITEMS
// ============================================================
router.get("/:rentalId/items", auth, rentalController.getItems);
router.post("/:rentalId/items", auth, isAdmin, rentalController.addItem);
router.patch("/:rentalId/items/:itemId", auth, isAdmin, rentalController.updateItem);
router.delete("/:rentalId/items/:itemId", auth, isAdmin, rentalController.removeItem);

// ============================================================
// STOCK RESERVATION
// ============================================================
router.post("/:id/confirm", auth, isAdmin, rentalController.confirmAndReserve);
router.patch("/:id/activate", auth, isAdmin, rentalController.activate);

// ============================================================
// RETURN & PENALTY
// ============================================================
router.post("/:id/return", auth, isAdmin, returnController.processReturn);
router.post("/:id/penalties", auth, isAdmin, returnController.addPenalty);
router.get("/:id/penalties", auth, returnController.getPenalties);

// ============================================================
// DEPOSIT
// ============================================================
router.get("/:rentalId/deposit", auth, returnController.getDepositByRental);
router.post("/:rentalId/deposit", auth, isAdmin, returnController.createDeposit);
router.patch("/:id/deposit/refund", auth, isAdmin, returnController.refundDeposit);
router.patch("/:rentalId/deposit/deduct", auth, isAdmin, returnController.deductDeposit);

// ============================================================
// INVOICE
// ============================================================
router.post("/:id/invoice", auth, isAdmin, paymentController.createInvoice);
router.get("/:id/invoice", auth, paymentController.getInvoiceByRentalId);

// ============================================================
// PAYMENT HISTORY
// ============================================================
router.get("/:rentalId/payments", auth, paymentController.getByRentalId);

module.exports = router;