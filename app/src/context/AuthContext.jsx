import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      // Check JWT expiry before making API call
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        const now = Date.now() / 1000;
        if (decoded.exp < now) {
          localStorage.removeItem("token");
          setLoading(false);
          return;
        }
      } catch {
        // If token is invalid, remove it
        localStorage.removeItem("token");
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/api/auth/me");
        setUser(res.data.result);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
