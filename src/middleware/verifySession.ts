import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "./asyncHandler";
import { Request, Response, NextFunction } from "express";
import { TokenExpiredError } from "jsonwebtoken";

const prisma = new PrismaClient();

export const verifySession = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.jwtPayload;

    //find user session in UserSession table
    const foundUserSession = await prisma.userSession.findFirst({
      where: {
        sessionId: payload.sessionId,
      },
    });

    if (!foundUserSession) {
      //! if this happens, FRONTEND should redirect user to login page
      //! and clear the accessToken in state by setting it to null
      res.clearCookie("refreshToken", {
        httpOnly: true,
        //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
      });
      throw new TokenExpiredError("Your session has expired.", payload.exp);
    }

    next();
  }
);
