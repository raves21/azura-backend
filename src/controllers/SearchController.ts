import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { areTheyFriends } from "../utils/functions/reusablePrismaFunctions";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class SearchController {
  public searchPosts = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;
    const { page, perPage, ascending, query } = req.query;

    if (!query) {
      throw new AppError(422, "Invalid Format.", "No query provided.", true);
    }

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const searchPosts = await prisma.post.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        content: {
          search: query.toString(),
        },
        OR: [
          //all public posts
          {
            privacy: "PUBLIC",
          },

          //all friends-only posts from the current user
          {
            ownerId: payload.userId,
            privacy: {
              in: ["FRIENDS_ONLY"],
            },
          },

          //all friends-only posts from the current user's friends
          {
            privacy: "FRIENDS_ONLY",
            owner: {
              followers: {
                some: {
                  followedId: payload.userId,
                },
              },
              following: {
                some: {
                  followerId: payload.userId,
                },
              },
            },
          },
        ],
      },
      include: {
        media: true,
        collection: {
          select: {
            id: true,
            name: true,
            description: true,
            collectionItems: {
              take: 3,
              select: {
                media: {
                  select: {
                    posterImage: true,
                  },
                },
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
            handle: true,
            createdAt: true,
          },
        },
        likes: {
          where: {
            userId: payload.userId,
          },
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      data: searchPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        owner: post.owner,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        isLikedByCurrentUser: post.likes
          .map((like) => like.userId)
          .includes(payload.userId.toString()),
        media: post.media,
        collection: post.collection,
      })),
    });
  });

  public searchUsers = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;
    const { page, perPage, ascending, query } = req.query;

    if (!query) {
      throw new AppError(422, "Invalid Format.", "No query provided.", true);
    }

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const searchUsers = await prisma.user.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        username: {
          search: query.toString(),
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        handle: true,
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
      data: searchUsers.map((user) => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        handle: user.handle,
        isFollowedByCurrentUser: user.following
          .map((follow) => follow.followerId)
          .includes(payload.userId)
          ? true
          : false,
      })),
    });
  });

  public searchCollections = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;
      const { page, perPage, ascending, query } = req.query;

      if (!query) {
        throw new AppError(422, "Invalid Format", "No query provided.", true);
      }

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      //retrieve collections that have privacy PUBLIC and FRIENDS_ONLY
      const searchCollections = await prisma.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          name: {
            search: query.toString(),
          },
          OR: [
            //all public collections
            {
              privacy: "PUBLIC",
            },

            //all friends-only collections from the current user's friends
            {
              privacy: "FRIENDS_ONLY",
              owner: {
                followers: {
                  some: {
                    followedId: payload.userId,
                  },
                },
                following: {
                  some: {
                    followerId: payload.userId,
                  },
                },
              },
            },
          ],
        },
        include: {
          collectionItems: {
            take: 3,
            select: {
              media: {
                select: {
                  posterImage: true,
                },
              },
            },
          },
          owner: {
            select: {
              id: true,
              username: true,
              avatar: true,
              handle: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        data: searchCollections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          photo: collection.photo,
          owner: collection.owner,
          privacy: collection.privacy,
          previewPosters: collection.collectionItems.map(
            (collectionItem) => collectionItem.media.posterImage
          ),
        })),
      });
    }
  );
}
