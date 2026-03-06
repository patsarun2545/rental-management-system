import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

export default function EntityTemplate() {
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
  });

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null); // เก็บ id ที่กำลังลบ
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

      const res = await api.get("/api/entities", {
        params: { page, limit, search: debouncedSearch },
      });

      setData(res.data.result.data);
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
    setForm({ id: null, name: "" });
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (saving) return; // ป้องกัน double submit

    if (!form.name.trim()) {
      return showError("กรุณากรอกข้อมูล");
    }

    try {
      setSaving(true);

      const payload = { name: form.name.trim() };

      if (!form.id) {
        await api.post("/api/entities", payload);
        showSuccess("เพิ่มสำเร็จ");
      } else {
        await api.put(`/api/entities/${form.id}`, payload);
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
    setForm({ id: item.id, name: item.name });
    setOpen(true);
  };

  const handleRemove = async (item) => {
    if (removing) return; // ป้องกัน double delete

    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ต้องการลบ "${item.name}" หรือไม่`,
      "ลบ",
      "ยกเลิก",
    );

    if (!confirmed) return;

    try {
      setRemoving(item.id);
      await api.delete(`/api/entities/${item.id}`);
      showSuccess("ลบสำเร็จ");

      if (data.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        fetchData();
      }
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการข้อมูล</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
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
                onClick={() => {
                  clearForm();
                  setOpen(true);
                }}
              >
                + เพิ่มข้อมูล
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>ชื่อ</th>
                  <th width="140" className="text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="2" className="text-center text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="text-center text-muted">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={removing === item.id}
                          onClick={() => handleEdit(item)}
                        >
                          แก้ไข
                        </button>

                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={removing === item.id}
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

      {/* MODAL */}
      <MyModal
        id="modalEntity"
        title="ข้อมูล"
        open={open}
        onClose={() => {
          if (saving) return; // ป้องกันปิด modal ระหว่าง save
          setOpen(false);
        }}
      >
        <input
          className="form-control mb-3"
          placeholder="ชื่อ"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()} // กด Enter เพื่อ save
          disabled={saving}
        />

        <button
          className="btn btn-primary w-100"
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
    </>
  );
}
