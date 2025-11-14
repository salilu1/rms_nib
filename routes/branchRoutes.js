const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
const { authGuard, adminGuard } = require("../middleware/auth");

router.post("/", authGuard, adminGuard, branchController.createBranch);
router.get("/", authGuard, branchController.getBranches);
router.get("/download", authGuard, branchController.downloadBranches);
router.get("/:id", authGuard, branchController.getBranchById);
router.put("/:id", authGuard, branchController.updateBranch);
router.delete("/:id", authGuard, adminGuard, branchController.deleteBranch);
router.get("/download", authGuard, branchController.downloadBranches);


module.exports = router;
