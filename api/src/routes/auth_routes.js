const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth_controller");
const auth = require("../middlewares/auth.middleware");

router.post("/signUp", authController.signUp);
router.post("/signIn", authController.signIn);
router.post("/signOut", auth, authController.signOut);
router.get("/me", auth, authController.me);

module.exports = router;
