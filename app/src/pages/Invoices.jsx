import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Invoices() {
  // =========================
  // LIST STATE
  // =========================
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // =========================
  // DETAIL MODAL
  // =========================
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // =========================
  // CREATE INVOICE MODAL
  // =========================
  const [createForm, setCreateForm] = useState({ rentalId: "" });
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // =========================
  // DEBOUNCE SEARCH
  // =========================
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/payments/invoices", {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      setData(res.data.result.invoices);
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
  // VIEW INVOICE
  // =========================
  const handleView = async (item) => {
    try {
      // ดึง invoice + rental แบบ full (มี items, penalties)
      const [invoiceRes, rentalRes] = await Promise.all([
        api.get(`/api/rentals/${item.rentalId}/invoice`),
        api.get(`/api/rentals/${item.rentalId}`),
      ]);
      setDetail({ ...invoiceRes.data.result, rental: rentalRes.data.result });
      setDetailOpen(true);
    } catch (e) {
      showError(e);
    }
  };

  // =========================
  // CREATE INVOICE
  // =========================
  const handleCreate = async () => {
    if (creating) return;
    if (!createForm.rentalId) return showError("กรุณากรอก Rental ID");
    try {
      setCreating(true);
      const res = await api.post(`/api/rentals/${createForm.rentalId}/invoice`);
      showSuccess("สร้าง Invoice สำเร็จ");
      setCreateForm({ rentalId: "" });
      setCreateOpen(false);
      fetchData();
      // เปิด detail ทันที
      setDetail(res.data.result);
      setDetailOpen(true);
    } catch (e) {
      showError(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการ Invoice</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>

        <div className="card-body">
          {/* SEARCH + CREATE */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="ค้นหาเลข Invoice"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-8 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreateForm({ rentalId: "" });
                  setCreateOpen(true);
                }}
              >
                + สร้าง Invoice
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Invoice No</th>
                  <th>Rental Code</th>
                  <th>ลูกค้า</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ Rental</th>
                  <th>วันที่</th>
                  <th width="80" className="text-center">
                    ดู
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
                        <code>{item.invoiceNo}</code>
                      </td>
                      <td>{item.rental?.code}</td>
                      <td>{item.rental?.user?.name}</td>
                      <td>฿{item.total?.toLocaleString()}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {item.rental?.status}
                        </span>
                      </td>
                      <td>
                        {new Date(item.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-info btn-sm"
                          onClick={() => handleView(item)}
                        >
                          ดู
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

      {/* MODAL สร้าง Invoice */}
      <MyModal
        id="modalCreateInvoice"
        title="สร้าง Invoice"
        open={createOpen}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
        }}
      >
        <label className="form-label">Rental ID</label>
        <input
          type="number"
          className="form-control mb-3"
          placeholder="ระบุ Rental ID"
          value={createForm.rentalId}
          onChange={(e) => setCreateForm({ rentalId: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={creating}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังสร้าง...
            </>
          ) : (
            "สร้าง Invoice"
          )}
        </button>
      </MyModal>

      {/* MODAL รายละเอียด Invoice */}
      <MyModal
        id="modalInvoiceDetail"
        title={`Invoice — ${detail?.invoiceNo || ""}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detail && (
          <>
            <div className="row mb-3">
              <div className="col-6">
                <small className="text-muted">Invoice No</small>
                <div>
                  <code className="fs-6">{detail.invoiceNo}</code>
                </div>
              </div>
              <div className="col-6">
                <small className="text-muted">วันที่</small>
                <div>
                  {new Date(detail.createdAt).toLocaleDateString("th-TH")}
                </div>
              </div>
            </div>

            {detail.rental && (
              <>
                <hr />
                <strong>ข้อมูลการเช่า</strong>
                <div className="mt-2 mb-2">
                  <small className="text-muted">ลูกค้า:</small>{" "}
                  {detail.rental?.user?.name} ({detail.rental?.user?.email})
                  <br />
                  <small className="text-muted">Rental Code:</small>{" "}
                  {detail.rental?.code}
                </div>

                {detail.rental?.items?.length > 0 && (
                  <div className="table-responsive mt-2">
                    <table className="table table-bordered table-sm">
                      <thead className="table-light">
                        <tr>
                          <th>สินค้า</th>
                          <th>Size</th>
                          <th>Color</th>
                          <th>จำนวน</th>
                          <th>ราคา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rental.items.map((i) => (
                          <tr key={i.id}>
                            <td>{i.variant?.product?.name}</td>
                            <td>{i.variant?.size?.name}</td>
                            <td>{i.variant?.color?.name}</td>
                            <td>{i.quantity}</td>
                            <td>฿{i.variant?.price?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detail.rental?.penalties?.length > 0 && (
                  <>
                    <strong>ค่าปรับ</strong>
                    <div className="table-responsive mt-1">
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th>ประเภท</th>
                            <th>จำนวน</th>
                            <th>หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.rental.penalties.map((p) => (
                            <tr key={p.id}>
                              <td>{p.type}</td>
                              <td>฿{p.amount?.toLocaleString()}</td>
                              <td>{p.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            <hr />
            <div className="d-flex justify-content-between align-items-center">
              <strong className="fs-5">ยอดรวมทั้งหมด</strong>
              <strong className="fs-5 text-primary">
                ฿{detail.total?.toLocaleString()}
              </strong>
            </div>
          </>
        )}
      </MyModal>
    </>
  );
}
