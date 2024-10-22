import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class UsersController {
  public async getAllUsers(req: Request, res: Response) {
    const { page, perPage } = req.query;
    const ascending =
      req.query.ascending && req.query.ascending == "true" ? true : false;

    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const order = ascending ? "asc" : "desc";
    const skip = (_page - 1) * _perPage;
    const totalUserCount = await prisma.user.count();
    const totalPages = Math.ceil(totalUserCount / _perPage);

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
      total: totalUserCount,
      totalPages,
      data: allUsers,
    });
  }

  public getSelfInfo = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;

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
  });

  public getUserInfo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = req.user;

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
      throw new AppError(404, "NotFoundError", "User not found.", true);
    }

    const followsCurrentUser = await prisma.follow.findFirst({
      where: {
        followerId: foundUser.id,
        followedId: currentUser.userId,
      },
    });

    const followedByCurrentUser = await prisma.follow.findFirst({
      where: {
        followerId: currentUser.userId,
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
    const currentUser = req.user;

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
    const currentUser = req.user;
    const { id: userToUnfollow } = req.params;

    //check if the relationship between currentUser and userToUnfollow exists
    const foundRelationship = await prisma.follow.findFirst({
      where: {
        followerId: currentUser.userId,
        followedId: userToUnfollow,
      },
    });

    if (!foundRelationship) {
      throw new AppError(
        404,
        "Relationship not found.",
        `Relationship between ${currentUser.userId} and ${userToUnfollow} not found.`,
        true
      );
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
  });
  public getCurrentUserFollowingList = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;

      //TODO: add pagination
      const currentUserFollowingList = await prisma.user.findFirst({
        where: {
          id: currentUser.userId,
        },
        select: {
          following: {
            select: {
              followed: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
              createdAt: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        data: currentUserFollowingList?.following.map((data) => data.followed),
      });
    }
  );

  public getCurrentUserFollowerList = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;

      //TODO: add pagination
      const currentUserFollowerList = await prisma.user.findFirst({
        where: {
          id: currentUser.userId,
        },
        select: {
          followers: {
            select: {
              follower: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
              createdAt: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        data: currentUserFollowerList?.followers.map((data) => data.follower),
      });
    }
  );

  public getUserFollowingList = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      //TODO: add pagination
      const userFollowingList = await prisma.user.findFirst({
        where: {
          id,
        },
        select: {
          following: {
            select: {
              followed: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
              createdAt: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        data: userFollowingList?.following.map((data) => data.followed),
      });
    }
  );

  public getUserFollowerList = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      //TODO: add pagination
      const userFollowerList = await prisma.user.findFirst({
        where: {
          id,
        },
        select: {
          followers: {
            select: {
              follower: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
              createdAt: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        data: userFollowerList?.followers.map((data) => data.follower),
      });
    }
  );
}
