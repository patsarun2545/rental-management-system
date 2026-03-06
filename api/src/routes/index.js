const express = require("express");
const router = express.Router();

const authRoutes = require("./auth_routes");
const userRoutes = require("./user_routes");
const catalogRoutes = require("./catalog_routes");
const productRoutes = require("./product_routes");
const rentalRoutes = require("./rental_routes");
const paymentRoutes = require("./payment_routes");
const cartRoutes = require("./cart_routes");
const wishlistRoutes = require("./wishlist_routes");
const promotionRoutes = require("./promotion_routes");
const adminRoutes = require("./admin_routes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);           // users + addresses
router.use("/catalog", catalogRoutes);      // /catalog/categories, /catalog/types
router.use("/products", productRoutes);     // products + variants + images
router.use("/rentals", rentalRoutes);       // rentals + items + confirm + return + deposit + invoice
router.use("/payments", paymentRoutes);     // payments + invoices list
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/promotions", promotionRoutes);
router.use("/admin", adminRoutes);          // dashboard + audit + reservations

module.exports = router;