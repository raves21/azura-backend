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
      throw new AppError(401, "No session token in cookies!", true);
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
      throw new AppError(404, "Session not found.", true);
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
