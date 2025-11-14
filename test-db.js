const db = require("./config/db"); // adjust path to your db.js
const bcrypt = require("bcrypt");

(async () => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (!rows.length) {
      const hash = await bcrypt.hash("admin123", 10); // default password
      await db.query(
        "INSERT INTO users (username, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)",
        ["admin", hash, "Super", "Admin", "admin"]
      );
      console.log("✅ Default admin created: username=admin, password=admin123");
    } else {
      console.log("ℹ️ Admin already exists");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
