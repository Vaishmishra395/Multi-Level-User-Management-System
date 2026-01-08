const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

exports.loginPage = (req, res) => {
  try {
    req.session.captcha = Math.floor(1000 + Math.random() * 9000);
    res.render("login", { captcha: req.session.captcha, error: null });
  } catch (error) {
    console.error("Error in loginPage:", error);
    res.status(500).render("login", { 
      captcha: Math.floor(1000 + Math.random() * 9000), 
      error: "An error occurred. Please try again." 
    });
  }
};

exports.registerPage = (req, res) => {
  try {
    req.session.captcha = Math.floor(1000 + Math.random() * 9000);
    res.render("register", { captcha: req.session.captcha, error: null });
  } catch (error) {
    console.error("Error in registerPage:", error);
    res.status(500).render("register", { 
      captcha: Math.floor(1000 + Math.random() * 9000), 
      error: "An error occurred. Please try again." 
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, password, confirmPassword, captcha } = req.body;

    // Validate input
    if (!username || !password || !confirmPassword || !captcha) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "All fields are required" 
      });
    }

    // Validate CAPTCHA
    if (captcha != req.session.captcha) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Invalid CAPTCHA. Please try again." 
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Passwords do not match" 
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 50) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Username must be between 3 and 50 characters" 
      });
    }

    // Validate password length
    if (password.length < 6) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Password must be at least 6 characters long" 
      });
    }

    // Check if username already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUsers.length > 0) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Username already exists. Please choose another one." 
      });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user (owner has no parent_id)
    await db.query(
      "INSERT INTO users (username, password, balance, role) VALUES (?, ?, 0, 'user')",
      [username, hashed]
    );

    req.session.captcha = Math.floor(1000 + Math.random() * 9000);
    res.render("register", { 
      captcha: req.session.captcha, 
      error: null,
      success: "Registration successful! Please login."
    });
  } catch (error) {
    console.error("Error in register:", error);
    req.session.captcha = Math.floor(1000 + Math.random() * 9000);
    
    if (error.code === "ER_DUP_ENTRY") {
      return res.render("register", { 
        captcha: req.session.captcha, 
        error: "Username already exists. Please choose another one." 
      });
    }

    res.render("register", { 
      captcha: req.session.captcha, 
      error: "An error occurred. Please try again." 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password, captcha } = req.body;

    // Validate input
    if (!username || !password || !captcha) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("login", { 
        captcha: req.session.captcha, 
        error: "All fields are required" 
      });
    }

    // Validate CAPTCHA
    if (captcha != req.session.captcha) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("login", { 
        captcha: req.session.captcha, 
        error: "Invalid CAPTCHA. Please try again." 
      });
    }

    // Check if user exists
    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (!rows.length) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("login", { 
        captcha: req.session.captcha, 
        error: "Invalid username or password" 
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) {
      req.session.captcha = Math.floor(1000 + Math.random() * 9000);
      return res.render("login", { 
        captcha: req.session.captcha, 
        error: "Invalid username or password" 
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: rows[0].id, role: rows[0].role, username: rows[0].username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error in login:", error);
    req.session.captcha = Math.floor(1000 + Math.random() * 9000);
    res.render("login", { 
      captcha: req.session.captcha, 
      error: "An error occurred. Please try again." 
    });
  }
};

exports.logout = (req, res) => {
  try {
    res.clearCookie("token");
    res.redirect("/login");
  } catch (error) {
    console.error("Error in logout:", error);
    res.redirect("/login");
  }
};
