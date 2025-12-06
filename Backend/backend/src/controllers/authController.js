import * as authService from "../services/authService.js";
import { env } from "../config/env.js";

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    res.cookie(env.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      secure: env.NODE_ENV === "production", // HTTPS only
    });

    res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

export async function logout(req, res) {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/", // ensure path matches how cookie was set
    domain: undefined, // let it default to the backend domain
  });

  // Force overwrite to expire the cookie even for stricter browsers
  res.cookie(env.COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
    path: "/",
  });
  res.json({ message: "Logged out successfully" });
}

export async function me(req, res) {
  res.json({ user: req.user });
}
