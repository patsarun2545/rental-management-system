const express = require("express");
const router = express.Router();

const wishlistController = require("../controllers/wishlist_controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, wishlistController.getMyWishlist);
router.get("/check/:productId", auth, wishlistController.check);
router.post("/", auth, wishlistController.add);
router.delete("/:productId", auth, wishlistController.remove);

module.exports = router;
