const prisma = require("../lib/client");
const response = require("../utils/response.utils");

// ============================================================
// ADMIN DASHBOARD & REPORTS
// ============================================================

module.exports = {
  // GET /admin/dashboard
  getDashboard: async (req, res) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalUsers, totalProducts, totalRentals,
        rentalsToday, rentalsThisMonth,
        pendingRentals, activeRentals, lateRentals,
        pendingPayments, lowStockVariants,
        revenueThisMonth, revenueTotal,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.product.count({ where: { isDeleted: false, status: "ACTIVE" } }),
        prisma.rental.count(),
        prisma.rental.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.rental.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.rental.count({ where: { status: "PENDING" } }),
        prisma.rental.count({ where: { status: "ACTIVE" } }),
        prisma.rental.count({ where: { status: "LATE" } }),
        prisma.payment.count({ where: { status: "PENDING" } }),
        prisma.productVariant.findMany({
          where: { stock: { lt: 3 } },
          include: {
            product: { select: { id: true, name: true } },
            size: true,
            color: true,
          },
          take: 10,
          orderBy: { stock: "asc" },
        }),
        prisma.payment.aggregate({
          where: { type: "RENTAL", status: "APPROVED", createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { type: "RENTAL", status: "APPROVED" },
          _sum: { amount: true },
        }),
      ]);

      return response.success(res, 200, "ข้อมูล Dashboard", {
        summary: {
          totalUsers, totalProducts, totalRentals,
          rentalsToday, rentalsThisMonth,
          pendingRentals, activeRentals, lateRentals,
          pendingPayments,
          revenueThisMonth: revenueThisMonth._sum.amount || 0,
          revenueTotal: revenueTotal._sum.amount || 0,
        },
        lowStockVariants,
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /admin/rentals/overdue
  getOverdueRentals: async (req, res) => {
    try {
      const now = new Date();
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = { status: { in: ["ACTIVE", "LATE"] }, endDate: { lt: now } };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { endDate: "asc" },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            items: {
              include: {
                variant: {
                  include: {
                    product: { select: { name: true } },
                    size: true,
                    color: true,
                  },
                },
              },
            },
          },
        }),
        prisma.rental.count({ where }),
      ]);

      const enriched = rentals.map((r) => ({
        ...r,
        daysOverdue: Math.floor(
          (now.getTime() - new Date(r.endDate).getTime()) / (1000 * 60 * 60 * 24),
        ),
        estimatedLateFee:
          Math.floor(
            (now.getTime() - new Date(r.endDate).getTime()) / (1000 * 60 * 60 * 24),
          ) * (r.lateFeePerDay || 0),
      }));

      return response.success(res, 200, "รายการที่เกินกำหนดคืน", {
        rentals: enriched, total, page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /admin/revenue — รายงานรายได้รายเดือน (12 เดือนล่าสุด)
  getRevenueReport: async (req, res) => {
    try {
      const now = new Date();

      const payments = await prisma.payment.findMany({
        where: {
          type: "RENTAL",
          status: "APPROVED",
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
        },
        select: { amount: true, createdAt: true },
      });

      const monthlyMap = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap[key] = 0;
      }

      for (const p of payments) {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in monthlyMap) monthlyMap[key] += p.amount;
      }

      const monthly = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue }));
      return response.success(res, 200, "รายงานรายได้รายเดือน", { monthly });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /admin/products/top — สินค้าที่ถูกเช่าบ่อยที่สุด
  getTopProducts: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const topVariants = await prisma.rentalItem.groupBy({
        by: ["productVariantId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: Number(limit),
      });

      const enriched = await Promise.all(
        topVariants.map(async (v) => {
          const variant = await prisma.productVariant.findUnique({
            where: { id: v.productVariantId },
            include: {
              product: { select: { id: true, name: true, brand: true } },
              size: true,
              color: true,
            },
          });
          return { ...variant, totalRented: v._sum.quantity };
        }),
      );

      return response.success(res, 200, "สินค้าที่ถูกเช่าบ่อยที่สุด", enriched);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // AUDIT LOG
  // ============================================================

  // GET /admin/audit
  getAuditLogs: async (req, res) => {
    try {
      const { page = 1, limit = 50, userId, action } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {};
      if (userId) where.userId = Number(userId);
      if (action) where.action = { contains: action, mode: "insensitive" };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return response.success(res, 200, "รายการ Audit Log", {
        logs, total, page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /admin/audit — internal / Admin
  createAuditLog: async (req, res) => {
    try {
      const { action, userId } = req.body;
      if (!action) return response.error(res, 400, "กรุณาระบุ action");

      const log = await prisma.auditLog.create({
        data: { action, userId: userId ? Number(userId) : null },
      });

      return response.success(res, 201, "บันทึก Audit Log สำเร็จ", log);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /admin/audit — Admin ลบ log เก่า
  clearAuditLogs: async (req, res) => {
    try {
      const { beforeDate } = req.body;
      if (!beforeDate) return response.error(res, 400, "กรุณาระบุ beforeDate");

      const date = new Date(beforeDate);
      if (isNaN(date.getTime())) return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");

      const { count } = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: date } },
      });

      return response.success(res, 200, `ลบ ${count} รายการสำเร็จ`);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};

// Helper สำหรับ log ภายใน — เรียกจาก controller อื่นได้
module.exports.log = async (action, userId = null) => {
  try {
    await prisma.auditLog.create({ data: { action, userId } });
  } catch (_) {
    // silent fail
  }
};
