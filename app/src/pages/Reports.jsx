import { useState, useEffect } from "react";
import { showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Reports() {
  const [monthly, setMonthly] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [r1, r2, r3] = await Promise.all([
          api.get("/api/admin/revenue"),
          api.get("/api/admin/products/top"),
          api.get("/api/admin/rentals/overdue"),
        ]);
        setMonthly(r1.data.result.monthly || []);
        setTopProducts(r2.data.result || []);
        setOverdue(r3.data.result.rentals || []);
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <>
      {/* REVENUE CHART */}
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>รายได้รายเดือน (12 เดือนล่าสุด)</span>
          {loading && <div className="spinner-border spinner-border-sm text-secondary" />}
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center text-muted">กำลังโหลด...</div>
          ) : (
            <div className="d-flex align-items-end gap-2" style={{ height: 200, overflowX: "auto" }}>
              {monthly.map((m) => (
                <div key={m.month} className="d-flex flex-column align-items-center" style={{ minWidth: 55 }}>
                  <small className="text-muted mb-1" style={{ fontSize: 11 }}>
                    ฿{(m.revenue / 1000).toFixed(0)}k
                  </small>
                  <div
                    className="bg-primary rounded-top w-100"
                    style={{ height: `${Math.max((m.revenue / maxRevenue) * 160, 4)}px` }}
                  />
                  <small className="text-muted mt-1" style={{ fontSize: 10 }}>{m.month.slice(5)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP PRODUCTS */}
      <div className="card mt-3 shadow-sm">
        <div className="card-header">สินค้าที่ถูกเช่าบ่อย (Top 10)</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>สินค้า</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>เช่าทั้งหมด</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center text-muted">กำลังโหลด...</td></tr>
                ) : topProducts.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted">ไม่มีข้อมูล</td></tr>
                ) : (
                  topProducts.map((v, i) => (
                    <tr key={v.id}>
                      <td>{i + 1}</td>
                      <td>{v.product?.name}</td>
                      <td>{v.size?.name}</td>
                      <td>{v.color?.name}</td>
                      <td><span className="badge bg-primary">{v.totalRented}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OVERDUE */}
      <div className="card mt-3 shadow-sm">
        <div className="card-header text-danger">รายการเกินกำหนดคืน</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>ลูกค้า</th>
                  <th>เกิน (วัน)</th>
                  <th>ค่าปรับโดยประมาณ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center text-muted">กำลังโหลด...</td></tr>
                ) : overdue.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-muted">ไม่มีรายการเกินกำหนด</td></tr>
                ) : (
                  overdue.map((r) => (
                    <tr key={r.id}>
                      <td>{r.code}</td>
                      <td>{r.user?.name}</td>
                      <td className="text-danger fw-bold">{r.daysOverdue}</td>
                      <td>฿{r.estimatedLateFee?.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
