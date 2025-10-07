const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required" });

    const [rows] = await db.query(
      "SELECT user_id, username, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });
    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ message: "Account is inactive" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const payload = { user_id: user.user_id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// CREATE USER (ADMIN ONLY)
exports.createUser = async (req, res) => {
  try {
    const { username, password, first_name, last_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required" });

    const [exists] = await db.query("SELECT user_id FROM users WHERE username = ? LIMIT 1", [username]);
    if (exists.length) return res.status(409).json({ message: "Username already exists" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query(
      "INSERT INTO users (username, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)",
      [username, hash, first_name || null, last_name || null, role === "admin" ? "admin" : "user"]
    );

    res.status(201).json({ message: "User created", user_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// SOFT DELETE USER
exports.softDeleteUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (parseInt(user_id, 10) === req.user.user_id) {
      return res.status(400).json({ message: "Admin cannot deactivate own account" });
    }

    const [result] = await db.query(
      "UPDATE users SET is_active = 0 WHERE user_id = ? AND is_active = 1",
      [user_id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "User not found or already inactive" });

    res.json({ message: "User deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGOUT (OPTIONAL BLACKLIST)
exports.logout = async (req, res) => {
  try {
    const token = req.token;
    if (!token) return res.status(400).json({ message: "No token provided" });

    await db.query("INSERT INTO token_blacklist (token) VALUES (?)", [token]);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, username, first_name, last_name, role, is_active FROM users WHERE user_id = ? LIMIT 1",
      [req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    // Get user from DB
    const [rows] = await db.query(
      "SELECT password_hash FROM users WHERE user_id = ? LIMIT 1",
      [req.user.user_id]
    );

    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    // Check current password
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS || 10, 10));

    // Update DB
    await db.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [newHash, req.user.user_id]);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

