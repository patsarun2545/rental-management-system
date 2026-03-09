const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");

// Helper: สร้าง rental code เช่น RNT-20240315-XXXX
const generateCode = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RNT-${date}-${rand}`;
};

// retry ถ้า code ชน unique constraint (โอกาส 1/1,679,616 ต่อวัน)
const generateUniqueCode = async (tx, maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateCode();
    const exists = await tx.rental.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("ไม่สามารถสร้างรหัสการเช่าได้ กรุณาลองใหม่");
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

      // ตรวจ duplicate productVariantId ใน items
      const variantIdSet = new Set();
      for (const item of items) {
        const vid = Number(item.productVariantId);
        if (variantIdSet.has(vid)) {
          return response.error(res, 400, `productVariantId ${vid} ซ้ำกันใน items กรุณารวมจำนวนให้เป็นรายการเดียว`);
        }
        variantIdSet.add(vid);
      }

      for (const item of items) {
        if (
          !Number.isInteger(Number(item.productVariantId)) ||
          Number(item.quantity) < 1
        ) {
          return response.error(res, 400, "ข้อมูล items ไม่ถูกต้อง");
        }
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
        // pre-check stock (best-effort ก่อน tx — tx จะ lock และตรวจซ้ำ)
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
        // ล็อค variant rows เพื่อป้องกัน race condition (SELECT FOR UPDATE)
        const variantIds = resolvedItems.map((i) => i.productVariantId);
        await tx.$executeRaw`
          SELECT id FROM "ProductVariant"
          WHERE id = ANY(${variantIds}::int[])
          FOR UPDATE
        `;

        // ตรวจสอบ stock อีกครั้งภายใน lock
        let calcTotal = 0;
        for (const item of resolvedItems) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          });
          if (!variant || variant.stock < item.quantity) {
            throw new Error(
              `สินค้า variant id: ${item.productVariantId} ไม่เพียงพอ`,
            );
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
            code: await generateUniqueCode(tx),
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

      const existing = await prisma.rental.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) return response.error(res, 404, "ไม่พบรายการเช่า");

      // State machine: กำหนด transitions ที่ถูกต้อง
      // หมายเหตุ: PENDING→CONFIRMED ต้องใช้ POST /rentals/:id/confirm เท่านั้น
      //           เพราะต้อง reserve stock ด้วย — ห้ามใช้ updateStatus bypass
      //           CONFIRMED→ACTIVE ต้องใช้ PATCH /rentals/:id/activate เท่านั้น
      //           RETURNED→COMPLETED ต้องใช้ PATCH /rentals/:id/complete เท่านั้น
      const allowedTransitions = {
        PENDING: ["CANCELLED"],
        CONFIRMED: ["CANCELLED"],
        ACTIVE: ["LATE", "CANCELLED"],
        LATE: ["CANCELLED"],
        RETURNED: [],  // ใช้ /complete
        COMPLETED: [], // terminal state
        CANCELLED: [], // terminal state
      };

      const allowed = allowedTransitions[existing.status] ?? [];
      if (!allowed.includes(status)) {
        return response.error(
          res,
          400,
          `ไม่สามารถเปลี่ยนสถานะจาก ${existing.status} → ${status} ได้`,
        );
      }

      // สถานะที่ stock ถูกตัดแล้ว (ผ่าน confirmAndReserve)
      const stockReservedStatuses = ["CONFIRMED", "ACTIVE", "LATE"];

      let rental;

      if (
        status === "CANCELLED" &&
        stockReservedStatuses.includes(existing.status)
      ) {
        // ต้องคืน stock และลบ reservation ใน transaction เดียวกัน
        await prisma.$transaction(async (tx) => {
          for (const item of existing.items) {
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            });
          }
          await tx.stockReservation.deleteMany({ where: { rentalId: id } });
          await tx.rental.update({
            where: { id },
            data: { status, handledBy: req.user.id },
          });
        });

        rental = await prisma.rental.findUnique({
          where: { id },
          include: rentalInclude,
        });
      } else {
        rental = await prisma.rental.update({
          where: { id },
          data: { status, handledBy: req.user.id },
          include: rentalInclude,
        });
      }

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

  // PATCH /rentals/:id/cancel — User (PENDING only) / Admin (PENDING หรือ CONFIRMED+)
  cancel: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      // User ยกเลิกได้เฉพาะ PENDING — Admin ยกเลิกได้ก่อน ACTIVE
      const isAdmin = req.user.role === "ADMIN";
      const cancellableByUser = ["PENDING"];
      const cancellableByAdmin = ["PENDING", "CONFIRMED"];

      const allowedStatuses = isAdmin ? cancellableByAdmin : cancellableByUser;
      if (!allowedStatuses.includes(rental.status)) {
        return response.error(
          res,
          400,
          isAdmin
            ? "Admin ยกเลิกได้เฉพาะรายการที่รอหรือยืนยันแล้วเท่านั้น"
            : "ยกเลิกได้เฉพาะรายการที่รอการยืนยัน",
        );
      }

      // สถานะที่ stock ถูกตัดแล้ว — ต้องคืนก่อน cancel
      const stockReservedStatuses = ["CONFIRMED"];

      let updated;
      const cancelData = {
        status: "CANCELLED",
        ...(isAdmin && { handledBy: req.user.id }),
      };

      if (stockReservedStatuses.includes(rental.status)) {
        await prisma.$transaction(async (tx) => {
          for (const item of rental.items) {
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { stock: { increment: item.quantity } },
            });
          }
          await tx.stockReservation.deleteMany({ where: { rentalId: id } });
          updated = await tx.rental.update({
            where: { id },
            data: cancelData,
          });
        });
      } else {
        updated = await prisma.rental.update({
          where: { id },
          data: cancelData,
        });
      }

      if (isAdmin) {
        await auditLog(
          `RENTAL_CANCELLED: rental #${id} cancelled by admin #${req.user.id}`,
          req.user.id,
        );
      }

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

  // GET /rentals/:rentalId/items/:itemId — Admin or owner
  getItemById: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const itemId = Number(req.params.itemId);

      const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
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

      if (!item) return response.error(res, 404, "ไม่พบรายการสินค้า");

      return response.success(res, 200, "ข้อมูลรายการสินค้าที่เช่า", item);
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

      const isConfirmed = rental.status === "CONFIRMED";

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
      if (isConfirmed) {
        // CONFIRMED: stock ถูกตัดไปแล้ว ต้อง decrement เพิ่ม + สร้าง/อัปเดต reservation ใน tx เดียวกัน
        await prisma.$transaction(async (tx) => {
          const lockedVariant = await tx.$queryRaw`
            SELECT id, stock FROM "ProductVariant" WHERE id = ${Number(productVariantId)} FOR UPDATE
          `;
          if (!lockedVariant[0] || lockedVariant[0].stock < Number(quantity)) {
            throw new Error("สินค้าไม่เพียงพอ");
          }

          if (existing) {
            item = await tx.rentalItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + Number(quantity) },
            });
            // อัปเดต reservation ที่มีอยู่
            await tx.stockReservation.updateMany({
              where: { rentalId, productVariantId: Number(productVariantId) },
              data: { startDate: rental.startDate, endDate: rental.endDate },
            });
          } else {
            item = await tx.rentalItem.create({
              data: {
                rentalId,
                productVariantId: Number(productVariantId),
                quantity: Number(quantity),
              },
            });
            await tx.stockReservation.create({
              data: {
                productVariantId: Number(productVariantId),
                rentalId,
                startDate: rental.startDate,
                endDate: rental.endDate,
              },
            });
          }

          await tx.productVariant.update({
            where: { id: Number(productVariantId) },
            data: { stock: { decrement: Number(quantity) } },
          });

          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        // PENDING: ยังไม่ตัด stock — แค่เพิ่ม rentalItem + recalc ใน tx เดียวกัน
        await prisma.$transaction(async (tx) => {
          if (existing) {
            item = await tx.rentalItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + Number(quantity) },
            });
          } else {
            item = await tx.rentalItem.create({
              data: {
                rentalId,
                productVariantId: Number(productVariantId),
                quantity: Number(quantity),
              },
            });
          }
          await _recalcTotalPrice(rentalId, tx);
        });
      }

      return response.success(res, 201, "เพิ่มสินค้าในรายการเช่าสำเร็จ", item);
    } catch (e) {
      if (e.message === "สินค้าไม่เพียงพอ")
        return response.error(res, 400, e.message);
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

      const isConfirmed = rental.status === "CONFIRMED";

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
        include: { variant: true },
      });
      if (!item) return response.error(res, 404, "ไม่พบรายการสินค้า");

      const newQty = Number(quantity);
      const oldQty = item.quantity;
      const delta = newQty - oldQty; // บวก = ต้องการเพิ่ม, ลบ = ต้องการลด

      let updated;
      if (isConfirmed && delta !== 0) {
        // CONFIRMED: ต้อง sync stock ตาม delta
        if (delta > 0 && item.variant.stock < delta) {
          return response.error(res, 400, "สินค้าไม่เพียงพอ");
        }
        await prisma.$transaction(async (tx) => {
          updated = await tx.rentalItem.update({
            where: { id: itemId },
            data: { quantity: newQty },
          });
          // delta > 0 → decrement stock, delta < 0 → increment stock คืน
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: -delta } },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        // PENDING: แค่อัปเดต qty
        if (item.variant.stock < newQty) {
          return response.error(res, 400, "สินค้าไม่เพียงพอ");
        }
        await prisma.$transaction(async (tx) => {
          updated = await tx.rentalItem.update({
            where: { id: itemId },
            data: { quantity: newQty },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      }

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

      const isConfirmed = rental.status === "CONFIRMED";

      const item = await prisma.rentalItem.findFirst({
        where: { id: itemId, rentalId },
      });
      if (!item) return response.error(res, 404, "ไม่พบรายการสินค้า");

      if (isConfirmed) {
        // CONFIRMED: ต้องคืน stock + ลบ reservation ใน tx เดียวกัน
        await prisma.$transaction(async (tx) => {
          await tx.rentalItem.delete({ where: { id: itemId } });
          await tx.stockReservation.deleteMany({
            where: { rentalId, productVariantId: item.productVariantId },
          });
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          });
          await _recalcTotalPrice(rentalId, tx);
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.rentalItem.delete({ where: { id: itemId } });
          await _recalcTotalPrice(rentalId, tx);
        });
      }

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
        // ล็อค variant rows ก่อนตัด stock เพื่อป้องกัน race condition
        const variantIds = rental.items.map((i) => i.productVariantId);
        await tx.$executeRaw`
          SELECT id FROM "ProductVariant"
          WHERE id = ANY(${variantIds}::int[])
          FOR UPDATE
        `;

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
      const { pickupDate } = req.body || {};

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
      console.error("activate error:", e);
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

  // GET /admin/staff/:adminId — Admin: ดู profile ของ admin คนใดก็ได้
  getAdminById: async (req, res) => {
    try {
      const adminId = Number(req.params.adminId);

      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      if (!admin) return response.error(res, 404, "ไม่พบผู้ใช้");
      if (admin.role !== "ADMIN") return response.error(res, 400, "ผู้ใช้นี้ไม่ใช่ Admin");

      // นับรายการเช่าที่ดูแลโดย admin คนนี้ แยกตามสถานะ
      const rentalStats = await prisma.rental.groupBy({
        by: ["status"],
        where: { handledBy: adminId },
        _count: { id: true },
      });

      const statsMap = Object.fromEntries(
        rentalStats.map((r) => [r.status, r._count.id])
      );

      return response.success(res, 200, "ข้อมูล Admin", {
        ...admin,
        rentalStats: statsMap,
        totalHandled: rentalStats.reduce((sum, r) => sum + r._count.id, 0),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /admin/staff/:adminId/rentals — Admin: ดูรายการเช่าที่ admin คนใดก็ได้ดูแล
  getRentalsByAdmin: async (req, res) => {
    try {
      const adminId = Number(req.params.adminId);
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { id: true, name: true, role: true },
      });
      if (!admin) return response.error(res, 404, "ไม่พบผู้ใช้");
      if (admin.role !== "ADMIN") return response.error(res, 400, "ผู้ใช้นี้ไม่ใช่ Admin");

      const validStatuses = ["PENDING", "CONFIRMED", "ACTIVE", "RETURNED", "LATE", "CANCELLED", "COMPLETED"];
      const where = {
        handledBy: adminId,
        ...(status && validStatuses.includes(status) && { status }),
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

      return response.success(res, 200, `รายการเช่าที่ดูแลโดย ${admin.name}`, {
        admin: { id: admin.id, name: admin.name },
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/pickup — Admin: อัปเดต pickupDate (วันที่ลูกค้ารับของจริง)
  updatePickupDate: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { pickupDate } = req.body;

      if (!pickupDate) {
        return response.error(res, 400, "กรุณาระบุ pickupDate");
      }

      const pickup = new Date(pickupDate);
      if (isNaN(pickup.getTime())) {
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");
      }

      const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (!["ACTIVE", "CONFIRMED"].includes(rental.status)) {
        return response.error(
          res,
          400,
          "อัปเดต pickupDate ได้เฉพาะรายการที่ยืนยันแล้วหรือ Active เท่านั้น",
        );
      }

      const updated = await prisma.rental.update({
        where: { id: rentalId },
        data: { pickupDate: pickup },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_PICKUP_UPDATED: rental #${rentalId} pickupDate → ${pickup.toISOString()} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "อัปเดต pickupDate สำเร็จ", updated);
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
        include: { deposit: true, penalties: true },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (rental.status !== "RETURNED") {
        return response.error(
          res,
          400,
          "สามารถปิดรายการได้เฉพาะที่คืนสินค้าแล้วเท่านั้น",
        );
      }

      // ตรวจว่ายังมี payment PENDING ค้างอยู่หรือไม่
      const pendingPayments = await prisma.payment.count({
        where: { rentalId, status: "PENDING" },
      });
      if (pendingPayments > 0) {
        return response.error(
          res,
          400,
          "ยังมีรายการชำระเงินที่รอการตรวจสอบ กรุณาอนุมัติหรือปฏิเสธก่อน",
        );
      }

      // ถ้ามี deposit ต้องดำเนินการก่อน (ไม่ใช่ HELD ค้างอยู่)
      if (rental.deposit && rental.deposit.status === "HELD") {
        return response.error(
          res,
          400,
          "ยังมีมัดจำที่รอการคืน กรุณาดำเนินการคืนหรือหักมัดจำก่อน (PATCH /rentals/:id/deposit/refund)",
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

  // GET /reservations/:id — Admin
  getReservationById: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const reservation = await prisma.stockReservation.findUnique({
        where: { id },
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
      });

      if (!reservation) return response.error(res, 404, "ไม่พบข้อมูลการจอง");

      return response.success(res, 200, "ข้อมูลการจอง stock", reservation);
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

  // GET /rentals/:id/reservations — Admin: ดู reservations ของ rental นั้น
  getRentalReservations: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      const reservations = await prisma.stockReservation.findMany({
        where: { rentalId },
        orderBy: { id: "asc" },
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true } },
              size: true,
              color: true,
            },
          },
        },
      });

      return response.success(res, 200, "รายการจอง stock ของการเช่า", reservations);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /reservations/:id — Admin: ลบ reservation ฉุกเฉิน พร้อมคืน stock
  deleteReservation: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const reservation = await prisma.stockReservation.findUnique({
        where: { id },
        include: {
          rental: { select: { id: true, code: true, status: true } },
          variant: { select: { id: true, sku: true, stock: true } },
        },
      });

      if (!reservation) return response.error(res, 404, "ไม่พบข้อมูลการจอง");

      // ห้ามลบ reservation ของ rental ที่ยัง active อยู่ (ต้องใช้ process return หรือ cancel แทน)
      const blockStatuses = ["ACTIVE", "LATE"];
      if (blockStatuses.includes(reservation.rental?.status)) {
        return response.error(
          res,
          400,
          `ไม่สามารถลบ reservation ของ rental ที่มีสถานะ ${reservation.rental.status} ได้ กรุณาใช้ process return หรือ cancel rental แทน`,
        );
      }

      // ดึง quantity จริงจาก RentalItem เพื่อคืน stock ให้ถูกต้อง
      const rentalItem = reservation.rentalId
        ? await prisma.rentalItem.findFirst({
            where: {
              rentalId: reservation.rentalId,
              productVariantId: reservation.productVariantId,
            },
            select: { quantity: true },
          })
        : null;

      const qtyToRestore = rentalItem?.quantity ?? 1;

      await prisma.$transaction(async (tx) => {
        await tx.stockReservation.delete({ where: { id } });
        // คืน stock กลับเมื่อลบ reservation ออก
        await tx.productVariant.update({
          where: { id: reservation.productVariantId },
          data: { stock: { increment: qtyToRestore } },
        });
      });

      await auditLog(
        `RESERVATION_DELETED: reservation #${id} (variant: ${reservation.variant.sku}, rental: ${reservation.rental?.code}) deleted by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "ลบ reservation สำเร็จ และคืน stock แล้ว");
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

      if (end <= start) {
        return response.error(res, 400, "วันสิ้นสุดต้องมากกว่าวันเริ่มต้น");
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: Number(productVariantId) },
      });
      if (!variant) return response.error(res, 404, "ไม่พบสินค้า");

      // variant.stock สะท้อนจำนวนจริงที่เหลืออยู่แล้ว
      // (ถูก decrement ตอน confirmAndReserve และ increment ตอน processReturn/cancel)
      // ไม่ต้องนำ reservation มาลบซ้ำ — มิฉะนั้นจะ double-count

      // นับ PENDING rentals ที่ overlap กับช่วงวันที่ขอ (ยังไม่ confirm จึงไม่ตัด stock)
      // แสดงเป็น informational เท่านั้น ไม่นำมาหักออกจาก availableStock
      const pendingOverlapQty = await prisma.rentalItem.aggregate({
        where: {
          productVariantId: Number(productVariantId),
          rental: {
            status: "PENDING",
            startDate: { lt: end },
            endDate: { gt: start },
          },
        },
        _sum: { quantity: true },
      });

      const pendingAmount = pendingOverlapQty._sum.quantity || 0;
      // availableStock = stock จริงที่เหลือ (หลัง confirm reservations ถูกตัดแล้ว)
      const availableStock = variant.stock;

      return response.success(res, 200, "ผลการตรวจสอบ", {
        productVariantId: variant.id,
        sku: variant.sku,
        currentStock: variant.stock,
        pendingRentalAmount: pendingAmount, // PENDING ที่ overlap — ยังไม่ตัด stock
        availableStock,
        requestedQuantity: Number(quantity),
        isAvailable: availableStock >= Number(quantity),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:id/payment-status — Admin: override paymentStatus โดยตรง
  updatePaymentStatus: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { paymentStatus } = req.body;

      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
      if (!validStatuses.includes(paymentStatus)) {
        return response.error(res, 400, "paymentStatus ไม่ถูกต้อง (PENDING / APPROVED / REJECTED)");
      }

      const rental = await prisma.rental.findUnique({ where: { id } });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (["CANCELLED", "COMPLETED"].includes(rental.status)) {
        return response.error(res, 400, "ไม่สามารถแก้ไข paymentStatus ของรายการที่ปิดแล้ว");
      }

      const updated = await prisma.rental.update({
        where: { id },
        data: { paymentStatus },
        include: rentalInclude,
      });

      await auditLog(
        `RENTAL_PAYMENT_STATUS_UPDATED: rental #${id} paymentStatus → ${paymentStatus} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "อัปเดต paymentStatus สำเร็จ", updated);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบรายการเช่า");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};

// ============================================================
// PRIVATE HELPER
// ============================================================

async function _recalcTotalPrice(rentalId, tx = prisma) {
  const rental = await tx.rental.findUnique({
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

  // ใช้ discount ของโปรโมชันที่ผูกไว้ตอนสร้าง rental เสมอ
  // ไม่ตรวจ expiry ซ้ำ เพราะสิทธิ์ในส่วนลดถูกตัดสิน ณ ตอน create แล้ว
  if (rental.promotion) {
    totalPrice = totalPrice * (1 - rental.promotion.discount / 100);
  }

  await tx.rental.update({ where: { id: rentalId }, data: { totalPrice } });
}