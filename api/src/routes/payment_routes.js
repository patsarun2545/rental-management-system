const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");
const upload = require("../middlewares/upload.middleware");

// ============================================================
// PAYMENT
// ============================================================
router.get("/", auth, isAdmin, paymentController.getAll);
router.get("/rental/:rentalId", auth, paymentController.getByRentalId);
router.post("/", auth, upload.single("image"), paymentController.create);
router.patch("/:id/approve", auth, isAdmin, paymentController.approve);
router.patch("/:id/reject", auth, isAdmin, paymentController.reject);

// ============================================================
// INVOICES LIST (Admin)
// ============================================================
router.get("/invoices", auth, isAdmin, paymentController.getAllInvoices);

module.exports = router;