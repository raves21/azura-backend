import { Request, Response } from "express";
import { PrismaClient, Privacy } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";

const prisma = new PrismaClient();

export default class FeedController {
  public getForYouPosts = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;

    const { page, perPage, ascending } = req.query;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const forYouPosts = await prisma.post.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
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
      data: forYouPosts.map((post) => ({
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

  public getFollowingPosts = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const followingPosts = await prisma.post.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          OR: [
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
            //all public posts from users that the current user follow
            //this includes all public posts from the current user's friends
            {
              privacy: "PUBLIC",
              owner: {
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
            },
          },
          likes: {
            where: {
              userId: payload.userId, // Current user's likes
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
        data: followingPosts.map((post) => ({
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
    }
  );
}
