const xlsx = require("xlsx");
const fs = require("fs");
const db = require("../config/db");

exports.uploadTerminals = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    for (const row of data) {
      if (row.terminal_code && row.merchant_name && row.branch_id) {
        await db.query(
          "INSERT INTO terminal (terminal_code, merchant_name, branch_id) VALUES (?, ?, ?)",
          [row.terminal_code, row.merchant_name, row.branch_id]
        );
      }
    }

    fs.unlinkSync(req.file.path);
    res.send("Terminals inserted successfully!");
  } catch (error) {
    console.error("Error inserting terminals:", error);
    res.status(500).send("Failed to insert terminals");
  }
};
// const xlsx = require("xlsx");
// const fs = require("fs");
// const db = require("../config/db");

// exports.uploadTerminals = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).send("No file uploaded");
//     }

//     const workbook = xlsx.readFile(req.file.path);
//     const sheetName = workbook.SheetNames[0];
//     const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     for (const row of data) {
//       if (row.branch_name && row.district_id) {
//         await db.query(
//           "INSERT INTO branch (branch_name, district_id) VALUES (?, ?)",
//           [row.branch_name, row.district_id]
//         );
//       }
//     }

//     fs.unlinkSync(req.file.path);
//     res.send("Branches inserted successfully!");
//   } catch (error) {
//     console.error("Error inserting branches:", error);
//     res.status(500).send("Failed to insert branches");
//   }
// };
