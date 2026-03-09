const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const bcrypt = require("bcryptjs");

// ============================================================
// USER
// ============================================================

module.exports = {
  // GET /users — Admin only
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return response.success(res, 200, "รายการผู้ใช้ทั้งหมด", {
        users,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/:id — Admin or self
  getById: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.role !== "ADMIN" && req.user.id !== id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          addresses: { select: { id: true, address: true } },
        },
      });

      if (!user) return response.error(res, 404, "ไม่พบผู้ใช้");

      return response.success(res, 200, "ข้อมูลผู้ใช้", user);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PUT /users/:id — Admin or self
  update: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.role !== "ADMIN" && req.user.id !== id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      let { name, phone } = req.body;
      name = name?.trim();
      phone = phone?.trim() || null;

      if (!name) return response.error(res, 400, "กรุณากรอกชื่อ");

      if (phone) {
        const phoneRegex = /^0[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          return response.error(res, 400, "รูปแบบเบอร์โทรไม่ถูกต้อง");
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: { name, phone },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });

      return response.success(res, 200, "อัปเดตข้อมูลสำเร็จ", user);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบผู้ใช้");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /users/:id/password — self only
  changePassword: async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (req.user.id !== id) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      if (newPassword.length < 8)
        return response.error(res, 400, "รหัสผ่านต้องอย่างน้อย 8 ตัว");
      if (!/[A-Z]/.test(newPassword))
        return response.error(res, 400, "ต้องมีตัวพิมพ์ใหญ่ 1 ตัว");
      if (!/[0-9]/.test(newPassword))
        return response.error(res, 400, "ต้องมีตัวเลข 1 ตัว");

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return response.error(res, 404, "ไม่พบผู้ใช้");

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return response.error(res, 400, "รหัสผ่านเดิมไม่ถูกต้อง");

      const hashPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id },
        data: { password: hashPassword },
      });

      return response.success(res, 200, "เปลี่ยนรหัสผ่านสำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PATCH /users/:id/role — Admin only
  changeRole: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { role } = req.body;

      const validRoles = ["USER", "ADMIN"];
      if (!validRoles.includes(role)) {
        return response.error(res, 400, "Role ไม่ถูกต้อง");
      }

      // กัน admin ลด role ตัวเองหรือลด admin คนสุดท้าย
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) return response.error(res, 404, "ไม่พบผู้ใช้");

      if (target.role === "ADMIN" && role !== "ADMIN") {
        if (req.user.id === id) {
          return response.error(res, 400, "ไม่สามารถลด role ตัวเองได้");
        }
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) {
          return response.error(res, 400, "ไม่สามารถลด role ได้ เนื่องจากเป็น Admin คนสุดท้ายในระบบ");
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, name: true, role: true },
      });

      return response.success(res, 200, "อัปเดต role สำเร็จ", user);
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบผู้ใช้");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /users/:id — Admin only
  remove: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return response.error(res, 404, "ไม่พบผู้ใช้");

      // กัน admin ลบ account ตัวเองหรือลบ admin คนสุดท้าย
      if (req.user.id === id) {
        return response.error(res, 400, "ไม่สามารถลบ account ตัวเองได้");
      }
      const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (targetUser?.role === "ADMIN") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) {
          return response.error(res, 400, "ไม่สามารถลบ Admin คนสุดท้ายในระบบได้");
        }
      }

      // ป้องกัน FK error: ตรวจ active rental ก่อนลบ
      const activeRental = await prisma.rental.findFirst({
        where: {
          userId: id,
          status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "LATE"] },
        },
        select: { id: true, code: true, status: true },
      });

      if (activeRental) {
        return response.error(
          res,
          400,
          `ไม่สามารถลบผู้ใช้ได้ เนื่องจากมีรายการเช่าที่ยังดำเนินการอยู่ (${activeRental.code} - ${activeRental.status})`,
        );
      }

      await prisma.user.delete({ where: { id } });
      return response.success(res, 200, "ลบผู้ใช้สำเร็จ");
    } catch (e) {
      if (e.code === "P2025") return response.error(res, 404, "ไม่พบผู้ใช้");
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // RENTAL (sub-resource of User)
  // ============================================================

  // GET /users/me/rentals — ดูประวัติเช่าของตัวเอง
  getMyRentals: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const validStatuses = ["PENDING", "CONFIRMED", "ACTIVE", "RETURNED", "LATE", "CANCELLED", "COMPLETED"];
      const where = {
        userId,
        ...(status && validStatuses.includes(status) && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
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
                        images: { where: { isMain: true }, select: { imageUrl: true }, take: 1 },
                      },
                    },
                    size: { select: { id: true, name: true } },
                    color: { select: { id: true, name: true, hex: true } },
                  },
                },
              },
            },
            payments: { orderBy: { createdAt: "desc" } },
            deposit: true,
            penalties: true,
            returnLog: true,
            invoice: true,
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, "ประวัติการเช่า", {
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/:id/rentals — Admin: ดูประวัติเช่าของ user คนใดก็ได้
  getRentalsByUser: async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return response.error(res, 404, "ไม่พบผู้ใช้");

      const validStatuses = ["PENDING", "CONFIRMED", "ACTIVE", "RETURNED", "LATE", "CANCELLED", "COMPLETED"];
      const where = {
        userId,
        ...(status && validStatuses.includes(status) && { status }),
      };

      const [rentals, total] = await Promise.all([
        prisma.rental.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
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
                        images: { where: { isMain: true }, select: { imageUrl: true }, take: 1 },
                      },
                    },
                    size: { select: { id: true, name: true } },
                    color: { select: { id: true, name: true, hex: true } },
                  },
                },
              },
            },
            payments: { orderBy: { createdAt: "desc" } },
            deposit: true,
            penalties: true,
            returnLog: true,
            invoice: true,
          },
        }),
        prisma.rental.count({ where }),
      ]);

      return response.success(res, 200, `ประวัติการเช่าของ ${user.name}`, {
        user: { id: user.id, name: user.name, email: user.email },
        rentals,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // ============================================================
  // ADDRESS (sub-resource of User)
  // ============================================================

  // GET /addresses — Admin only: ดูที่อยู่ทั้งหมดในระบบ
  getAllAddresses: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = "" } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search
        ? { address: { contains: search, mode: "insensitive" } }
        : {};

      const [addresses, total] = await Promise.all([
        prisma.address.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { id: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.address.count({ where }),
      ]);

      return response.success(res, 200, "รายการที่อยู่ทั้งหมด", {
        addresses,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/me/addresses
  getMyAddresses: async (req, res) => {
    try {
      const userId = req.user.id;
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: { id: "asc" },
      });
      return response.success(res, 200, "รายการที่อยู่", addresses);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/:userId/addresses — Admin only
  getAddressesByUser: async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const addresses = await prisma.address.findMany({
        where: { userId },
        orderBy: { id: "asc" },
      });
      return response.success(res, 200, "รายการที่อยู่", addresses);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /users/me/addresses
  createAddress: async (req, res) => {
    try {
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "กรุณากรอกที่อยู่");

      const newAddress = await prisma.address.create({
        data: { userId: req.user.id, address },
      });

      return response.success(res, 201, "เพิ่มที่อยู่สำเร็จ", newAddress);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // POST /users/:userId/addresses — Admin only
  createAddressForUser: async (req, res) => {
    try {
      let { address } = req.body;
      address = address?.trim();
      if (!address) return response.error(res, 400, "กรุณากรอกที่อยู่");

      const userId = Number(req.params.userId);
      const newAddress = await prisma.address.create({
        data: { userId, address },
      });
      return response.success(res, 201, "เพิ่มที่อยู่สำเร็จ", newAddress);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PUT /users/me/addresses/:id
  updateAddress: async (req, res) => {
    try {
      const id = Number(req.params.id);
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "กรุณากรอกที่อยู่");

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบที่อยู่");

      if (req.user.role !== "ADMIN" && existing.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์แก้ไข");
      }

      const updated = await prisma.address.update({
        where: { id },
        data: { address },
      });
      return response.success(res, 200, "อัปเดตที่อยู่สำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /users/me/addresses/:id
  removeAddress: async (req, res) => {
    try {
      const id = Number(req.params.id);

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบที่อยู่");

      if (req.user.role !== "ADMIN" && existing.userId !== req.user.id) {
        return response.error(res, 403, "ไม่มีสิทธิ์ลบ");
      }

      await prisma.address.delete({ where: { id } });
      return response.success(res, 200, "ลบที่อยู่สำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/:userId/addresses/:id — Admin or self
  getAddressById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);

      if (req.user.role !== "ADMIN" && req.user.id !== userId) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      const address = await prisma.address.findUnique({ where: { id } });
      if (!address) return response.error(res, 404, "ไม่พบที่อยู่");

      if (address.userId !== userId) {
        return response.error(res, 400, "ที่อยู่ไม่ตรงกับผู้ใช้");
      }

      return response.success(res, 200, "ข้อมูลที่อยู่", address);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // GET /users/me/addresses/:id — self
  getMyAddressById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user.id;

      const address = await prisma.address.findUnique({ where: { id } });
      if (!address) return response.error(res, 404, "ไม่พบที่อยู่");

      if (address.userId !== userId) {
        return response.error(res, 403, "ไม่มีสิทธิ์เข้าถึง");
      }

      return response.success(res, 200, "ข้อมูลที่อยู่", address);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // PUT /users/:userId/addresses/:id (Admin)
  updateAddressForUser: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);
      let { address } = req.body;
      address = address?.trim();

      if (!address) return response.error(res, 400, "กรุณากรอกที่อยู่");

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบที่อยู่");
      if (existing.userId !== userId)
        return response.error(res, 400, "ที่อยู่ไม่ตรงกับผู้ใช้");

      const updated = await prisma.address.update({
        where: { id },
        data: { address },
      });
      return response.success(res, 200, "อัปเดตที่อยู่สำเร็จ", updated);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  // DELETE /users/:userId/addresses/:id (Admin)
  removeAddressForUser: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.params.userId);

      const existing = await prisma.address.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบที่อยู่");
      if (existing.userId !== userId)
        return response.error(res, 400, "ที่อยู่ไม่ตรงกับผู้ใช้");

      await prisma.address.delete({ where: { id } });
      return response.success(res, 200, "ลบที่อยู่สำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};