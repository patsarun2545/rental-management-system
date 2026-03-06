import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { showSuccess, showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function SignUp() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return showError("กรุณากรอกข้อมูลให้ครบ");
    }
    try {
      setSaving(true);
      await api.post("/api/auth/signUp", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      showSuccess("สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ");
      navigate("/");
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-light d-flex align-items-center justify-content-center vh-100">
      <div className="card border-0 shadow-sm" style={{ width: "400px", borderRadius: "16px" }}>
        <div className="card-body p-4 p-md-5">
          <h4 className="fw-semibold mb-1 text-center">สมัครสมาชิก</h4>
          <p className="text-muted text-center mb-4" style={{ fontSize: "14px" }}>
            กรอกข้อมูลเพื่อสร้างบัญชี
          </p>

          <div className="mb-3">
            <label className="form-label small text-muted">ชื่อ</label>
            <input
              type="text"
              className="form-control"
              placeholder="ชื่อ-นามสกุล"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              style={{ height: "44px", borderRadius: "10px" }}
              disabled={saving}
            />
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              style={{ height: "44px", borderRadius: "10px" }}
              disabled={saving}
            />
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted">เบอร์โทร (ถ้ามี)</label>
            <input
              type="tel"
              className="form-control"
              placeholder="0812345678"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              style={{ height: "44px", borderRadius: "10px" }}
              disabled={saving}
            />
          </div>

          <div className="mb-4">
            <label className="form-label small text-muted">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="อย่างน้อย 8 ตัว, มีตัวพิมพ์ใหญ่และตัวเลข"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ height: "44px", borderRadius: "10px" }}
              disabled={saving}
            />
          </div>

          <button
            className="btn btn-dark w-100 mb-3"
            style={{ height: "44px", borderRadius: "10px", fontWeight: "500" }}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <><span className="spinner-border spinner-border-sm me-2" />กำลังสมัคร...</>
            ) : "สมัครสมาชิก"}
          </button>

          <p className="text-center text-muted mb-0" style={{ fontSize: "14px" }}>
            มีบัญชีแล้ว?{" "}
            <Link to="/" className="text-dark fw-semibold text-decoration-none">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}