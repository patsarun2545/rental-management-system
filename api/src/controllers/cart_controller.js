const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  // GET /cart — ดึงตะกร้าของตัวเอง
  getMyCart: async (req, res) => {
    try {
      const userId = req.user.id;

      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      brand: true,
                      images: {
                        where: { isMain: true },
                        select: { imageUrl: true },
                        take: 1,
                      },
                    },
                  },
                  size: { select: { id: true, name: true } },
                  color: { select: { id: true, name: true, hex: true } },
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!cart) {
        return response.success(res, 200, "ตะกร้าสินค้า", {
          items: [],
          total: 0,
        });
      }

      const total = cart.items.reduce(
        (sum, item) => sum + item.variant.price * item.quantity,
        0,
      );

      return response.success(res, 200, "ตะกร้าสินค้า", {
        id: cart.id,
        items: cart.items,
        total,
      });
    } catch {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /cart/items — เพิ่มสินค้าลงตะกร้า
  addItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productVariantId, quantity } = req.body;

      if (!productVariantId || !quantity) {
        return response.error(
          res,
          400,
          "กรุณาระบุ productVariantId และ quantity",
        );
      }

      if (Number(quantity) < 1) {
        return response.error(res, 400, "quantity ต้องมากกว่า 0");
      }

      const [variant, cart] = await Promise.all([
        prisma.productVariant.findUnique({
          where: { id: Number(productVariantId) },
          include: {
            product: { select: { isDeleted: true, status: true } },
          },
        }),
        prisma.cart.upsert({
          where: { userId },
          create: { userId },
          update: {},
        }),
      ]);

      if (!variant) {
        return response.error(res, 404, "ไม่พบสินค้า");
      }

      if (variant.product.isDeleted || variant.product.status !== "ACTIVE") {
        return response.error(res, 400, "สินค้านี้ไม่พร้อมให้เช่าในขณะนี้");
      }

      if (variant.stock < Number(quantity)) {
        return response.error(res, 400, "สินค้าไม่เพียงพอ");
      }

      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productVariantId: Number(productVariantId),
        },
      });

      if (existing) {
        const newQuantity = existing.quantity + Number(quantity);
        if (variant.stock < newQuantity) {
          return response.error(res, 400, "สินค้าไม่เพียงพอ");
        }
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productVariantId: Number(productVariantId),
            quantity: Number(quantity),
          },
        });
      }

      const updatedCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      brand: true,
                      images: {
                        where: { isMain: true },
                        select: { imageUrl: true },
                        take: 1,
                      },
                    },
                  },
                  size: { select: { id: true, name: true } },
                  color: { select: { id: true, name: true, hex: true } },
                },
              },
            },
          },
        },
      });

      return response.success(
        res,
        200,
        "เพิ่มสินค้าในตะกร้าสำเร็จ",
        updatedCart,
      );
    } catch {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /cart/items/:itemId — อัปเดตจำนวน
  updateItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const itemId = Number(req.params.itemId);
      const { quantity } = req.body;

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0");
      }

      // ตรวจสอบว่า item เป็นของ user นี้
      const item = await prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
        include: { variant: true },
      });

      if (!item) {
        return response.error(res, 404, "ไม่พบรายการในตะกร้า");
      }

      if (item.variant.stock < Number(quantity)) {
        return response.error(res, 400, "สินค้าไม่เพียงพอ");
      }

      const updated = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: Number(quantity) },
      });

      return response.success(res, 200, "อัปเดตจำนวนสำเร็จ", updated);
    } catch {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /cart/items/:itemId — ลบ item ออกจากตะกร้า
  removeItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const itemId = Number(req.params.itemId);

      const item = await prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId },
        },
      });

      if (!item) {
        return response.error(res, 404, "ไม่พบรายการในตะกร้า");
      }

      await prisma.cartItem.delete({ where: { id: itemId } });

      return response.success(res, 200, "ลบรายการสำเร็จ");
    } catch {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /cart — ล้างตะกร้าทั้งหมด
  clearCart: async (req, res) => {
    try {
      const userId = req.user.id;

      const cart = await prisma.cart.findUnique({ where: { userId } });

      if (!cart) {
        return response.success(res, 200, "ตะกร้าว่างอยู่แล้ว");
      }

      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      return response.success(res, 200, "ล้างตะกร้าสำเร็จ");
    } catch {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};
