const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey"; // store securely

// 🔹 Generate JWT
const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
};

// 🔹 Verify JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
