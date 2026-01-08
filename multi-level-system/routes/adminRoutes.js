const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminController = require("../controllers/adminController");

router.get("/", auth, adminController.adminPanel);
router.get("/user/:userId/downline", auth, adminController.viewUserDownline);
router.get("/user/:userId/credit", auth, adminController.creditBalancePage);
router.post("/user/:userId/credit", auth, adminController.creditBalance);
router.get("/summary", auth, adminController.balanceSummary);

module.exports = router;
