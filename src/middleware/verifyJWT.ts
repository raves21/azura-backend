import { TokenExpiredError, verify } from "jsonwebtoken";
import { Response, NextFunction, Request } from "express";
import { CustomJWTPayload } from "../utils/types/jwt";
import AppError from "../utils/types/errors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const cookies = req.cookies;

  if (!cookies?.refreshToken) {
    throw new AppError(401, "Unauthorized.", "No JWT in cookies!", true);
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    throw new AppError(
      401,
      "Unauthorized.",
      "Unauthorized. No token in authorization header.",
      true
    );
  }

  const accessToken = authHeader.split(" ")[1]; //Bearer {access token}

  //verify if access token is still valid
  verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET as string,
    async (err, decoded) => {
      try {
        if (err) {
          throw new AppError(401, "InvalidTokenError", "Invalid token.", true);
        }
        const payload = decoded as CustomJWTPayload;
        //find user session in UserSession table
        const foundUserSession = await prisma.userSession.findFirst({
          where: {
            sessionId: payload.sessionId,
          },
        });

        if (!foundUserSession) {
          res.clearCookie("refreshToken", {
            httpOnly: true,
            //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
          });
          throw new TokenExpiredError("Your session has expired.", new Date());
        }
        req.jwtPayload = payload;
        next();
      } catch (error) {
        next(error);
      }
    }
  );
};
