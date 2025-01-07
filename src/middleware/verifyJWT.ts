import { TokenExpiredError, verify } from "jsonwebtoken";
import { Response, NextFunction, Request } from "express";
import { CustomJWTPayload, RequestWithPayload } from "../utils/types/jwt";
import AppError from "../utils/types/errors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const verifyJWT = (_: Request, res: Response, next: NextFunction) => {
  const req = _ as RequestWithPayload;
  const cookies = req.cookies;

  if (!cookies?.refreshToken) {
    throw new AppError(401, "Unauthorized.", "No JWT in cookies!", true);
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    throw new AppError(
      401,
      "Unauthorized",
      "Unauthorized. No token in header.",
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
          throw new AppError(401, "Unauthorized", "Invalid token.", true);
        }
        const payload = decoded as CustomJWTPayload;
        //find user session in UserSession table
        const foundUserSession = await prisma.userSession.findFirst({
          where: {
            sessionId: payload.sessionId
          }
        });

        //if userSession is not found, then that means someone logged the currentUser's session out
        //(logging out means the session is deleted in the UserSession table)
        if (!foundUserSession) {
          res.clearCookie("refreshToken", {
            httpOnly: true
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
