import { verify, JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
require("dotenv").config();

export type CustomJWTPayload = JwtPayload & {
  userId: string;
  sessionId: string;
  email: string;
};

export type RequestWithJWTPayload = Request & {
  user?: CustomJWTPayload;
};

export function verifyJWT(
  req: RequestWithJWTPayload,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(401).json("Unauthorized. No auth header.");
    return;
  }

  const accessToken = authHeader.split(" ")[1]; //Bearer {access token}
  verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET as string,
    (err, decoded) => {
      if (err) {
        res.status(403).json("Invalid token.");
        return;
      }
      const payload = decoded as CustomJWTPayload;
      console.log("PAYLOAD OF VERIFYJWT", payload);
      req.user = payload;
      next();
    }
  );
}
