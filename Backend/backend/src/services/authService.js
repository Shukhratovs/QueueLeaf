import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/jwt.js";

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid credentials");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid credentials");

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
}
