import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

export type CustomJWTPayload = JwtPayload & {
  userId: string;
  sessionId: string;
  email: string;
  handle: string;
};

export type RequestWithPayload = Request & {
  jwtPayload: CustomJWTPayload;
};
