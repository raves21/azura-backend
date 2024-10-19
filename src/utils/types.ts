import { JwtPayload } from "jsonwebtoken";
import {Request} from "express"

export type CustomJWTPayload = JwtPayload & {
  userId: string;
  sessionId: string;
  email: string;
};

export type RequestWithJWTPayload = Request & {
  user?: CustomJWTPayload;
};
