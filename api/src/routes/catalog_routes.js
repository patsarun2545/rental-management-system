const express = require("express");
const router = express.Router();

const catalogController = require("../controllers/catalog_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");
// ============================================================
// CATEGORY
// ============================================================
router.post("/categories", auth, isAdmin, catalogController.createCategory);
router.get("/categories", catalogController.getAllCategories);
router.get("/categories/:id", catalogController.getCategoryById);
router.put("/categories/:id", auth, isAdmin, catalogController.updateCategory);
router.delete(
  "/categories/:id",
  auth,
  isAdmin,
  catalogController.deleteCategory,
);

// ============================================================
// TYPE
// ============================================================
router.post("/types", auth, isAdmin, catalogController.createType);
router.get("/types", catalogController.getAllTypes);
router.get("/types/:id", catalogController.getTypeById);
router.put("/types/:id", auth, isAdmin, catalogController.updateType);
router.delete("/types/:id", auth, isAdmin, catalogController.deleteType);

// ============================================================
// SIZE
// ============================================================
router.post("/sizes", auth, isAdmin, catalogController.createSize);
router.get("/sizes", catalogController.getAllSizes);
router.get("/sizes/:id", catalogController.getSizeById);
router.put("/sizes/:id", auth, isAdmin, catalogController.updateSize);
router.delete("/sizes/:id", auth, isAdmin, catalogController.deleteSize);

// ============================================================
// COLOR
// ============================================================
router.post("/colors", auth, isAdmin, catalogController.createColor);
router.get("/colors", catalogController.getAllColors);
router.get("/colors/:id", catalogController.getColorById);
router.put("/colors/:id", auth, isAdmin, catalogController.updateColor);
router.delete("/colors/:id", auth, isAdmin, catalogController.deleteColor);

module.exports = router;