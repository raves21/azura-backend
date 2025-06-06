import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";
import { sub } from "date-fns";

export default class CronController {
  public clearUnusedMedia = asyncHandler(
    async (req: Request, res: Response) => {
      //retrieve all media
      const allMedia = await PRISMA.media.findMany({
        include: {
          posts: true,
          collectionItems: true,
        },
      });

      //retrieve all media ids that are not referenced by any post or collectionItem
      const unusedMediaIds = allMedia
        .filter(
          (media) =>
            media.posts.length === 0 && media.collectionItems.length === 0
        )
        .map((unusedMedia) => unusedMedia.id);

      if (unusedMediaIds.length !== 0) {
        //delete all from unusedMediaIds
        await PRISMA.media.deleteMany({
          where: {
            id: {
              in: unusedMediaIds,
            },
          },
        });
        res.status(200).json({
          message: "Success. Deleted unused media/s",
          deletedMedias: unusedMediaIds,
        });
      } else {
        res.status(200).json({
          message: "Success. No unused media/s to delete.",
        });
      }
    }
  );

  public clearExpiredOtcs = asyncHandler(
    async (req: Request, res: Response) => {
      const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);

      await PRISMA.oTC.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: new Date(), // expired OTCs
              },
            },
            {
              createdAt: {
                lt: oneHourAgo, // more than 1 hour old
              },
            },
          ],
        },
      });
      res.status(200).json({
        message: "Success. Cleared expired otcs.",
      });
    }
  );

  public clearOldNotifications = asyncHandler(
    async (req: Request, res: Response) => {
      await PRISMA.notification.deleteMany({
        where: {
          createdAt: {
            gte: sub(new Date(), { weeks: 2 }),
          },
        },
      });

      res.json({
        message: "Success. Cleared old notifications."
      })
    }
  );
}
