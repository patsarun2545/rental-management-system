const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");

// Helper: สร้าง rental code เช่น RNT-20240315-XXXX
const generateCode = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RNT-${date}-${rand}`;
};

const rentalInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  promotion: true,
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
  payments: true,
  invoice: true,
  deposit: true,
  penalties: true,
  returnLog: true,
};

// ============================================================
// RENTAL
// ============================================================

module.exports = {
  // GET /rentals
  getAll: async (req, res) => {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { page = 1, limit = 20, status, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        ...(!isAdmin && { userId: req.user.id }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            promotion: true,
            items: {
              include: {
                variant: { include: { product: { select: { name: true } } } },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "รายการเช่า", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /rentals/:id
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id },
        include: rentalInclude,
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      return response.success(res, 200, "ข้อมูลการเช่า", rental);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /rentals
  create: async (req, res) => {
    try {
      const userId = req.user.id;
      let {
        startDate,
        endDate,
        items,
        promotionId,
        depositAmount,
        lateFeePerDay,
      } = req.body;

      if (!startDate || !endDate || !items?.length) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");
      }

      if (end <= start)
        return response.error(res, 400, "วันคืนต้องมากกว่าวันรับ");

      let totalPrice = 0;
      const resolvedItems = [];

      for (const item of items) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: Number(item.productVariantId) },
        });
        if (!variant) {
          return response.error(
            res,
            404,
            `ไม่พบสินค้า variant id: ${item.productVariantId}`,
          );
        }
        if (variant.stock < Number(item.quantity)) {
          return response.error(
            res,
            400,
            `สินค้า variant id: ${item.productVariantId} ไม่เพียงพอ`,
          );
        }
        totalPrice += variant.price * Number(item.quantity);
        resolvedItems.push({
          productVariantId: Number(item.productVariantId),
          quantity: Number(item.quantity),
        });
      }

      if (promotionId) {
        const now = new Date();
        const promo = await prisma.promotion.findUnique({
          where: { id: Number(promotionId) },
        });
        if (!promo) return response.error(res, 404, "ไม่พบโปรโมชัน");
        if (now < promo.startDate || now > promo.endDate) {
          return response.error(res, 400, "โปรโมชันนี้หมดอายุแล้ว");
        }
        totalPrice = totalPrice * (1 - promo.discount / 100);
      }

      const rental = await prisma.$transaction(async (tx) => {
        // ตรวจสอบ stock ภายใน transaction เพื่อป้องกัน race condition
        let calcTotal = 0;
        for (const item of resolvedItems) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          });
          if (!variant || variant.stock < item.quantity) {
            throw new Error(`สินค้า variant id: ${item.productVariantId} ไม่เพียงพอ`);
          }
          calcTotal += variant.price * item.quantity;
        }

        // apply promotion อีกครั้งภายใน tx
        let finalPrice = calcTotal;
        if (promotionId) {
          const promo = await tx.promotion.findUnique({
            where: { id: Number(promotionId) },
          });
          if (promo) {
            const now = new Date();
            if (now >= promo.startDate && now <= promo.endDate) {
              finalPrice = calcTotal * (1 - promo.discount / 100);
            }
          }
        }

        return tx.rental.create({
          data: {
            code: generateCode(),
            userId,
            startDate: start,
            endDate: end,
            totalPrice: finalPrice,
            depositAmount: depositAmount ? Number(depositAmount) : null,
            lateFeePerDay: lateFeePerDay ? Number(lateFeePerDay) : 0,
            promotionId: promotionId ? Number(promotionId) : null,
            status: "PENDING",
            paymentStatus: "PENDING",
            items: { create: resolvedItems },
          },
          include: rentalInclude,
        });
      });

      return response.success(res, 201, "สร้างรายการเช่าสำเร็จ", rental);
    } catch (e) {
      if (e.message?.includes("ไม่เพียงพอ")) {
        return response.error(res, 400, e.message);
      }
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/status — Admin
  updateStatus: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "ACTIVE",
        "RETURNED",
        "LATE",
        "CANCELLED",
        "COMPLETED",
      ];
      if (!validStatuses.includes(status))
        return response.error(res, 400, "สถานะไม่ถูกต้อง");

      const rental = await prisma.rental.update({
        where: { id },
        data: { status },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_STATUS_UPDATED: rental #${id} → ${status} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "อัปเดตสถานะสำเร็จ", rental);
    } catch (e) {
      if (e.code === "P2025")
        return response.error(res, 404, "ไม่พบรายการเช่า");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/cancel — User (PENDING only)
  cancel: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rental = await prisma.rental.findUnique({ where: { id } });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      if (rental.status !== "PENDING") {
        return response.error(res, 400, "ยกเลิกได้เฉพาะรายการที่รอการยืนยัน");
      }

      const updated = await prisma.rental.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return response.success(res, 200, "ยกเลิกรายการเช่าสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // RENTAL ITEMS (sub-resource of Rental)
  // ============================================================

  // GET /rentals/:rentalId/items
  getItems: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const items = await prisma.rentalItem.findMany({
        where: { rentalId },
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
      });

      return response.success(res, 200, "รายการสินค้าที่เช่า", items);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /rentals/:rentalId/items — Admin
  addItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const { productVariantId, quantity } = req.body;

      if (!productVariantId || !quantity)
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "ไม่สามารถเพิ่มสินค้าในสถานะนี้ได้");
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(productVariantId) },
      });
      if (!variant) return response.error(res, 404, "ไม่พบสินค้า");
      if (variant.stock < Number(quantity))
        return response.error(res, 400, "สินค้าไม่เพียงพอ");

      const existing = await prisma.rentalItem.findFirst({
        where: { rentalId, productVariantId: Number(productVariantId) },
      });

      let item;
      if (existing) {
        item = await prisma.rentalItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + Number(quantity) },
        });
      } else {
        item = await prisma.rentalItem.create({
          data: {
            rentalId,
            productVariantId: Number(productVariantId),
            quantity: Number(quantity),
          },
        });
      }

      await _recalcTotalPrice(rentalId);
      return response.success(res, 201, "เพิ่มสินค้าในรายการเช่าสำเร็จ", item);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:rentalId/items/:itemId — Admin
  updateItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);
      const { quantity } = req.body;

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return response.error(res, 400, "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "ไม่สามารถแก้ไขในสถานะนี้ได้");
      }

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
        include: { variant: true },
      });
      if (!item) return response.error(res, 404, "ไม่พบรายการสินค้า");
      if (item.variant.stock < Number(quantity))
        return response.error(res, 400, "สินค้าไม่เพียงพอ");

      const updated = await prisma.rentalItem.update({
        where: { id: itemId },
        data: { quantity: Number(quantity) },
      });

      await _recalcTotalPrice(rentalId);
      return response.success(res, 200, "อัปเดตจำนวนสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /rentals/:rentalId/items/:itemId — Admin
  removeItem: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (!["PENDING", "CONFIRMED"].includes(rental.status)) {
        return response.error(res, 400, "ไม่สามารถลบสินค้าในสถานะนี้ได้");
      }

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
      });
      if (!item) return response.error(res, 404, "ไม่พบรายการสินค้า");

      await prisma.rentalItem.delete({ where: { id: itemId } });
      await _recalcTotalPrice(rentalId);

      return response.success(res, 200, "ลบสินค้าออกจากรายการเช่าสำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // STOCK RESERVATION (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:id/confirm — Admin: PENDING → CONFIRMED + reserve stock
  confirmAndReserve: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { items: { include: { variant: true } } },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (rental.status !== "PENDING") {
        return response.error(
          res,
          400,
          "ยืนยันได้เฉพาะรายการที่รอยืนยันเท่านั้น",
        );
      }

      for (const item of rental.items) {
        if (item.variant.stock < item.quantity) {
          return response.error(
            res,
            400,
            `สินค้า ${item.variant.sku} สต๊อกไม่เพียงพอ (มี ${item.variant.stock} ต้องการ ${item.quantity})`,
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const item of rental.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.quantity } },
          });
          await tx.stockReservation.create({
            data: {
              productVariantId: item.productVariantId,
              rentalId,
              startDate: rental.startDate,
              endDate: rental.endDate,
            },
          });
        }
        await tx.rental.update({
          where: { id: rentalId },
          data: { status: "CONFIRMED", handledBy: req.user.id },
        });
      });

      const updated = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: {
          items: {
            include: {
              variant: { include: { product: true, size: true, color: true } },
            },
          },
          stockReservations: true,
        },
      });

      await auditLog(
        `RENTAL_CONFIRMED: rental #${rentalId} confirmed by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "ยืนยันและจอง stock สำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/activate — Admin: CONFIRMED → ACTIVE
  activate: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { pickupDate } = req.body;

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (rental.status !== "CONFIRMED") {
        return response.error(res, 400, "ต้องยืนยันรายการก่อนเปิดใช้งาน");
      }

      const pickup = pickupDate ? new Date(pickupDate) : new Date();
      if (isNaN(pickup.getTime()))
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { status: "ACTIVE", pickupDate: pickup, handledBy: req.user.id },
      });

      await auditLog(
        `RENTAL_ACTIVATED: rental #${rentalId} activated by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "เปิดใช้งานการเช่าสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /rentals/handled — Admin: ดึงรายการเช่าที่ตัวเองดูแล (handledBy)
  getHandledByMe: async (req, res) => {
    try {
      const adminId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        handledBy: adminId,
        ...(status && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            promotion: true,
            items: {
              include: {
                variant: { include: { product: { select: { name: true } } } },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "รายการเช่าที่ดูแลโดยแอดมินนี้", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/complete — Admin: RETURNED → COMPLETED
  complete: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (rental.status !== "RETURNED") {
        return response.error(
          res,
          400,
          "สามารถปิดรายการได้เฉพาะที่คืนสินค้าแล้วเท่านั้น",
        );
      }

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { status: "COMPLETED", handledBy: req.user.id },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_COMPLETED: rental #${rentalId} completed by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "ปิดรายการเช่าสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /reservations — Admin
  getAllReservations: async (req, res) => {
    try {
      const { productVariantId, page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const where = productVariantId
        ? { productVariantId: Number(productVariantId) }
        : {};

      const [reservations, total] = await Promise.all([
        prisma.stockReservation.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { startDate: "asc" },
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true } },
                size: true,
                color: true,
              },
            },
            rental: { select: { id: true, code: true, status: true } },
          },
        }),
        prisma.stockReservation.count({ where }),
      ]);

      return response.success(res, 200, "รายการจอง stock", {
        reservations,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /reservations/check
  checkAvailability: async (req, res) => {
    try {
      const { productVariantId, startDate, endDate, quantity = 1 } = req.query;

      if (!productVariantId || !startDate || !endDate) {
        return response.error(
          res,
          400,
          "กรุณาระบุ productVariantId, startDate, endDate",
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(productVariantId) },
      });
      if (!variant) return response.error(res, 404, "ไม่พบสินค้า");

      const reservedQty = await prisma.rentalItem.aggregate({
        where: {
          productVariantId: Number(productVariantId),
          rental: {
            stockReservations: {
              some: {
                productVariantId: Number(productVariantId),
                startDate: { lt: end },
                endDate: { gt: start },
              },
            },
          },
        },
        _sum: { quantity: true },
      });

      const reservedAmount = reservedQty._sum.quantity || 0;
      const availableStock = variant.stock - reservedAmount;

      return response.success(res, 200, "ผลการตรวจสอบ", {
        productVariantId: variant.id,
        sku: variant.sku,
        totalStock: variant.stock,
        reservedAmount,
        availableStock,
        requestedQuantity: Number(quantity),
        isAvailable: availableStock >= Number(quantity),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};

// ============================================================
// PRIVATE HELPER
// ============================================================

async function _recalcTotalPrice(rentalId) {
  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: {
      items: { include: { variant: true } },
      promotion: true,
    },
  });
  if (!rental) return;

  let totalPrice = rental.items.reduce(
    (sum, i) => sum + i.variant.price * i.quantity,
    0,
  );

  if (rental.promotion) {
    const now = new Date();
    // apply discount เฉพาะโปรโมชันที่ยังไม่หมดอายุ
    if (now >= rental.promotion.startDate && now <= rental.promotion.endDate) {
      totalPrice = totalPrice * (1 - rental.promotion.discount / 100);
    }
  }

  await prisma.rental.update({ where: { id: rentalId }, data: { totalPrice } });
}