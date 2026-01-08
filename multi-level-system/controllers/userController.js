const bcrypt = require("bcrypt");
const db = require("../config/db");

// Helper function to get all downline users recursively
async function getDownlineUsers(userId) {
  const [directChildren] = await db.query(
    "SELECT id, username, balance, role, parent_id, created_at FROM users WHERE parent_id = ? ORDER BY username ASC",
    [userId]
  );

  const downline = [];
  for (const child of directChildren) {
    const childDownline = await getDownlineUsers(child.id);
    downline.push({
      ...child,
      level: 1,
      children: childDownline
    });
  }

  return downline;
}

// Helper function to check if a user is in the downline
async function isInDownline(parentId, childId) {
  const [users] = await db.query(
    "SELECT id, parent_id FROM users WHERE id = ?",
    [childId]
  );

  if (users.length === 0) return false;
  if (users[0].parent_id === parentId) return true;
  if (!users[0].parent_id) return false;

  return await isInDownline(parentId, users[0].parent_id);
}

// Helper function to check if user is next level (direct child)
async function isNextLevel(parentId, childId) {
  const [users] = await db.query(
    "SELECT parent_id FROM users WHERE id = ?",
    [childId]
  );

  return users.length > 0 && users[0].parent_id === parentId;
}

exports.dashboard = async (req, res) => {
  try {
    const [[user]] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!user) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    // Ensure balance is a number
    user.balance = parseFloat(user.balance || 0);

    // Get direct children count
    const [childrenCount] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE parent_id = ?",
      [req.user.id]
    );

    // Get total commission earned
    const [commissionData] = await db.query(
      "SELECT SUM(amount) as total_commission FROM commissions WHERE user_id = ?",
      [req.user.id]
    );

    res.render("dashboard", { 
      user,
      childrenCount: childrenCount[0]?.count || 0,
      totalCommission: parseFloat(commissionData[0]?.total_commission || 0)
    });
  } catch (error) {
    console.error("Error in dashboard:", error);
    res.status(500).render("dashboard", { 
      user: { balance: 0 },
      childrenCount: 0,
      totalCommission: 0,
      error: "An error occurred while loading the dashboard." 
    });
  }
};

exports.createUserPage = (req, res) => {
  try {
    res.render("createUser", { error: null, success: null });
  } catch (error) {
    console.error("Error in createUserPage:", error);
    res.status(500).render("createUser", { 
      error: "An error occurred. Please try again.",
      success: null 
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.render("createUser", {
        error: "Username and password are required",
        success: null
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 50) {
      return res.render("createUser", {
        error: "Username must be between 3 and 50 characters",
        success: null
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.render("createUser", {
        error: "Password must be at least 6 characters long",
        success: null
      });
    }

    // Check if username already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUsers.length > 0) {
      return res.render("createUser", {
        error: "Username already exists. Please choose another one.",
        success: null
      });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user (only next level)
    await db.query(
      "INSERT INTO users (parent_id, username, password, balance, role) VALUES (?, ?, ?, 0, 'user')",
      [req.user.id, username, hashed]
    );

    res.render("createUser", {
      error: null,
      success: `User "${username}" created successfully!`
    });
  } catch (error) {
    console.error("Error in createUser:", error);
    
    // Handle duplicate username error
    if (error.code === "ER_DUP_ENTRY") {
      return res.render("createUser", {
        error: "Username already exists. Please choose another one.",
        success: null
      });
    }

    res.render("createUser", {
      error: "An error occurred while creating the user. Please try again.",
      success: null
    });
  }
};

exports.viewDownline = async (req, res) => {
  try {
    const downline = await getDownlineUsers(req.user.id);
    
    // Flatten the hierarchy for display
    function flattenDownline(users, level = 1) {
      let result = [];
      for (const user of users) {
        result.push({ ...user, level });
        if (user.children && user.children.length > 0) {
          result = result.concat(flattenDownline(user.children, level + 1));
        }
      }
      return result;
    }

    const flatDownline = flattenDownline(downline);

    res.render("downline", { 
      downline: flatDownline,
      hierarchicalDownline: downline
    });
  } catch (error) {
    console.error("Error in viewDownline:", error);
    res.status(500).render("downline", {
      downline: [],
      hierarchicalDownline: [],
      error: "An error occurred while loading downline."
    });
  }
};

exports.changePasswordPage = async (req, res) => {
  try {
    // Get next level users only
    const [users] = await db.query(
      "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
      [req.user.id]
    );

    res.render("changePassword", {
      users: users || [],
      error: null,
      success: null
    });
  } catch (error) {
    console.error("Error in changePasswordPage:", error);
    res.status(500).render("changePassword", {
      users: [],
      error: "An error occurred. Please try again.",
      success: null
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    // Validate input
    if (!user_id || !new_password) {
      const [users] = await db.query(
        "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("changePassword", {
        users: users || [],
        error: "User and new password are required",
        success: null
      });
    }

    // Validate password length
    if (new_password.length < 6) {
      const [users] = await db.query(
        "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("changePassword", {
        users: users || [],
        error: "Password must be at least 6 characters long",
        success: null
      });
    }

    // Check if user is next level (direct child)
    const isNext = await isNextLevel(req.user.id, parseInt(user_id));
    if (!isNext) {
      const [users] = await db.query(
        "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("changePassword", {
        users: users || [],
        error: "You can only change password of your direct next-level users",
        success: null
      });
    }

    // Hash new password
    const hashed = await bcrypt.hash(new_password, 10);

    // Update password
    await db.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashed, user_id]
    );

    const [users] = await db.query(
      "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
      [req.user.id]
    );

    res.render("changePassword", {
      users: users || [],
      error: null,
      success: "Password changed successfully!"
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    const [users] = await db.query(
      "SELECT id, username FROM users WHERE parent_id = ? ORDER BY username ASC",
      [req.user.id]
    ).catch(() => ({ users: [] }));

    res.render("changePassword", {
      users: users || [],
      error: "An error occurred while changing password. Please try again.",
      success: null
    });
  }
};

exports.selfRechargePage = async (req, res) => {
  try {
    // Check if user is owner (no parent_id)
    const [[user]] = await db.query(
      "SELECT id, balance, parent_id FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!user) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    // Only owner can self recharge
    if (user.parent_id !== null) {
      return res.redirect("/dashboard");
    }

    res.render("selfRecharge", {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error("Error in selfRechargePage:", error);
    res.status(500).render("selfRecharge", {
      user: { balance: 0 },
      error: "An error occurred. Please try again.",
      success: null
    });
  }
};

exports.selfRecharge = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate input
    if (!amount) {
      const [[user]] = await db.query(
        "SELECT id, balance FROM users WHERE id = ?",
        [req.user.id]
      );
      return res.render("selfRecharge", {
        user: user || { balance: 0 },
        error: "Amount is required",
        success: null
      });
    }

    const rechargeAmount = parseFloat(amount);

    // Validate amount
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      const [[user]] = await db.query(
        "SELECT id, balance FROM users WHERE id = ?",
        [req.user.id]
      );
      return res.render("selfRecharge", {
        user: user || { balance: 0 },
        error: "Please enter a valid amount greater than 0",
        success: null
      });
    }

    // Check if user is owner
    const [[user]] = await db.query(
      "SELECT id, balance, parent_id FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!user) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    if (user.parent_id !== null) {
      return res.redirect("/dashboard");
    }

    // Update balance
    await db.query(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [rechargeAmount, req.user.id]
    );

    // Record transaction (self recharge - CREDIT)
    await db.query(
      "INSERT INTO transactions (sender_id, receiver_id, amount, type, description) VALUES (?, ?, ?, 'CREDIT', 'Self Recharge')",
      [req.user.id, req.user.id, rechargeAmount]
    );

    const [[updatedUser]] = await db.query(
      "SELECT id, balance FROM users WHERE id = ?",
      [req.user.id]
    );

    res.render("selfRecharge", {
      user: updatedUser || { balance: 0 },
      error: null,
      success: `Successfully recharged ₹${rechargeAmount.toLocaleString('en-IN')}`
    });
  } catch (error) {
    console.error("Error in selfRecharge:", error);
    const [[user]] = await db.query(
      "SELECT id, balance FROM users WHERE id = ?",
      [req.user.id]
    ).catch(() => ({ user: { balance: 0 } }));

    res.render("selfRecharge", {
      user: user || { balance: 0 },
      error: "An error occurred while processing recharge. Please try again.",
      success: null
    });
  }
};

exports.viewCommission = async (req, res) => {
  try {
    // Get all commissions earned by user
    const [commissions] = await db.query(
      `SELECT 
        c.*,
        t.amount as transaction_amount,
        t.description,
        t.created_at as transaction_date,
        s.username as sender_username
      FROM commissions c
      LEFT JOIN transactions t ON c.transaction_id = t.id
      LEFT JOIN users s ON t.sender_id = s.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    // Calculate total commission
    const [totalData] = await db.query(
      "SELECT SUM(amount) as total FROM commissions WHERE user_id = ?",
      [req.user.id]
    );

    res.render("commission", {
      commissions: commissions || [],
      totalCommission: parseFloat(totalData[0]?.total || 0)
    });
  } catch (error) {
    console.error("Error in viewCommission:", error);
    res.status(500).render("commission", {
      commissions: [],
      totalCommission: 0,
      error: "An error occurred while loading commission data."
    });
  }
};
