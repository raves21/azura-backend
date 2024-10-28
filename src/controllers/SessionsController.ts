import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class SessionsController {
  public getSessions = asyncHandler(async (req: Request, res: Response) => {
    //extract the user/userinfo from the payload (given by verifyJWT)
    const payload = req.jwtPayload;

    if (!payload) {
      throw new AppError(
        400,
        "Bad request",
        "Bad request. Request did not come with payload.",
        true
      );
    }

    //get all user sessions, and mark the current session as isCurrentSession: true
    const allUserSessions = (
      await prisma.userSession.findMany({
        where: {
          userId: payload.userId,
        },
        select: {
          userId: true,
          sessionId: true,
          deviceName: true,
          createdAt: true,
        },
      })
    ).map((userSession) =>
      userSession.sessionId === payload.sessionId
        ? {
            ...userSession,
            isCurrentSession: true,
          }
        : {
            ...userSession,
            isCurrentSession: false,
          }
    );

    res.status(200).json({
      message: "success",
      data: allUserSessions,
    });
  });

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    //Delete the row with the sessionId in the UserSession table
    await prisma.userSession.delete({
      where: {
        sessionId,
      },
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });
}
