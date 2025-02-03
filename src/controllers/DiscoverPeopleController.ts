import { Request, Response } from "express";
import { RequestWithPayload } from "../utils/types/jwt";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";

export class DiscoverPeopleController {
  public getDiscoverPeople = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;

    const { page, perPage } = req.query;

    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    //returns all users, except that it is sorted where the ones that the current user does not follow
    //comes first.
    const discoverPeople = await PRISMA.user.findMany({
      skip,
      take: _perPage,
      where: {
        id: {
          not: payload.userId
        }
      },
      select: {
        id: true,
        avatar: true,
        username: true,
        handle: true,
        bio: true,
        following: {
          where: {
            followerId: payload.userId
          }
        }
      },
      orderBy: {
        following: {
          _count: "asc"
        }
      }
    });

    const totalItems = await PRISMA.user.count({
      where: {
        id: {
          not: payload.userId
        }
      }
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: discoverPeople.map((user) => ({
        id: user.id,
        avatar: user.avatar,
        username: user.username,
        handle: user.handle,
        bio: user.bio,
        isFollowedByCurrentUser: user.following.length === 0 ? false : true
      }))
    });
  });
}
