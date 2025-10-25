require("dotenv").config();
const express = require("express");
const cors = require("cors");

const terminalRoutes = require("./routes/terminalRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const currencyRoutes = require("./routes/currencyRoutes");


const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: "http://172.24.111.254:5173", // frontend origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Parse JSON requests
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/terminals", terminalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/currency", currencyRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Hello from RMS Backend!");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
