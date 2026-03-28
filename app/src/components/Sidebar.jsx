import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import { useState } from "react";
import MyModal from "../components/MyModal";
import api from "../services/axios";

export default function Sidebar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  // =========================
  // โมดัลโปรไฟล์
  // =========================
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  // =========================
  // โมดัลเปลี่ยนรหัสผ่าน
  // =========================
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwSaving, setPwSaving] = useState(false);

  // =========================
  // โมดัลที่อยู่
  // =========================
  const [addressOpen, setAddressOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressForm, setAddressForm] = useState({ id: null, address: "" });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressRemoving, setAddressRemoving] = useState(null);

  // =========================
  // ออกจากระบบ
  // =========================
  const signOut = async () => {
    try {
      const confirmed = await showConfirm(
        "ออกจากระบบ",
        "คุณต้องการออกจากระบบใช่หรือไม่?",
      );
      if (confirmed) {
        await api.post("/api/auth/signOut");
        localStorage.removeItem("token"); // ← เพิ่มบรรทัดนี้
        setUser(null);
        showSuccess("ออกจากระบบสำเร็จ");
        navigate("/");
      }
    } catch (e) {
      showError(e);
    }
  };

  // =========================
  // ฟังก์ชันจัดการโปรไฟล์
  // =========================
  const openProfile = () => {
    setProfileForm({ name: user?.name || "", phone: user?.phone || "" });
    setProfileOpen(true);
  };

  const handleProfileSave = async () => {
    if (profileSaving) return;
    if (!profileForm.name.trim()) return showError("กรุณากรอกชื่อ");
    try {
      setProfileSaving(true);
      const res = await api.put(`/api/users/${user.id}`, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || undefined,
      });
      setUser((prev) => ({
        ...prev,
        name: res.data.result.name,
        phone: res.data.result.phone,
      }));
      showSuccess("แก้ไขข้อมูลสำเร็จ");
      setProfileOpen(false);
    } catch (e) {
      showError(e);
    } finally {
      setProfileSaving(false);
    }
  };

  // =========================
  // ฟังก์ชันจัดการรหัสผ่าน
  // =========================
  const openPassword = () => {
    setProfileOpen(false);
    setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPwOpen(true);
  };

  const handlePwSave = async () => {
    if (pwSaving) return;
    if (!pwForm.oldPassword || !pwForm.newPassword)
      return showError("กรุณากรอกข้อมูลให้ครบ");
    if (pwForm.newPassword !== pwForm.confirmPassword)
      return showError("รหัสผ่านใหม่ไม่ตรงกัน");
    try {
      setPwSaving(true);
      await api.patch(`/api/users/${user.id}/password`, {
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });
      showSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
      setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setPwOpen(false);
    } catch (e) {
      showError(e);
    } finally {
      setPwSaving(false);
    }
  };

  // =========================
  // ฟังก์ชันจัดการที่อยู่
  // =========================
  const fetchAddresses = async () => {
    try {
      setAddressLoading(true);
      const res = await api.get("/api/users/me/addresses");
      setAddresses(res.data.result);
    } catch (e) {
      showError(e);
    } finally {
      setAddressLoading(false);
    }
  };

  const openAddresses = () => {
    setProfileOpen(false);
    setAddressForm({ id: null, address: "" });
    setAddressOpen(true);
    fetchAddresses();
  };

  const handleAddressSave = async () => {
    if (addressSaving) return;
    if (!addressForm.address.trim()) return showError("กรุณากรอกที่อยู่");
    try {
      setAddressSaving(true);
      if (!addressForm.id) {
        await api.post("/api/users/me/addresses", {
          address: addressForm.address.trim(),
        });
        showSuccess("เพิ่มที่อยู่สำเร็จ");
      } else {
        await api.put(`/api/users/me/addresses/${addressForm.id}`, {
          address: addressForm.address.trim(),
        });
        showSuccess("แก้ไขที่อยู่สำเร็จ");
      }
      setAddressForm({ id: null, address: "" });
      fetchAddresses();
    } catch (e) {
      showError(e);
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddressRemove = async (addr) => {
    if (addressRemoving) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ",
      "คุณต้องการลบที่อยู่นี้ใช่หรือไม่?",
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setAddressRemoving(addr.id);
      await api.delete(`/api/users/me/addresses/${addr.id}`);
      showSuccess("ลบที่อยู่สำเร็จ");
      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
    } catch (e) {
      showError(e);
    } finally {
      setAddressRemoving(null);
    }
  };

  return (
    <>
      <aside
        className="app-sidebar bg-body-secondary shadow"
        data-bs-theme="dark"
      >
        {/* Sidebar Brand */}
        <div className="sidebar-brand">
          <Link to="/dashboard" className="brand-link">
            <img
              src="/dist/assets/img/Logo.png"
              alt="AdminLTE Logo"
              className="brand-image opacity-75 shadow"
            />
            <span className="brand-text fw-light">RMS</span>
          </Link>
        </div>

        <div className="sidebar-wrapper">
          {/* User Panel — คลิกชื่อเปิด modal โปรไฟล์ */}
          <div className="user-panel mt-3 pb-3 mb-3 px-3">
            {/* row 1: รูป + ชื่อ + role */}
            <div className="d-flex align-items-center mb-2">
              <div className="image me-2 flex-shrink-0">
                <img
                  src="/dist/assets/img/user.png"
                  className="img-circle elevation-2"
                  alt="User Image"
                  style={{ width: 34, height: 34 }}
                />
              </div>
              <div className="overflow-hidden">
                <div
                  className="text-white fw-semibold text-truncate"
                  style={{ fontSize: 14, lineHeight: 1.3 }}
                >
                  {user?.name}
                </div>
                <span
                  className={`badge bg-${user?.role === "ADMIN" ? "danger" : "secondary"}`}
                  style={{ fontSize: 10 }}
                >
                  {user?.role}
                </span>
              </div>
            </div>
            {/* row 2: ปุ่ม แก้ไข + logout */}
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-light btn-sm flex-fill"
                style={{ fontSize: 12 }}
                onClick={openProfile}
              >
                <i className="bi bi-pencil-fill me-1"></i>แก้ไข
              </button>
              <button
                className="btn btn-danger btn-sm flex-fill"
                style={{ fontSize: 12 }}
                onClick={signOut}
              >
                <i className="bi bi-box-arrow-right me-1"></i>ออกจากระบบ
              </button>
            </div>
          </div>

          <nav className="mt-2">
            <ul
              className="nav sidebar-menu flex-column"
              data-lte-toggle="treeview"
              role="menu"
              data-accordion="false"
            >
              {/* DASHBOARD */}
              <li className="nav-item">
                <Link to="/dashboard" className="nav-link">
                  <i className="nav-icon bi bi-speedometer2"></i>
                  <p>Dashboard</p>
                </Link>
              </li>

              {/* ================= MASTER DATA ================= */}
              <li className="nav-header">Master Data</li>

              <li className="nav-item">
                <Link to="/users" className="nav-link">
                  <i className="nav-icon bi bi-people-fill"></i>
                  <p>Users</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/products" className="nav-link">
                  <i className="nav-icon bi bi-box-seam-fill"></i>
                  <p>Products</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/categories" className="nav-link">
                  <i className="nav-icon bi bi-tags-fill"></i>
                  <p>Categories</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/types" className="nav-link">
                  <i className="nav-icon bi bi-list-ul"></i>
                  <p>Types</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/sizes-colors" className="nav-link">
                  <i className="nav-icon bi bi-palette-fill"></i>
                  <p>Sizes & Colors</p>
                </Link>
              </li>

              {/* ================= RENTAL MANAGEMENT ================= */}
              <li className="nav-header">Rental Management</li>

              <li className="nav-item">
                <Link to="/reservations" className="nav-link">
                  <i className="nav-icon bi bi-calendar2-check-fill"></i>
                  <p>Reservations</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/rentals" className="nav-link">
                  <i className="nav-icon bi bi-cart-fill"></i>
                  <p>Rentals</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/returns" className="nav-link">
                  <i className="nav-icon bi bi-arrow-counterclockwise"></i>
                  <p>Returns</p>
                </Link>
              </li>

              {/* ================= FINANCE ================= */}
              <li className="nav-header">Finance</li>

              <li className="nav-item">
                <Link to="/payments" className="nav-link">
                  <i className="nav-icon bi bi-credit-card-fill"></i>
                  <p>Payments</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/deposits" className="nav-link">
                  <i className="nav-icon bi bi-wallet-fill"></i>
                  <p>Deposits</p>
                </Link>
              </li>

              <li className="nav-item">
                <Link to="/invoices" className="nav-link">
                  <i className="nav-icon bi bi-receipt"></i>
                  <p>Invoices</p>
                </Link>
              </li>

              {/* ================= MARKETING ================= */}
              <li className="nav-header">Marketing</li>

              <li className="nav-item">
                <Link to="/promotions" className="nav-link">
                  <i className="nav-icon bi bi-megaphone-fill"></i>
                  <p>Promotions</p>
                </Link>
              </li>

              {/* ================= REPORTS ================= */}
              <li className="nav-header">Reports</li>

              <li className="nav-item">
                <Link to="/reports" className="nav-link">
                  <i className="nav-icon bi bi-bar-chart-fill"></i>
                  <p>Reports</p>
                </Link>
              </li>

              {/* ================= SYSTEM ================= */}
              <li className="nav-header">System</li>

              <li className="nav-item">
                <Link to="/audit" className="nav-link">
                  <i className="nav-icon bi bi-clipboard2-check-fill"></i>
                  <p>Audit Logs</p>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* ======================================================
          MODAL แก้ไขโปรไฟล์
      ====================================================== */}
      <MyModal
        id="modalSidebarProfile"
        title="โปรไฟล์ของฉัน"
        open={profileOpen}
        onClose={() => {
          if (profileSaving) return;
          setProfileOpen(false);
        }}
      >
        {/* ข้อมูล read-only */}
        <div className="mb-3 p-3 bg-light rounded border">
          <div className="d-flex justify-content-between">
            <div>
              <small className="text-muted d-block">Email</small>
              <span style={{ fontSize: 14 }}>{user?.email}</span>
            </div>
            <span
              className={`badge bg-${user?.role === "ADMIN" ? "danger" : "secondary"} align-self-start`}
            >
              {user?.role}
            </span>
          </div>
        </div>

        <label className="form-label">ชื่อ</label>
        <input
          className="form-control mb-2"
          placeholder="ชื่อ-นามสกุล"
          value={profileForm.name}
          onChange={(e) =>
            setProfileForm((p) => ({ ...p, name: e.target.value }))
          }
          disabled={profileSaving}
        />
        <label className="form-label">เบอร์โทร</label>
        <input
          className="form-control mb-3"
          placeholder="0xxxxxxxxx"
          value={profileForm.phone}
          onChange={(e) =>
            setProfileForm((p) => ({ ...p, phone: e.target.value }))
          }
          onKeyDown={(e) => e.key === "Enter" && handleProfileSave()}
          disabled={profileSaving}
        />

        <button
          className="btn btn-primary w-100 mb-2"
          onClick={handleProfileSave}
          disabled={profileSaving}
        >
          {profileSaving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึกข้อมูล"
          )}
        </button>

        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-warning flex-fill"
            onClick={openPassword}
            disabled={profileSaving}
          >
            <i className="bi bi-key-fill me-1"></i>เปลี่ยนรหัสผ่าน
          </button>
          <button
            className="btn btn-outline-info flex-fill"
            onClick={openAddresses}
            disabled={profileSaving}
          >
            <i className="bi bi-geo-alt-fill me-1"></i>เปลี่ยนที่อยู่
          </button>
        </div>
      </MyModal>

      {/* ======================================================
          MODAL เปลี่ยนรหัสผ่าน
      ====================================================== */}
      <MyModal
        id="modalSidebarPassword"
        title="เปลี่ยนรหัสผ่าน"
        open={pwOpen}
        onClose={() => {
          if (pwSaving) return;
          setPwOpen(false);
        }}
      >
        <label className="form-label">รหัสผ่านเดิม</label>
        <input
          type="password"
          className="form-control mb-2"
          placeholder="••••••••"
          value={pwForm.oldPassword}
          onChange={(e) =>
            setPwForm((p) => ({ ...p, oldPassword: e.target.value }))
          }
          disabled={pwSaving}
        />
        <label className="form-label">รหัสผ่านใหม่</label>
        <input
          type="password"
          className="form-control mb-2"
          placeholder="อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่และตัวเลข"
          value={pwForm.newPassword}
          onChange={(e) =>
            setPwForm((p) => ({ ...p, newPassword: e.target.value }))
          }
          disabled={pwSaving}
        />
        <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
        <input
          type="password"
          className="form-control mb-2"
          placeholder="••••••••"
          value={pwForm.confirmPassword}
          onChange={(e) =>
            setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))
          }
          onKeyDown={(e) => e.key === "Enter" && handlePwSave()}
          disabled={pwSaving}
        />
        <p className="text-muted small mb-3">
          ต้องอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ 1 ตัว และตัวเลข 1 ตัว
        </p>
        <button
          className="btn btn-primary w-100 mb-2"
          onClick={handlePwSave}
          disabled={pwSaving}
        >
          {pwSaving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "เปลี่ยนรหัสผ่าน"
          )}
        </button>
        <button
          className="btn btn-outline-secondary w-100"
          onClick={() => {
            setPwOpen(false);
            openProfile();
          }}
          disabled={pwSaving}
        >
          ← กลับ
        </button>
      </MyModal>

      {/* ======================================================
          MODAL ที่อยู่
      ====================================================== */}
      <MyModal
        id="modalSidebarAddress"
        title="ที่อยู่ของฉัน"
        open={addressOpen}
        onClose={() => {
          if (addressSaving) return;
          setAddressOpen(false);
        }}
      >
        {addressLoading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm" />
          </div>
        ) : addresses.length === 0 ? (
          <p className="text-muted text-center">ยังไม่มีที่อยู่</p>
        ) : (
          <div className="list-group mb-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="list-group-item d-flex justify-content-between align-items-start gap-2"
              >
                <div className="flex-grow-1">
                  {addressForm.id === addr.id ? (
                    <input
                      className="form-control form-control-sm"
                      value={addressForm.address}
                      onChange={(e) =>
                        setAddressForm((p) => ({
                          ...p,
                          address: e.target.value,
                        }))
                      }
                      disabled={addressSaving}
                    />
                  ) : (
                    <span style={{ fontSize: 13 }}>📍 {addr.address}</span>
                  )}
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  {addressForm.id === addr.id ? (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={handleAddressSave}
                        disabled={addressSaving}
                      >
                        {addressSaving ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          "บันทึก"
                        )}
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          setAddressForm({ id: null, address: "" })
                        }
                        disabled={addressSaving}
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        disabled={!!addressRemoving}
                        onClick={() =>
                          setAddressForm({ id: addr.id, address: addr.address })
                        }
                      >
                        แก้
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        disabled={!!addressRemoving}
                        onClick={() => handleAddressRemove(addr)}
                      >
                        {addressRemoving === addr.id ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          "ลบ"
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!addressForm.id && (
          <>
            <hr />
            <label className="form-label">เพิ่มที่อยู่ใหม่</label>
            <textarea
              className="form-control mb-2"
              rows={2}
              placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
              value={addressForm.address}
              onChange={(e) =>
                setAddressForm((p) => ({ ...p, address: e.target.value }))
              }
              disabled={addressSaving}
            />
            <button
              className="btn btn-success w-100 mb-2"
              onClick={handleAddressSave}
              disabled={addressSaving}
            >
              {addressSaving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  กำลังบันทึก...
                </>
              ) : (
                "+ เพิ่มที่อยู่"
              )}
            </button>
          </>
        )}

        <button
          className="btn btn-outline-secondary w-100"
          onClick={() => {
            setAddressOpen(false);
            openProfile();
          }}
          disabled={addressSaving}
        >
          ← กลับ
        </button>
      </MyModal>
    </>
  );
}
