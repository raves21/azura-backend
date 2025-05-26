import { Response, NextFunction, Request } from "express";
import { RequestWithSession } from "../utils/types/session";
import AppError from "../utils/types/errors";
import PRISMA from "../utils/constants/prismaInstance";
import { asyncHandler } from "./asyncHandler";

export const verifySessionToken = asyncHandler(
  async (_: Request, res: Response, next: NextFunction) => {
    const req = _ as RequestWithSession;
    const cookies = req.cookies;

    if (!cookies?.sessionToken) {
      console.log('cookies', cookies ? {...cookies} : 'req.cookies is undefined');
      throw new AppError(401, "Unauthenticated", true);
    }

    const tokenFromCookies = cookies.sessionToken;

    const foundSession = await PRISMA.userSession.findFirst({
      where: {
        token: tokenFromCookies,
      },
      include: {
        user: true,
      },
    });

    if (!foundSession) {
      res.clearCookie("sessionToken", {
        httpOnly: true,
        sameSite: "none",
        // secure: !!Number(process.env.IS_PROD),
        path: '/',
        domain: process.env.DOMAIN
      });
      throw new AppError(401, "Unauthenticated", true);
    }

    req.session = {
      email: foundSession.user.email,
      handle: foundSession.user.handle,
      userId: foundSession.user.id,
      sessionId: foundSession.id,
    };

    next();
  }
);
