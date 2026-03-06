const express = require("express");
const router = express.Router();

const promotionController = require("../controllers/promotion_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");
router.get("/", auth, promotionController.getAll);
router.get("/:id", auth, promotionController.getById);
router.post("/", auth, isAdmin, promotionController.create);
router.put("/:id", auth, isAdmin, promotionController.update);
router.delete("/:id", auth, isAdmin, promotionController.remove);

module.exports = router;
