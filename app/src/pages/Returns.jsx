import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Returns() {
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
  // FORM STATE — บันทึกคืน
  // =========================
  const [form, setForm] = useState({
    rentalId: null,
    code: "",
    returnedAt: "",
    condition: "GOOD",
    note: "",
  });

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // =========================
  // PENALTY FORM
  // =========================
  const [penaltyForm, setPenaltyForm] = useState({
    rentalId: null,
    code: "",
    type: "DAMAGE",
    amount: "",
    note: "",
  });
  const [penaltySaving, setPenaltySaving] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);

  // =========================
  // DEPOSIT FORM
  // =========================
  const [depositForm, setDepositForm] = useState({
    rentalId: null,
    code: "",
    refundedAmount: "",
  });
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  // =========================
  // DEDUCT DEPOSIT FORM
  // =========================
  const [deductForm, setDeductForm] = useState({
    rentalId: null,
    code: "",
    amount: "",
  });
  const [deductSaving, setDeductSaving] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);

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
  // FETCH (ACTIVE + LATE)
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        api.get("/api/rentals", {
          params: { page, limit, search: debouncedSearch, status: "ACTIVE" },
        }),
        api.get("/api/rentals", {
          params: { page, limit, search: debouncedSearch, status: "LATE" },
        }),
      ]);
      const combined = [
        ...(r1.data.result.rentals || []),
        ...(r2.data.result.rentals || []),
      ];
      setData(combined);
      setTotal(r1.data.result.total + r2.data.result.total);
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
  // RETURN HANDLER
  // =========================
  const clearForm = () =>
    setForm({
      rentalId: null,
      code: "",
      returnedAt: "",
      condition: "GOOD",
      note: "",
    });

  const handleChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (saving) return;
    if (!form.returnedAt || !form.condition)
      return showError("กรุณากรอกข้อมูลให้ครบ");

    try {
      setSaving(true);
      await api.post(`/api/rentals/${form.rentalId}/return`, {
        returnedAt: form.returnedAt,
        condition: form.condition,
        note: form.note,
      });
      showSuccess("บันทึกการคืนสำเร็จ");
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
      rentalId: item.id,
      code: item.code,
      returnedAt: "",
      condition: "GOOD",
      note: "",
    });
    setOpen(true);
  };

  // =========================
  // PENALTY HANDLER
  // =========================
  const clearPenaltyForm = () =>
    setPenaltyForm({
      rentalId: null,
      code: "",
      type: "DAMAGE",
      amount: "",
      note: "",
    });

  const handlePenaltyChange = (key, value) =>
    setPenaltyForm((prev) => ({ ...prev, [key]: value }));

  const handlePenaltySave = async () => {
    if (penaltySaving) return;
    if (!penaltyForm.amount) return showError("กรุณาระบุจำนวนเงิน");

    try {
      setPenaltySaving(true);
      await api.post(`/api/rentals/${penaltyForm.rentalId}/penalties`, {
        type: penaltyForm.type,
        amount: penaltyForm.amount,
        note: penaltyForm.note,
      });
      showSuccess("เพิ่มค่าปรับสำเร็จ");
      clearPenaltyForm();
      setPenaltyOpen(false);
    } catch (e) {
      showError(e);
    } finally {
      setPenaltySaving(false);
    }
  };

  // =========================
  // DEPOSIT HANDLER
  // =========================
  const clearDepositForm = () =>
    setDepositForm({ rentalId: null, code: "", refundedAmount: "" });

  const handleDepositChange = (key, value) =>
    setDepositForm((prev) => ({ ...prev, [key]: value }));

  const handleDepositSave = async () => {
    if (depositSaving) return;
    if (depositForm.refundedAmount === "")
      return showError("กรุณาระบุจำนวนเงิน");

    try {
      setDepositSaving(true);
      await api.patch(`/api/rentals/${depositForm.rentalId}/deposit/refund`, {
        refundedAmount: depositForm.refundedAmount,
      });
      showSuccess("คืนมัดจำสำเร็จ");
      clearDepositForm();
      setDepositOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setDepositSaving(false);
    }
  };

  // =========================
  // DEDUCT HANDLER
  // =========================
  const clearDeductForm = () =>
    setDeductForm({ rentalId: null, code: "", amount: "" });

  const handleDeductChange = (key, value) =>
    setDeductForm((prev) => ({ ...prev, [key]: value }));

  const handleDeductSave = async () => {
    if (deductSaving) return;
    if (!deductForm.amount) return showError("กรุณาระบุจำนวนเงิน");

    try {
      setDeductSaving(true);
      await api.patch(`/api/rentals/${deductForm.rentalId}/deposit/deduct`, {
        amount: deductForm.amount,
      });
      showSuccess("หักมัดจำสำเร็จ");
      clearDeductForm();
      setDeductOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setDeductSaving(false);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการการคืนสินค้า (ACTIVE / LATE)</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>

        <div className="card-body">
          {/* SEARCH */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control rounded"
                placeholder="ค้นหา code / ชื่อลูกค้า"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>ลูกค้า</th>
                  <th>วันคืนกำหนด</th>
                  <th>สถานะ</th>
                  <th width="240" className="text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.user?.name}</td>
                      <td>
                        {new Date(item.endDate).toLocaleDateString("th-TH")}
                      </td>
                      <td>
                        <span
                          className={`badge bg-${item.status === "LATE" ? "danger" : "primary"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-success btn-sm me-1"
                          onClick={() => handleEdit(item)}
                        >
                          บันทึกคืน
                        </button>
                        <button
                          className="btn btn-outline-warning btn-sm me-1"
                          onClick={() => {
                            setPenaltyForm({
                              rentalId: item.id,
                              code: item.code,
                              type: "DAMAGE",
                              amount: "",
                              note: "",
                            });
                            setPenaltyOpen(true);
                          }}
                        >
                          ค่าปรับ
                        </button>
                        <button
                          className="btn btn-outline-info btn-sm me-1"
                          onClick={() => {
                            setDepositForm({
                              rentalId: item.id,
                              code: item.code,
                              refundedAmount: "",
                            });
                            setDepositOpen(true);
                          }}
                        >
                          คืนมัดจำ
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => {
                            setDeductForm({
                              rentalId: item.id,
                              code: item.code,
                              amount: "",
                            });
                            setDeductOpen(true);
                          }}
                        >
                          หักมัดจำ
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

      {/* MODAL บันทึกคืน */}
      <MyModal
        id="modalReturn"
        title="บันทึกการคืนสินค้า"
        open={open}
        onClose={() => {
          if (saving) return;
          setOpen(false);
        }}
      >
        <p className="text-muted mb-3">
          Rental: <strong>{form.code}</strong>
        </p>
        <label className="form-label">วันที่คืน</label>
        <input
          type="datetime-local"
          className="form-control mb-2"
          value={form.returnedAt}
          onChange={(e) => handleChange("returnedAt", e.target.value)}
          disabled={saving}
        />
        <label className="form-label">สภาพสินค้า</label>
        <select
          className="form-select mb-2"
          value={form.condition}
          onChange={(e) => handleChange("condition", e.target.value)}
          disabled={saving}
        >
          <option value="GOOD">GOOD — ปกติ</option>
          <option value="DAMAGED">DAMAGED — เสียหาย</option>
          <option value="LOST">LOST — สูญหาย</option>
        </select>
        <textarea
          className="form-control mb-3"
          placeholder="หมายเหตุ"
          rows={2}
          value={form.note}
          onChange={(e) => handleChange("note", e.target.value)}
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

      {/* MODAL ค่าปรับ */}
      <MyModal
        id="modalPenalty"
        title="เพิ่มค่าปรับ"
        open={penaltyOpen}
        onClose={() => {
          if (penaltySaving) return;
          setPenaltyOpen(false);
        }}
      >
        <p className="text-muted mb-3">
          Rental: <strong>{penaltyForm.code}</strong>
        </p>
        <select
          className="form-select mb-2"
          value={penaltyForm.type}
          onChange={(e) => handlePenaltyChange("type", e.target.value)}
          disabled={penaltySaving}
        >
          <option value="LATE">LATE — ล่าช้า</option>
          <option value="DAMAGE">DAMAGE — เสียหาย</option>
          <option value="LOST">LOST — สูญหาย</option>
        </select>
        <input
          type="number"
          className="form-control mb-2"
          placeholder="จำนวนเงิน"
          value={penaltyForm.amount}
          onChange={(e) => handlePenaltyChange("amount", e.target.value)}
          disabled={penaltySaving}
        />
        <textarea
          className="form-control mb-3"
          placeholder="หมายเหตุ"
          rows={2}
          value={penaltyForm.note}
          onChange={(e) => handlePenaltyChange("note", e.target.value)}
          disabled={penaltySaving}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handlePenaltySave}
          disabled={penaltySaving}
        >
          {penaltySaving ? (
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

      {/* MODAL มัดจำ */}
      <MyModal
        id="modalDeposit"
        title="คืนมัดจำ"
        open={depositOpen}
        onClose={() => {
          if (depositSaving) return;
          setDepositOpen(false);
        }}
      >
        <p className="text-muted mb-1">
          Rental: <strong>{depositForm.code}</strong>
        </p>
        <p className="text-muted small mb-3">
          ใส่ 0 = หักทั้งหมด / ใส่เต็มจำนวน = คืนเต็ม
        </p>
        <input
          type="number"
          className="form-control mb-3"
          placeholder="จำนวนเงินที่คืน"
          value={depositForm.refundedAmount}
          onChange={(e) =>
            handleDepositChange("refundedAmount", e.target.value)
          }
          disabled={depositSaving}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handleDepositSave}
          disabled={depositSaving}
        >
          {depositSaving ? (
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

      {/* MODAL หักมัดจำ */}
      <MyModal
        id="modalDeduct"
        title="หักมัดจำ"
        open={deductOpen}
        onClose={() => {
          if (deductSaving) return;
          setDeductOpen(false);
        }}
      >
        <p className="text-muted mb-1">
          Rental: <strong>{deductForm.code}</strong>
        </p>
        <p className="text-muted small mb-3">
          ระบุจำนวนเงินที่ต้องการหักออกจากมัดจำ
        </p>
        <input
          type="number"
          className="form-control mb-3"
          placeholder="จำนวนเงินที่หัก"
          value={deductForm.amount}
          onChange={(e) => handleDeductChange("amount", e.target.value)}
          disabled={deductSaving}
        />
        <button
          className="btn btn-danger w-100"
          onClick={handleDeductSave}
          disabled={deductSaving}
        >
          {deductSaving ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              />
              กำลังบันทึก...
            </>
          ) : (
            "หักมัดจำ"
          )}
        </button>
      </MyModal>
    </>
  );
}
