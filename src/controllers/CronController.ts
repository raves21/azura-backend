import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";

export default class CronController {
  public clearUnusedMedia = asyncHandler(
    async (req: Request, res: Response) => {
      //retrieve all media
      const allMedia = await PRISMA.media.findMany({
        include: {
          posts: true,
          collectionItems: true
        }
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
              in: unusedMediaIds
            }
          }
        });
        res.status(200).json({
          message: "Success. Deleted unused media/s",
          deletedMedia: unusedMediaIds
        });
      } else {
        res.status(200).json({
          message: "Success. No unused media/s to delete."
        });
      }
    }
  );

  public clearExpiredOtcs = asyncHandler(
    async (req: Request, res: Response) => {
      const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);

      await PRISMA.oTC.deleteMany({
        where: {
          expiresAt: {
            lt: oneHourAgo //otcs that are less than one hour ago
          }
        }
      });
      res.status(200).json({
        message: "Success. Cleared expired otcs."
      });
    }
  );
}
