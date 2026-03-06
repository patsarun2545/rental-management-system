const express = require("express");
const router = express.Router();

const userController = require("../controllers/user_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");

// ============================================================
// ADDRESS (nested under /users)
// ============================================================
router.get("/me/addresses", auth, userController.getMyAddresses);
router.post("/me/addresses", auth, userController.createAddress);
router.put("/me/addresses/:id", auth, userController.updateAddress);
router.delete("/me/addresses/:id", auth, userController.removeAddress);

// ============================================================
// USER
// ============================================================
router.get("/", auth, isAdmin, userController.getAll);
router.get("/:id", auth, userController.getById);
router.put("/:id", auth, userController.update);
router.patch("/:id/password", auth, userController.changePassword);
router.patch("/:id/role", auth, isAdmin, userController.changeRole);
router.delete("/:id", auth, isAdmin, userController.remove);

// ============================================================
// ADDRESS by userId (Admin)
// ============================================================
router.get("/:userId/addresses", auth, isAdmin, userController.getAddressesByUser);
router.post("/:userId/addresses", auth, isAdmin, userController.createAddressForUser);

module.exports = router;