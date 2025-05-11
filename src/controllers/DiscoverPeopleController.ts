import { Request, Response } from "express";
import { RequestWithSession } from "../utils/types/session";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";
import { getPaginationParameters } from "../utils/functions/shared";

export class DiscoverPeopleController {
  public getDiscoverPeople = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;

    const { skip, _page, _perPage } = getPaginationParameters(req);

    //returns all users, except that it is sorted where the ones that the current user does not follow
    //comes first.
    const discoverPeople = await PRISMA.user.findMany({
      skip,
      take: _perPage,
      where: {
        id: {
          not: session.userId,
        },
      },
      select: {
        id: true,
        avatar: true,
        username: true,
        handle: true,
        bio: true,
        following: {
          where: {
            followerId: session.userId,
          },
        },
      },
      orderBy: {
        following: {
          _count: "asc",
        },
      },
    });

    const totalItems = await PRISMA.user.count({
      where: {
        id: {
          not: session.userId,
        },
      },
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
        isFollowedByCurrentUser: user.following.length === 0 ? false : true,
      })),
    });
  });
}
