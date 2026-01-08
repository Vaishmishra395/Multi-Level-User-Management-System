const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const balanceController = require("../controllers/balanceController");

router.get("/transfer", auth, balanceController.transferPage);
router.post("/transfer", auth, balanceController.transfer);
router.get("/statement", auth, balanceController.statement);

module.exports = router;
