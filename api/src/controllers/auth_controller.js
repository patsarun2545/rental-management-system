const prisma = require("../lib/client");
const response = require("../utils/response.utils");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

if (!process.env.SECRET_KEY) {
  throw new Error("SECRET_KEY environment variable is not configured");
}
module.exports = {
  signUp: async (req, res) => {
    try {
      let { email, password, name, phone } = req.body;

      if (typeof email !== "string") {
        return response.error(res, 400, "รูปแบบ email ไม่ถูกต้อง");
      }

      email = email?.trim().toLowerCase();
      name = name?.trim();
      phone = phone?.trim() || null;

      if (!email || !password || !name) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบ");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return response.error(res, 400, "รูปแบบ email ไม่ถูกต้อง");
      }

      if (phone) {
        const phoneRegex = /^0[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          return response.error(res, 400, "รูปแบบเบอร์โทรไม่ถูกต้อง");
        }
      }

      if (password.length < 8) {
        return response.error(res, 400, "รหัสผ่านต้องอย่างน้อย 8 ตัว");
      }

      if (!/[A-Z]/.test(password)) {
        return response.error(res, 400, "ต้องมีตัวพิมพ์ใหญ่ 1 ตัว");
      }

      if (!/[0-9]/.test(password)) {
        return response.error(res, 400, "ต้องมีตัวเลข 1 ตัว");
      }

      const hashPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashPassword,
          name,
          phone,
          role: "USER",
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      return response.success(res, 201, "สมัครสมาชิกสำเร็จ", newUser);
    } catch (e) {
      if (e.code === "P2002") {
        return response.error(res, 409, "email นี้ถูกใช้งานแล้ว");
      }
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  signIn: async (req, res) => {
    try {
      let { email, password } = req.body;

      email = email?.trim().toLowerCase();

      if (!email || !password) {
        return response.error(res, 400, "กรุณากรอก email และ password");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return response.error(res, 400, "รูปแบบ email ไม่ถูกต้อง");
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, password: true, role: true },
      });

      if (!user) {
        await bcrypt.compare(password, "$2a$12$dummyhashdummyhashdummyhashdum");
        return response.error(res, 401, "email หรือ password ไม่ถูกต้อง");
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return response.error(res, 401, "email หรือ password ไม่ถูกต้อง");
      }

      const payload = { id: user.id, name: user.name, role: user.role };

      const token = jwt.sign(payload, process.env.SECRET_KEY, {
        expiresIn: "4h",
        algorithm: "HS256",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 4 * 60 * 60 * 1000,
      });

      return response.success(res, 200, "เข้าสู่ระบบสำเร็จ", {
        id: user.id,
        name: user.name,
        role: user.role,
        token,
      });
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  signOut: async (req, res) => {
    try {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      return response.success(res, 200, "Logout สำเร็จ");
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },

  me: async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });

      if (!user) return response.error(res, 404, "ไม่มีข้อมูลผู้ใช้");

      return response.success(res, 200, "ข้อมูลผู้ใช้", user);
    } catch (e) {
      return response.error(res, 500, "เกิดข้อผิดพลาดในระบบ");
    }
  },
};
