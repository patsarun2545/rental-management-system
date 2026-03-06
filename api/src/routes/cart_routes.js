const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cart_controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, cartController.getMyCart);
router.post("/items", auth, cartController.addItem);
router.patch("/items/:itemId", auth, cartController.updateItem);
router.delete("/items/:itemId", auth, cartController.removeItem);
router.delete("/", auth, cartController.clearCart);

module.exports = router;
