const prisma = require("../lib/client");
const response = require("../utils/response.utils");

module.exports = {
  // GET /promotions — Admin: ดูทั้งหมด / User: ดูเฉพาะที่ยังใช้งานได้
  getAll: async (req, res) => {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const now = new Date();

      const where = {
        ...(search && { name: { contains: search, mode: "insensitive" } }),
        ...(!isAdmin && {
          startDate: { lte: now },
          endDate: { gte: now },
        }),
      };

      const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { startDate: "desc" },
        }),
        prisma.promotion.count({ where }),
      ]);

      return response.success(res, 200, "รายการโปรโมชัน", {
        promotions,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /promotions/:id
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const isAdmin = req.user.role === "ADMIN";

      const promotion = await prisma.promotion.findUnique({ where: { id } });

      if (!promotion) {
        return response.error(res, 404, "ไม่พบโปรโมชัน");
      }

      // User เห็นเฉพาะโปรโมชันที่ยังใช้งานได้ ให้สอดคล้องกับ getAll
      if (!isAdmin) {
        const now = new Date();
        if (promotion.startDate > now || promotion.endDate < now) {
          return response.error(res, 404, "ไม่พบโปรโมชัน");
        }
      }

      return response.success(res, 200, "ข้อมูลโปรโมชัน", promotion);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /promotions — Admin only
  create: async (req, res) => {
    try {
      let { name, discount, startDate, endDate } = req.body;

      name = name?.trim();

      if (!name || discount == null || !startDate || !endDate) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      if (
        isNaN(Number(discount)) ||
        Number(discount) <= 0 ||
        Number(discount) > 100
      ) {
        return response.error(res, 400, "ส่วนลดต้องอยู่ระหว่าง 0.01 - 100");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");
      }

      if (end <= start) {
        return response.error(res, 400, "วันสิ้นสุดต้องมากกว่าวันเริ่มต้น");
      }

      const promotion = await prisma.promotion.create({
        data: {
          name,
          discount: Number(discount),
          startDate: start,
          endDate: end,
        },
      });

      return response.success(res, 201, "เพิ่มโปรโมชันสำเร็จ", promotion);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PUT /promotions/:id — Admin only
  update: async (req, res) => {
    try {
      const id = Number(req.params.id);
      let { name, discount, startDate, endDate } = req.body;

      name = name?.trim();

      if (!name || discount == null || !startDate || !endDate) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      if (
        isNaN(Number(discount)) ||
        Number(discount) <= 0 ||
        Number(discount) > 100
      ) {
        return response.error(res, 400, "ส่วนลดต้องอยู่ระหว่าง 0.01 - 100");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return response.error(res, 400, "รูปแบบวันที่ไม่ถูกต้อง");
      }

      if (end <= start) {
        return response.error(res, 400, "วันสิ้นสุดต้องมากกว่าวันเริ่มต้น");
      }

      const promotion = await prisma.promotion.update({
        where: { id },
        data: {
          name,
          discount: Number(discount),
          startDate: start,
          endDate: end,
        },
      });

      return response.success(res, 200, "อัปเดตโปรโมชันสำเร็จ", promotion);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบโปรโมชัน");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /promotions/:id — Admin only
  remove: async (req, res) => {
    try {
      const id = Number(req.params.id);

      // ตรวจว่ามี rental ที่ยัง active ใช้ promotion นี้อยู่ไหม
      const activeRental = await prisma.rental.findFirst({
        where: {
          promotionId: id,
          status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "LATE"] },
        },
        select: { id: true, code: true, status: true },
      });
      if (activeRental) {
        return response.error(
          res,
          400,
          `ไม่สามารถลบได้ เนื่องจากมีรายการเช่าที่ใช้โปรโมชันนี้อยู่ (${activeRental.code} - ${activeRental.status})`,
        );
      }

      await prisma.promotion.delete({ where: { id } });

      return response.success(res, 200, "ลบโปรโมชันสำเร็จ");
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบโปรโมชัน");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};