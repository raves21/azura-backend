import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { RequestWithJWTPayload } from "../utils/types";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export default class UsersController {
  public async getAllUsers(req: Request, res: Response) {
    const allUsers = await prisma.user.findMany();
    res.status(200).json({
      message: "success",
      data: allUsers,
    });
  }

  public async getSelfInfo(req: RequestWithJWTPayload, res: Response) {
    const currentUser = req.user;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request did not come with payload.",
      });
      return;
    }

    console.log("GET SELF INFO CURRENT USER ID", currentUser.userId);

    try {
      const currentUserInfo = await prisma.user.findFirst({
        where: {
          id: currentUser.userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        data: {
          ...currentUserInfo,
          sessionId: currentUser.sessionId,
        },
      });
    } catch (error) {
      console.log("GETSELFINFO ERROR", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? `BRUH ${error.message}`
            : "An unknown error occured",
      });
    }
  }

  public async getUserInfo(req: RequestWithJWTPayload, res: Response) {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request does not come with payload.",
      });
      return;
    }

    try {
      const foundUser = await prisma.user.findFirst({
        where: {
          id,
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!foundUser) {
        res.status(404).json({
          message: "User not found.",
        });
        return;
      }

      const followsCurrentUser = await prisma.follow.findFirst({
        where: {
          followerId: foundUser.id,
          followedId: currentUser.userId,
        },
      });

      const followedByCurrentUser = await prisma.follow.findFirst({
        where: {
          followerId: currentUser.id,
          followedId: foundUser.id,
        },
      });

      res.status(200).json({
        message: `Success. User ${foundUser.id} found.`,
        data: {
          ...foundUser,
          followsYou: followsCurrentUser ? true : false,
          followedByYou: followedByCurrentUser ? true : false,
        },
      });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error ? error.message : "An unknown error occured.",
      });
    }
  }

  public async followUser(req: RequestWithJWTPayload, res: Response) {
    const { id: userToFollow } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request did not come with payload.",
      });
      return;
    }

    try {
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
            ? `Follow user failed. You are already following this user.`
            : "An unknown error occured",
      });
    }
  }

  public async unfollowUser(req: RequestWithJWTPayload, res: Response) {
    const currentUser = req.user;
    const { id: userToUnfollow } = req.params;

    if (!currentUser) {
      res.status(400).json({
        message: "Bad request. Request did not come with jwt payload.",
      });
      return;
    }

    try {
      //check if the relationship between currentUser and userToUnfollow exists
      const foundRelationship = await prisma.follow.findFirst({
        where: {
          followerId: currentUser.userId,
          followedId: userToUnfollow,
        },
      });

      if (!foundRelationship) {
        res.status(404).json({
          message: `Relationship between ${currentUser.userId} and ${userToUnfollow} not found.`,
        });
        return;
      }

      //delete the relationship
      await prisma.follow.delete({
        where: {
          followerId_followedId: {
            followerId: currentUser.userId,
            followedId: userToUnfollow,
          },
        },
      });

      res.status(200).json({
        message: `Successfully unfollowed user ${userToUnfollow}`,
      });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unknown occured.",
      });
    }
  }
}
