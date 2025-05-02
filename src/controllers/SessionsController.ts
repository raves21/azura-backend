import { Request, Response } from "express";
import PRISMA from "../utils/constants/prismaInstance";
import { asyncHandler } from "../middleware/asyncHandler";
import { RequestWithSession } from "../utils/types/session";

export default class SessionsController {
  public getSessions = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;

    //get all user sessions, and mark the current session as isCurrentSession: true
    const allUserSessions = (
      await PRISMA.userSession.findMany({
        where: {
          userId: session.userId,
        },
        select: {
          id: true,
          userId: true,
          browser: true,
          expiresAt: true,
          os: true,
          platform: true,
          createdAt: true,
        },
      })
    ).map((userSession) => ({
      ...userSession,
      isCurrentSession: userSession.id === session.sessionId,
    }));

    res.status(200).json({
      message: "success",
      data: allUserSessions,
    });
  });

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    //Delete the row with the sessionId in the UserSession table
    await PRISMA.userSession.delete({
      where: {
        id: sessionId,
      },
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });

  public logoutSessionsExceptCurrent = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      await PRISMA.userSession.deleteMany({
        where: {
          NOT: {
            id: session.sessionId,
          },
        },
      });

      res.status(200).json({
        message: "sessions except current session logged out successfully.",
      });
    }
  );
}
