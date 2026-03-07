import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import { getImageUrl } from "../utils/image.utils";
import api from "../services/axios";

export default function Payments() {
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
  // FILTER STATE
  // =========================
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("");
  const [slipUrl, setSlipUrl] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);

  // =========================
  // SLIP MODAL
  // =========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // =========================
  // UPLOAD SLIP FORM
  // =========================
  const [uploadForm, setUploadForm] = useState({
    rentalId: "",
    amount: "",
    type: "RENTAL",
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const clearUploadForm = () =>
    setUploadForm({ rentalId: "", amount: "", type: "RENTAL", file: null });

  const handleUploadSave = async () => {
    if (uploading) return;
    if (!uploadForm.rentalId || !uploadForm.amount || !uploadForm.type)
      return showError("กรุณากรอกข้อมูลให้ครบ");
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("rentalId", uploadForm.rentalId);
      fd.append("amount", uploadForm.amount);
      fd.append("type", uploadForm.type);
      if (uploadForm.file) fd.append("image", uploadForm.file);
      await api.post("/api/payments", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showSuccess("บันทึกการชำระเงินสำเร็จ");
      clearUploadForm();
      setUploadOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setUploading(false);
    }
  };

  // =========================
  // FETCH
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/payments", {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          search: debouncedSearch || undefined,
        },
      });
      setData(res.data.result.payments || []);
      setTotal(res.data.result.total);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =========================
  // ACTION HANDLER
  // =========================
  const handleApprove = async (item) => {
    const confirmed = await showConfirm(
      "อนุมัติ?",
      `อนุมัติการชำระ ฿${item.amount?.toLocaleString()}?`,
      "อนุมัติ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      await api.patch(`/api/payments/${item.id}/approve`);
      showSuccess("อนุมัติสำเร็จ");
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  const handleReject = async (item) => {
    const confirmed = await showConfirm(
      "ปฏิเสธ?",
      `ปฏิเสธการชำระ ฿${item.amount?.toLocaleString()}?`,
      "ปฏิเสธ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      await api.patch(`/api/payments/${item.id}/reject`);
      showSuccess("ปฏิเสธสำเร็จ");
      fetchData();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>ตรวจสอบสลิปการชำระเงิน</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>

        <div className="card-body">
          {/* FILTER */}
          <div className="row mb-3 g-2">
            <div className="col-md-3">
              <input
                className="form-control"
                placeholder="ค้นหา Rental Code"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
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
                <option value="PENDING">PENDING — รอตรวจ</option>
                <option value="APPROVED">APPROVED — อนุมัติแล้ว</option>
                <option value="REJECTED">REJECTED — ปฏิเสธแล้ว</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">ทุกประเภท</option>
                <option value="RENTAL">RENTAL</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="PENALTY">PENALTY</option>
              </select>
            </div>
            <div className="col-md-3 text-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearUploadForm();
                  setUploadOpen(true);
                }}
              >
                + บันทึกการชำระเงิน
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Rental</th>
                  <th>ลูกค้า</th>
                  <th>ประเภท</th>
                  <th>จำนวน</th>
                  <th>สลิป</th>
                  <th>วันที่</th>
                  <th width="160" className="text-center">
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
                      ไม่มีรายการรอตรวจสอบ
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id}>
                      <td>{item.rental?.code}</td>
                      <td>{item.rental?.user?.name}</td>
                      <td>
                        <span className="badge bg-secondary">{item.type}</span>
                      </td>
                      <td>฿{item.amount?.toLocaleString()}</td>
                      <td>
                        {item.imageUrl ? (
                          <button
                            className="btn btn-outline-info btn-sm"
                            onClick={() => {
                              setSlipUrl(item.imageUrl);
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
                        {new Date(item.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-success btn-sm me-2"
                          onClick={() => handleApprove(item)}
                        >
                          อนุมัติ
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleReject(item)}
                        >
                          ปฏิเสธ
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

      {/* MODAL สลิป */}
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

      {/* MODAL บันทึกการชำระเงิน */}
      <MyModal
        id="modalUploadPayment"
        title="บันทึกการชำระเงิน"
        open={uploadOpen}
        onClose={() => {
          if (uploading) return;
          setUploadOpen(false);
        }}
      >
        <label className="form-label">Rental ID</label>
        <input
          type="number"
          className="form-control mb-2"
          placeholder="ระบุ Rental ID"
          value={uploadForm.rentalId}
          onChange={(e) =>
            setUploadForm((p) => ({ ...p, rentalId: e.target.value }))
          }
          disabled={uploading}
        />
        <label className="form-label">จำนวนเงิน</label>
        <input
          type="number"
          className="form-control mb-2"
          placeholder="จำนวนเงิน"
          value={uploadForm.amount}
          onChange={(e) =>
            setUploadForm((p) => ({ ...p, amount: e.target.value }))
          }
          disabled={uploading}
        />
        <label className="form-label">ประเภท</label>
        <select
          className="form-select mb-2"
          value={uploadForm.type}
          onChange={(e) =>
            setUploadForm((p) => ({ ...p, type: e.target.value }))
          }
          disabled={uploading}
        >
          <option value="RENTAL">RENTAL</option>
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="PENALTY">PENALTY</option>
        </select>
        <label className="form-label">สลิป (ถ้ามี)</label>
        <input
          type="file"
          className="form-control mb-3"
          accept="image/*"
          onChange={(e) =>
            setUploadForm((p) => ({ ...p, file: e.target.files[0] }))
          }
          disabled={uploading}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handleUploadSave}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
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
