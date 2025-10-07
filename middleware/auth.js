const jwt = require("jsonwebtoken");
const db = require("../config/db");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

exports.authGuard = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" });

    // const [black] = await db.query("SELECT id FROM token_blacklist WHERE token = ? LIMIT 1", [token]);
    // if (black.length) return res.status(401).json({ message: "Token revoked" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    req.token = token;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

exports.adminGuard = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
};
