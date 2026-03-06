import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import { getImageUrl } from "../utils/image.utils";
import api from "../services/axios";

const STATUS_COLORS = {
  PENDING: "warning",
  CONFIRMED: "info",
  ACTIVE: "primary",
  RETURNED: "success",
  LATE: "danger",
  CANCELLED: "secondary",
  COMPLETED: "dark",
};
const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "RETURNED",
  "LATE",
  "CANCELLED",
  "COMPLETED",
];

export default function Rentals() {
  // ============================================================
  // LIST STATE
  // ============================================================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/rentals", {
        params: {
          page,
          limit,
          search: debouncedSearch,
          status: statusFilter || undefined,
        },
      });
      setData(res.data.result.rentals);
      setTotal(res.data.result.total);
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
  // MANAGE MODAL — tabs: info | items | payment | deposit
  // ============================================================
  const [mgmt, setMgmt] = useState(null);
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [mgmtTab, setMgmtTab] = useState("info");
  const [mgmtLoading, setMgmtLoading] = useState(false);

  const openMgmt = async (item, tab = "info") => {
    try {
      setMgmtLoading(true);
      const res = await api.get(`/api/rentals/${item.id}`);
      setMgmt(res.data.result);
      setMgmtTab(tab);
      setMgmtOpen(true);
    } catch (e) {
      showError(e);
    } finally {
      setMgmtLoading(false);
    }
  };

  const refreshMgmt = async () => {
    if (!mgmt) return;
    try {
      const res = await api.get(`/api/rentals/${mgmt.id}`);
      setMgmt(res.data.result);
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  // ============================================================
  // ITEMS TAB
  // ============================================================
  const [variantOptions, setVariantOptions] = useState([]);
  const [itemForm, setItemForm] = useState({
    productVariantId: "",
    quantity: 1,
  });
  const [itemSaving, setItemSaving] = useState(false);
  const [itemRemoving, setItemRemoving] = useState(null);
  const [itemEditing, setItemEditing] = useState(null);

  const loadVariantOptions = () => {
    api
      .get("/api/products", { params: { limit: 500 } })
      .then((r) => {
        const variants = [];
        (r.data.result.data || []).forEach((p) => {
          (p.variants || []).forEach((v) =>
            variants.push({ ...v, productName: p.name }),
          );
        });
        setVariantOptions(variants);
      })
      .catch((e) => showError(e));
  };

  useEffect(() => {
    if (mgmtTab !== "items") return;
    loadVariantOptions();
  }, [mgmtTab]);

  const handleAddItem = async () => {
    if (itemSaving) return;
    if (!itemForm.productVariantId) return showError("กรุณาเลือกสินค้า");
    try {
      setItemSaving(true);
      await api.post(`/api/rentals/${mgmt.id}/items`, {
        productVariantId: Number(itemForm.productVariantId),
        quantity: Number(itemForm.quantity),
      });
      showSuccess("เพิ่มสินค้าสำเร็จ");
      setItemForm({ productVariantId: "", quantity: 1 });
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setItemSaving(false);
    }
  };

  const handleUpdateItem = async (itemId) => {
    if (!itemEditing) return;
    try {
      setItemSaving(true);
      await api.patch(`/api/rentals/${mgmt.id}/items/${itemId}`, {
        quantity: Number(itemEditing.quantity),
      });
      showSuccess("อัปเดตสำเร็จ");
      setItemEditing(null);
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    const ok = await showConfirm(
      "ลบสินค้า?",
      "ต้องการลบรายการนี้ออกจาก rental?",
      "ลบ",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setItemRemoving(itemId);
      await api.delete(`/api/rentals/${mgmt.id}/items/${itemId}`);
      showSuccess("ลบสำเร็จ");
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setItemRemoving(null);
    }
  };

  // ============================================================
  // PAYMENT TAB
  // ============================================================
  const [payForm, setPayForm] = useState({
    amount: "",
    type: "RENTAL",
    file: null,
  });
  const [paySaving, setPaySaving] = useState(false);
  const [payApproving, setPayApproving] = useState(null);
  const [payRejecting, setPayRejecting] = useState(null);
  const [slipUrl, setSlipUrl] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);

  const handlePaySubmit = async () => {
    if (paySaving) return;
    if (!payForm.amount) return showError("กรุณาระบุจำนวนเงิน");
    try {
      setPaySaving(true);
      const fd = new FormData();
      fd.append("rentalId", mgmt.id);
      fd.append("amount", payForm.amount);
      fd.append("type", payForm.type);
      if (payForm.file) fd.append("image", payForm.file);
      await api.post("/api/payments", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showSuccess("บันทึกการชำระเงินสำเร็จ");
      setPayForm({ amount: "", type: "RENTAL", file: null });
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setPaySaving(false);
    }
  };

  const handlePayApprove = async (payId) => {
    const ok = await showConfirm(
      "อนุมัติ?",
      "อนุมัติการชำระเงินนี้?",
      "อนุมัติ",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setPayApproving(payId);
      await api.patch(`/api/payments/${payId}/approve`);
      showSuccess("อนุมัติสำเร็จ");
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setPayApproving(null);
    }
  };

  const handlePayReject = async (payId) => {
    const ok = await showConfirm(
      "ปฏิเสธ?",
      "ปฏิเสธการชำระเงินนี้?",
      "ปฏิเสธ",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      setPayRejecting(payId);
      await api.patch(`/api/payments/${payId}/reject`);
      showSuccess("ปฏิเสธสำเร็จ");
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setPayRejecting(null);
    }
  };

  // ============================================================
  // DEPOSIT TAB
  // ============================================================
  const [depForm, setDepForm] = useState({ amount: "" });
  const [depSaving, setDepSaving] = useState(false);
  const [depRefundAmt, setDepRefundAmt] = useState("");
  const [depRefunding, setDepRefunding] = useState(false);
  const [depDeductAmt, setDepDeductAmt] = useState("");
  const [depDeducting, setDepDeducting] = useState(false);

  const handleDepCreate = async () => {
    if (depSaving) return;
    if (!depForm.amount) return showError("กรุณาระบุจำนวนเงิน");
    try {
      setDepSaving(true);
      await api.post(`/api/rentals/${mgmt.id}/deposit`, {
        amount: Number(depForm.amount),
      });
      showSuccess("สร้าง Deposit สำเร็จ");
      setDepForm({ amount: "" });
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setDepSaving(false);
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
      await api.patch(`/api/rentals/${mgmt.id}/deposit/refund`, {
        refundedAmount: Number(depRefundAmt),
      });
      showSuccess("คืนมัดจำสำเร็จ");
      setDepRefundAmt("");
      await refreshMgmt();
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
      await api.patch(`/api/rentals/${mgmt.id}/deposit/deduct`, {
        amount: Number(depDeductAmt),
      });
      showSuccess("หักมัดจำสำเร็จ");
      setDepDeductAmt("");
      await refreshMgmt();
    } catch (e) {
      showError(e);
    } finally {
      setDepDeducting(false);
    }
  };

  // ============================================================
  // STATUS QUICK ACTIONS
  // ============================================================
  const handleConfirm = async (item) => {
    const ok = await showConfirm(
      "ยืนยันการเช่า?",
      `ยืนยัน "${item.code}" และจอง stock?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      await api.post(`/api/rentals/${item.id}/confirm`);
      showSuccess("ยืนยันสำเร็จ");
      fetchData();
      if (mgmt?.id === item.id) await refreshMgmt();
    } catch (e) {
      showError(e);
    }
  };

  const handleActivate = async (item) => {
    const ok = await showConfirm(
      "ลูกค้ารับสินค้าแล้ว?",
      `เปลี่ยน "${item.code}" เป็น ACTIVE?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      await api.patch(`/api/rentals/${item.id}/activate`);
      showSuccess("เปิดใช้งานสำเร็จ");
      fetchData();
      if (mgmt?.id === item.id) await refreshMgmt();
    } catch (e) {
      showError(e);
    }
  };

  const handleCancel = async (item) => {
    const ok = await showConfirm(
      "ยืนยันการยกเลิก?",
      `ยกเลิก "${item.code}"?`,
      "ยกเลิกการเช่า",
      "ไม่",
    );
    if (!ok) return;
    try {
      await api.patch(`/api/rentals/${item.id}/cancel`);
      showSuccess("ยกเลิกสำเร็จ");
      fetchData();
      if (mgmt?.id === item.id) {
        setMgmtOpen(false);
        setMgmt(null);
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleComplete = async (item) => {
    const ok = await showConfirm(
      "ปิดงานเช่า?",
      `ปิด "${item.code}" เป็น COMPLETED?`,
      "ยืนยัน",
      "ยกเลิก",
    );
    if (!ok) return;
    try {
      await api.patch(`/api/rentals/${item.id}/complete`);
      showSuccess("ปิดงานสำเร็จ");
      fetchData();
      if (mgmt?.id === item.id) await refreshMgmt();
    } catch (e) {
      showError(e);
    }
  };

  // ============================================================
  // CREATE RENTAL
  // ============================================================
  const emptyCreate = {
    userId: "",
    startDate: "",
    endDate: "",
    depositAmount: "",
    lateFeePerDay: "",
    promotionId: "",
    items: [{ productVariantId: "", quantity: 1 }],
  };
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [promotionOptions, setPromotionOptions] = useState([]);

  useEffect(() => {
    if (!createOpen) return;
    Promise.all([
      api.get("/api/users", { params: { limit: 200 } }),
      api.get("/api/promotions", { params: { limit: 100 } }),
    ])
      .then(([u, pr]) => {
        setUserOptions(u.data.result.users || []);
        setPromotionOptions(pr.data.result.promotions || []);
      })
      .catch((e) => showError(e));
    loadVariantOptions();
  }, [createOpen]);

  const handleCreateItemChange = (idx, key, val) => {
    setCreateForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [key]: val };
      return { ...prev, items };
    });
  };

  const handleCreateSave = async () => {
    if (creating) return;
    const { userId, startDate, endDate, items } = createForm;
    if (
      !userId ||
      !startDate ||
      !endDate ||
      items.some((i) => !i.productVariantId)
    )
      return showError("กรุณากรอกข้อมูลให้ครบ");
    try {
      setCreating(true);
      const res = await api.post("/api/rentals", {
        userId: Number(userId),
        startDate,
        endDate,
        depositAmount: createForm.depositAmount || undefined,
        lateFeePerDay: createForm.lateFeePerDay || undefined,
        promotionId: createForm.promotionId || undefined,
        items: items.map((i) => ({
          productVariantId: Number(i.productVariantId),
          quantity: Number(i.quantity),
        })),
      });
      showSuccess("สร้างการเช่าสำเร็จ");
      setCreateForm(emptyCreate);
      setCreateOpen(false);
      fetchData();
      // เปิด manage modal ทันที
      setMgmt(res.data.result);
      setMgmtTab("info");
      setMgmtOpen(true);
    } catch (e) {
      showError(e);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  const canEditItems = mgmt && ["PENDING", "CONFIRMED"].includes(mgmt.status);
  const deposit = mgmt?.deposit;

  return (
    <>
      {/* ===================== LIST CARD ===================== */}
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการการเช่า</span>
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
            <div className="col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">ทุกสถานะ</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-5 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateForm(emptyCreate);
                  setCreateOpen(true);
                }}
              >
                + สร้างการเช่า
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>ลูกค้า</th>
                  <th>วันรับ</th>
                  <th>วันคืน</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th className="text-center" width="210">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      ไม่มีข้อมูล
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
                        {new Date(item.startDate).toLocaleDateString("th-TH")}
                      </td>
                      <td>
                        {new Date(item.endDate).toLocaleDateString("th-TH")}
                      </td>
                      <td>฿{item.totalPrice?.toLocaleString()}</td>
                      <td>
                        <span
                          className={`badge bg-${STATUS_COLORS[item.status]}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm me-1"
                          onClick={() => openMgmt(item)}
                          disabled={mgmtLoading}
                        >
                          {mgmtLoading ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            "จัดการ"
                          )}
                        </button>
                        {item.status === "PENDING" && (
                          <button
                            className="btn btn-outline-success btn-sm me-1"
                            onClick={() => handleConfirm(item)}
                          >
                            ยืนยัน
                          </button>
                        )}
                        {item.status === "CONFIRMED" && (
                          <button
                            className="btn btn-outline-info btn-sm me-1"
                            onClick={() => handleActivate(item)}
                          >
                            Activate
                          </button>
                        )}
                        {item.status === "RETURNED" && (
                          <button
                            className="btn btn-outline-dark btn-sm me-1"
                            onClick={() => handleComplete(item)}
                          >
                            Complete
                          </button>
                        )}
                        {["PENDING", "CONFIRMED"].includes(item.status) && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleCancel(item)}
                          >
                            ยกเลิก
                          </button>
                        )}
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

      {/* ===================== MANAGE MODAL ===================== */}
      <MyModal
        id="modalManageRental"
        title={`จัดการ — ${mgmt?.code || ""}`}
        open={mgmtOpen}
        onClose={() => {
          setMgmtOpen(false);
          setMgmt(null);
          setItemEditing(null);
        }}
      >
        {mgmt && (
          <>
            {/* STATUS + QUICK ACTIONS */}
            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <span className={`badge bg-${STATUS_COLORS[mgmt.status]} fs-6`}>
                {mgmt.status}
              </span>
              {mgmt.status === "PENDING" && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleConfirm(mgmt)}
                >
                  ✓ ยืนยัน
                </button>
              )}
              {mgmt.status === "CONFIRMED" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleActivate(mgmt)}
                >
                  ▶ Activate
                </button>
              )}
              {mgmt.status === "RETURNED" && (
                <button
                  className="btn btn-dark btn-sm"
                  onClick={() => handleComplete(mgmt)}
                >
                  ✔ Complete
                </button>
              )}
              {["PENDING", "CONFIRMED"].includes(mgmt.status) && (
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleCancel(mgmt)}
                >
                  ✕ ยกเลิก
                </button>
              )}
            </div>

            {/* TABS */}
            <ul className="nav nav-tabs mb-3">
              {[
                { key: "info", label: "ข้อมูล" },
                { key: "items", label: `สินค้า (${mgmt.items?.length || 0})` },
                {
                  key: "payment",
                  label: `ชำระเงิน (${mgmt.payments?.length || 0})`,
                },
                { key: "deposit", label: "มัดจำ" },
              ].map((t) => (
                <li key={t.key} className="nav-item">
                  <button
                    className={`nav-link${mgmtTab === t.key ? " active" : ""}`}
                    onClick={() => setMgmtTab(t.key)}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>

            {/* ── INFO ── */}
            {mgmtTab === "info" && (
              <div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <small className="text-muted d-block">ลูกค้า</small>
                    <strong>{mgmt.user?.name}</strong>
                    <div className="text-muted small">{mgmt.user?.email}</div>
                    {mgmt.user?.phone && (
                      <div className="text-muted small">{mgmt.user.phone}</div>
                    )}
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Rental Code</small>
                    <code>{mgmt.code}</code>
                    <div className="mt-1">
                      <small className="text-muted">สถานะชำระ: </small>
                      <span
                        className={`badge bg-${mgmt.paymentStatus === "APPROVED" ? "success" : "warning"}`}
                      >
                        {mgmt.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4">
                    <small className="text-muted d-block">วันรับ</small>
                    {new Date(mgmt.startDate).toLocaleDateString("th-TH")}
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">วันคืน</small>
                    {new Date(mgmt.endDate).toLocaleDateString("th-TH")}
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">ค่าปรับ/วัน</small>฿
                    {mgmt.lateFeePerDay?.toLocaleString() || "0"}
                  </div>
                </div>
                <div className="alert alert-light border py-2 mb-2 d-flex justify-content-between">
                  <span>ยอดรวม</span>
                  <strong className="text-primary">
                    ฿{mgmt.totalPrice?.toLocaleString()}
                  </strong>
                </div>
                {mgmt.promotion && (
                  <div className="alert alert-info py-1 px-2 small mb-2">
                    โปรโมชัน: <strong>{mgmt.promotion.name}</strong> ลด{" "}
                    {mgmt.promotion.discount}%
                  </div>
                )}
                {mgmt.penalties?.length > 0 && (
                  <>
                    <small className="text-muted fw-bold">ค่าปรับ</small>
                    {mgmt.penalties.map((p) => (
                      <div
                        key={p.id}
                        className="d-flex justify-content-between small py-1 border-bottom"
                      >
                        <span>
                          {p.type} {p.note ? `— ${p.note}` : ""}
                        </span>
                        <span className="text-danger fw-bold">
                          ฿{p.amount?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {mgmt.returnLog && (
                  <div className="alert alert-success py-2 small mt-2 mb-0">
                    <strong>คืนสินค้าแล้ว</strong> —{" "}
                    {new Date(mgmt.returnLog.returnedAt).toLocaleDateString(
                      "th-TH",
                    )}{" "}
                    &nbsp;
                    <span
                      className={`badge bg-${mgmt.returnLog.condition === "GOOD" ? "success" : "danger"}`}
                    >
                      {mgmt.returnLog.condition}
                    </span>
                    {mgmt.returnLog.note && (
                      <span className="ms-2">{mgmt.returnLog.note}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ITEMS ── */}
            {mgmtTab === "items" && (
              <div>
                <div className="table-responsive mb-3">
                  <table className="table table-bordered table-sm align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>สินค้า</th>
                        <th>Size</th>
                        <th>Color</th>
                        <th>ราคา</th>
                        <th>จำนวน</th>
                        {canEditItems && <th width="110"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {!mgmt.items?.length ? (
                        <tr>
                          <td colSpan="6" className="text-center text-muted">
                            ยังไม่มีสินค้า
                          </td>
                        </tr>
                      ) : (
                        mgmt.items.map((i) => (
                          <tr key={i.id}>
                            <td>{i.variant?.product?.name}</td>
                            <td>{i.variant?.size?.name}</td>
                            <td>
                              <div className="d-flex align-items-center gap-1">
                                {i.variant?.color?.hex && (
                                  <div
                                    style={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: 3,
                                      background: i.variant.color.hex,
                                      border: "1px solid #ccc",
                                    }}
                                  />
                                )}
                                {i.variant?.color?.name}
                              </div>
                            </td>
                            <td>฿{i.variant?.price?.toLocaleString()}</td>
                            <td>
                              {canEditItems && itemEditing?.id === i.id ? (
                                <div className="d-flex gap-1">
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    style={{ width: 65 }}
                                    min="1"
                                    value={itemEditing.quantity}
                                    onChange={(e) =>
                                      setItemEditing((p) => ({
                                        ...p,
                                        quantity: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    className="btn btn-success btn-sm px-1"
                                    onClick={() => handleUpdateItem(i.id)}
                                    disabled={itemSaving}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="btn btn-outline-secondary btn-sm px-1"
                                    onClick={() => setItemEditing(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                i.quantity
                              )}
                            </td>
                            {canEditItems && (
                              <td>
                                {itemEditing?.id !== i.id && (
                                  <>
                                    <button
                                      className="btn btn-outline-primary btn-sm me-1"
                                      onClick={() =>
                                        setItemEditing({
                                          id: i.id,
                                          quantity: i.quantity,
                                        })
                                      }
                                    >
                                      แก้
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      disabled={itemRemoving === i.id}
                                      onClick={() => handleRemoveItem(i.id)}
                                    >
                                      {itemRemoving === i.id ? (
                                        <span className="spinner-border spinner-border-sm" />
                                      ) : (
                                        "ลบ"
                                      )}
                                    </button>
                                  </>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {mgmt.items?.length > 0 && (
                      <tfoot>
                        <tr className="table-light fw-bold">
                          <td
                            colSpan={canEditItems ? 4 : 3}
                            className="text-end"
                          >
                            ยอดรวม
                          </td>
                          <td className="text-primary">
                            ฿{mgmt.totalPrice?.toLocaleString()}
                          </td>
                          {canEditItems && <td></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {canEditItems ? (
                  <div className="border rounded p-2 bg-light">
                    <small className="text-muted fw-bold d-block mb-2">
                      + เพิ่มสินค้า
                    </small>
                    <div className="row g-2 align-items-end">
                      <div className="col-7">
                        <select
                          className="form-select form-select-sm"
                          value={itemForm.productVariantId}
                          onChange={(e) =>
                            setItemForm((p) => ({
                              ...p,
                              productVariantId: e.target.value,
                            }))
                          }
                          disabled={itemSaving}
                        >
                          <option value="">-- เลือกสินค้า --</option>
                          {variantOptions.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.productName} | {v.size?.name} | {v.color?.name}{" "}
                              (฿{v.price?.toLocaleString()}, stock: {v.stock})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-2">
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="1"
                          value={itemForm.quantity}
                          onChange={(e) =>
                            setItemForm((p) => ({
                              ...p,
                              quantity: e.target.value,
                            }))
                          }
                          disabled={itemSaving}
                        />
                      </div>
                      <div className="col-3">
                        <button
                          className="btn btn-primary btn-sm w-100"
                          onClick={handleAddItem}
                          disabled={itemSaving}
                        >
                          {itemSaving ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            "เพิ่ม"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-2 small mb-0">
                    ไม่สามารถแก้ไขสินค้าในสถานะ <strong>{mgmt.status}</strong>
                  </div>
                )}
              </div>
            )}

            {/* ── PAYMENT ── */}
            {mgmtTab === "payment" && (
              <div>
                {mgmt.payments?.length > 0 && (
                  <div className="table-responsive mb-3">
                    <table className="table table-bordered table-sm align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>ประเภท</th>
                          <th>จำนวน</th>
                          <th>สลิป</th>
                          <th>สถานะ</th>
                          <th>วันที่</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mgmt.payments.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span className="badge bg-secondary">
                                {p.type}
                              </span>
                            </td>
                            <td>฿{p.amount?.toLocaleString()}</td>
                            <td>
                              {p.imageUrl ? (
                                <button
                                  className="btn btn-outline-info btn-sm"
                                  onClick={() => {
                                    setSlipUrl(p.imageUrl);
                                    setSlipOpen(true);
                                  }}
                                >
                                  ดูสลิป
                                </button>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge bg-${p.status === "APPROVED" ? "success" : p.status === "REJECTED" ? "danger" : "warning"}`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td>
                              {new Date(p.createdAt).toLocaleDateString(
                                "th-TH",
                              )}
                            </td>
                            <td>
                              {p.status === "PENDING" && (
                                <>
                                  <button
                                    className="btn btn-outline-success btn-sm me-1"
                                    disabled={payApproving === p.id}
                                    onClick={() => handlePayApprove(p.id)}
                                  >
                                    {payApproving === p.id ? (
                                      <span className="spinner-border spinner-border-sm" />
                                    ) : (
                                      "อนุมัติ"
                                    )}
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    disabled={payRejecting === p.id}
                                    onClick={() => handlePayReject(p.id)}
                                  >
                                    {payRejecting === p.id ? (
                                      <span className="spinner-border spinner-border-sm" />
                                    ) : (
                                      "ปฏิเสธ"
                                    )}
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!["CANCELLED", "COMPLETED"].includes(mgmt.status) && (
                  <div className="border rounded p-2 bg-light">
                    <small className="text-muted fw-bold d-block mb-2">
                      บันทึกการชำระเงินใหม่
                    </small>
                    <div className="row g-2 mb-2">
                      <div className="col-5">
                        <label className="form-label small mb-1">ประเภท</label>
                        <select
                          className="form-select form-select-sm"
                          value={payForm.type}
                          onChange={(e) =>
                            setPayForm((p) => ({ ...p, type: e.target.value }))
                          }
                          disabled={paySaving}
                        >
                          <option value="RENTAL">ค่าเช่า</option>
                          <option value="DEPOSIT">เงินมัดจำ</option>
                          <option value="PENALTY">ค่าปรับ</option>
                        </select>
                      </div>
                      <div className="col-7">
                        <label className="form-label small mb-1">
                          จำนวนเงิน (฿)
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          placeholder="0"
                          value={payForm.amount}
                          onChange={(e) =>
                            setPayForm((p) => ({
                              ...p,
                              amount: e.target.value,
                            }))
                          }
                          disabled={paySaving}
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="form-label small mb-1">
                        สลิป (ถ้ามี)
                      </label>
                      <input
                        type="file"
                        className="form-control form-control-sm"
                        accept="image/*"
                        onChange={(e) =>
                          setPayForm((p) => ({ ...p, file: e.target.files[0] }))
                        }
                        disabled={paySaving}
                      />
                    </div>
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={handlePaySubmit}
                      disabled={paySaving}
                    >
                      {paySaving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        "บันทึกการชำระเงิน"
                      )}
                    </button>
                  </div>
                )}

                {mgmt.payments?.length === 0 &&
                  ["CANCELLED", "COMPLETED"].includes(mgmt.status) && (
                    <p className="text-muted text-center mb-0">
                      ไม่มีรายการชำระเงิน
                    </p>
                  )}
              </div>
            )}

            {/* ── DEPOSIT ── */}
            {mgmtTab === "deposit" && (
              <div>
                {!deposit ? (
                  <div className="border rounded p-3 bg-light">
                    <p className="text-muted small mb-2">
                      ยังไม่มี เงินมัดจำ สำหรับ ค่าเช่า นี้
                    </p>
                    <label className="form-label small">จำนวนมัดจำ (฿)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm mb-2"
                      placeholder="0"
                      value={depForm.amount}
                      onChange={(e) => setDepForm({ amount: e.target.value })}
                      disabled={depSaving}
                    />
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleDepCreate}
                      disabled={depSaving}
                    >
                      {depSaving ? (
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
                              ฿{(deposit.refundedAmount || 0)?.toLocaleString()}
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

      {/* ===================== CREATE RENTAL MODAL ===================== */}
      <MyModal
        id="modalCreateRental"
        title="สร้างรายการเช่าใหม่"
        open={createOpen}
        onClose={() => {
          if (creating) return;
          setCreateForm(emptyCreate);
          setCreateOpen(false);
        }}
      >
        <label className="form-label">
          ลูกค้า <span className="text-danger">*</span>
        </label>
        <select
          className="form-select mb-3"
          value={createForm.userId}
          onChange={(e) =>
            setCreateForm((p) => ({ ...p, userId: e.target.value }))
          }
          disabled={creating}
        >
          <option value="">-- เลือกลูกค้า --</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>

        <div className="row g-2 mb-3">
          <div className="col-6">
            <label className="form-label">
              วันรับสินค้า <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={createForm.startDate}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, startDate: e.target.value }))
              }
              disabled={creating}
            />
          </div>
          <div className="col-6">
            <label className="form-label">
              วันคืนสินค้า <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={createForm.endDate}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, endDate: e.target.value }))
              }
              disabled={creating}
            />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-6">
            <label className="form-label">มัดจำ (฿)</label>
            <input
              type="number"
              className="form-control"
              placeholder="0"
              value={createForm.depositAmount}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, depositAmount: e.target.value }))
              }
              disabled={creating}
            />
          </div>
          <div className="col-6">
            <label className="form-label">ค่าปรับต่อวัน (฿)</label>
            <input
              type="number"
              className="form-control"
              placeholder="0"
              value={createForm.lateFeePerDay}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, lateFeePerDay: e.target.value }))
              }
              disabled={creating}
            />
          </div>
        </div>

        <label className="form-label">โปรโมชัน (ถ้ามี)</label>
        <select
          className="form-select mb-3"
          value={createForm.promotionId}
          onChange={(e) =>
            setCreateForm((p) => ({ ...p, promotionId: e.target.value }))
          }
          disabled={creating}
        >
          <option value="">-- ไม่ใช้โปรโมชัน --</option>
          {promotionOptions.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name} ({pr.discount}%)
            </option>
          ))}
        </select>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label mb-0">
            รายการสินค้า <span className="text-danger">*</span>
          </label>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() =>
              setCreateForm((p) => ({
                ...p,
                items: [...p.items, { productVariantId: "", quantity: 1 }],
              }))
            }
            disabled={creating}
          >
            + เพิ่ม
          </button>
        </div>

        {createForm.items.map((item, idx) => (
          <div key={idx} className="row g-2 mb-2 align-items-center">
            <div className="col-7">
              <select
                className="form-select form-select-sm"
                value={item.productVariantId}
                onChange={(e) =>
                  handleCreateItemChange(
                    idx,
                    "productVariantId",
                    e.target.value,
                  )
                }
                disabled={creating}
              >
                <option value="">-- เลือกสินค้า --</option>
                {variantOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productName} | {v.size?.name} | {v.color?.name} (฿
                    {v.price?.toLocaleString()}, stock: {v.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-3">
              <input
                type="number"
                className="form-control form-control-sm"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  handleCreateItemChange(idx, "quantity", e.target.value)
                }
                disabled={creating}
              />
            </div>
            <div className="col-2 text-center">
              {createForm.items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() =>
                    setCreateForm((p) => ({
                      ...p,
                      items: p.items.filter((_, i) => i !== idx),
                    }))
                  }
                  disabled={creating}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        <hr />
        <button
          className="btn btn-primary w-100"
          onClick={handleCreateSave}
          disabled={creating}
        >
          {creating ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังสร้าง...
            </>
          ) : (
            "สร้างการเช่า"
          )}
        </button>
      </MyModal>

      {/* ===================== SLIP MODAL ===================== */}
      <MyModal
        id="modalSlip"
        title="สลิปการชำระเงิน"
        open={slipOpen}
        onClose={() => setSlipOpen(false)}
      >
        {slipUrl && (
          <img
            src={getImageUrl(slipUrl)}
            alt="slip"
            className="img-fluid rounded"
          />
        )}
      </MyModal>
    </>
  );
}
