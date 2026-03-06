import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { showSuccess, showError } from "../utils/alert.utils";
import api from "../services/axios";

export default function Signin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const signin = async () => {
    try {
      const payload = { email, password };
      const res = await api.post("/api/auth/signIn", payload);

      setUser(res.data.result);
      showSuccess("Login Success");
      navigate("/dashboard");
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="bg-light d-flex align-items-center justify-content-center vh-100">
      <div
        className="card border-0 shadow-sm"
        style={{ width: "380px", borderRadius: "16px" }}
      >
        <div className="card-body p-4 p-md-5">
          {/* Title */}
          <h4 className="fw-semibold mb-1 text-center">Welcome back</h4>
          <p
            className="text-muted text-center mb-4"
            style={{ fontSize: "14px" }}
          >
            Please enter your details
          </p>

          {/* Email */}
          <div className="mb-3">
            <label className="form-label small text-muted">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ height: "44px", borderRadius: "10px" }}
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="form-label small text-muted">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: "44px", borderRadius: "10px" }}
            />
          </div>

          {/* Button */}
          <button
            className="btn btn-dark w-100 mb-3"
            style={{
              height: "44px",
              borderRadius: "10px",
              fontWeight: "500",
            }}
            onClick={signin}
          >
            Sign in
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
