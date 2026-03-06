import MyModal from "../components/MyModal";
import { useState, useEffect, useCallback } from "react";
import { showSuccess, showError, showConfirm } from "../utils/alert.utils";
import api from "../services/axios";

export default function Users() {
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
  // ROLE MODAL
  // =========================
  const [roleForm, setRoleForm] = useState({ id: null, role: "USER" });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  // =========================
  // EDIT PROFILE MODAL
  // =========================
  const [profileForm, setProfileForm] = useState({
    id: null,
    name: "",
    phone: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // =========================
  // ADDRESS MODAL
  // =========================
  const [addressUserId, setAddressUserId] = useState(null);
  const [addressUserName, setAddressUserName] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressForm, setAddressForm] = useState({ id: null, address: "" });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressRemoving, setAddressRemoving] = useState(null);
  const [addressOpen, setAddressOpen] = useState(false);

  // =========================
  // REMOVING
  // =========================
  const [removing, setRemoving] = useState(null);

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
  // FETCH USERS
  // =========================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/users", {
        params: { page, limit, search: debouncedSearch },
      });
      setData(res.data.result.users);
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
  // ROLE HANDLER
  // =========================
  const handleRoleSave = async () => {
    if (roleSaving) return;
    try {
      setRoleSaving(true);
      await api.patch(`/api/users/${roleForm.id}/role`, {
        role: roleForm.role,
      });
      showSuccess("เปลี่ยน Role สำเร็จ");
      setRoleOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRoleSaving(false);
    }
  };

  // =========================
  // PROFILE HANDLER
  // =========================
  const handleProfileSave = async () => {
    if (profileSaving) return;
    if (!profileForm.name.trim()) return showError("กรุณากรอกชื่อ");
    try {
      setProfileSaving(true);
      await api.put(`/api/users/${profileForm.id}`, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || undefined,
      });
      showSuccess("แก้ไขข้อมูลสำเร็จ");
      setProfileOpen(false);
      fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setProfileSaving(false);
    }
  };

  // =========================
  // REMOVE USER
  // =========================
  const handleRemove = async (item) => {
    if (removing) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      `ต้องการลบผู้ใช้ "${item.name}" หรือไม่`,
      "ลบ",
      "ยกเลิก",
    );
    if (!confirmed) return;
    try {
      setRemoving(item.id);
      await api.delete(`/api/users/${item.id}`);
      showSuccess("ลบสำเร็จ");
      if (data.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchData();
    } catch (e) {
      showError(e);
    } finally {
      setRemoving(null);
    }
  };

  // =========================
  // ADDRESS HANDLERS
  // =========================
  const openAddresses = async (item) => {
    setAddressUserId(item.id);
    setAddressUserName(item.name);
    setAddressForm({ id: null, address: "" });
    setAddressOpen(true);
    await fetchAddresses(item.id);
  };

  const fetchAddresses = async (userId) => {
    try {
      setAddressLoading(true);
      const res = await api.get(`/api/users/${userId}/addresses`);
      setAddresses(res.data.result);
    } catch (e) {
      showError(e);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleAddressSave = async () => {
    if (addressSaving) return;
    if (!addressForm.address.trim()) return showError("กรุณากรอกที่อยู่");
    try {
      setAddressSaving(true);
      if (!addressForm.id) {
        // Admin ใช้ endpoint ของ user โดยตรง
        await api.post(`/api/users/${addressUserId}/addresses`, {
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
      fetchAddresses(addressUserId);
    } catch (e) {
      showError(e);
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddressRemove = async (addr) => {
    if (addressRemoving) return;
    const confirmed = await showConfirm(
      "ยืนยันการลบ?",
      "ลบที่อยู่นี้?",
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
      <div className="card mt-3 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>จัดการผู้ใช้</span>
          {loading && (
            <div className="spinner-border spinner-border-sm text-secondary" />
          )}
        </div>

        <div className="card-body">
          {/* SEARCH */}
          <div className="row mb-3 g-2">
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="ค้นหาชื่อ / email"
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
                  <th>#</th>
                  <th>ชื่อ</th>
                  <th>Email</th>
                  <th>เบอร์</th>
                  <th>Role</th>
                  <th>วันที่สมัคร</th>
                  <th width="220" className="text-center">
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
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.phone || "-"}</td>
                      <td>
                        <span
                          className={`badge bg-${item.role === "ADMIN" ? "danger" : "secondary"}`}
                        >
                          {item.role}
                        </span>
                      </td>
                      <td>
                        {new Date(item.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-secondary btn-sm me-1"
                          disabled={!!removing}
                          onClick={() => {
                            setProfileForm({
                              id: item.id,
                              name: item.name,
                              phone: item.phone || "",
                            });
                            setProfileOpen(true);
                          }}
                          title="แก้ไขข้อมูล"
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-primary btn-sm me-1"
                          disabled={!!removing}
                          onClick={() => {
                            setRoleForm({ id: item.id, role: item.role });
                            setRoleOpen(true);
                          }}
                          title="เปลี่ยน Role"
                        >
                          Role
                        </button>
                        <button
                          className="btn btn-outline-info btn-sm me-1"
                          disabled={!!removing}
                          onClick={() => openAddresses(item)}
                          title="จัดการที่อยู่"
                        >
                          ที่อยู่
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          disabled={!!removing}
                          onClick={() => handleRemove(item)}
                        >
                          {removing === item.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" />
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

      {/* MODAL เปลี่ยน Role */}
      <MyModal
        id="modalUserRole"
        title="เปลี่ยน Role"
        open={roleOpen}
        onClose={() => {
          if (roleSaving) return;
          setRoleOpen(false);
        }}
      >
        <select
          className="form-select mb-3"
          value={roleForm.role}
          onChange={(e) => setRoleForm((p) => ({ ...p, role: e.target.value }))}
          disabled={roleSaving}
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          className="btn btn-primary w-100"
          onClick={handleRoleSave}
          disabled={roleSaving}
        >
          {roleSaving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </MyModal>

      {/* MODAL แก้ไข Profile */}
      <MyModal
        id="modalUserProfile"
        title="แก้ไขข้อมูลผู้ใช้"
        open={profileOpen}
        onClose={() => {
          if (profileSaving) return;
          setProfileOpen(false);
        }}
      >
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
          disabled={profileSaving}
        />
        <button
          className="btn btn-primary w-100"
          onClick={handleProfileSave}
          disabled={profileSaving}
        >
          {profileSaving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </MyModal>

      {/* MODAL ที่อยู่ */}
      <MyModal
        id="modalUserAddress"
        title={`ที่อยู่ของ ${addressUserName}`}
        open={addressOpen}
        onClose={() => {
          if (addressSaving) return;
          setAddressOpen(false);
        }}
      >
        {/* รายการที่อยู่ */}
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
                    <span style={{ fontSize: 14 }}>{addr.address}</span>
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

        {/* เพิ่มที่อยู่ใหม่ */}
        {!addressForm.id && (
          <>
            <hr />
            <label className="form-label">เพิ่มที่อยู่ใหม่</label>
            <textarea
              className="form-control mb-2"
              rows={2}
              placeholder="ที่อยู่"
              value={addressForm.address}
              onChange={(e) =>
                setAddressForm((p) => ({ ...p, address: e.target.value }))
              }
              disabled={addressSaving}
            />
            <button
              className="btn btn-success w-100"
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
      </MyModal>
    </>
  );
}
