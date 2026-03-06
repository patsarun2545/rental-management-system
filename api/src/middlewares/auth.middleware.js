const jwt = require("jsonwebtoken");
const response = require("../utils/response.utils");

module.exports = (req, res, next) => {
  try {
    if (!process.env.SECRET_KEY) {
      return response.error(res, 500, "SECRET_KEY not found");
    }

    const authHeader = req.headers.authorization;

    let token = null;

    if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return response.error(res, 401, "Unauthorized");
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    req.user = decoded;
    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return response.error(res, 401, "Token expired");
    }

    return response.error(res, 401, "Invalid token");
  }
};
