import axios from "axios";
import config from "../../config";

const api = axios.create({
  baseURL: config.apiServer,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;