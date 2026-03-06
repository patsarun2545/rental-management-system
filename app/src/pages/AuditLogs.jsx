import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

export default function AuditLogs() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 50;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // FORM STATE — ลบ log เก่า
  // =========================
  const [form, setForm] = useState({
    beforeDate: "",
  });

  const [saving, setSaving] = useState(false);
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
      const res = await api.get("/api/admin/audit", {
        params: { page, limit, action: debouncedSearch || undefined },
      });
      setData(res.data.result.logs);
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
  // FORM HANDLER
  // =========================
  const clearForm = () => {
    setForm({ beforeDate: "" });
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.beforeDate) return showError("กรุณาระบุวันที่");

    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ลบ log ทั้งหมดก่อนวันที่ ${form.beforeDate}?`,
      "ลบ",
      "ยกเลิก"
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      await api.delete("/api/admin/audit", { data: { beforeDate: form.beforeDate } });
      showSuccess("ลบ log สำเร็จ");
      clearForm();
      setOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Audit Log</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div className="card-body">
          {/* SEARCH + CLEAR */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="ค้นหา action"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button className="btn btn-danger" onClick={() => { clearForm(); setOpen(true); }}>
                ลบ Log เก่า
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>User ID</th>
                  <th>วันที่</th>
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
                      <td><code>{item.action}</code></td>
                      <td>{item.userId || "-"}</td>
                      <td>{new Date(item.createdAt).toLocaleString("th-TH")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="mt-3 d-flex justify-content-center align-items-center">
            <button className="btn btn-outline-secondary me-2" disabled={page === 1 || loading} onClick={() => setPage((prev) => prev - 1)}>Previous</button>
            <span>หน้า {page} / {totalPages}</span>
            <button className="btn btn-outline-secondary ms-2" disabled={page >= totalPages || loading} onClick={() => setPage((prev) => prev + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <MyModal
        id="modalAuditClear"
        title="ลบ Log เก่า"
        open={open}
        onClose={() => { if (saving) return; setOpen(false); }}
      >
        <p className="text-muted small mb-3">จะลบ log ทั้งหมดที่ถูกสร้างก่อนวันที่ที่ระบุ</p>
        <label className="form-label">ลบก่อนวันที่</label>
        <input
          type="date"
          className="form-control mb-3"
          value={form.beforeDate}
          onChange={(e) => handleChange("beforeDate", e.target.value)}
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
