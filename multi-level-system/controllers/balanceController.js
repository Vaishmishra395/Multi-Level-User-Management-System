const db = require("../config/db");

// Helper function to check if user is next level (direct child)
async function isNextLevel(parentId, childId) {
  const [users] = await db.query(
    "SELECT parent_id FROM users WHERE id = ?",
    [childId]
  );

  return users.length > 0 && users[0].parent_id === parentId;
}

exports.transferPage = async (req, res) => {
  try {
    // Only show next-level users (direct children)
    const [users] = await db.query(
      "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
      [req.user.id]
    );

    res.render("transfer", { 
      users: users || [],
      error: null,
      success: null
    });
  } catch (error) {
    console.error("Error in transferPage:", error);
    res.status(500).render("transfer", {
      users: [],
      error: "An error occurred while loading the transfer page.",
      success: null
    });
  }
};

exports.transfer = async (req, res) => {
  try {
    const { receiver_id, amount } = req.body;

    // Validate input
    if (!receiver_id || !amount) {
      const [users] = await db.query(
        "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("transfer", {
        users: users || [],
        error: "Receiver and amount are required",
        success: null
      });
    }

    const transferAmount = parseFloat(amount);

    // Validate amount
    if (isNaN(transferAmount) || transferAmount <= 0) {
      const [users] = await db.query(
        "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("transfer", {
        users: users || [],
        error: "Please enter a valid amount greater than 0",
        success: null
      });
    }

    // Check if receiver is next level (direct child)
    const isNext = await isNextLevel(req.user.id, parseInt(receiver_id));
    if (!isNext) {
      const [users] = await db.query(
        "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("transfer", {
        users: users || [],
        error: "You can only transfer to your direct next-level users",
        success: null
      });
    }

    // Check sender balance
    const [[sender]] = await db.query(
      "SELECT balance FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!sender) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    const senderBalance = parseFloat(sender.balance || 0);

    if (senderBalance < transferAmount) {
      const [users] = await db.query(
        "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
        [req.user.id]
      );
      return res.render("transfer", {
        users: users || [],
        error: `Insufficient balance. Your current balance is ₹${senderBalance.toLocaleString('en-IN')}`,
        success: null
      });
    }

    // Get receiver and sender info for transaction record
    const [[receiver]] = await db.query(
      "SELECT username FROM users WHERE id = ?",
      [receiver_id]
    );

    const [[senderInfo]] = await db.query(
      "SELECT username FROM users WHERE id = ?",
      [req.user.id]
    );

    // Commission percentage (configurable, default 2%)
    const COMMISSION_PERCENTAGE = parseFloat(process.env.COMMISSION_PERCENTAGE || 2);
    const commissionAmount = (transferAmount * COMMISSION_PERCENTAGE) / 100;
    const netAmount = transferAmount - commissionAmount;

    // Get sender's parent for commission
    const [[senderData]] = await db.query(
      "SELECT parent_id FROM users WHERE id = ?",
      [req.user.id]
    );

    // Update balances
    await db.query("UPDATE users SET balance = balance - ? WHERE id = ?", [
      transferAmount,
      req.user.id
    ]);

    await db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [
      netAmount,
      receiver_id
    ]);

    // Record transaction for sender (DEBIT) first
    const [debitTx] = await db.query(
      "INSERT INTO transactions (sender_id, receiver_id, amount, type, description, commission) VALUES (?, ?, ?, 'DEBIT', ?, ?)",
      [req.user.id, receiver_id, transferAmount, `Transfer to ${receiver?.username || 'User'}`, commissionAmount]
    );

    // Add commission to sender's parent if exists
    if (senderData && senderData.parent_id && commissionAmount > 0) {
      await db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [
        commissionAmount,
        senderData.parent_id
      ]);

      // Record commission transaction
      const [commissionTx] = await db.query(
        "INSERT INTO transactions (sender_id, receiver_id, amount, type, description, commission) VALUES (?, ?, ?, 'CREDIT', ?, ?)",
        [req.user.id, senderData.parent_id, commissionAmount, `Commission from ${senderInfo?.username || 'User'}`, commissionAmount]
      );

      // Record in commissions table
      await db.query(
        "INSERT INTO commissions (user_id, transaction_id, amount, percentage) VALUES (?, ?, ?, ?)",
        [senderData.parent_id, debitTx.insertId, commissionAmount, COMMISSION_PERCENTAGE]
      );
    }

    // Record transaction for receiver (CREDIT)
    await db.query(
      "INSERT INTO transactions (sender_id, receiver_id, amount, type, description) VALUES (?, ?, ?, 'CREDIT', ?)",
      [req.user.id, receiver_id, netAmount, `Received from ${senderInfo?.username || 'User'}${commissionAmount > 0 ? ` (Commission: ₹${commissionAmount.toFixed(2)})` : ''}`]
    );

    res.redirect("/statement");
  } catch (error) {
    console.error("Error in transfer:", error);
    const [users] = await db.query(
      "SELECT id, username, balance FROM users WHERE parent_id = ? ORDER BY username ASC",
      [req.user.id]
    ).catch(() => ({ users: [] }));

    res.render("transfer", {
      users: users || [],
      error: "An error occurred while processing the transfer. Please try again.",
      success: null
    });
  }
};

exports.statement = async (req, res) => {
  try {
    // Get transactions with sender and receiver details
    const [tx] = await db.query(
      `SELECT 
        t.*,
        s.username as sender_username,
        r.username as receiver_username
      FROM transactions t
      LEFT JOIN users s ON t.sender_id = s.id
      LEFT JOIN users r ON t.receiver_id = r.id
      WHERE t.sender_id = ? OR t.receiver_id = ?
      ORDER BY t.created_at DESC, t.id DESC`,
      [req.user.id, req.user.id]
    );

    // Format transaction data
    const formattedTx = (tx || []).map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount || 0),
      created_at: transaction.created_at || transaction.createdAt,
      isCredit: transaction.receiver_id === req.user.id,
      isDebit: transaction.sender_id === req.user.id && transaction.receiver_id !== req.user.id
    }));

    res.render("statement", { tx: formattedTx });
  } catch (error) {
    console.error("Error in statement:", error);
    res.status(500).render("statement", {
      tx: [],
      error: "An error occurred while loading the statement."
    });
  }
};
