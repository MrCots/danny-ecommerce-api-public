import jwt from "jsonwebtoken";
import pool from "../db/index.js ";

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("Access denied. No token provided.");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Invalid or expired token.");
  }
}

async function authenticateAdmin(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT role FROM users WHERE userid = $1",
      [req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    if (result.rows[0].role !== 'admin') {
      return res.status(403).send("Admin access required");
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).send("Authorization check failed");
  }
}

export { authenticateToken, authenticateAdmin };