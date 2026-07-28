import "dotenv/config";
import jwt from "jsonwebtoken";
import type { UserRoles } from "../../../types.js";

export function mintAccessToken(
  userId: string,
  email: string,
  role: UserRoles[],
) {
  return jwt.sign(
    { userId, email, role },
    process.env.ACCESS_TOKEN_SECRET ?? "",
    { expiresIn: "15m" },
  );
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
