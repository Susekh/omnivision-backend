const express = require("express");
const app = express();
const dotenv = require("dotenv");
const path = require("path");
const auditLog = require("./middlewares/auditLog");
dotenv.config();
const cors = require("cors");
const connectToDb = require("./Db/db");
const userRoutes = require("./routes/user.routes");
const agencyRoutes = require("./routes/agency.router");
const adminRoutes = require("./routes/admin.routes");
// Middleware (order matters!)
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const {
  switchModel,
  getActiveModelController,
} = require("./controllers/model.controller");
const authAdmin = require("./middlewares/auth.admin");
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

connectToDb();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://omnivision.neuradyne.in",
  "https://www.omnivision.neuradyne.in",
  "https://omnivision-frontend.vercel.app",
];

// Add environment variable for additional origins if needed
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(","));
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Groundstaff-Id"],
  })
);
app.options("*", cors());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));
/*********************************************************************************** */
// // Middleware to set security headers
// app.use((req, res, next) => {
//   res.setHeader("X-Frame-Options", "SAMEORIGIN");

//   res.setHeader(
//     "Content-Security-Policy",
//     `default-src 'self' cdn.jsdelivr.net maps.googleapis.com cdn.arcgis.com basemaps.arcgis.com; img-src 'self' data: http://192.168.192.177:9000; frame-ancestors 'self'; script-src 'self' 'nonce-${global.nonce}'`
//   );

//   next();
// });

//****************************************************************************** */

app.use(auditLog);
app.use((req, res, next) => {
  console.log("Request content length:", req.headers["content-length"]);
  next();
});

// app.use(cookieparser());
app.listen(port, () => {
  console.log(`HTTPS Server is running on port ${port}`);
});
app.use("/backend/user", userRoutes);
app.use("/backend/admin", adminRoutes); // new admin endpoints
// app.use('/agencies',agencyRoutes);
app.use("/backend", agencyRoutes);
app.post("/backend/switch-model", authAdmin, switchModel);
app.get("/backend/active-model", authAdmin, getActiveModelController);

// app.use('/images', imageRoutes);
app.get("/backend", (req, res) => {
  res.send("Hey Server is Running");
});

module.exports = app;
