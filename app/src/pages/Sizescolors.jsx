import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

// ============================================================
// SIZES
// ============================================================
function Sizes() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // FORM STATE
  // =========================
  const [form, setForm] = useState({ id: null, name: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  // =========================
  // DEBOUNCE SEARCH
  // =========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/catalog/sizes", {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      setData(res.data.result.data ?? res.data.result);
      setTotal(res.data.result.total ?? res.data.result.length);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // FORM HANDLERS
  // =========================
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
        await api.put(`/api/catalog/sizes/${form.id}`, { name: form.name.trim() });
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
      "ยกเลิก"
    );
    if (!confirmed) return;

    try {
      setRemoving(item.id);
      await api.delete(`/api/catalog/sizes/${item.id}`);
      showSuccess("ลบสำเร็จ");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchData();
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
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* SEARCH + ADD */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="ค้นหา size"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button
                className="btn btn-primary"
                onClick={() => { clearForm(); setOpen(true); }}
              >
                + เพิ่ม Size
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>ชื่อ Size</th>
                  <th>ใช้ใน Variant</th>
                  <th width="140" className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center text-muted">กำลังโหลด...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted">ไม่มีข้อมูล</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <span className="badge bg-secondary fs-6 fw-normal">{item.name}</span>
                      </td>
                      <td>{item._count?.variants ?? 0}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => { setForm({ id: item.id, name: item.name }); setOpen(true); }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing || (item._count?.variants ?? 0) > 0}
                          title={(item._count?.variants ?? 0) > 0 ? "ไม่สามารถลบได้ มี variant ใช้งาน" : ""}
                          onClick={() => handleRemove(item)}
                        >
                          {removing === item.id ? (
                            <><span className="spinner-border spinner-border-sm me-1" role="status" />ลบ...</>
                          ) : "ลบ"}
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
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>หน้า {page} / {totalPages}</span>
            <button
              className="btn btn-outline-secondary ms-2"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <MyModal
        id="modalSize"
        title={form.id ? "แก้ไข Size" : "เพิ่ม Size"}
        open={open}
        onClose={() => { if (saving) return; setOpen(false); }}
      >
        <input
          className="form-control mb-3"
          placeholder="ชื่อ Size เช่น S, M, L, XL"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          disabled={saving}
        />
        <button className="btn btn-primary w-100" onClick={handleSave} disabled={saving}>
          {saving ? (
            <><span className="spinner-border spinner-border-sm me-2" role="status" />กำลังบันทึก...</>
          ) : "บันทึก"}
        </button>
      </MyModal>
    </>
  );
}

// ============================================================
// COLORS
// ============================================================
function Colors() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // FORM STATE
  // =========================
  const [form, setForm] = useState({ id: null, name: "", hex: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [open, setOpen] = useState(false);

  // =========================
  // DEBOUNCE SEARCH
  // =========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/catalog/colors", {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      setData(res.data.result.data ?? res.data.result);
      setTotal(res.data.result.total ?? res.data.result.length);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // FORM HANDLERS
  // =========================
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
      "ยกเลิก"
    );
    if (!confirmed) return;

    try {
      setRemoving(item.id);
      await api.delete(`/api/catalog/colors/${item.id}`);
      showSuccess("ลบสำเร็จ");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchData();
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
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* SEARCH + ADD */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="ค้นหา color"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button
                className="btn btn-primary"
                onClick={() => { clearForm(); setOpen(true); }}
              >
                + เพิ่ม Color
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>สี</th>
                  <th>ชื่อ Color</th>
                  <th>Hex</th>
                  <th>ใช้ใน Variant</th>
                  <th width="140" className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center text-muted">กำลังโหลด...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted">ไม่มีข้อมูล</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        {item.hex ? (
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: item.hex, border: "1px solid #dee2e6",
                            display: "inline-block",
                          }} />
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{item.name}</td>
                      <td><code>{item.hex || "-"}</code></td>
                      <td>{item._count?.variants ?? 0}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => {
                            setForm({ id: item.id, name: item.name, hex: item.hex || "" });
                            setOpen(true);
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing || (item._count?.variants ?? 0) > 0}
                          title={(item._count?.variants ?? 0) > 0 ? "ไม่สามารถลบได้ มี variant ใช้งาน" : ""}
                          onClick={() => handleRemove(item)}
                        >
                          {removing === item.id ? (
                            <><span className="spinner-border spinner-border-sm me-1" role="status" />ลบ...</>
                          ) : "ลบ"}
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
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>หน้า {page} / {totalPages}</span>
            <button
              className="btn btn-outline-secondary ms-2"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <MyModal
        id="modalColor"
        title={form.id ? "แก้ไข Color" : "เพิ่ม Color"}
        open={open}
        onClose={() => { if (saving) return; setOpen(false); }}
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
        <button className="btn btn-primary w-100" onClick={handleSave} disabled={saving}>
          {saving ? (
            <><span className="spinner-border spinner-border-sm me-2" role="status" />กำลังบันทึก...</>
          ) : "บันทึก"}
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
