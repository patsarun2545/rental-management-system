import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

export default function Promotions() {
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
  const [form, setForm] = useState({
    id: null,
    name: "",
    discount: "",
    startDate: "",
    endDate: "",
  });
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
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/promotions", {
        params: { page, limit, search: debouncedSearch },
      });
      setData(res.data.result.promotions);
      setTotal(res.data.result.total);
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
  const clearForm = () =>
    setForm({ id: null, name: "", discount: "", startDate: "", endDate: "" });

  const handleChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.discount || !form.startDate || !form.endDate) {
      return showError("กรุณากรอกข้อมูลให้ครบ");
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        discount: form.discount,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      if (!form.id) {
        await api.post("/api/promotions", payload);
        showSuccess("เพิ่มสำเร็จ");
      } else {
        await api.put(`/api/promotions/${form.id}`, payload);
        showSuccess("แก้ไขสำเร็จ");
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

  const handleEdit = (item) => {
    setForm({
      id: item.id,
      name: item.name,
      discount: item.discount,
      startDate: item.startDate?.slice(0, 16),
      endDate: item.endDate?.slice(0, 16),
    });
    setOpen(true);
  };

  const handleRemove = async (item) => {
    if (removing) return;

    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ต้องการลบ "${item.name}" หรือไม่`,
      "ลบ",
      "ยกเลิก"
    );
    if (!confirmed) return;

    try {
      setRemoving(item.id);
      await api.delete(`/api/promotions/${item.id}`);
      showSuccess("ลบสำเร็จ");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  const isActive = (item) => {
    const now = new Date();
    return new Date(item.startDate) <= now && now <= new Date(item.endDate);
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการโปรโมชัน</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* SEARCH + ADD */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="ค้นหา"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button
                className="btn btn-primary"
                onClick={() => { clearForm(); setOpen(true); }}
              >
                + เพิ่มโปรโมชัน
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>ชื่อโปรโมชัน</th>
                  <th>ส่วนลด (%)</th>
                  <th>เริ่ม</th>
                  <th>สิ้นสุด</th>
                  <th>สถานะ</th>
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
                      <td>{item.name}</td>
                      <td>{item.discount}%</td>
                      <td>{new Date(item.startDate).toLocaleDateString("th-TH")}</td>
                      <td>{new Date(item.endDate).toLocaleDateString("th-TH")}</td>
                      <td>
                        <span className={`badge bg-${isActive(item) ? "success" : "secondary"}`}>
                          {isActive(item) ? "ใช้งานได้" : "หมดอายุ"}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={!!removing}
                          onClick={() => handleEdit(item)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing}
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
        id="modalPromotion"
        title={form.id ? "แก้ไขโปรโมชัน" : "เพิ่มโปรโมชัน"}
        open={open}
        onClose={() => { if (saving) return; setOpen(false); }}
      >
        <input
          className="form-control mb-2"
          placeholder="ชื่อโปรโมชัน"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          disabled={saving}
        />
        <input
          type="number"
          className="form-control mb-2"
          placeholder="ส่วนลด (%) เช่น 10"
          value={form.discount}
          onChange={(e) => handleChange("discount", e.target.value)}
          disabled={saving}
        />
        <label className="form-label">วันเริ่มต้น</label>
        <input
          type="datetime-local"
          className="form-control mb-2"
          value={form.startDate}
          onChange={(e) => handleChange("startDate", e.target.value)}
          disabled={saving}
        />
        <label className="form-label">วันสิ้นสุด</label>
        <input
          type="datetime-local"
          className="form-control mb-3"
          value={form.endDate}
          onChange={(e) => handleChange("endDate", e.target.value)}
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
