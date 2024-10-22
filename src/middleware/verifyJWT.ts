import { verify } from "jsonwebtoken";
import { Response, NextFunction, Request } from "express";
import { CustomJWTPayload } from "../utils/types/jwt";
import AppError from "../utils/types/errors";

export function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    throw new AppError(
      401,
      "Unauthorized.",
      "Unauthorized. No jwt in authorization header.",
      true
    );
  }

  const accessToken = authHeader.split(" ")[1]; //Bearer {access token}

  //verify if access token is still valid
  verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET as string,
    (err, decoded) => {
      if (err) {
        throw new AppError(403, "InvalidTokenError", "Invalid token.", true);
      }
      const payload = decoded as CustomJWTPayload;
      req.user = payload;
      next();
    }
  );
}
