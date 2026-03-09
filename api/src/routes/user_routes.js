const express = require("express");
const router = express.Router();

const userController = require("../controllers/user_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");

// ============================================================
// ADDRESS (nested under /users)
// ============================================================
router.get("/me/addresses", auth, userController.getMyAddresses);
router.get("/me/addresses/:id", auth, userController.getMyAddressById);
router.post("/me/addresses", auth, userController.createAddress);
router.put("/me/addresses/:id", auth, userController.updateAddress);
router.delete("/me/addresses/:id", auth, userController.removeAddress);

// ============================================================
// USER
// ============================================================
router.get("/", auth, isAdmin, userController.getAll);
router.get("/me/rentals", auth, userController.getMyRentals);
router.get("/:id", auth, userController.getById);
router.get("/:id/rentals", auth, isAdmin, userController.getRentalsByUser);
router.put("/:id", auth, userController.update);
router.patch("/:id/password", auth, userController.changePassword);
router.patch("/:id/role", auth, isAdmin, userController.changeRole);
router.delete("/:id", auth, isAdmin, userController.remove);

// ============================================================
// ADDRESS by userId (Admin)
// ============================================================
router.get("/:userId/addresses", auth, isAdmin, userController.getAddressesByUser);
router.get("/:userId/addresses/:id", auth, isAdmin, userController.getAddressById);
router.post("/:userId/addresses", auth, isAdmin, userController.createAddressForUser);
router.put("/:userId/addresses/:id", auth, isAdmin, userController.updateAddressForUser);
router.delete("/:userId/addresses/:id", auth, isAdmin, userController.removeAddressForUser);

module.exports = router;