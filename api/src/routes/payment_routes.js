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
router.get("/invoices", auth, isAdmin, paymentController.getAllInvoices);
router.get("/invoices/:invoiceNo", auth, paymentController.getInvoiceByNo);
router.get("/rental/:rentalId", auth, paymentController.getByRentalId);
router.get("/:id", auth, paymentController.getById);
router.post("/", auth, upload.single("image"), paymentController.create);
router.patch("/:id/approve", auth, isAdmin, paymentController.approve);
router.patch("/:id/reject", auth, isAdmin, paymentController.reject);

module.exports = router;