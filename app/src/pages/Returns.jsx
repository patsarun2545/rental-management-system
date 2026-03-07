import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

// แสดงเฉพาะ rental ที่อยู่ระหว่างรอคืน (ACTIVE / LATE) และที่คืนแล้ว (RETURNED)
// ฟีเจอร์: บันทึกคืน, เพิ่มค่าปรับ, จัดการมัดจำ (คืน/หัก)

const STATUS_COLORS = {
  ACTIVE: "primary",
  LATE: "danger",
  RETURNED: "success",
};

export default function Returns() {
  // LIST STATE
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "", "ACTIVE", "LATE", "RETURNED"
  const [page, setPage] = useState(1);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ดึงเฉพาะ ACTIVE, LATE, RETURNED
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const statuses = statusFilter
        ? [statusFilter]
        : ["ACTIVE", "LATE", "RETURNED"];

      const results = await Promise.all(
        statuses.map((s) =>
          api.get("/api/rentals", {
            params: {
              page: s === statusFilter ? page : 1,
              limit: s === statusFilter ? limit : 1000,
              search: debouncedSearch,
              status: s,
            },
          }),
        ),
      );

      let combined = [];
      let totalCount = 0;

      if (statusFilter) {
        combined = results[0].data.result.rentals || [];
        totalCount = results[0].data.result.total || 0;
      } else {
        // LATE ก่อน (urgent) แล้ว ACTIVE แล้ว RETURNED
        const [late, active, returned] = results;
        const lateList = late.data.result.rentals || [];
        const activeList = active.data.result.rentals || [];
        const returnedList = returned.data.result.rentals || [];
        // paginate จาก active (หลัก) + late + returned ที่ load ทั้งหมด
        combined = [...lateList, ...activeList, ...returnedList];
        totalCount =
          (late.data.result.total || 0) +
          (active.data.result.total || 0) +
          (returned.data.result.total || 0);
      }

      setData(combined);
      setTotal(totalCount);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // DETAIL MODAL — tabs: info | return | penalty | deposit
  // ============================================================
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("info");
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (item, tab = "info") => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/api/rentals/${item.id}`);
      setDetail(res.data.result);
      setDetailTab(tab);
      setDetailOpen(true);
    } catch (e) {
      showError(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const res = await api.get(`/api/rentals/${detail.id}`);
      setDetail(res.data.result);
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  // ============================================================
  // RETURN TAB
  // ============================================================
  const [returnForm, setReturnForm] = useState({
    returnedAt: "",
    condition: "GOOD",
    note: "",
  });
  const [returnSaving, setReturnSaving] = useState(false);

  const handleReturnSave = async () => {
    if (returnSaving) return;
    if (!returnForm.returnedAt || !returnForm.condition)
      return showError("กรุณากรอกข้อมูลให้ครบ");
    const ok = await showConfirm(
      "บันทึกการคืน?",
      `ยืนยันบันทึกคืนสินค้า "${detail?.code}"?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setReturnSaving(true);
      await api.post(`/api/rentals/${detail.id}/return`, {
        returnedAt: returnForm.returnedAt,
        condition: returnForm.condition,
        note: returnForm.note,
      });
      showSuccess("บันทึกการคืนสำเร็จ");
      setReturnForm({ returnedAt: "", condition: "GOOD", note: "" });
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setReturnSaving(false);
    }
  };

  // ============================================================
  // PENALTY TAB
  // ============================================================
  const [penaltyForm, setPenaltyForm] = useState({
    type: "DAMAGE",
    amount: "",
    note: "",
  });
  const [penaltySaving, setPenaltySaving] = useState(false);

  const handlePenaltySave = async () => {
    if (penaltySaving) return;
    if (!penaltyForm.amount) return showError("กรุณาระบุจำนวนเงิน");
    try {
      setPenaltySaving(true);
      await api.post(`/api/rentals/${detail.id}/penalties`, {
        type: penaltyForm.type,
        amount: Number(penaltyForm.amount),
        note: penaltyForm.note,
      });
      showSuccess("เพิ่มค่าปรับสำเร็จ");
      setPenaltyForm({ type: "DAMAGE", amount: "", note: "" });
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setPenaltySaving(false);
    }
  };

  // ============================================================
  // DEPOSIT TAB
  // ============================================================
  const [depRefundAmt, setDepRefundAmt] = useState("");
  const [depRefunding, setDepRefunding] = useState(false);
  const [depDeductAmt, setDepDeductAmt] = useState("");
  const [depDeducting, setDepDeducting] = useState(false);
  const [depCreateAmt, setDepCreateAmt] = useState("");
  const [depCreating, setDepCreating] = useState(false);

  const handleDepCreate = async () => {
    if (depCreating) return;
    if (!depCreateAmt) return showError("กรุณาระบุจำนวนเงิน");
    try {
      setDepCreating(true);
      await api.post(`/api/rentals/${detail.id}/deposit`, {
        amount: Number(depCreateAmt),
      });
      showSuccess("สร้าง Deposit สำเร็จ");
      setDepCreateAmt("");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepCreating(false);
    }
  };

  const handleDepRefund = async () => {
    if (depRefunding) return;
    if (depRefundAmt === "") return showError("กรุณาระบุจำนวนเงิน");
    const ok = await showConfirm(
      "คืนมัดจำ?",
      `คืนเงิน ฿${depRefundAmt}?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setDepRefunding(true);
      await api.patch(`/api/rentals/${detail.id}/deposit/refund`, {
        refundedAmount: Number(depRefundAmt),
      });
      showSuccess("คืนมัดจำสำเร็จ");
      setDepRefundAmt("");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepRefunding(false);
    }
  };

  const handleDepDeduct = async () => {
    if (depDeducting) return;
    if (!depDeductAmt) return showError("กรุณาระบุจำนวนเงิน");
    const ok = await showConfirm(
      "หักมัดจำ?",
      `หัก ฿${depDeductAmt} จากมัดจำ?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setDepDeducting(true);
      await api.patch(`/api/rentals/${detail.id}/deposit/deduct`, {
        amount: Number(depDeductAmt),
      });
      showSuccess("หักมัดจำสำเร็จ");
      setDepDeductAmt("");
      await refreshDetail();
    } catch (e) {
      showError(e);
    } finally {
      setDepDeducting(false);
    }
  };

  const deposit = detail?.deposit;
  const hasReturned = !!detail?.returnLog;

  return (
    <>
      {/* LIST CARD */}
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการการคืนสินค้า</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>
        <div className="card-body">
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="ค้นหา code / ชื่อลูกค้า"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">ทุกสถานะ</option>
                <option value="ACTIVE">ACTIVE — กำลังเช่า</option>
                <option value="LATE">LATE — เกินกำหนด</option>
                <option value="RETURNED">RETURNED — คืนแล้ว</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>ลูกค้า</th>
                  <th>วันคืนกำหนด</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th className="text-center" width="100">
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
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>{item.code}</code>
                      </td>
                      <td>{item.user?.name}</td>
                      <td>
                        {new Date(item.endDate).toLocaleDateString("th-TH")}
                      </td>
                      <td>฿{item.totalPrice?.toLocaleString()}</td>
                      <td>
                        <span
                          className={`badge bg-${STATUS_COLORS[item.status] || "secondary"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => openDetail(item)}
                          disabled={detailLoading}
                        >
                          {detailLoading ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            "จัดการ"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 d-flex justify-content-center align-items-center">
            <button
              className="btn btn-outline-secondary me-2"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              หน้า {page} / {totalPages}
            </span>
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

      {/* DETAIL MODAL */}
      <MyModal
        id="modalReturnDetail"
        title={`การคืนสินค้า — ${detail?.code || ""}`}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
      >
        {detail && (
          <>
            {/* STATUS + SUMMARY */}
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <span
                className={`badge bg-${STATUS_COLORS[detail.status] || "secondary"} fs-6`}
              >
                {detail.status}
              </span>
              <span className="text-muted small">
                {detail.user?.name} — ฿{detail.totalPrice?.toLocaleString()}
              </span>
            </div>

            {/* TABS: info | return | penalty | deposit */}
            <ul className="nav nav-tabs mb-3">
              {[
                { key: "info", label: "ข้อมูล" },
                {
                  key: "return",
                  label: hasReturned ? "✓ คืนแล้ว" : "บันทึกคืน",
                },
                {
                  key: "penalty",
                  label: `ค่าปรับ (${detail.penalties?.length || 0})`,
                },
                { key: "deposit", label: "มัดจำ" },
              ].map((t) => (
                <li key={t.key} className="nav-item">
                  <button
                    className={`nav-link${detailTab === t.key ? " active" : ""}`}
                    onClick={() => setDetailTab(t.key)}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>

            {/* INFO TAB */}
            {detailTab === "info" && (
              <div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <small className="text-muted d-block">ลูกค้า</small>
                    <strong>{detail.user?.name}</strong>
                    <div className="text-muted small">{detail.user?.email}</div>
                    {detail.user?.phone && (
                      <div className="text-muted small">
                        {detail.user.phone}
                      </div>
                    )}
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Rental Code</small>
                    <code>{detail.code}</code>
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4">
                    <small className="text-muted d-block">วันรับ</small>
                    {new Date(detail.startDate).toLocaleDateString("th-TH")}
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">กำหนดคืน</small>
                    {new Date(detail.endDate).toLocaleDateString("th-TH")}
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">ค่าปรับ/วัน</small>฿
                    {detail.lateFeePerDay?.toLocaleString() || "0"}
                  </div>
                </div>

                {/* รายการสินค้า */}
                {detail.items?.length > 0 && (
                  <div className="table-responsive mt-2">
                    <table className="table table-bordered table-sm">
                      <thead className="table-light">
                        <tr>
                          <th>สินค้า</th>
                          <th>Size</th>
                          <th>Color</th>
                          <th>จำนวน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((i) => (
                          <tr key={i.id}>
                            <td>{i.variant?.product?.name}</td>
                            <td>{i.variant?.size?.name}</td>
                            <td>{i.variant?.color?.name}</td>
                            <td>{i.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Return log ถ้ามี */}
                {detail.returnLog && (
                  <div className="alert alert-success py-2 small mt-2 mb-0">
                    <strong>คืนสินค้าแล้ว</strong> —{" "}
                    {new Date(detail.returnLog.returnedAt).toLocaleDateString(
                      "th-TH",
                    )}
                    &nbsp;
                    <span
                      className={`badge bg-${detail.returnLog.condition === "GOOD" ? "success" : "danger"}`}
                    >
                      {detail.returnLog.condition}
                    </span>
                    {detail.returnLog.note && (
                      <span className="ms-2">{detail.returnLog.note}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RETURN TAB */}
            {detailTab === "return" && (
              <div>
                {hasReturned ? (
                  <div className="alert alert-success">
                    <strong>บันทึกการคืนแล้ว</strong>
                    <div className="mt-2">
                      <div>
                        <small className="text-muted">วันที่คืน: </small>
                        {new Date(detail.returnLog.returnedAt).toLocaleString(
                          "th-TH",
                        )}
                      </div>
                      <div>
                        <small className="text-muted">สภาพ: </small>
                        <span
                          className={`badge bg-${detail.returnLog.condition === "GOOD" ? "success" : "danger"}`}
                        >
                          {detail.returnLog.condition}
                        </span>
                      </div>
                      {detail.returnLog.note && (
                        <div>
                          <small className="text-muted">หมายเหตุ: </small>
                          {detail.returnLog.note}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {!["ACTIVE", "LATE"].includes(detail.status) ? (
                      <div className="alert alert-warning py-2 small">
                        สามารถบันทึกคืนได้เฉพาะสถานะ <strong>ACTIVE</strong>{" "}
                        หรือ <strong>LATE</strong>
                      </div>
                    ) : (
                      <>
                        <label className="form-label">วันที่คืนจริง</label>
                        <input
                          type="datetime-local"
                          className="form-control mb-2"
                          value={returnForm.returnedAt}
                          onChange={(e) =>
                            setReturnForm((p) => ({
                              ...p,
                              returnedAt: e.target.value,
                            }))
                          }
                          disabled={returnSaving}
                        />
                        <label className="form-label">สภาพสินค้า</label>
                        <select
                          className="form-select mb-2"
                          value={returnForm.condition}
                          onChange={(e) =>
                            setReturnForm((p) => ({
                              ...p,
                              condition: e.target.value,
                            }))
                          }
                          disabled={returnSaving}
                        >
                          <option value="GOOD">GOOD — ปกติ</option>
                          <option value="DAMAGED">DAMAGED — เสียหาย</option>
                          <option value="LOST">LOST — สูญหาย</option>
                        </select>
                        <label className="form-label">หมายเหตุ</label>
                        <textarea
                          className="form-control mb-3"
                          rows={2}
                          placeholder="หมายเหตุ (ถ้ามี)"
                          value={returnForm.note}
                          onChange={(e) =>
                            setReturnForm((p) => ({
                              ...p,
                              note: e.target.value,
                            }))
                          }
                          disabled={returnSaving}
                        />
                        <button
                          className="btn btn-success w-100"
                          onClick={handleReturnSave}
                          disabled={returnSaving}
                        >
                          {returnSaving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              กำลังบันทึก...
                            </>
                          ) : (
                            "บันทึกการคืน"
                          )}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PENALTY TAB */}
            {detailTab === "penalty" && (
              <div>
                {/* รายการค่าปรับที่มีอยู่ */}
                {detail.penalties?.length > 0 ? (
                  <div className="table-responsive mb-3">
                    <table className="table table-bordered table-sm">
                      <thead className="table-light">
                        <tr>
                          <th>ประเภท</th>
                          <th>จำนวน</th>
                          <th>หมายเหตุ</th>
                          <th>วันที่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.penalties.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span className="badge bg-danger">{p.type}</span>
                            </td>
                            <td>฿{p.amount?.toLocaleString()}</td>
                            <td>{p.note || "-"}</td>
                            <td>
                              {new Date(p.createdAt).toLocaleDateString(
                                "th-TH",
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-light fw-bold">
                          <td className="text-end" colSpan={3}>
                            รวมค่าปรับ
                          </td>
                          <td className="text-danger">
                            ฿
                            {detail.penalties
                              .reduce((s, p) => s + p.amount, 0)
                              .toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted small mb-3">ยังไม่มีค่าปรับ</p>
                )}

                {/* ฟอร์มเพิ่มค่าปรับ */}
                <div className="border rounded p-2 bg-light">
                  <small className="text-muted fw-bold d-block mb-2">
                    + เพิ่มค่าปรับ
                  </small>
                  <label className="form-label small mb-1">ประเภท</label>
                  <select
                    className="form-select form-select-sm mb-2"
                    value={penaltyForm.type}
                    onChange={(e) =>
                      setPenaltyForm((p) => ({ ...p, type: e.target.value }))
                    }
                    disabled={penaltySaving}
                  >
                    <option value="LATE">LATE — ล่าช้า</option>
                    <option value="DAMAGE">DAMAGE — เสียหาย</option>
                    <option value="LOST">LOST — สูญหาย</option>
                  </select>
                  <label className="form-label small mb-1">จำนวนเงิน (฿)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm mb-2"
                    placeholder="0"
                    value={penaltyForm.amount}
                    onChange={(e) =>
                      setPenaltyForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    disabled={penaltySaving}
                  />
                  <label className="form-label small mb-1">หมายเหตุ</label>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows={2}
                    placeholder="หมายเหตุ (ถ้ามี)"
                    value={penaltyForm.note}
                    onChange={(e) =>
                      setPenaltyForm((p) => ({ ...p, note: e.target.value }))
                    }
                    disabled={penaltySaving}
                  />
                  <button
                    className="btn btn-warning btn-sm w-100"
                    onClick={handlePenaltySave}
                    disabled={penaltySaving}
                  >
                    {penaltySaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      "เพิ่มค่าปรับ"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* DEPOSIT TAB */}
            {detailTab === "deposit" && (
              <div>
                {!deposit ? (
                  <div className="border rounded p-3 bg-light">
                    <p className="text-muted small mb-2">
                      ยังไม่มีเงินมัดจำสำหรับรายการเช่านี้
                    </p>
                    <label className="form-label small">จำนวนมัดจำ (฿)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm mb-2"
                      placeholder="0"
                      value={depCreateAmt}
                      onChange={(e) => setDepCreateAmt(e.target.value)}
                      disabled={depCreating}
                    />
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleDepCreate}
                      disabled={depCreating}
                    >
                      {depCreating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          กำลังสร้าง...
                        </>
                      ) : (
                        "สร้าง Deposit"
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* ข้อมูล deposit */}
                    <div className="card mb-3">
                      <div className="card-body py-2">
                        <div className="row g-2 text-center">
                          <div className="col-4">
                            <small className="text-muted d-block">มัดจำ</small>
                            <strong>฿{deposit.amount?.toLocaleString()}</strong>
                          </div>
                          <div className="col-4">
                            <small className="text-muted d-block">
                              คืนแล้ว
                            </small>
                            <strong className="text-success">
                              ฿{(deposit.refundedAmount || 0).toLocaleString()}
                            </strong>
                          </div>
                          <div className="col-4">
                            <small className="text-muted d-block">สถานะ</small>
                            <span
                              className={`badge bg-${deposit.status === "HELD" ? "warning" : deposit.status === "REFUNDED" ? "success" : "danger"}`}
                            >
                              {deposit.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {deposit.status === "HELD" ? (
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="border rounded p-2 bg-light h-100">
                            <small className="text-muted fw-bold d-block mb-2">
                              คืนมัดจำ
                            </small>
                            <input
                              type="number"
                              className="form-control form-control-sm mb-2"
                              placeholder={`สูงสุด ฿${deposit.amount?.toLocaleString()}`}
                              value={depRefundAmt}
                              onChange={(e) => setDepRefundAmt(e.target.value)}
                              disabled={depRefunding}
                            />
                            <button
                              className="btn btn-success btn-sm w-100"
                              onClick={handleDepRefund}
                              disabled={depRefunding}
                            >
                              {depRefunding ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                "คืนมัดจำ"
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-2 bg-light h-100">
                            <small className="text-muted fw-bold d-block mb-2">
                              หักมัดจำ
                            </small>
                            <input
                              type="number"
                              className="form-control form-control-sm mb-2"
                              placeholder={`สูงสุด ฿${deposit.amount?.toLocaleString()}`}
                              value={depDeductAmt}
                              onChange={(e) => setDepDeductAmt(e.target.value)}
                              disabled={depDeducting}
                            />
                            <button
                              className="btn btn-danger btn-sm w-100"
                              onClick={handleDepDeduct}
                              disabled={depDeducting}
                            >
                              {depDeducting ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                "หักมัดจำ"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-secondary py-2 small mb-0">
                        Deposit ดำเนินการแล้ว ({deposit.status})
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </MyModal>
    </>
  );
}
