import axios from "axios";
import config from "../../config";

const api = axios.create({
  baseURL: config.apiServer,
  withCredentials: true,
});

export default api;