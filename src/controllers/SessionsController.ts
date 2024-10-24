import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export default class SessionsController {
  public getSessions = asyncHandler(async (req: Request, res: Response) => {
    //extract the user/userinfo from the payload (given by verifyJWT)
    const currentUser = req.user;

    if (!currentUser) {
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
          userId: currentUser.userId,
        },
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
  });

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
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
        .json(`Session with id ${sessionId} logged out successfully.`);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        //this means user with that sessionId is not found in the table
        throw new AppError(
          404,
          "NotFoundError",
          "Logout failed. User session not found.",
          true
        );
      } else {
        throw err;
      }
    }
  });
}
