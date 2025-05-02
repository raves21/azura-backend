import { Response, Request } from "express-serve-static-core";
import PRISMA from "../utils/constants/prismaInstance";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import { upsertNotification } from "../utils/functions/reusablePrismaFunctions";
import { RequestWithSession } from "../utils/types/session";

export default class UsersController {
  public async getAllUsers(_: Request, res: Response) {
    const req = _ as RequestWithSession;
    const { page, perPage, ascending } = req.query;
    const session = req.session;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const allUsers = await PRISMA.user.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        email: true,
        handle: true,
        bio: true,
        following: {
          select: {
            followerId: true,
          },
        },
      },
    });
    const totalItems = await PRISMA.user.count();
    const totalPages = Math.ceil(totalItems / _perPage);
    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: allUsers.map((user) => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
        handle: user.handle,
        bio: user.bio,
        isFollowedByCurrentUser: user.following
          .map((follow) => follow.followerId)
          .includes(session.userId),
      })),
    });
  }

  public getCurrentUserInfo = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      const currentUser = await PRISMA.user.findFirstOrThrow({
        where: {
          id: session.userId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          banner: true,
          handle: true,
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
          id: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar,
          banner: currentUser.banner,
          bio: currentUser.bio,
          handle: currentUser.handle,
          createdAt: currentUser.createdAt,
          //*idk why but ts needs to be inverted ⬇️
          totalFollowers: currentUser._count.following,
          totalFollowing: currentUser._count.followers,
          sessionId: session.sessionId,
        },
      });
    }
  );

  public getUserInfo = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const { handle } = req.params;
    const session = req.session;

    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        handle,
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        banner: true,
        bio: true,
        handle: true,
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

    const followsCurrentUser = await PRISMA.follow.findFirst({
      where: {
        followerId: foundUser.id,
        followedId: session.userId,
      },
    });

    const followedByCurrentUser = await PRISMA.follow.findFirst({
      where: {
        followerId: session.userId,
        followedId: foundUser.id,
      },
    });

    res.status(200).json({
      message: `success. user found.`,
      data: {
        id: foundUser.id,
        username: foundUser.username,
        avatar: foundUser.avatar,
        banner: foundUser.banner,
        bio: foundUser.bio,
        handle: foundUser.handle,
        createdAt: foundUser.createdAt,
        //*idk why but ts needs to be inverted ⬇️
        totalFollowers: foundUser._count.following,
        totalFollowing: foundUser._count.followers,
        followsYou: followsCurrentUser ? true : false,
        followedByYou: followedByCurrentUser ? true : false,
      },
    });
  });

  public followUser = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const { id: userToFollow } = req.params;
    const session = req.session;

    if (userToFollow === session.userId) {
      throw new AppError(
        400,
        "BadRequest",
        "You cannot follow yourself.",
        true
      );
    }

    await PRISMA.follow.create({
      data: {
        followerId: session.userId,
        followedId: userToFollow,
      },
    });

    await upsertNotification({
      recipientId: userToFollow,
      actorId: session.userId,
      type: "FOLLOW",
    });
    res.status(201).json({
      message: `Success, you have successfully followed user ${userToFollow}`,
    });
  });

  public unfollowUser = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { id: userToUnfollow } = req.params;

    //check if the relationship between currentUser and userToUnfollow exists
    const foundRelationship = await PRISMA.follow.findFirst({
      where: {
        followerId: session.userId,
        followedId: userToUnfollow,
      },
    });

    if (!foundRelationship) {
      throw new AppError(
        404,
        "Relationship not found.",
        `User relationship not found.`,
        true
      );
    }

    //delete the relationship
    await PRISMA.follow.delete({
      where: {
        followerId_followedId: {
          followerId: session.userId,
          followedId: userToUnfollow,
        },
      },
    });

    res.status(200).json({
      message: `Successfully unfollowed user ${userToUnfollow}`,
    });
  });
  public getCurrentUserFollowingList = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserFollowingList = await PRISMA.follow.findMany({
        where: {
          followerId: session.userId,
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
              avatar: true,
              handle: true,
              bio: true,
            },
          },
        },
      });

      const totalItems = await PRISMA.follow.count({
        where: {
          followerId: session.userId,
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: currentUserFollowingList.map((item) => ({
          id: item.followed.id,
          username: item.followed.username,
          handle: item.followed.handle,
          bio: item.followed.bio,
          avatar: item.followed.avatar,
          isFollowedByCurrentUser: true,
        })),
      });
    }
  );

  public getCurrentUserFollowerList = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserFollowerList = await PRISMA.follow.findMany({
        where: {
          followedId: session.userId,
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
              handle: true,
              avatar: true,
              bio: true,
              following: {
                where: {
                  followerId: session.userId,
                },
              },
            },
          },
        },
      });
      const totalItems = await PRISMA.follow.count({
        where: {
          followedId: session.userId,
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: currentUserFollowerList.map((item) => ({
          id: item.follower.id,
          username: item.follower.username,
          handle: item.follower.handle,
          bio: item.follower.bio,
          avatar: item.follower.avatar,
          isFollowedByCurrentUser:
            item.follower.following.length === 0 ? false : true,
        })),
      });
    }
  );

  public getUserFollowingList = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const { handle } = req.params;
      const session = req.session;
      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const userFollowingList = await PRISMA.follow.findMany({
        where: {
          follower: {
            handle,
          },
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
              avatar: true,
              handle: true,
              bio: true,
              followers: {
                where: {
                  followedId: session.userId,
                },
              },
            },
          },
        },
      });

      const totalItems = await PRISMA.follow.count({
        where: {
          follower: {
            handle,
          },
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: userFollowingList.map((item) => ({
          id: item.followed.id,
          username: item.followed.username,
          handle: item.followed.handle,
          bio: item.followed.bio,
          avatar: item.followed.avatar,
          isFollowedByCurrentUser:
            item.followed.followers.length === 0 ? false : true,
        })),
      });
    }
  );

  public getUserFollowerList = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const { handle } = req.params;
      const { page, perPage, ascending } = req.query;
      const session = req.session;
      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const userFollowerList = await PRISMA.follow.findMany({
        where: {
          followed: {
            handle,
          },
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
              avatar: true,
              handle: true,
              bio: true,
              following: {
                where: {
                  followerId: session.userId,
                },
              },
            },
          },
        },
      });

      const totalItems = await PRISMA.follow.count({
        where: {
          followed: {
            handle,
          },
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: userFollowerList.map((item) => ({
          id: item.follower.id,
          username: item.follower.username,
          handle: item.follower.handle,
          bio: item.follower.bio,
          avatar: item.follower.avatar,
          isFollowedByCurrentUser:
            item.follower.following.length === 0 ? false : true,
        })),
      });
    }
  );
}
