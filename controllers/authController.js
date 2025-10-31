const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password required" });

    const user = await prisma.users.findUnique({
      where: { username },
      select: { user_id: true, username: true, password_hash: true, role: true, is_active: true },
    });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
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

// CREATE USER
exports.createUser = async (req, res) => {
  try {
    const { username, password, first_name, last_name, role } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password required" });

    const existingUser = await prisma.users.findUnique({ where: { username } });
    if (existingUser) return res.status(409).json({ message: "Username already exists" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.users.create({
      data: {
        username,
        password_hash: hash,
        first_name: first_name || null,
        last_name: last_name || null,
        role: role === "admin" ? "admin" : "user",
      },
    });

    res.status(201).json({ message: "User created", user_id: newUser.user_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET ALL USERS (ignores inactive)
exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
      select: { user_id: true, username: true, first_name: true, last_name: true, role: true },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET USER BY ID (ignores inactive)
exports.getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.users.findFirst({
      where: { user_id: id, is_active: true },
      select: { user_id: true, username: true, first_name: true, last_name: true, role: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE USER (ignores inactive)
exports.updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, password, first_name, last_name, role } = req.body;

    const updateData = { username, first_name, last_name, role };
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await prisma.users.updateMany({
      where: { user_id: id, is_active: true },
      data: updateData,
    });
    

    if (user.count === 0) return res.status(404).json({ message: "User not found or inactive" });

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// const user = await prisma.users.updateMany({
//   where: {
//     user_id: Number(user_id),  // Make sure it’s a number
//     is_active: true
//   },
//   data: {
//     is_active: false
//   }
// });


// SOFT DELETE USER
exports.softDeleteUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (parseInt(user_id, 10) === req.user.user_id)
      return res.status(400).json({ message: "Cannot deactivate own account" });

    const user = await prisma.users.updateMany({
      where: { user_id: Number(user_id), is_active: true },
      data: { is_active: false },
    });

    if (user.count === 0) return res.status(404).json({ message: "User not found or already inactive" });

    res.json({ message: "User deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { user_id: req.user.user_id },
      select: { user_id: true, username: true, first_name: true, last_name: true, role: true, is_active: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Current and new password are required" });

    const user = await prisma.users.findUnique({
      where: { user_id: req.user.user_id },
      select: { password_hash: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.users.update({
      where: { user_id: req.user.user_id },
      data: { password_hash: newHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
