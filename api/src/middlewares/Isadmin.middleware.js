const response = require("../utils/response.utils");

module.exports = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return response.error(res, 403, "สำหรับ Admin เท่านั้น");
  }
  next();
};