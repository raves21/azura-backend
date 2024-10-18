import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { RequestWithJWTPayload } from "../middleware/verifyJWT";

const prisma = new PrismaClient();

export default class UserController {
  public async getAllUsers(req: Request, res: Response) {
    const allUsers = await prisma.user.findMany();
    res.status(200).json({
      message: "success",
      data: allUsers,
    });
  }

  public async getUserSessions(req: RequestWithJWTPayload, res: Response) {
    //extract the user/userinfo from the payload (given by verifyJWT)
    const currentUser = req.user;

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
      userSession.sessionId === currentUser?.sessionId
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
  }

  public async getCurrentUserInfo(req: RequestWithJWTPayload, res: Response) {
    const currentUserInfoFromCookies = req.user;

    //Since req.user only gives us userId, sessionId, and email, we need to
    //use userId to query the User table to find all info about the current user
    const currentUserAllInfo = await prisma.user.findFirst({
      where: {
        id: currentUserInfoFromCookies?.userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    //* im not sure if i should include all info (posts, likes, etc.), bc if i do then that would be a
    //* huge response size. So for now i will just include the username, userId, email, and sessionId

    res.status(200).json({
      message: "success",
      data: {
        ...currentUserAllInfo,
        sessionId: currentUserInfoFromCookies?.sessionId,
      },
    });
  }
}
