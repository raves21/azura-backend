import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class SessionsController {
  public getSessions = asyncHandler(async (req: Request, res: Response) => {
    //extract the user/userinfo from the payload (given by verifyJWT)
    const payload = req.jwtPayload;

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
    ).map((userSession) => ({
      ...userSession,
      isCurrentSession:
        userSession.sessionId === payload.sessionId ? true : false,
    }));

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

  public logoutSessionsExceptCurrent = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;

      await prisma.userSession.deleteMany({
        where: {
          NOT: {
            sessionId: payload.sessionId,
          },
        },
      });

      res.status(200).json({
        message: "sessions except current session logged out successfully.",
      });
    }
  );
}
