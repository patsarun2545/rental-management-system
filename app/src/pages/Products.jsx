import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import { getImageUrl } from "../utils/image.utils";
import api from "../services/axios";

export default function Products() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // FORM STATE
  // =========================
  const [form, setForm] = useState({
    id: null,
    name: "",
    description: "",
    brand: "",
    price: "",
    categoryId: "",
    typeId: "",
    status: "ACTIVE",
  });

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  // =========================
  // VARIANT STATE
  // =========================
  const [variantProduct, setVariantProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [variantOpen, setVariantOpen] = useState(false);
  const [varForm, setVarForm] = useState({
    id: null,
    sizeId: "",
    colorId: "",
    price: "",
    stock: "",
    sku: "",
  });
  const [varSaving, setVarSaving] = useState(false);
  const [varRemoving, setVarRemoving] = useState(null);

  // =========================
  // IMAGE STATE (ใช้ใน modal สร้าง/แก้ไข)
  // =========================
  const [images, setImages] = useState([]); // รูปที่มีอยู่ใน DB (กรณี edit)
  const [imageFiles, setImageFiles] = useState([]); // ไฟล์ใหม่ที่รอ upload
  const [imagePreviewUrls, setImagePreviewUrls] = useState([]); // preview ก่อน upload
  const [imageRemoving, setImageRemoving] = useState(null);

  // =========================
  // CATEGORIES / TYPES
  // =========================
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  useEffect(() => {
    api
      .get("/api/catalog/categories", { params: { limit: 100 } })
      .then((r) => setCategories(r.data.result.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.categoryId) {
      setTypes([]);
      return;
    }
    api
      .get("/api/catalog/types", {
        params: { categoryId: form.categoryId, limit: 100 },
      })
      .then((r) => setTypes(r.data.result.data))
      .catch(() => {});
  }, [form.categoryId]);

  useEffect(() => {
    api
      .get("/api/catalog/sizes")
      .then((r) => setSizes(r.data.result))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get("/api/catalog/colors")
      .then((r) => setColors(r.data.result))
      .catch(() => {});
  }, []);

  // =========================
  // DEBOUNCE SEARCH
  // =========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/products", {
        params: {
          page,
          limit,
          search: debouncedSearch,
          status: statusFilter || undefined,
          categoryId: categoryFilter || undefined,
        },
      });
      setData(res.data.result.data);
      setTotal(res.data.result.total);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // FORM HANDLER
  // =========================
  const clearForm = () => {
    setForm({
      id: null,
      name: "",
      description: "",
      brand: "",
      price: "",
      categoryId: "",
      typeId: "",
      status: "ACTIVE",
    });
    setImages([]);
    setImageFiles([]);
    setImagePreviewUrls([]);
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.categoryId || !form.typeId)
      return showError("กรุณากรอกข้อมูลให้ครบ");

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description,
        brand: form.brand,
        price: form.price || undefined,
        categoryId: form.categoryId,
        typeId: form.typeId,
        status: form.status,
      };

      let productId = form.id;

      if (!form.id) {
        const res = await api.post("/api/products", payload);
        productId = res.data.result.id;
        showSuccess("เพิ่มสำเร็จ");
      } else {
        await api.put(`/api/products/${form.id}`, payload);
        showSuccess("แก้ไขสำเร็จ");
      }

      // อัปโหลดรูปใหม่ถ้ามี
      if (imageFiles.length > 0) {
        const formData = new FormData();
        imageFiles.forEach((f) => formData.append("images", f));
        await api.post(`/api/products/${productId}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      clearForm();
      setOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (item) => {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      brand: item.brand || "",
      price: item.price || "",
      categoryId: item.categoryId,
      typeId: item.typeId,
      status: item.status,
    });
    setImageFiles([]);
    setImagePreviewUrls([]);
    try {
      const res = await api.get(`/api/products/${item.id}/images`);
      setImages(res.data.result);
    } catch (_) {
      setImages([]);
    }
    setOpen(true);
  };

  const handleRemove = async (item) => {
    if (removing) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ต้องการลบ "${item.name}" หรือไม่`,
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setRemoving(item.id);
      await api.delete(`/api/products/${item.id}`);
      showSuccess("ลบสำเร็จ");
      if (data.length === 1 && page > 1) setPage((prev) => prev - 1);
      else fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await api.patch(`/api/products/${item.id}/status`);
      showSuccess("เปลี่ยนสถานะสำเร็จ");
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  // =========================
  // VARIANT HANDLER
  // =========================
  const openVariants = async (product) => {
    setVariantProduct(product);
    setVarForm({
      id: null,
      sizeId: "",
      colorId: "",
      price: "",
      stock: "",
      sku: "",
    });
    try {
      const res = await api.get(`/api/products/${product.id}/variants`);
      setVariants(res.data.result);
    } catch (e) {
      showError(e);
    }
    setVariantOpen(true);
  };

  const clearVarForm = () =>
    setVarForm({
      id: null,
      sizeId: "",
      colorId: "",
      price: "",
      stock: "",
      sku: "",
    });

  const handleVarChange = (key, value) =>
    setVarForm((prev) => ({ ...prev, [key]: value }));

  const handleVarSave = async () => {
    if (varSaving) return;
    if (!varForm.price || !varForm.sku)
      return showError("กรุณากรอกข้อมูลให้ครบ");
    if (!varForm.id && (!varForm.sizeId || !varForm.colorId))
      return showError("กรุณากรอก size และ color");

    try {
      setVarSaving(true);
      if (!varForm.id) {
        await api.post(`/api/products/${variantProduct.id}/variants`, {
          sizeId: varForm.sizeId,
          colorId: varForm.colorId,
          price: varForm.price,
          stock: varForm.stock || 0,
          sku: varForm.sku,
        });
        showSuccess("เพิ่ม variant สำเร็จ");
      } else {
        await api.put(`/api/products/variants/${varForm.id}`, {
          price: varForm.price,
          stock: varForm.stock,
          sku: varForm.sku,
        });
        showSuccess("แก้ไข variant สำเร็จ");
      }
      const res = await api.get(`/api/products/${variantProduct.id}/variants`);
      setVariants(res.data.result);
      clearVarForm();
    } catch (e) {
      showError(e);
    } finally {
      setVarSaving(false);
    }
  };

  const handleVarRemove = async (v) => {
    if (varRemoving) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ลบ variant SKU: ${v.sku}?`,
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setVarRemoving(v.id);
      await api.delete(`/api/products/variants/${v.id}`);
      showSuccess("ลบสำเร็จ");
      setVariants((prev) => prev.filter((x) => x.id !== v.id));
    } catch (e) {
      showError(e);
    } finally {
      setVarRemoving(null);
    }
  };

  // =========================
  // IMAGE HANDLER (ใน modal สร้าง/แก้ไข)
  // =========================
  const handleSetMain = async (img) => {
    try {
      await api.patch(`/api/products/images/${img.id}/main`);
      showSuccess("ตั้งรูปหลักสำเร็จ");
      const res = await api.get(`/api/products/${form.id}/images`);
      setImages(res.data.result);
    } catch (e) {
      showError(e);
    }
  };

  const handleImageRemove = async (img) => {
    if (imageRemoving) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      "ลบรูปภาพนี้?",
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setImageRemoving(img.id);
      await api.delete(`/api/products/images/${img.id}`);
      setImages((prev) => prev.filter((x) => x.id !== img.id));
    } catch (e) {
      showError(e);
    } finally {
      setImageRemoving(null);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการสินค้า</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>

        <div className="card-body">
          {/* FILTER + ADD */}
          <div className="row mb-3 g-2">
            <div className="col-md-3">
              <input
                className="form-control rounded"
                placeholder="ค้นหาสินค้า"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">ทุกสถานะ</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearForm();
                  setOpen(true);
                }}
              >
                + เพิ่มสินค้า
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th width="50">รูป</th>
                  <th>ชื่อสินค้า</th>
                  <th>Brand</th>
                  <th>หมวดหมู่</th>
                  <th>ประเภท</th>
                  <th>ราคา</th>
                  <th>สถานะ</th>
                  <th width="220" className="text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td className="text-center p-1">
                        {item.images?.find((img) => img.isMain)?.imageUrl ? (
                          <img
                            src={getImageUrl(
                              item.images.find((img) => img.isMain).imageUrl,
                            )}
                            alt=""
                            style={{
                              width: 50,
                              height: 50,
                              objectFit: "contain",
                              borderRadius: 4,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              background: "#f0f0f0",
                              borderRadius: 4,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: 18, color: "#bbb" }}>
                              📷
                            </span>
                          </div>
                        )}
                      </td>
                      <td>{item.name}</td>
                      <td>{item.brand || "-"}</td>
                      <td>{item.category?.name}</td>
                      <td>{item.type?.name}</td>
                      <td>{item.price}</td>
                      <td>
                        <span
                          className={`badge bg-${item.status === "ACTIVE" ? "success" : "secondary"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-1"
                          disabled={!!removing}
                          onClick={() => handleEdit(item)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-warning btn-sm me-1"
                          onClick={() => handleToggleStatus(item)}
                        >
                          {item.status === "ACTIVE" ? "ปิด" : "เปิด"}
                        </button>
                        <button
                          className="btn btn-outline-info btn-sm me-1"
                          onClick={() => openVariants(item)}
                        >
                          Variant
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing}
                          onClick={() => handleRemove(item)}
                        >
                          {removing === item.id ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-1"
                                role="status"
                              />
                              ลบ...
                            </>
                          ) : (
                            "ลบ"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="mt-3 d-flex justify-content-center align-items-center">
            <button
              className="btn btn-outline-secondary me-2"
              disabled={page === 1 || loading}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Previous
            </button>
            <span>
              หน้า {page} / {totalPages}
            </span>
            <button
              className="btn btn-outline-secondary ms-2"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL PRODUCT */}
      <MyModal
        id="modalProduct"
        title={form.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
        open={open}
        onClose={() => {
          if (saving) return;
          setOpen(false);
        }}
      >
        <input
          className="form-control mb-2"
          placeholder="ชื่อสินค้า *"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          disabled={saving}
        />
        <input
          className="form-control mb-2"
          placeholder="Brand"
          value={form.brand}
          onChange={(e) => handleChange("brand", e.target.value)}
          disabled={saving}
        />
        <input
          type="number"
          className="form-control mb-2"
          placeholder="ราคาอ้างอิง"
          value={form.price}
          onChange={(e) => handleChange("price", e.target.value)}
          disabled={saving}
        />
        <textarea
          className="form-control mb-2"
          placeholder="คำอธิบาย"
          rows={2}
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          disabled={saving}
        />
        <select
          className="form-select mb-2"
          value={form.categoryId}
          onChange={(e) => handleChange("categoryId", e.target.value)}
          disabled={saving}
        >
          <option value="">-- เลือกหมวดหมู่ --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="form-select mb-2"
          value={form.typeId}
          onChange={(e) => handleChange("typeId", e.target.value)}
          disabled={saving}
        >
          <option value="">-- เลือกประเภท --</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="form-select mb-3"
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          disabled={saving}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        {/* ===== IMAGES ===== */}
        <hr />
        <p className="fw-bold mb-2">รูปภาพสินค้า</p>

        {/* รูปที่มีอยู่แล้ว (กรณี edit) */}
        {images.length > 0 && (
          <div className="row g-2 mb-3">
            {images.map((img) => (
              <div key={img.id} className="col-4">
                <div
                  className={`border rounded p-1 position-relative${img.isMain ? " border-primary border-2" : ""}`}
                >
                  <img
                    src={getImageUrl(img.imageUrl)}
                    alt=""
                    className="img-fluid rounded mb-1"
                    style={{ height: 100, width: "100%", objectFit: "contain" }}
                  />
                  {img.isMain && (
                    <span
                      className="badge bg-primary position-absolute top-0 start-0 m-1"
                      style={{ fontSize: 10 }}
                    >
                      หลัก
                    </span>
                  )}
                  <div className="d-flex gap-1">
                    {!img.isMain && (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm flex-fill"
                        style={{ fontSize: 11, padding: "1px 4px" }}
                        disabled={!!imageRemoving || saving}
                        onClick={() => handleSetMain(img)}
                      >
                        ตั้งหลัก
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm flex-fill"
                      style={{ fontSize: 11, padding: "1px 4px" }}
                      disabled={
                        !!imageRemoving || saving || images.length === 1
                      }
                      onClick={() => handleImageRemove(img)}
                    >
                      {imageRemoving === img.id ? (
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                        />
                      ) : (
                        "ลบ"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* อัปโหลดรูปใหม่ */}
        <input
          type="file"
          className="form-control mb-1"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={saving}
          onChange={(e) => {
            const files = Array.from(e.target.files);
            setImageFiles(files);
            // revoke URLs เดิมก่อน สร้างใหม่
            imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
            setImagePreviewUrls(files.map((f) => URL.createObjectURL(f)));
          }}
        />
        {/* Preview รูปที่เลือกใหม่ */}
        {imagePreviewUrls.length > 0 && (
          <div className="row g-2 mb-2 mt-2">
            {imagePreviewUrls.map((url, i) => (
              <div key={i} className="col-4">
                <div
                  className="border rounded p-1 border-dashed"
                  style={{ borderStyle: "dashed" }}
                >
                  <img
                    src={url}
                    alt=""
                    className="img-fluid rounded"
                    style={{ height: 100, width: "100%", objectFit: "contain" }}
                  />
                  <p
                    className="text-muted text-center mb-0"
                    style={{ fontSize: 10 }}
                  >
                    ใหม่
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {imageFiles.length > 0 && (
          <p className="text-muted small mb-2">
            เลือก {imageFiles.length} ไฟล์ — จะอัปโหลดพร้อมบันทึก
          </p>
        )}

        <button
          className="btn btn-primary w-100 mt-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </MyModal>

      {/* MODAL VARIANT */}
      <MyModal
        id="modalVariant"
        title={`Variant — ${variantProduct?.name || ""}`}
        open={variantOpen}
        onClose={() => {
          if (varSaving) return;
          setVariantOpen(false);
        }}
      >
        <div className="table-responsive mb-3">
          <table className="table table-bordered table-hover table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>SKU</th>
                <th>Size</th>
                <th>Color</th>
                <th>ราคา</th>
                <th>Stock</th>
                <th width="100" className="text-center">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    ยังไม่มี variant
                  </td>
                </tr>
              ) : (
                variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.sku}</td>
                    <td>{v.size?.name}</td>
                    <td>{v.color?.name}</td>
                    <td>{v.price}</td>
                    <td>{v.stock}</td>
                    <td className="text-center">
                      <button
                        className="btn btn-outline-primary btn-sm me-1"
                        disabled={!!varRemoving}
                        onClick={() =>
                          setVarForm({
                            id: v.id,
                            size: v.size?.name,
                            color: v.color?.name,
                            price: v.price,
                            stock: v.stock,
                            sku: v.sku,
                          })
                        }
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        disabled={!!varRemoving}
                        onClick={() => handleVarRemove(v)}
                      >
                        {varRemoving === v.id ? (
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                          />
                        ) : (
                          "ลบ"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <hr />
        <p className="fw-bold mb-2">
          {varForm.id ? "แก้ไข Variant" : "เพิ่ม Variant"}
        </p>
        <div className="row g-2 mb-2">
          <div className="col-6">
            <select
              className="form-select"
              value={varForm.sizeId}
              onChange={(e) => handleVarChange("sizeId", e.target.value)}
            >
              <option value="">เลือก Size</option>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <select
              className="form-select"
              value={varForm.colorId}
              onChange={(e) => handleVarChange("colorId", e.target.value)}
            >
              <option value="">เลือก Color</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-4">
            <input
              type="number"
              className="form-control"
              placeholder="ราคา"
              value={varForm.price}
              disabled={varSaving}
              onChange={(e) => handleVarChange("price", e.target.value)}
            />
          </div>
          <div className="col-4">
            <input
              type="number"
              className="form-control"
              placeholder="Stock"
              value={varForm.stock}
              disabled={varSaving}
              onChange={(e) => handleVarChange("stock", e.target.value)}
            />
          </div>
          <div className="col-4">
            <input
              className="form-control"
              placeholder="SKU"
              value={varForm.sku}
              disabled={!!varForm.id || varSaving}
              onChange={(e) => handleVarChange("sku", e.target.value)}
            />
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-success flex-fill"
            onClick={handleVarSave}
            disabled={varSaving}
          >
            {varSaving ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                />
                กำลังบันทึก...
              </>
            ) : varForm.id ? (
              "อัปเดต"
            ) : (
              "เพิ่ม"
            )}
          </button>
          {varForm.id && (
            <button
              className="btn btn-outline-secondary"
              onClick={clearVarForm}
              disabled={varSaving}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </MyModal>
    </>
  );
}
