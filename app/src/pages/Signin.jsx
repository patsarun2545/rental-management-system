import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { showSuccess, showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Signin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const res = await api.post("/api/auth/signIn", {
        email: form.email,
        password: form.password,
      });

      const userData = res.data.result;

      if (userData.role !== "ADMIN") {
        showError("ไม่มีสิทธิ์เข้าใช้งานระบบนี้");
        return;
      }

      setUser(userData);
      showSuccess("เข้าสู่ระบบสำเร็จ");
      navigate("/dashboard");
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-light d-flex align-items-center justify-content-center vh-100">
      <div
        className="card border-0 shadow-sm"
        style={{ width: "380px", borderRadius: "16px" }}
      >
        <div className="card-body p-4 p-md-5">
          <h4 className="fw-semibold mb-1 text-center">ยินดีต้อนรับ</h4>
          <p
            className="text-muted text-center mb-4"
            style={{ fontSize: "14px" }}
          >
            กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ
          </p>

          <div className="mb-3">
            <label className="form-label small text-muted">อีเมล</label>
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

          <div className="mb-4">
            <label className="form-label small text-muted">รหัสผ่าน</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
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
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </button>

          <p
            className="text-center text-muted mb-0"
            style={{ fontSize: "14px" }}
          >
            ยังไม่มีบัญชี?{" "}
            <Link
              to="/signup"
              className="text-dark fw-semibold text-decoration-none"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
