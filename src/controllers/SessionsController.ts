import { Response } from "express";
import { RequestWithJWTPayload } from "../utils/types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class SessionsController {
  public async getSessions(req: RequestWithJWTPayload, res: Response) {
    //extract the user/userinfo from the payload (given by verifyJWT)
    const currentUser = req.user;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request did not come with payload.",
      });
      return;
    }

    try {
      //get all user sessions, and mark the current session as isCurrentSession: true
      const allUserSessions = (
        await prisma.userSession.findMany({
          select: {
            userId: true,
            sessionId: true,
            deviceName: true,
            createdAt: true,
          },
        })
      ).map((userSession) =>
        userSession.sessionId === currentUser.sessionId
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
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error ? error.message : "An unknown error occured.",
      });
    }
  }

  public async logoutSession(req: RequestWithJWTPayload, res: Response) {
    const { sessionId } = req.params;

    try {
      //Delete the row with the sessionId in the UserSession table
      await prisma.userSession.delete({
        where: {
          sessionId,
        },
      });
      res
        .status(200)
        .json(`User with sessionId ${sessionId} logged out successfully.`);
    } catch (err) {
      //this means user with that sessionId is not found in the table
      res.status(404).json(`Logout failed. User session not found.`);
    }
  }
}
