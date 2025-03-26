import { Request, Response } from "express";
import PRISMA from "../utils/constants/prismaInstance";
import { asyncHandler } from "../middleware/asyncHandler";
import { RequestWithPayload } from "../utils/types/jwt";

export default class SessionsController {
  public getSessions = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    //extract the user/userinfo from the payload (given by verifyJWT)
    const payload = req.jwtPayload;

    //get all user sessions, and mark the current session as isCurrentSession: true
    const allUserSessions = (
      await PRISMA.userSession.findMany({
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
      isCurrentSession: userSession.sessionId === payload.sessionId,
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
        sessionId,
      },
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });

  public logoutSessionsExceptCurrent = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;

      await PRISMA.userSession.deleteMany({
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
