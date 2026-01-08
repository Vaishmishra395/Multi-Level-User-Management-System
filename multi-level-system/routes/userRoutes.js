const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const userController = require("../controllers/userController");

router.get("/dashboard", auth, userController.dashboard);
router.get("/create-user", auth, userController.createUserPage);
router.post("/create-user", auth, userController.createUser);
router.get("/downline", auth, userController.viewDownline);
router.get("/change-password", auth, userController.changePasswordPage);
router.post("/change-password", auth, userController.changePassword);
router.get("/self-recharge", auth, userController.selfRechargePage);
router.post("/self-recharge", auth, userController.selfRecharge);
router.get("/commission", auth, userController.viewCommission);

module.exports = router;
