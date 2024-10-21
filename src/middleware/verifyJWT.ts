import { verify } from "jsonwebtoken";
import { Response, NextFunction } from "express";
import { RequestWithJWTPayload, CustomJWTPayload } from "../utils/types";

export function verifyJWT(
  req: RequestWithJWTPayload,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(401).json("Unauthorized. No jwt in authorization header.");
    return;
  }

  const accessToken = authHeader.split(" ")[1]; //Bearer {access token}

  //verify if access token is still valid
  verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET as string,
    (err, decoded) => {
      if (err) {
        res.status(403).json("Invalid token.");
        return;
      }
      const payload = decoded as CustomJWTPayload;
      req.user = payload;
      next();
    }
  );
}
