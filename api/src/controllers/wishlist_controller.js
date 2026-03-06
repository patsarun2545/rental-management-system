const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  // GET /wishlist — ดึง wishlist ของตัวเอง
  getMyWishlist: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const [items, total] = await Promise.all([
        prisma.wishlist.findMany({
          where: { userId },
          skip,
          take: Number(limit),
          orderBy: { id: "desc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                price: true,
                status: true,
                images: {
                  where: { isMain: true },
                  select: { imageUrl: true },
                  take: 1,
                },
                category: { select: { id: true, name: true } },
                type: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.wishlist.count({ where: { userId } }),
      ]);

      return response.success(res, 200, "รายการ Wishlist", {
        items,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /wishlist — เพิ่มสินค้าใน wishlist
  add: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId } = req.body;

      if (!productId) {
        return response.error(res, 400, "กรุณาระบุ productId");
      }

      // ตรวจสอบ product มีจริง
      const product = await prisma.product.findUnique({
        where: { id: Number(productId), isDeleted: false },
      });

      if (!product) {
        return response.error(res, 404, "ไม่พบสินค้า");
      }

      // ถ้ามีอยู่แล้ว → ไม่ต้องทำอะไร
      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId: Number(productId),
          },
        },
      });

      if (existing) {
        return response.error(res, 409, "สินค้านี้อยู่ใน Wishlist แล้ว");
      }

      const item = await prisma.wishlist.create({
        data: {
          userId,
          productId: Number(productId),
        },
      });

      return response.success(res, 201, "เพิ่มใน Wishlist สำเร็จ", item);
    } catch (e) {
      if (e.code === "P2002") {
        return response.error(res, 409, "สินค้านี้อยู่ใน Wishlist แล้ว");
      }
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /wishlist/:productId — ลบสินค้าออกจาก wishlist
  remove: async (req, res) => {
    try {
      const userId = req.user.id;
      const productId = Number(req.params.productId);

      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: { userId, productId },
        },
      });

      if (!existing) {
        return response.error(res, 404, "ไม่พบสินค้าใน Wishlist");
      }

      await prisma.wishlist.delete({
        where: {
          userId_productId: { userId, productId },
        },
      });

      return response.success(res, 200, "ลบออกจาก Wishlist สำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /wishlist/check/:productId — เช็คว่าสินค้านี้อยู่ใน wishlist หรือเปล่า
  check: async (req, res) => {
    try {
      const userId = req.user.id;
      const productId = Number(req.params.productId);

      const existing = await prisma.wishlist.findUnique({
        where: {
          userId_productId: { userId, productId },
        },
      });

      return response.success(res, 200, "ตรวจสอบ Wishlist", {
        inWishlist: !!existing,
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};
