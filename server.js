require("dotenv").config();
const express = require("express");

const terminalRoutes = require("./routes/terminalRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

//app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Hello from RMS Backend!");
});

app.use("/api/terminals", terminalRoutes);
app.use("/api/reports", reportRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
