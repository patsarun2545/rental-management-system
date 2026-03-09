const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const fs = require("fs");
const path = require("path");

// Helper: ลบไฟล์รูปออกจาก disk (silent fail ถ้าไม่เจอไฟล์)
const deleteImageFile = (imageUrl) => {
  try {
    const filePath = path.join(__dirname, "../assets", imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
};

// ============================================================
// PRODUCT
// ============================================================

module.exports = {
  // POST /products
  createProduct: async (req, res) => {
    try {
      const {
        name,
        description,
        brand,
        price,
        categoryId,
        typeId,
        status = "ACTIVE",
        variants = [],
        images = [],
      } = req.body;

      if (!name || !categoryId || !typeId) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      if (price !== undefined && isNaN(Number(price))) {
        return response.error(res, 400, "price ต้องเป็นตัวเลข");
      }

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return response.error(res, 400, "status ต้องเป็น ACTIVE หรือ INACTIVE");
      }

      if (!Array.isArray(variants)) return response.error(res, 400, "variants ต้องเป็น array");
      if (!Array.isArray(images)) return response.error(res, 400, "images ต้องเป็น array");

      const category = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
      if (!category) return response.error(res, 404, "ไม่พบหมวดหมู่");

      const type = await prisma.type.findUnique({ where: { id: Number(typeId) } });
      if (!type || type.categoryId !== Number(categoryId)) {
        return response.error(res, 400, "type ไม่อยู่ในหมวดหมู่ที่เลือก");
      }

      const combinationSet = new Set();
      for (const v of variants) {
        if (!v.sizeId || !v.colorId || !v.sku) {
          return response.error(res, 400, "ข้อมูล variant ไม่ครบ");
        }
        if (isNaN(Number(v.price)) || isNaN(Number(v.stock ?? 0))) {
          return response.error(res, 400, "price/stock ของ variant ต้องเป็นตัวเลข");
        }
        const key = `${v.sizeId}-${v.colorId}`;
        if (combinationSet.has(key)) return response.error(res, 400, "มี size + color ซ้ำกันใน variants");
        combinationSet.add(key);

        const size = await prisma.size.findUnique({ where: { id: Number(v.sizeId) } });
        if (!size) return response.error(res, 404, `ไม่พบ size id ${v.sizeId}`);

        const color = await prisma.color.findUnique({ where: { id: Number(v.colorId) } });
        if (!color) return response.error(res, 404, `ไม่พบ color id ${v.colorId}`);

        const existSku = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
        if (existSku) return response.error(res, 400, `SKU ${v.sku} ถูกใช้แล้ว`);
      }

      const product = await prisma.$transaction(async (tx) => {
        return await tx.product.create({
          data: {
            name, description, brand,
            price: price !== undefined ? Number(price) : null,
            categoryId: Number(categoryId),
            typeId: Number(typeId),
            status,
            variants: variants.length
              ? {
                  create: variants.map((v) => ({
                    sizeId: Number(v.sizeId),
                    colorId: Number(v.colorId),
                    price: Number(v.price),
                    stock: Number(v.stock ?? 0),
                    sku: v.sku,
                  })),
                }
              : undefined,
            images: images.length
              ? { create: images.map((img, i) => ({ imageUrl: img, isMain: i === 0 })) }
              : undefined,
          },
          include: { variants: true, images: true },
        });
      });

      return response.success(res, 201, "เพิ่มสินค้าสำเร็จ", product);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ข้อมูลซ้ำในระบบ");
      return response.error(res, 500, e.message);
    }
  },

  // GET /products
  getAllProducts: async (req, res) => {
    try {
      const {
        search, categoryId, typeId, minPrice, maxPrice,
        status, page = 1, limit = 10, sort = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      let priceFilter;
      if (minPrice || maxPrice) {
        priceFilter = {
          not: null,
          gte: minPrice ? Number(minPrice) : undefined,
          lte: maxPrice ? Number(maxPrice) : undefined,
        };
      }

      const where = {
        isDeleted: false,
        status: status === "" ? undefined : (status || "ACTIVE"),
        name: search ? { contains: search, mode: "insensitive" } : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        typeId: typeId ? Number(typeId) : undefined,
        price: priceFilter,
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            type: true,
            variants: { include: { size: true, color: true } },
            images: { where: { isMain: true }, take: 1 },
          },
          orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.product.count({ where }),
      ]);

      return response.success(res, 200, "ข้อมูลสินค้า", {
        data: products, total, page: Number(page), limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:id
  getProductById: async (req, res) => {
    try {
      const product = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
        include: {
          category: true,
          type: true,
          variants: { include: { size: true, color: true } },
          images: true,
        },
      });

      if (!product) return response.error(res, 404, "ไม่พบสินค้า");
      return response.success(res, 200, "ข้อมูลสินค้า", product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /products/:id
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, brand, price, categoryId, typeId, status } = req.body;

      const existing = await prisma.product.findFirst({
        where: { id: Number(id), isDeleted: false },
      });
      if (!existing) return response.error(res, 404, "ไม่พบสินค้า");

      if (price !== undefined && isNaN(Number(price))) {
        return response.error(res, 400, "price ต้องเป็นตัวเลข");
      }

      if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
        return response.error(res, 400, "status ต้องเป็น ACTIVE หรือ INACTIVE");
      }

      if (categoryId && typeId) {
        const type = await prisma.type.findUnique({ where: { id: Number(typeId) } });
        if (!type || type.categoryId !== Number(categoryId)) {
          return response.error(res, 400, "category / type ไม่สัมพันธ์กัน");
        }
      }

      const product = await prisma.product.update({
        where: { id: Number(id) },
        data: {
          name, description, brand,
          price: price !== undefined ? Number(price) : undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          typeId: typeId ? Number(typeId) : undefined,
          status: status || undefined,
        },
      });

      return response.success(res, 200, "แก้ไขข้อมูลสินค้า", product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /products/:id/toggle-status
  toggleStatus: async (req, res) => {
    try {
      const existing = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
      });
      if (!existing) return response.error(res, 404, "ไม่พบสินค้า");

      const newStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const product = await prisma.product.update({
        where: { id: Number(req.params.id) },
        data: { status: newStatus },
      });

      return response.success(res, 200, `เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ`, product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /products/:id
  deleteProduct: async (req, res) => {
    try {
      const existing = await prisma.product.findFirst({
        where: { id: Number(req.params.id), isDeleted: false },
        include: { variants: true },
      });
      if (!existing) return response.error(res, 404, "ไม่พบสินค้า");

      const usedInRental = await prisma.rentalItem.findFirst({
        where: { variant: { productId: Number(req.params.id) } },
      });
      if (usedInRental) {
        return response.error(res, 400, "ไม่สามารถลบสินค้าได้ เพราะมีการเช่าอยู่");
      }

      await prisma.product.update({
        where: { id: Number(req.params.id) },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      return response.success(res, 200, "ลบข้อมูลสินค้าแล้ว");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /products/:id/restore — Admin: กู้คืนสินค้าที่ถูก soft-delete
  restoreProduct: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const existing = await prisma.product.findFirst({
        where: { id, isDeleted: true },
      });
      if (!existing) {
        return response.error(res, 404, "ไม่พบสินค้าที่ถูกลบ");
      }

      const product = await prisma.product.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, status: "INACTIVE" },
        include: { variants: true, images: true, category: true, type: true },
      });

      return response.success(res, 200, "กู้คืนสินค้าสำเร็จ (status: INACTIVE — กรุณาเปิดใช้งานเอง)", product);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/deleted — Admin: ดูรายการสินค้าที่ถูก soft-delete
  getDeletedProducts: async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: { isDeleted: true },
          include: {
            category: true,
            type: true,
            images: { where: { isMain: true }, take: 1 },
          },
          orderBy: { deletedAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.product.count({ where: { isDeleted: true } }),
      ]);

      return response.success(res, 200, "สินค้าที่ถูกลบ", {
        data: products, total, page: Number(page), limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // VARIANT (sub-resource of Product)
  // ============================================================

  // POST /products/:productId/variants
  createVariant: async (req, res) => {
    try {
      let { sizeId, colorId, size, color, colorHex, price, stock, sku } = req.body;
      const productId = Number(req.params.productId);

      price = Number(price);
      stock = stock !== undefined ? Number(stock) : 0;
      sku = sku?.trim();

      if (!productId || isNaN(price) || !sku) return response.error(res, 400, "ข้อมูลไม่ครบ");
      if (price < 0 || stock < 0) return response.error(res, 400, "price และ stock ต้อง >= 0");

      const product = await prisma.product.findFirst({ where: { id: productId, isDeleted: false } });
      if (!product) return response.error(res, 404, "ไม่พบสินค้า");

      let sizeRecord;
      if (sizeId) {
        sizeRecord = await prisma.size.findUnique({ where: { id: Number(sizeId) } });
        if (!sizeRecord) return response.error(res, 404, "ไม่พบ size");
      } else if (size) {
        sizeRecord = await prisma.size.upsert({
          where: { name: size.trim() },
          update: {},
          create: { name: size.trim() },
        });
      } else {
        return response.error(res, 400, "ต้องระบุ sizeId หรือ size");
      }

      let colorRecord;
      if (colorId) {
        colorRecord = await prisma.color.findUnique({ where: { id: Number(colorId) } });
        if (!colorRecord) return response.error(res, 404, "ไม่พบ color");
      } else if (color) {
        colorRecord = await prisma.color.upsert({
          where: { name: color.trim() },
          update: colorHex ? { hex: colorHex } : {},
          create: { name: color.trim(), hex: colorHex || null },
        });
      } else {
        return response.error(res, 400, "ต้องระบุ colorId หรือ color");
      }

      const existSku = await prisma.productVariant.findUnique({ where: { sku } });
      if (existSku) return response.error(res, 400, "SKU นี้ถูกใช้แล้ว");

      const existVariant = await prisma.productVariant.findFirst({
        where: { productId, sizeId: sizeRecord.id, colorId: colorRecord.id },
      });
      if (existVariant) return response.error(res, 400, "variant นี้มีอยู่แล้ว");

      const variant = await prisma.productVariant.create({
        data: { productId, sizeId: sizeRecord.id, colorId: colorRecord.id, price, stock, sku },
        include: { product: true, size: true, color: true },
      });

      return response.success(res, 201, "เพิ่ม variant สำเร็จ", variant);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:productId/variants
  getVariantsByProduct: async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      if (!productId || isNaN(productId)) return response.error(res, 400, "productId ไม่ถูกต้อง");

      const variants = await prisma.productVariant.findMany({
        where: { productId },
        include: { size: true, color: true },
        orderBy: { id: "desc" },
      });

      return response.success(res, 200, "ข้อมูล variants", variants);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /variants/:id
  getVariantById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id ไม่ถูกต้อง");

      const variant = await prisma.productVariant.findUnique({
        where: { id },
        include: { product: true, size: true, color: true },
      });

      if (!variant) return response.error(res, 404, "ไม่พบ variant");
      return response.success(res, 200, "ข้อมูล variant", variant);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /variants/:id
  updateVariant: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id ไม่ถูกต้อง");

      let { price, stock, sku } = req.body;

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "ไม่พบ variant");

      const data = {};

      if (price !== undefined) {
        price = Number(price);
        if (isNaN(price) || price < 0) return response.error(res, 400, "price ต้องมากกว่าหรือเท่ากับ 0");
        data.price = price;
      }

      if (stock !== undefined) {
        stock = Number(stock);
        if (isNaN(stock) || stock < 0) return response.error(res, 400, "stock ต้องมากกว่าหรือเท่ากับ 0");
        data.stock = stock;
      }

      if (sku !== undefined) {
        sku = sku.trim();
        const existSku = await prisma.productVariant.findFirst({ where: { sku, NOT: { id } } });
        if (existSku) return response.error(res, 400, "SKU นี้ถูกใช้แล้ว");
        data.sku = sku;
      }

      const updated = await prisma.productVariant.update({
        where: { id },
        data,
        include: { size: true, color: true },
      });

      return response.success(res, 200, "แก้ไขข้อมูล variant สำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /variants/:id/stock
  updateStock: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id ไม่ถูกต้อง");

      let { stock } = req.body;
      stock = Number(stock);
      if (isNaN(stock) || stock < 0) return response.error(res, 400, "stock ต้องมากกว่าหรือเท่ากับ 0");

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "ไม่พบ variant");

      // ตรวจว่า stock ใหม่ไม่น้อยกว่าจำนวนที่ reserve ไว้ในการเช่าที่ยัง active
      // (stock ปัจจุบันสะท้อน available stock หลัง reserve แล้ว — ห้ามตั้งต่ำกว่า 0)
      // นับ rentalItem ที่ยัง active/confirmed เพื่อเทียบ
      const reservedQty = await prisma.rentalItem.aggregate({
        where: {
          productVariantId: id,
          rental: { status: { in: ["CONFIRMED", "ACTIVE", "LATE"] } },
        },
        _sum: { quantity: true },
      });
      const reserved = reservedQty._sum.quantity || 0;

      // stock จริงทั้งหมด = stock ปัจจุบัน (available) + reserved
      // stock ใหม่ต้องไม่น้อยกว่า reserved
      const currentTotal = variant.stock + reserved;
      if (stock > currentTotal) {
        // อนุญาตให้ตั้งสูงกว่าเดิมได้ปกติ
      }
      if (stock < reserved) {
        return response.error(
          res,
          400,
          `ไม่สามารถตั้ง stock ต่ำกว่าจำนวนที่จองไว้ (${reserved} ชิ้น)`,
        );
      }

      // เก็บเป็น available stock (total - reserved)
      const newAvailable = stock - reserved;
      const updated = await prisma.productVariant.update({ where: { id }, data: { stock: newAvailable } });
      return response.success(res, 200, "แก้ไข stock สำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /variants/:id
  deleteVariant: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) return response.error(res, 400, "id ไม่ถูกต้อง");

      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) return response.error(res, 404, "ไม่พบ variant");

      const [usedInRental, usedInCart, usedInReservation] = await Promise.all([
        prisma.rentalItem.findFirst({ where: { productVariantId: id } }),
        prisma.cartItem.findFirst({ where: { productVariantId: id } }),
        prisma.stockReservation.findFirst({ where: { productVariantId: id } }),
      ]);

      if (usedInRental || usedInCart || usedInReservation) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจาก variant มีการใช้งานอยู่");
      }

      await prisma.productVariant.delete({ where: { id } });
      return response.success(res, 200, "ลบ variant สำเร็จ");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // PRODUCT IMAGE (sub-resource of Product)
  // ============================================================

  // POST /products/:productId/images — รับได้หลายรูปพร้อมกัน (multipart field: "images")
  addImage: async (req, res) => {
    try {
      const productId = Number(req.params.productId);

      if (!req.files || req.files.length === 0) {
        return response.error(res, 400, "กรุณาอัปโหลดไฟล์รูปภาพอย่างน้อย 1 ไฟล์");
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, isDeleted: false },
      });

      if (!product) {
        // ลบไฟล์ที่อัปโหลดมาแล้วทิ้ง เพราะสินค้าไม่มีจริง
        req.files.forEach((f) => deleteImageFile(`/uploads/${f.filename}`));
        return response.error(res, 404, "ไม่พบสินค้า");
      }

      // ตรวจว่ามีรูปหลักอยู่แล้วหรือยัง
      const hasMain = await prisma.productImage.findFirst({
        where: { productId, isMain: true },
      });

      const images = await prisma.productImage.createMany({
        data: req.files.map((f, i) => ({
          productId,
          imageUrl: `/uploads/${f.filename}`,
          // ถ้ายังไม่มีรูปหลัก → รูปแรกที่อัปโหลดเป็น main อัตโนมัติ
          isMain: !hasMain && i === 0,
        })),
      });

      const created = await prisma.productImage.findMany({
        where: { productId },
        orderBy: [{ isMain: "desc" }, { id: "asc" }],
      });

      return response.success(res, 201, `อัปโหลด ${req.files.length} รูปสำเร็จ`, created);
    } catch (e) {
      // cleanup ไฟล์ที่อัปโหลดมาแล้วถ้า error
      if (req.files) req.files.forEach((f) => deleteImageFile(`/uploads/${f.filename}`));
      return response.error(res, 500, e.message);
    }
  },

  // GET /products/:productId/images
  getImagesByProduct: async (req, res) => {
    try {
      const images = await prisma.productImage.findMany({
        where: { productId: Number(req.params.productId) },
        orderBy: [{ isMain: "desc" }, { id: "asc" }],
      });
      return response.success(res, 200, "ข้อมูลรูปภาพ", images);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PATCH /images/:id/main
  setMainImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) return response.error(res, 404, "ไม่พบรูปภาพ");

      const updated = await prisma.$transaction(async (tx) => {
        await tx.productImage.updateMany({
          where: { productId: image.productId },
          data: { isMain: false },
        });
        return await tx.productImage.update({ where: { id }, data: { isMain: true } });
      });

      return response.success(res, 200, "ตั้งรูปหลักสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /images/:id — อัปเดตรูป พร้อมลบไฟล์เก่าออกจาก disk
  updateImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) {
        if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
        return response.error(res, 404, "ไม่พบรูปภาพ");
      }

      if (!req.file) {
        return response.error(res, 400, "กรุณาอัปโหลดไฟล์รูปภาพใหม่");
      }

      const oldImageUrl = image.imageUrl;

      const updated = await prisma.productImage.update({
        where: { id },
        data: { imageUrl: `/uploads/${req.file.filename}` },
      });

      // ลบไฟล์เก่าออกจาก disk หลัง DB อัปเดตสำเร็จ
      deleteImageFile(oldImageUrl);

      return response.success(res, 200, "แก้ไขรูปภาพสำเร็จ", updated);
    } catch (e) {
      if (req.file) deleteImageFile(`/uploads/${req.file.filename}`);
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /images/:id
  deleteImage: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const image = await prisma.productImage.findUnique({ where: { id } });
      if (!image) return response.error(res, 404, "ไม่พบรูปภาพ");

      const imageCount = await prisma.productImage.count({
        where: { productId: image.productId },
      });
      if (imageCount === 1) {
        return response.error(res, 400, "ไม่สามารถลบรูปภาพสุดท้ายของสินค้าได้");
      }

      await prisma.$transaction(async (tx) => {
        await tx.productImage.delete({ where: { id } });
        if (image.isMain) {
          const firstImage = await tx.productImage.findFirst({
            where: { productId: image.productId },
          });
          if (firstImage) {
            await tx.productImage.update({ where: { id: firstImage.id }, data: { isMain: true } });
          }
        }
      });

      // ลบไฟล์จาก disk หลัง DB ลบสำเร็จ
      deleteImageFile(image.imageUrl);

      return response.success(res, 200, "ลบรูปภาพเรียบร้อย", null);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },
};