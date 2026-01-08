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
      balance: parseFloat(child.balance || 0),
      children: childDownline
    });
  }

  return downline;
}

// Helper function to get user's immediate parent
async function getParent(userId) {
  const [[user]] = await db.query(
    "SELECT parent_id FROM users WHERE id = ?",
    [userId]
  );
  return user?.parent_id || null;
}

exports.adminPanel = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.redirect("/dashboard");
    }

    // Get all users of next level (users with no parent or direct children of owner)
    const [nextLevelUsers] = await db.query(
      `SELECT u.*, 
       (SELECT COUNT(*) FROM users WHERE parent_id = u.id) as children_count
       FROM users u 
       WHERE u.parent_id IS NULL OR u.parent_id = 0
       ORDER BY u.id ASC`
    );

    // Format user data
    const formattedUsers = (nextLevelUsers || []).map(user => ({
      ...user,
      balance: parseFloat(user.balance || 0),
      children_count: user.children_count || 0
    }));

    // Get summary statistics
    const [summary] = await db.query(
      `SELECT 
        COUNT(*) as total_users,
        SUM(balance) as total_balance,
        COUNT(CASE WHEN parent_id IS NULL OR parent_id = 0 THEN 1 END) as top_level_users
       FROM users`
    );

    res.render("admin", { 
      users: formattedUsers,
      summary: summary[0] || { total_users: 0, total_balance: 0, top_level_users: 0 }
    });
  } catch (error) {
    console.error("Error in adminPanel:", error);
    res.status(500).render("admin", {
      users: [],
      summary: { total_users: 0, total_balance: 0, top_level_users: 0 },
      error: "An error occurred while loading the admin panel."
    });
  }
};

exports.viewUserDownline = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.redirect("/dashboard");
    }

    const userId = parseInt(req.params.userId);

    if (!userId) {
      return res.redirect("/admin");
    }

    // Get user info
    const [[user]] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.redirect("/admin");
    }

    // Get complete downline hierarchy
    const downline = await getDownlineUsers(userId);

    // Flatten for display
    function flattenDownline(users, level = 1) {
      let result = [];
      for (const u of users) {
        result.push({ ...u, level });
        if (u.children && u.children.length > 0) {
          result = result.concat(flattenDownline(u.children, level + 1));
        }
      }
      return result;
    }

    const flatDownline = flattenDownline(downline);

    res.render("adminDownline", {
      user: {
        ...user,
        balance: parseFloat(user.balance || 0)
      },
      downline: flatDownline,
      hierarchicalDownline: downline
    });
  } catch (error) {
    console.error("Error in viewUserDownline:", error);
    res.redirect("/admin");
  }
};

exports.creditBalancePage = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.redirect("/dashboard");
    }

    const userId = parseInt(req.params.userId);

    if (!userId) {
      return res.redirect("/admin");
    }

    // Get user info
    const [[user]] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.redirect("/admin");
    }

    // Get parent info
    const parentId = user.parent_id;
    let parent = null;
    if (parentId) {
      const [[parentData]] = await db.query(
        "SELECT id, username, balance FROM users WHERE id = ?",
        [parentId]
      );
      parent = parentData ? {
        ...parentData,
        balance: parseFloat(parentData.balance || 0)
      } : null;
    }

    res.render("adminCredit", {
      user: {
        ...user,
        balance: parseFloat(user.balance || 0)
      },
      parent,
      error: null,
      success: null
    });
  } catch (error) {
    console.error("Error in creditBalancePage:", error);
    res.redirect("/admin");
  }
};

exports.creditBalance = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.redirect("/dashboard");
    }

    const userId = parseInt(req.params.userId);
    const { amount } = req.body;

    if (!userId || !amount) {
      const [[user]] = await db.query(
        "SELECT * FROM users WHERE id = ?",
        [userId]
      ).catch(() => ({ user: null }));
      
      const parentId = user?.parent_id;
      let parent = null;
      if (parentId) {
        const [[parentData]] = await db.query(
          "SELECT id, username, balance FROM users WHERE id = ?",
          [parentId]
        ).catch(() => ({ parent: null }));
        parent = parentData;
      }

      return res.render("adminCredit", {
        user: user || { balance: 0 },
        parent,
        error: "Amount is required",
        success: null
      });
    }

    const creditAmount = parseFloat(amount);

    // Validate amount
    if (isNaN(creditAmount) || creditAmount <= 0) {
      const [[user]] = await db.query(
        "SELECT * FROM users WHERE id = ?",
        [userId]
      );
      
      const parentId = user?.parent_id;
      let parent = null;
      if (parentId) {
        const [[parentData]] = await db.query(
          "SELECT id, username, balance FROM users WHERE id = ?",
          [parentId]
        );
        parent = parentData;
      }

      return res.render("adminCredit", {
        user: user || { balance: 0 },
        parent,
        error: "Please enter a valid amount greater than 0",
        success: null
      });
    }

    // Get user and parent info
    const [[user]] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.redirect("/admin");
    }

    const parentId = user.parent_id;

    if (!parentId) {
      // If no parent, credit directly (owner case)
      await db.query(
        "UPDATE users SET balance = balance + ? WHERE id = ?",
        [creditAmount, userId]
      );

      // Record transaction
      await db.query(
        "INSERT INTO transactions (sender_id, receiver_id, amount, type, description) VALUES (?, ?, ?, 'CREDIT', 'Admin Credit')",
        [req.user.id, userId, creditAmount]
      );

      const [[updatedUser]] = await db.query(
        "SELECT * FROM users WHERE id = ?",
        [userId]
      );

      return res.render("adminCredit", {
        user: {
          ...updatedUser,
          balance: parseFloat(updatedUser.balance || 0)
        },
        parent: null,
        error: null,
        success: `Successfully credited ₹${creditAmount.toLocaleString('en-IN')} to ${user.username}`
      });
    }

    // Get parent balance
    const [[parent]] = await db.query(
      "SELECT id, username, balance FROM users WHERE id = ?",
      [parentId]
    );

    if (!parent) {
      return res.redirect("/admin");
    }

    const parentBalance = parseFloat(parent.balance || 0);

    if (parentBalance < creditAmount) {
      return res.render("adminCredit", {
        user: {
          ...user,
          balance: parseFloat(user.balance || 0)
        },
        parent: {
          ...parent,
          balance: parentBalance
        },
        error: `Insufficient balance in parent account. Parent balance is ₹${parentBalance.toLocaleString('en-IN')}`,
        success: null
      });
    }

    // Deduct from parent and credit to user
    await db.query(
      "UPDATE users SET balance = balance - ? WHERE id = ?",
      [creditAmount, parentId]
    );

    await db.query(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [creditAmount, userId]
    );

    // Record transactions
    await db.query(
      "INSERT INTO transactions (sender_id, receiver_id, amount, type, description) VALUES (?, ?, ?, 'DEBIT', ?)",
      [parentId, userId, creditAmount, `Admin Credit to ${user.username}`]
    );

    await db.query(
      "INSERT INTO transactions (sender_id, receiver_id, amount, type, description) VALUES (?, ?, ?, 'CREDIT', ?)",
      [parentId, userId, creditAmount, `Admin Credit from ${parent.username}`]
    );

    // Get updated user and parent
    const [[updatedUser]] = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId]
    );

    const [[updatedParent]] = await db.query(
      "SELECT id, username, balance FROM users WHERE id = ?",
      [parentId]
    );

    res.render("adminCredit", {
      user: {
        ...updatedUser,
        balance: parseFloat(updatedUser.balance || 0)
      },
      parent: {
        ...updatedParent,
        balance: parseFloat(updatedParent.balance || 0)
      },
      error: null,
      success: `Successfully credited ₹${creditAmount.toLocaleString('en-IN')} to ${user.username} (deducted from parent)`
    });
  } catch (error) {
    console.error("Error in creditBalance:", error);
    res.redirect("/admin");
  }
};

exports.balanceSummary = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.redirect("/dashboard");
    }

    // Get all users with their hierarchy level
    const [allUsers] = await db.query(
      `SELECT 
        u.id,
        u.username,
        u.balance,
        u.parent_id,
        u.created_at,
        (SELECT COUNT(*) FROM users WHERE parent_id = u.id) as children_count,
        (SELECT username FROM users WHERE id = u.parent_id) as parent_username
       FROM users u
       ORDER BY u.id ASC`
    );

    // Calculate level for each user
    async function getUserLevel(userId) {
      let level = 0;
      let currentId = userId;
      while (currentId) {
        const [[user]] = await db.query(
          "SELECT parent_id FROM users WHERE id = ?",
          [currentId]
        );
        if (user && user.parent_id) {
          level++;
          currentId = user.parent_id;
        } else {
          break;
        }
      }
      return level;
    }

    const usersWithLevel = await Promise.all(
      (allUsers || []).map(async (user) => ({
        ...user,
        balance: parseFloat(user.balance || 0),
        level: await getUserLevel(user.id)
      }))
    );

    // Calculate summary
    const summary = {
      total_users: usersWithLevel.length,
      total_balance: usersWithLevel.reduce((sum, u) => sum + u.balance, 0),
      by_level: {}
    };

    usersWithLevel.forEach(user => {
      if (!summary.by_level[user.level]) {
        summary.by_level[user.level] = {
          count: 0,
          total_balance: 0
        };
      }
      summary.by_level[user.level].count++;
      summary.by_level[user.level].total_balance += user.balance;
    });

    res.render("adminSummary", {
      users: usersWithLevel,
      summary
    });
  } catch (error) {
    console.error("Error in balanceSummary:", error);
    res.status(500).render("adminSummary", {
      users: [],
      summary: { total_users: 0, total_balance: 0, by_level: {} },
      error: "An error occurred while loading balance summary."
    });
  }
};
