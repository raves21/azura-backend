import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { RequestWithJWTPayload } from "../utils/types";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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

  public async followUser(req: RequestWithJWTPayload, res: Response) {
    const { userId: userToFollow } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request did not come with payload.",
      });
      return;
    }

    try {
      //TODO: check to see if userToFollow has privateAccount, and if he does,
      //TODO: then append the currentUser to the follow requests.
      await prisma.follow.create({
        data: {
          followerId: currentUser.userId,
          followedId: userToFollow,
        },
      });
      res.status(201).json({
        message: `Success, you have successfully followed user ${userToFollow}`,
      });
    } catch (error) {
      console.log("FOLLOW ERROR", error);
      res.status(500).json({
        message:
          error instanceof PrismaClientKnownRequestError
            ? `Follow user failed. You cannot follow the same user twice.`
            : "An unknown error occured",
      });
    }
  }
}
