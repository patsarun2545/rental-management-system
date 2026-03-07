const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");

// ============================================================
// RETURN & PENALTY
// ============================================================

module.exports = {
  // POST /rentals/:id/return — Admin บันทึกการคืนสินค้า
  processReturn: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      let { returnedAt, condition, note } = req.body;

      const validConditions = ["GOOD", "DAMAGED", "LOST"];

      if (!returnedAt || !condition) {
        return response.error(res, 400, "กรุณาระบุวันที่คืนและสภาพสินค้า");
      }

      if (!validConditions.includes(condition)) {
        return response.error(
          res,
          400,
          "สภาพสินค้าไม่ถูกต้อง (GOOD / DAMAGED / LOST)",
        );
      }

      const returnDate = new Date(returnedAt);
      if (isNaN(returnDate.getTime()))
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { items: { include: { variant: true } }, deposit: true },
      });

      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (!["ACTIVE", "LATE"].includes(rental.status)) {
        return response.error(
          res,
          400,
          "สามารถบันทึกการคืนได้เฉพาะรายการที่ Active หรือ Late เท่านั้น",
        );
      }

      const existReturn = await prisma.returnLog.findUnique({
        where: { rentalId },
      });
      if (existReturn) return response.error(res, 400, "บันทึกการคืนแล้ว");

      const daysLate = Math.floor(
        (returnDate.getTime() - new Date(rental.endDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const latePenaltyAmount =
        daysLate > 0 && rental.lateFeePerDay > 0
          ? daysLate * rental.lateFeePerDay
          : 0;

      await prisma.$transaction(async (tx) => {
        await tx.returnLog.create({
          data: {
            rentalId,
            returnedAt: returnDate,
            condition,
            note: note?.trim() || null,
          },
        });

        if (latePenaltyAmount > 0) {
          await tx.penalty.create({
            data: {
              rentalId,
              type: "LATE",
              amount: latePenaltyAmount,
              note: `เกินกำหนด ${daysLate} วัน`,
            },
          });
        }

        for (const item of rental.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          });
        }

        await tx.stockReservation.deleteMany({ where: { rentalId } });

        await tx.rental.update({
          where: { id: rentalId },
          data: {
            status: "RETURNED",
            returnDate: returnDate,
          },
        });
      });

      const updated = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: { returnLog: true, penalties: true, deposit: true },
      });

      await auditLog(
        `RENTAL_RETURNED: rental #${rentalId} returned, condition: ${condition}, daysLate: ${daysLate}, latePenalty: ${latePenaltyAmount} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "บันทึกการคืนสำเร็จ", {
        rental: updated,
        daysLate,
        latePenaltyAmount,
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /rentals/:id/penalties — Admin เพิ่มค่าปรับ
  addPenalty: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      let { type, amount, note } = req.body;

      const validTypes = ["LATE", "DAMAGE", "LOST"];

      if (!type || amount == null)
        return response.error(res, 400, "กรุณาระบุประเภทและจำนวนเงิน");
      if (!validTypes.includes(type)) {
        return response.error(
          res,
          400,
          "ประเภทค่าปรับไม่ถูกต้อง (LATE / DAMAGE / LOST)",
        );
      }
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return response.error(res, 400, "จำนวนเงินต้องมากกว่า 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      const penalty = await prisma.penalty.create({
        data: {
          rentalId,
          type,
          amount: Number(amount),
          note: note?.trim() || null,
        },
      });

      return response.success(res, 201, "เพิ่มค่าปรับสำเร็จ", penalty);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /rentals/:id/penalties
  getPenalties: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const penalties = await prisma.penalty.findMany({
        where: { rentalId },
        orderBy: { createdAt: "asc" },
      });
      const total = penalties.reduce((sum, p) => sum + p.amount, 0);

      return response.success(res, 200, "รายการค่าปรับ", { penalties, total });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // DEPOSIT (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:rentalId/deposit — Admin สร้าง deposit
  createDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      let { amount } = req.body;
      amount = Number(amount);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      const existing = await prisma.deposit.findUnique({ where: { rentalId } });
      if (existing)
        return response.error(
          res,
          400,
          "Deposit already exists for this rental",
        );

      const deposit = await prisma.deposit.create({
        data: { rentalId, amount },
      });

      await prisma.rental.update({
        where: { id: rentalId },
        data: { depositAmount: amount },
      });

      return response.success(res, 201, "Deposit created", deposit);
    } catch (e) {
      return response.error(res, 500, "Internal server error", e.message);
    }
  },

  // GET /deposits — Admin
  getAllDeposits: async (req, res) => {
    try {
      const deposits = await prisma.deposit.findMany({
        include: { rental: true },
        orderBy: { createdAt: "desc" },
      });
      return response.success(res, 200, "Success", deposits);
    } catch (e) {
      return response.error(res, 500, "Internal server error", e.message);
    }
  },

  // GET /rentals/:rentalId/deposit
  getDepositByRental: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const deposit = await prisma.deposit.findUnique({
        where: { rentalId },
        include: { rental: true },
      });
      if (!deposit) return response.error(res, 404, "Deposit not found");
      return response.success(res, 200, "Success", deposit);
    } catch (e) {
      return response.error(res, 500, "Internal server error", e.message);
    }
  },

  // PATCH /rentals/:id/deposit/refund — Admin คืนมัดจำ
  refundDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const { refundedAmount } = req.body;

      if (
        refundedAmount == null ||
        isNaN(Number(refundedAmount)) ||
        Number(refundedAmount) < 0
      ) {
        return response.error(res, 400, "กรุณาระบุจำนวนเงินที่คืน");
      }

      const deposit = await prisma.deposit.findUnique({ where: { rentalId } });
      if (!deposit) return response.error(res, 404, "ไม่พบข้อมูลมัดจำ");

      if (deposit.status !== "HELD")
        return response.error(res, 400, "มัดจำนี้ดำเนินการแล้ว");

      if (Number(refundedAmount) > deposit.amount) {
        return response.error(res, 400, "จำนวนคืนมากกว่ามัดจำที่รับมา");
      }

      // ตรวจสอบว่ามี payment PENDING ค้างอยู่หรือไม่
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

      const newStatus =
        Number(refundedAmount) === deposit.amount ? "REFUNDED" : "DEDUCTED";

      const updated = await prisma.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { rentalId },
          data: { refundedAmount: Number(refundedAmount), status: newStatus },
        });
        await tx.rental.update({
          where: { id: rentalId },
          data: { status: "COMPLETED" },
        });
        return dep;
      });

      await auditLog(
        `DEPOSIT_REFUNDED: rental #${rentalId}, refunded: ${refundedAmount}, status: ${newStatus} by admin #${req.user.id}`,
        req.user.id,
      );

      return response.success(res, 200, "คืนมัดจำสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /rentals/:rentalId/deposit/deduct — Admin หักมัดจำ
  deductDeposit: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      let { amount } = req.body;
      amount = Number(amount);

      const deposit = await prisma.deposit.findUnique({ where: { rentalId } });
      if (!deposit) return response.error(res, 404, "Deposit not found");
      if (deposit.status !== "HELD")
        return response.error(res, 400, "Deposit already processed");
      if (amount > deposit.amount)
        return response.error(res, 400, "Deduction exceeds deposit");

      const updated = await prisma.deposit.update({
        where: { rentalId },
        data: { refundedAmount: deposit.amount - amount, status: "DEDUCTED" },
      });

      return response.success(res, 200, "Deposit deducted", updated);
    } catch (e) {
      return response.error(res, 500, "Internal server error", e.message);
    }
  },
};
