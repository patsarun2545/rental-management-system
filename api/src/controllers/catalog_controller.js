const prisma = require("../lib/client");
const response = require("../utils/response.utils");

// ============================================================
// CATEGORY
// ============================================================

module.exports = {
  // POST /categories
  createCategory: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "กรุณากรอกชื่อหมวดหมู่");

      const exist = await prisma.category.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (exist) return response.error(res, 400, "หมวดหมู่นี้มีอยู่แล้ว");

      const category = await prisma.category.create({ data: { name } });
      return response.success(res, 201, "เพิ่มหมวดหมู่สำเร็จ", category);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อหมวดหมู่ซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // GET /categories
  getAllCategories: async (req, res) => {
    try {
      const { search, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      };

      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          include: {
            types: true,
            _count: { select: { products: { where: { isDeleted: false } } } },
          },
          orderBy: { id: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.category.count({ where }),
      ]);

      return response.success(res, 200, "ข้อมูลหมวดหมู่", {
        data: categories,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /categories/:id
  getCategoryById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัสหมวดหมู่ไม่ถูกต้อง");

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          types: true,
          products: { where: { isDeleted: false } },
        },
      });

      if (!category) return response.error(res, 404, "ไม่พบหมวดหมู่");
      return response.success(res, 200, "ข้อมูลหมวดหมู่", category);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /categories/:id
  updateCategory: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const name = req.body.name?.trim();

      if (isNaN(id)) return response.error(res, 400, "รหัสหมวดหมู่ไม่ถูกต้อง");
      if (!name) return response.error(res, 400, "กรุณากรอกชื่อหมวดหมู่");

      const existCategory = await prisma.category.findUnique({ where: { id } });
      if (!existCategory) return response.error(res, 404, "ไม่พบหมวดหมู่");

      const duplicate = await prisma.category.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
      });
      if (duplicate) return response.error(res, 400, "ชื่อหมวดหมู่นี้ถูกใช้แล้ว");

      const category = await prisma.category.update({ where: { id }, data: { name } });
      return response.success(res, 200, "แก้ไขข้อมูลหมวดหมู่สำเร็จ", category);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /categories/:id
  deleteCategory: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัสหมวดหมู่ไม่ถูกต้อง");

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          types: true,
          products: true, // รวม soft-deleted เพราะยังมี FK ชี้อยู่
        },
      });

      if (!category) return response.error(res, 404, "ไม่พบหมวดหมู่");
      if (category.types.length > 0) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจากมีประเภทสินค้าอยู่ในหมวดหมู่นี้");
      }
      if (category.products.length > 0) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจากมีสินค้าอยู่ในหมวดหมู่นี้ (รวมสินค้าที่ถูกลบแล้ว)");
      }

      await prisma.category.delete({ where: { id } });
      return response.success(res, 200, "ลบหมวดหมู่สำเร็จ");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // TYPE (sub-resource of Category)
  // ============================================================

  // POST /types
  createType: async (req, res) => {
    try {
      let { name, categoryId } = req.body;
      name = name?.trim();
      categoryId = Number(categoryId);

      if (!name || isNaN(categoryId)) {
        return response.error(res, 400, "กรุณากรอกข้อมูลให้ครบถ้วน");
      }

      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) return response.error(res, 404, "ไม่พบหมวดหมู่");

      const exist = await prisma.type.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, categoryId },
      });
      if (exist) return response.error(res, 400, "ประเภทนี้มีอยู่แล้วในหมวดหมู่นี้");

      const type = await prisma.type.create({
        data: { name, categoryId },
        include: { category: true },
      });
      return response.success(res, 201, "สร้างประเภทสำเร็จ", type);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อประเภทซ้ำในหมวดหมู่นี้");
      return response.error(res, 500, e.message);
    }
  },

  // GET /types
  getAllTypes: async (req, res) => {
    try {
      const { search, categoryId, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const catId = categoryId ? Number(categoryId) : undefined;

      const where = {
        categoryId: catId && !isNaN(catId) ? catId : undefined,
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      };

      const [types, total] = await Promise.all([
        prisma.type.findMany({
          where,
          include: {
            category: true,
            _count: { select: { products: { where: { isDeleted: false } } } },
          },
          orderBy: { id: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.type.count({ where }),
      ]);

      return response.success(res, 200, "ข้อมูลประเภท", {
        data: types,
        total,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /types/:id
  getTypeById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัสประเภทไม่ถูกต้อง");

      const type = await prisma.type.findUnique({
        where: { id },
        include: {
          category: true,
          products: { where: { isDeleted: false } },
        },
      });

      if (!type) return response.error(res, 404, "ไม่พบข้อมูลประเภท");
      return response.success(res, 200, "ข้อมูลประเภท", type);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // PUT /types/:id
  updateType: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัสประเภทไม่ถูกต้อง");

      let { name, categoryId } = req.body;

      const existing = await prisma.type.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบประเภท");

      name = name?.trim();
      const newCategoryId = categoryId ? Number(categoryId) : existing.categoryId;

      if (categoryId) {
        if (isNaN(newCategoryId)) return response.error(res, 400, "หมวดหมู่ไม่ถูกต้อง");
        const category = await prisma.category.findUnique({ where: { id: newCategoryId } });
        if (!category) return response.error(res, 404, "ไม่พบหมวดหมู่");
      }

      if (name) {
        const duplicate = await prisma.type.findFirst({
          where: {
            name: { equals: name, mode: "insensitive" },
            categoryId: newCategoryId,
            NOT: { id },
          },
        });
        if (duplicate) return response.error(res, 400, "ชื่อประเภทนี้ถูกใช้แล้ว");
      }

      const updated = await prisma.type.update({
        where: { id },
        data: {
          name: name || undefined,
          categoryId: categoryId ? newCategoryId : undefined,
        },
        include: { category: true },
      });

      return response.success(res, 200, "แก้ไขข้อมูลประเภทสำเร็จ", updated);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อประเภทซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /types/:id
  deleteType: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัสประเภทไม่ถูกต้อง");

      const type = await prisma.type.findUnique({
        where: { id },
        include: { products: true }, // รวม soft-deleted เพราะยังมี FK ชี้อยู่
      });

      if (!type) return response.error(res, 404, "ไม่พบประเภท");
      if (type.products.length > 0) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจากมีสินค้าอยู่ในประเภทนี้ (รวมสินค้าที่ถูกลบแล้ว)");
      }

      await prisma.type.delete({ where: { id } });
      return response.success(res, 200, "ลบข้อมูลประเภทสำเร็จ");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // SIZE
  // ============================================================

  // POST /catalog/sizes — Admin only
  createSize: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "กรุณากรอกชื่อ size");

      const exist = await prisma.size.findUnique({ where: { name } });
      if (exist) return response.error(res, 400, "size นี้มีอยู่แล้ว");

      const size = await prisma.size.create({ data: { name } });
      return response.success(res, 201, "เพิ่ม size สำเร็จ", size);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อ size ซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // PUT /catalog/sizes/:id — Admin only
  updateSize: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส size ไม่ถูกต้อง");

      const name = req.body.name?.trim();
      if (!name) return response.error(res, 400, "กรุณากรอกชื่อ size");

      const existing = await prisma.size.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบ size");

      const duplicate = await prisma.size.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) return response.error(res, 400, "ชื่อ size นี้ถูกใช้แล้ว");

      const size = await prisma.size.update({ where: { id }, data: { name } });
      return response.success(res, 200, "แก้ไข size สำเร็จ", size);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อ size ซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // GET /catalog/sizes
  getAllSizes: async (req, res) => {
    try {
      const { search } = req.query;

      const sizes = await prisma.size.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
        include: { _count: { select: { variants: true } } },
        orderBy: { name: "asc" },
      });

      return response.success(res, 200, "ข้อมูล Size", sizes);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /catalog/sizes/:id
  getSizeById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส size ไม่ถูกต้อง");

      const size = await prisma.size.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!size) return response.error(res, 404, "ไม่พบ size");
      return response.success(res, 200, "ข้อมูล Size", size);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /catalog/sizes/:id — Admin only (ลบได้เฉพาะที่ไม่มี variant ใช้)
  deleteSize: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส size ไม่ถูกต้อง");

      const size = await prisma.size.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!size) return response.error(res, 404, "ไม่พบ size");

      if (size._count.variants > 0) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจาก size นี้มี variant ใช้งานอยู่");
      }

      await prisma.size.delete({ where: { id } });
      return response.success(res, 200, "ลบ size สำเร็จ");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // ============================================================
  // COLOR
  // ============================================================

  // POST /catalog/colors — Admin only
  createColor: async (req, res) => {
    try {
      const name = req.body.name?.trim();
      const hex = req.body.hex?.trim() || null;

      if (!name) return response.error(res, 400, "กรุณากรอกชื่อ color");

      if (hex && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        return response.error(res, 400, "รูปแบบ hex color ไม่ถูกต้อง เช่น #FFFFFF");
      }

      const exist = await prisma.color.findUnique({ where: { name } });
      if (exist) return response.error(res, 400, "color นี้มีอยู่แล้ว");

      const color = await prisma.color.create({ data: { name, hex } });
      return response.success(res, 201, "เพิ่ม color สำเร็จ", color);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อ color ซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // PUT /catalog/colors/:id — Admin only
  updateColor: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส color ไม่ถูกต้อง");

      const name = req.body.name?.trim();
      const hex = req.body.hex?.trim() || null;

      if (!name) return response.error(res, 400, "กรุณากรอกชื่อ color");

      if (hex && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
        return response.error(res, 400, "รูปแบบ hex color ไม่ถูกต้อง เช่น #FFFFFF");
      }

      const existing = await prisma.color.findUnique({ where: { id } });
      if (!existing) return response.error(res, 404, "ไม่พบ color");

      const duplicate = await prisma.color.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) return response.error(res, 400, "ชื่อ color นี้ถูกใช้แล้ว");

      const color = await prisma.color.update({ where: { id }, data: { name, hex } });
      return response.success(res, 200, "แก้ไข color สำเร็จ", color);
    } catch (e) {
      if (e.code === "P2002") return response.error(res, 400, "ชื่อ color ซ้ำ");
      return response.error(res, 500, e.message);
    }
  },

  // GET /catalog/colors
  getAllColors: async (req, res) => {
    try {
      const { search } = req.query;

      const colors = await prisma.color.findMany({
        where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
        include: { _count: { select: { variants: true } } },
        orderBy: { name: "asc" },
      });

      return response.success(res, 200, "ข้อมูล Color", colors);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // GET /catalog/colors/:id
  getColorById: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส color ไม่ถูกต้อง");

      const color = await prisma.color.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!color) return response.error(res, 404, "ไม่พบ color");
      return response.success(res, 200, "ข้อมูล Color", color);
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },

  // DELETE /catalog/colors/:id — Admin only (ลบได้เฉพาะที่ไม่มี variant ใช้)
  deleteColor: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return response.error(res, 400, "รหัส color ไม่ถูกต้อง");

      const color = await prisma.color.findUnique({
        where: { id },
        include: { _count: { select: { variants: true } } },
      });

      if (!color) return response.error(res, 404, "ไม่พบ color");

      if (color._count.variants > 0) {
        return response.error(res, 400, "ไม่สามารถลบได้ เนื่องจาก color นี้มี variant ใช้งานอยู่");
      }

      await prisma.color.delete({ where: { id } });
      return response.success(res, 200, "ลบ color สำเร็จ");
    } catch (e) {
      return response.error(res, 500, e.message);
    }
  },
};