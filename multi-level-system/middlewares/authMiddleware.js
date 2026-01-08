const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect("/login");
    }

    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (error) {
      // Token is invalid or expired
      res.clearCookie("token");
      return res.redirect("/login");
    }
  } catch (error) {
    console.error("Error in authMiddleware:", error);
    res.clearCookie("token");
    return res.redirect("/login");
  }
};
