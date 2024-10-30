import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class UsersController {
  public async getAllUsers(req: Request, res: Response) {
    const { page, perPage, ascending } = req.query;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const allUsers = await prisma.user.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
    });
    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      data: allUsers,
    });
  }

  public getCurrentUserInfo = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;

      const currentUserInfo = await prisma.user.findFirst({
        where: {
          id: payload.userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          banner: true,
          bio: true,
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
          sessionId: payload.sessionId,
        },
      });
    }
  );

  public getUserInfo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const payload = req.jwtPayload;

    const foundUser = await prisma.user.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        banner: true,
        bio: true,
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
      throw new AppError(404, "NotFoundError", "User not found.", true);
    }

    const followsCurrentUser = await prisma.follow.findFirst({
      where: {
        followerId: foundUser.id,
        followedId: payload.userId,
      },
    });

    const followedByCurrentUser = await prisma.follow.findFirst({
      where: {
        followerId: payload.userId,
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
  });

  public followUser = asyncHandler(async (req: Request, res: Response) => {
    const { id: userToFollow } = req.params;
    const payload = req.jwtPayload;

    try {
      await prisma.follow.create({
        data: {
          followerId: payload.userId,
          followedId: userToFollow,
        },
      });
      res.status(201).json({
        message: `Success, you have successfully followed user ${userToFollow}`,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        res.status(500).json({
          message: "Follow user failed. You are already following this user.",
        });
      } else {
        throw error;
      }
    }
  });

  public unfollowUser = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;
    const { id: userToUnfollow } = req.params;

    //check if the relationship between currentUser and userToUnfollow exists
    const foundRelationship = await prisma.follow.findFirst({
      where: {
        followerId: payload.userId,
        followedId: userToUnfollow,
      },
    });

    if (!foundRelationship) {
      throw new AppError(
        404,
        "Relationship not found.",
        `Relationship between ${payload.userId} and ${userToUnfollow} not found.`,
        true
      );
    }

    //delete the relationship
    await prisma.follow.delete({
      where: {
        followerId_followedId: {
          followerId: payload.userId,
          followedId: userToUnfollow,
        },
      },
    });

    res.status(200).json({
      message: `Successfully unfollowed user ${userToUnfollow}`,
    });
  });
  public getCurrentUserFollowingList = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserFollowingList = await prisma.follow.findMany({
        where: {
          followerId: payload.userId,
        },
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        select: {
          followed: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              bio: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: currentUserFollowingList.map((item) => item.followed),
      });
    }
  );

  public getCurrentUserFollowerList = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserFollowerList = await prisma.follow.findMany({
        where: {
          followedId: payload.userId,
        },
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        select: {
          follower: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              bio: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: currentUserFollowerList.map((item) => item.follower),
      });
    }
  );

  public getUserFollowingList = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const userFollowingList = await prisma.follow.findMany({
        where: {
          followerId: id,
        },
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        select: {
          followed: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              bio: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: userFollowingList.map((item) => item.followed),
      });
    }
  );

  public getUserFollowerList = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const userFollowerList = await prisma.follow.findMany({
        where: {
          followedId: id,
        },
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        select: {
          follower: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              bio: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: userFollowerList.map((item) => item.follower),
      });
    }
  );
}
