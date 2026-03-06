const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

const corsMiddleware = require("./middlewares/cors.middleware");
const routes = require("./routes");

const app = express();

app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "assets/uploads")));

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;
