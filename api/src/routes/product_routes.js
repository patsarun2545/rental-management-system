const express = require("express");
const router = express.Router();

const productController = require("../controllers/product_controller");
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/Isadmin.middleware");
const upload = require("../middlewares/upload.middleware");

// ============================================================
// PRODUCT
// ============================================================
router.post("/", auth, isAdmin, productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put("/:id", auth, isAdmin, productController.updateProduct);
router.delete("/:id", auth, isAdmin, productController.deleteProduct);
router.patch("/:id/status", auth, isAdmin, productController.toggleStatus);

// ============================================================
// VARIANT (nested under /products)
// ============================================================
router.post("/:productId/variants", auth, isAdmin, productController.createVariant);
router.get("/:productId/variants", productController.getVariantsByProduct);
router.get("/variants/:id", productController.getVariantById);
router.put("/variants/:id", auth, isAdmin, productController.updateVariant);
router.delete("/variants/:id", auth, isAdmin, productController.deleteVariant);
router.patch("/variants/:id/stock", auth, isAdmin, productController.updateStock);

// ============================================================
// IMAGES (nested under /products)
// ============================================================
router.post("/:productId/images", auth, isAdmin, upload.array("images", 10), productController.addImage);
router.get("/:productId/images", productController.getImagesByProduct);
router.patch("/images/:id/main", auth, isAdmin, productController.setMainImage);
router.put("/images/:id", auth, isAdmin, upload.single("image"), productController.updateImage);
router.delete("/images/:id", auth, isAdmin, productController.deleteImage);

module.exports = router;
