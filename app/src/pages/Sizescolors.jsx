import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

// ============================================================
// SIZES
// ============================================================
function Sizes() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ id: null, name: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/catalog/sizes", {
        params: { search: search || undefined },
      });
      setData(res.data.result);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const clearForm = () => setForm({ id: null, name: "" });

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) return showError("กรุณากรอกชื่อ size");
    try {
      setSaving(true);
      if (!form.id) {
        await api.post("/api/catalog/sizes", { name: form.name.trim() });
        showSuccess("เพิ่ม Size สำเร็จ");
      } else {
        await api.put(`/api/catalog/sizes/${form.id}`, {
          name: form.name.trim(),
        });
        showSuccess("แก้ไข Size สำเร็จ");
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

  const handleRemove = async (item) => {
    if (removing) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ลบ Size "${item.name}"?`,
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setRemoving(item.id);
      await api.delete(`/api/catalog/sizes/${item.id}`);
      showSuccess("ลบสำเร็จ");
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการ Size</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>
        <div className="card-body">
          <div className="row mb-3 g-2">
            <div className="col-md-5">
              <input
                className="form-control"
                placeholder="ค้นหา size"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-7 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearForm();
                  setOpen(true);
                }}
              >
                + เพิ่ม Size
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>ชื่อ Size</th>
                  <th>ใช้ใน Variant</th>
                  <th width="140" className="text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <span className="badge bg-secondary fs-6 fw-normal">
                          {item.name}
                        </span>
                      </td>
                      <td>{item._count?.variants ?? 0}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => {
                            setForm({ id: item.id, name: item.name });
                            setOpen(true);
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={
                            !!removing || (item._count?.variants ?? 0) > 0
                          }
                          onClick={() => handleRemove(item)}
                          title={
                            (item._count?.variants ?? 0) > 0
                              ? "ไม่สามารถลบได้ มี variant ใช้งาน"
                              : ""
                          }
                        >
                          {removing === item.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" />
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
        </div>
      </div>

      <MyModal
        id="modalSize"
        title={form.id ? "แก้ไข Size" : "เพิ่ม Size"}
        open={open}
        onClose={() => {
          if (saving) return;
          setOpen(false);
        }}
      >
        <input
          className="form-control mb-3"
          placeholder="ชื่อ Size เช่น S, M, L, XL"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          disabled={saving}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </MyModal>
    </>
  );
}

// ============================================================
// COLORS
// ============================================================
function Colors() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ id: null, name: "", hex: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/catalog/colors", {
        params: { search: search || undefined },
      });
      setData(res.data.result);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const clearForm = () => setForm({ id: null, name: "", hex: "" });

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) return showError("กรุณากรอกชื่อ color");
    try {
      setSaving(true);
      const payload = { name: form.name.trim(), hex: form.hex || undefined };
      if (!form.id) {
        await api.post("/api/catalog/colors", payload);
        showSuccess("เพิ่ม Color สำเร็จ");
      } else {
        await api.put(`/api/catalog/colors/${form.id}`, payload);
        showSuccess("แก้ไข Color สำเร็จ");
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

  const handleRemove = async (item) => {
    if (removing) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ลบ Color "${item.name}"?`,
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setRemoving(item.id);
      await api.delete(`/api/catalog/colors/${item.id}`);
      showSuccess("ลบสำเร็จ");
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="card shadow-sm mt-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการ Color</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>
        <div className="card-body">
          <div className="row mb-3 g-2">
            <div className="col-md-5">
              <input
                className="form-control"
                placeholder="ค้นหา color"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-7 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearForm();
                  setOpen(true);
                }}
              >
                + เพิ่ม Color
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>สี</th>
                  <th>ชื่อ Color</th>
                  <th>Hex</th>
                  <th>ใช้ใน Variant</th>
                  <th width="140" className="text-center">
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
                      <td>{item.id}</td>
                      <td>
                        {item.hex ? (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: item.hex,
                              border: "1px solid #dee2e6",
                              display: "inline-block",
                            }}
                          />
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{item.name}</td>
                      <td>
                        <code>{item.hex || "-"}</code>
                      </td>
                      <td>{item._count?.variants ?? 0}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => {
                            setForm({
                              id: item.id,
                              name: item.name,
                              hex: item.hex || "",
                            });
                            setOpen(true);
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={
                            !!removing || (item._count?.variants ?? 0) > 0
                          }
                          onClick={() => handleRemove(item)}
                          title={
                            (item._count?.variants ?? 0) > 0
                              ? "ไม่สามารถลบได้ มี variant ใช้งาน"
                              : ""
                          }
                        >
                          {removing === item.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" />
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
        </div>
      </div>

      <MyModal
        id="modalColor"
        title={form.id ? "แก้ไข Color" : "เพิ่ม Color"}
        open={open}
        onClose={() => {
          if (saving) return;
          setOpen(false);
        }}
      >
        <input
          className="form-control mb-2"
          placeholder="ชื่อ Color เช่น Red, Blue, Black"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          disabled={saving}
        />
        <div className="d-flex align-items-center gap-2 mb-3">
          <input
            type="color"
            className="form-control form-control-color"
            style={{ width: 50, height: 38 }}
            value={form.hex || "#000000"}
            onChange={(e) => setForm((p) => ({ ...p, hex: e.target.value }))}
            disabled={saving}
          />
          <input
            className="form-control"
            placeholder="Hex เช่น #FF0000 (ไม่บังคับ)"
            value={form.hex}
            onChange={(e) => setForm((p) => ({ ...p, hex: e.target.value }))}
            disabled={saving}
          />
        </div>
        <button
          className="btn btn-primary w-100"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </MyModal>
    </>
  );
}

// ============================================================
// EXPORT — หน้ารวม Sizes + Colors
// ============================================================
export default function SizesColors() {
  return (
    <div className="mt-3">
      <Sizes />
      <Colors />
    </div>
  );
}
