// AuthGuard.jsx
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div className="text-center">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">กำลังโหลด...</p>
        </div>
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;

  return children;
}
