const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const { log: auditLog } = require("./admin_controller");

// Helper: สร้าง Invoice No เช่น INV-20240315-0001
const generateInvoiceNo = async () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.invoice.count();
  const seq = String(count + 1).padStart(4, "0");
  return `INV-${date}-${seq}`;
};

// ============================================================
// PAYMENT
// ============================================================

module.exports = {
  // GET /payments — Admin: ดูรายการชำระเงินทั้งหมด (filter by status: PENDING / APPROVED / REJECTED)
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
      const validTypes = ["RENTAL", "DEPOSIT", "PENALTY"];

      const where = {
        ...(status && validStatuses.includes(status) && { status }),
        ...(type && validTypes.includes(type) && { type }),
      };

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            rental: {
              select: {
                code: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return response.success(res, 200, "รายการชำระเงินทั้งหมด", {
        payments,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /payments/rental/:rentalId
  getByRentalId: async (req, res) => {
    try {
      const rentalId = Number(req.params.rentalId);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const payments = await prisma.payment.findMany({
        where: { rentalId },
        orderBy: { createdAt: "desc" },
      });

      return response.success(res, 200, "ประวัติการชำระเงิน", payments);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /payments — User แนบสลิปชำระเงิน
  create: async (req, res) => {
    try {
      const userId = req.user.id;
      const { rentalId, amount, type } = req.body;
      const validTypes = ["RENTAL", "DEPOSIT", "PENALTY"];

      if (!rentalId || !amount || !type)
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      if (!validTypes.includes(type))
        return response.error(res, 400, "ประเภทการชำระเงินไม่ถูกต้อง");
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return response.error(res, 400, "จำนวนเงินต้องมากกว่า 0");
      }

      const rental = await prisma.rental.findUnique({
        where: { id: Number(rentalId) },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== userId) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      if (["CANCELLED", "COMPLETED"].includes(rental.status)) {
        return response.error(res, 400, "ไม่สามารถชำระเงินรายการนี้ได้");
      }

      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const payment = await prisma.payment.create({
        data: {
          rentalId: Number(rentalId),
          amount: Number(amount),
          type,
          imageUrl,
          status: "PENDING",
        },
      });

      return response.success(
        res,
        201,
        "บันทึกการชำระเงินสำเร็จ รอการตรวจสอบ",
        payment,
      );
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /payments/:id/approve — Admin
  approve: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { rental: true },
      });
      if (!payment) return response.error(res, 404, "ไม่พบรายการชำระเงิน");

      if (payment.status !== "PENDING") {
        return response.error(res, 400, "รายการนี้ถูกดำเนินการแล้ว");
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id },
          data: { status: "APPROVED" },
        });

        const rental = payment.rental;

        if (payment.type === "DEPOSIT") {
          const existDeposit = await tx.deposit.findUnique({
            where: { rentalId: rental.id },
          });
          if (existDeposit) {
            await tx.deposit.update({
              where: { rentalId: rental.id },
              data: { amount: existDeposit.amount + payment.amount },
            });
          } else {
            await tx.deposit.create({
              data: {
                rentalId: rental.id,
                amount: payment.amount,
                status: "HELD",
              },
            });
          }
        }

        if (payment.type === "RENTAL") {
          const approvedPayments = await tx.payment.findMany({
            where: { rentalId: rental.id, type: "RENTAL", status: "APPROVED" },
          });
          const totalPaid = approvedPayments.reduce(
            (sum, p) => sum + p.amount,
            0,
          );
          if (totalPaid >= rental.totalPrice) {
            await tx.rental.update({
              where: { id: rental.id },
              data: { paymentStatus: "APPROVED" },
            });
          }
        }
      });

      const updated = await prisma.payment.findUnique({ where: { id } });
      await auditLog(
        `PAYMENT_APPROVED: payment #${id} (rental #${payment.rentalId}, type: ${payment.type}, amount: ${payment.amount}) approved by admin #${req.user.id}`,
        req.user.id,
      );
      return response.success(res, 200, "อนุมัติการชำระเงินสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /payments/:id/reject — Admin
  reject: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return response.error(res, 404, "ไม่พบรายการชำระเงิน");

      if (payment.status !== "PENDING") {
        return response.error(res, 400, "รายการนี้ถูกดำเนินการแล้ว");
      }

      const updated = await prisma.payment.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      await auditLog(
        `PAYMENT_REJECTED: payment #${id} (rental #${payment.rentalId}) rejected by admin #${req.user.id}`,
        req.user.id,
      );
      return response.success(res, 200, "ปฏิเสธการชำระเงินสำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // INVOICE (sub-resource of Rental)
  // ============================================================

  // POST /rentals/:id/invoice — Admin
  createInvoice: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);

      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
        include: {
          items: {
            include: {
              variant: { include: { product: true, size: true, color: true } },
            },
          },
          user: { select: { id: true, name: true, email: true, phone: true } },
          penalties: true,
          invoice: true,
        },
      });

      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");
      if (rental.invoice)
        return response.error(res, 400, "Invoice ถูกสร้างแล้ว");

      const penaltyTotal = rental.penalties.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const total = rental.totalPrice + penaltyTotal;
      const invoiceNo = await generateInvoiceNo();

      const invoice = await prisma.invoice.create({
        data: { rentalId, invoiceNo, total },
      });

      return response.success(res, 201, "สร้าง Invoice สำเร็จ", {
        invoice,
        rental: {
          code: rental.code,
          user: rental.user,
          items: rental.items,
          totalPrice: rental.totalPrice,
          penalties: rental.penalties,
          penaltyTotal,
          grandTotal: total,
        },
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /rentals/:id/invoice
  getInvoiceByRentalId: async (req, res) => {
    try {
      const rentalId = Number(req.params.id);
      const rental = await prisma.rental.findUnique({
        where: { id: rentalId },
      });
      if (!rental) return response.error(res, 404, "ไม่พบรายการเช่า");

      if (req.user.role !== "ADMIN" && rental.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const invoice = await prisma.invoice.findUnique({ where: { rentalId } });
      if (!invoice) return response.error(res, 404, "ยังไม่มี Invoice");

      return response.success(res, 200, "ข้อมูล Invoice", invoice);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /invoices — Admin
  getAllInvoices: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const where = search
        ? { invoiceNo: { contains: search, mode: "insensitive" } }
        : {};

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            rental: {
              select: {
                code: true,
                status: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return response.success(res, 200, "รายการ Invoice ทั้งหมด", {
        invoices,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};
