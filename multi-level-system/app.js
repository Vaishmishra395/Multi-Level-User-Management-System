require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "captcha-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 5 * 60 * 1000, // 5 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    }
  })
);

// View engine
app.set("view engine", "ejs");

// Routes
app.use("/", require("./routes/authRoutes"));
app.use("/", require("./routes/userRoutes"));
app.use("/", require("./routes/balanceRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// 404 handler
app.use((req, res) => {
  res.status(404);
  // Check if user is likely authenticated (has token cookie)
  const hasToken = req.cookies.token;
  res.render("error", {
    title: "404 - Page Not Found",
    message: "The page you are looking for does not exist.",
    error: null,
    hasToken: hasToken
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).render("error", {
    title: "500 - Server Error",
    message: "An internal server error occurred. Please try again later.",
    error: process.env.NODE_ENV === "development" ? err.message : null
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});
