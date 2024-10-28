import { JwtPayload } from "jsonwebtoken";

export type CustomJWTPayload = JwtPayload & {
  userId: string;
  sessionId: string;
  email: string;
};
