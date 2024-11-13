import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import { upsertNotification } from "../utils/functions/reusablePrismaFunctions";
import { RequestWithPayload } from "../utils/types/jwt";

const prisma = new PrismaClient();

export default class UsersController {
  public async getAllUsers(req: RequestWithPayload, res: Response) {
    const { page, perPage, ascending } = req.query;
    const payload = req.jwtPayload;

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
    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      data: allUsers.map((user) => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
        handle: user.handle,
        bio: user.bio,
        isFollowedByCurrentUser: user.following
          .map((follow) => follow.followerId)
          .includes(payload.userId),
      })),
    });
  }

  public getCurrentUserInfo = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;

      const currentUser = await prisma.user.findFirst({
        where: {
          id: payload.userId,
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

      if (!currentUser) {
        throw new AppError(404, "NotFoundError", "User not found.", true);
      }

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
          sessionId: payload.sessionId,
        },
      });
    }
  );

  public getUserInfo = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { handle } = req.params;
      const payload = req.jwtPayload;

      const foundUser = await prisma.user.findFirst({
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
    }
  );

  public followUser = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { id: userToFollow } = req.params;
      const payload = req.jwtPayload;

      if (userToFollow === payload.userId) {
        throw new AppError(
          400,
          "BadRequest",
          "You cannot follow yourself.",
          true
        );
      }

      await prisma.follow.create({
        data: {
          followerId: payload.userId,
          followedId: userToFollow,
        },
      });

      await upsertNotification({
        recipientId: userToFollow,
        actorId: payload.userId,
        type: "FOLLOW",
      });
      res.status(201).json({
        message: `Success, you have successfully followed user ${userToFollow}`,
      });
    }
  );

  public unfollowUser = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
    }
  );
  public getCurrentUserFollowingList = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
              handle: true,
              bio: true,
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: currentUserFollowingList.map((item) => ({
          id: item.followed.id,
          username: item.followed.username,
          handle: item.followed.username,
          bio: item.followed.bio,
          avatar: item.followed.avatar,
          isFollowedByCurrentUser: true,
        })),
      });
    }
  );

  public getCurrentUserFollowerList = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
              handle: true,
              avatar: true,
              bio: true,
              following: {
                select: {
                  followerId: true,
                },
              },
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: currentUserFollowerList.map((item) => ({
          id: item.follower.id,
          username: item.follower.username,
          email: item.follower.email,
          handle: item.follower.handle,
          bio: item.follower.bio,
          avatar: item.follower.avatar,
          isFollowedByCurrentUser: item.follower.following
            .map((follow) => follow.followerId)
            .includes(payload.userId),
        })),
      });
    }
  );

  public getUserFollowingList = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { id } = req.params;
      const payload = req.jwtPayload;
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
              handle: true,
              bio: true,
              following: {
                select: {
                  followerId: true,
                },
              },
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: userFollowingList.map((item) => ({
          id: item.followed.id,
          username: item.followed.username,
          handle: item.followed.handle,
          email: item.followed.email,
          bio: item.followed.bio,
          avatar: item.followed.avatar,
          isFollowedByCurrentUser: item.followed.following
            .map((follow) => follow.followerId)
            .includes(payload.userId),
        })),
      });
    }
  );

  public getUserFollowerList = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { id } = req.params;
      const { page, perPage, ascending } = req.query;
      const payload = req.jwtPayload;
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
              handle: true,
              bio: true,
              following: {
                select: {
                  followerId: true,
                },
              },
            },
          },
        },
      });
      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: userFollowerList.map((item) => ({
          id: item.follower.id,
          username: item.follower.username,
          handle: item.follower.handle,
          email: item.follower.email,
          bio: item.follower.bio,
          avatar: item.follower.avatar,
          isFollowedByCurrentUser: item.follower.following
            .map((follow) => follow.followerId)
            .includes(payload.userId),
        })),
      });
    }
  );
}
