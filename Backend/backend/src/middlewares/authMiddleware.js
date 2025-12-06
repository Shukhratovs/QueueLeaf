import { verifyToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.ql_auth; // our cookie name
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = verifyToken(token);
    req.user = decoded; // { userId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized or expired token" });
  }
}
