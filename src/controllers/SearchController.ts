import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { PrismaClient } from "@prisma/client";
import AppError from "../utils/types/errors";
import { RequestWithPayload } from "../utils/types/jwt";
import { POSTS_INCLUDE } from "../utils/constants/queries";

const prisma = new PrismaClient();

export default class SearchController {
  public searchPosts = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
          OR: [
            // search in post content
            {
              content: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
            // search in related media title
            {
              media: {
                title: {
                  search: query.toString().trim().split(" ").join(" & "),
                },
              },
            },
          ],
          AND: [
            // privacy filters
            {
              OR: [
                // public posts
                {
                  privacy: "PUBLIC",
                },
                //all friends-only posts from the current user
                {
                  AND: [
                    { ownerId: payload.userId },
                    { privacy: "FRIENDS_ONLY" },
                  ],
                },
                //all friends-only posts from the current user's friends
                {
                  AND: [
                    { privacy: "FRIENDS_ONLY" },
                    {
                      owner: {
                        AND: [
                          {
                            followers: {
                              some: {
                                followedId: payload.userId,
                              },
                            },
                          },
                          {
                            following: {
                              some: {
                                followerId: payload.userId,
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        include: POSTS_INCLUDE(payload.userId),
      });

      const totalItems = await prisma.post.count({
        where: {
          OR: [
            // search in post content
            {
              content: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
            // search in related media title
            {
              media: {
                title: {
                  search: query.toString().trim().split(" ").join(" & "),
                },
              },
            },
          ],
          AND: [
            // privacy filters
            {
              OR: [
                // public posts
                {
                  privacy: "PUBLIC",
                },
                //all friends-only posts from the current user
                {
                  AND: [
                    { ownerId: payload.userId },
                    { privacy: "FRIENDS_ONLY" },
                  ],
                },
                //all friends-only posts from the current user's friends
                {
                  AND: [
                    { privacy: "FRIENDS_ONLY" },
                    {
                      owner: {
                        AND: [
                          {
                            followers: {
                              some: {
                                followedId: payload.userId,
                              },
                            },
                          },
                          {
                            following: {
                              some: {
                                followerId: payload.userId,
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
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
          collection: post.collection
            ? {
                id: post.collection.id,
                name: post.collection.name,
                description: post.collection.description,
                owner: post.collection.owner,
                privacy: post.collection.privacy,
                previewMedias: post.collection.collectionItems.map(
                  (collectionItem) => collectionItem.media
                ),
              }
            : null,
        })),
      });
    }
  );

  public searchUsers = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
          OR: [
            {
              username: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
            {
              handle: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
          ],
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

      const totalItems = await prisma.user.count({
        where: {
          OR: [
            {
              username: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
            {
              handle: {
                search: query.toString().trim().split(" ").join(" & "),
              },
            },
          ],
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
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
    }
  );

  public searchCollections = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
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
            search: query.toString().trim().split(" ").join(" & "),
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
                  title: true,
                  year: true,
                  type: true,
                  posterImage: true,
                  coverImage: true,
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

      const totalItems = await prisma.collection.count({
        where: {
          name: {
            search: query.toString().trim().split(" ").join(" & "),
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
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: searchCollections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          photo: collection.photo,
          owner: collection.owner,
          privacy: collection.privacy,
          previewMedias: collection.collectionItems.map(
            (collectionItem) => collectionItem.media
          ),
        })),
      });
    }
  );
}
