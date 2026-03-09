import { useState, useEffect, useCallback } from "react";
import { showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Reservations() {
  // =========================
  // RESERVATIONS LIST
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [variantFilter, setVariantFilter] = useState("");
  const [debouncedVariant, setDebouncedVariant] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // AVAILABILITY CHECKER
  // =========================
  const [checkForm, setCheckForm] = useState({
    productVariantId: "",
    startDate: "",
    endDate: "",
    quantity: "1",
  });
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  // =========================
  // DEBOUNCE variant filter
  // =========================
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedVariant(variantFilter); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [variantFilter]);

  // =========================
  // FETCH RESERVATIONS
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/reservations", {
        params: {
          page,
          limit,
          productVariantId: debouncedVariant || undefined,
        },
      });
      setData(res.data.result.reservations);
      setTotal(res.data.result.total);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedVariant]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // =========================
  // CHECK AVAILABILITY
  // =========================
  const handleCheck = async () => {
    if (checking) return;
    const { productVariantId, startDate, endDate, quantity } = checkForm;
    if (!productVariantId || !startDate || !endDate) {
      return;
    }
    try {
      setChecking(true);
      setCheckResult(null);
      const res = await api.get("/api/admin/reservations/check", {
        params: { productVariantId, startDate, endDate, quantity },
      });
      setCheckResult(res.data.result);
    } catch (e) {
      showError(e);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-3">
      {/* AVAILABILITY CHECKER */}
      <div className="card shadow-sm mb-4">
        <div className="card-header">ตรวจสอบความพร้อมของ Stock</div>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted">Variant ID</label>
              <input
                type="number"
                className="form-control"
                placeholder="เช่น 1"
                value={checkForm.productVariantId}
                onChange={(e) => setCheckForm((p) => ({ ...p, productVariantId: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">วันเริ่ม</label>
              <input
                type="date"
                className="form-control"
                value={checkForm.startDate}
                onChange={(e) => setCheckForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">วันสิ้นสุด</label>
              <input
                type="date"
                className="form-control"
                value={checkForm.endDate}
                onChange={(e) => setCheckForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">จำนวน</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={checkForm.quantity}
                onChange={(e) => setCheckForm((p) => ({ ...p, quantity: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={handleCheck} disabled={checking}>
                {checking ? <><span className="spinner-border spinner-border-sm me-1" />กำลังตรวจ...</> : "ตรวจสอบ"}
              </button>
            </div>
          </div>

          {checkResult && (
            <div className={`alert mt-3 mb-0 ${checkResult.isAvailable ? "alert-success" : "alert-danger"}`}>
              <div className="row">
                <div className="col-6 col-md-3">
                  <small className="text-muted d-block">SKU</small>
                  <strong>{checkResult.sku}</strong>
                </div>
                <div className="col-6 col-md-2">
                  <small className="text-muted d-block">Stock ทั้งหมด</small>
                  <strong>{checkResult.totalStock}</strong>
                </div>
                <div className="col-6 col-md-2">
                  <small className="text-muted d-block">จองแล้ว</small>
                  <strong className="text-warning">{checkResult.reservedAmount}</strong>
                </div>
                <div className="col-6 col-md-2">
                  <small className="text-muted d-block">พร้อมใช้</small>
                  <strong className={checkResult.isAvailable ? "text-success" : "text-danger"}>
                    {checkResult.availableStock}
                  </strong>
                </div>
                <div className="col-12 col-md-3 d-flex align-items-center mt-2 mt-md-0">
                  <span className={`badge fs-6 bg-${checkResult.isAvailable ? "success" : "danger"}`}>
                    {checkResult.isAvailable ? "✓ มีพร้อม" : "✗ ไม่เพียงพอ"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESERVATIONS TABLE */}
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>รายการจอง Stock ทั้งหมด</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>
        <div className="card-body">
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="กรอง Variant ID"
                value={variantFilter}
                onChange={(e) => setVariantFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>สินค้า</th>
                  <th>SKU</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Rental</th>
                  <th>วันเริ่ม</th>
                  <th>วันสิ้นสุด</th>
                  <th>สถานะ Rental</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center text-muted">กำลังโหลด...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="9" className="text-center text-muted">ไม่มีข้อมูล</td></tr>
                ) : data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.variant?.product?.name}</td>
                    <td><code>{item.variant?.sku}</code></td>
                    <td>{item.variant?.size?.name}</td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        {item.variant?.color?.hex && (
                          <div style={{
                            width: 14, height: 14, borderRadius: 3,
                            background: item.variant.color.hex,
                            border: "1px solid #dee2e6",
                          }} />
                        )}
                        {item.variant?.color?.name}
                      </div>
                    </td>
                    <td>
                      {item.rental ? (
                        <span className="badge bg-light text-dark border">{item.rental.code}</span>
                      ) : "-"}
                    </td>
                    <td>{new Date(item.startDate).toLocaleDateString("th-TH")}</td>
                    <td>{new Date(item.endDate).toLocaleDateString("th-TH")}</td>
                    <td>
                      {item.rental?.status ? (
                        <span className="badge bg-info text-dark">{item.rental.status}</span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="mt-3 d-flex justify-content-center align-items-center">
            <button className="btn btn-outline-secondary me-2" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
            <span>หน้า {page} / {totalPages}</span>
            <button className="btn btn-outline-secondary ms-2" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
          </div>
        </div>
      </div>
    </div>
  );
}