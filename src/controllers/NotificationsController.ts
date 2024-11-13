import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import { RequestWithPayload } from "../utils/types/jwt";

const prisma = new PrismaClient();

export default class NotificationsController {
  public getNotifications = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;

      const { page, perPage } = req.query;
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const notifications = await prisma.notification.findMany({
        skip,
        take: _perPage,
        orderBy: {
          updatedAt: "desc",
        },
        where: {
          recipientId: payload.userId,
        },
        include: {
          post: {
            select: {
              id: true,
            },
          },
          actors: {
            take: 2,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              actor: {
                select: {
                  avatar: true,
                  username: true,
                },
              },
            },
          },
          _count: {
            select: {
              actors: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "success",
        data: notifications.map((notif) => ({
          id: notif.id,
          recipientId: notif.recipientId,
          isRead: notif.isRead,
          postId: notif.postId,
          type: notif.type,
          actorsPreview: notif.actors.map((item) => ({
            name: item.actor.username,
            avatar: item.actor.avatar,
          })),
          totalActors: notif._count.actors,
          updatedAt: notif.updatedAt,
        })),
      });
    }
  );

  public updateNotificationIsRead = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { isRead } = req.query;

      if (!isRead) {
        throw new AppError(
          400,
          "BadRequest",
          "No isRead query provided.",
          true
        );
      }

      const _isRead = isRead == "true";
      const updatedNotification = await prisma.notification.update({
        where: {
          id,
        },
        data: {
          isRead: _isRead,
        },
        select: {
          isRead: true,
        },
      });

      res.status(200).json({
        message: "isRead updated",
        data: updatedNotification,
      });
    }
  );

  public deleteNotification = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      await prisma.notification.delete({
        where: {
          id,
        },
      });

      res.status(200).json("successfully deleted notification.");
    }
  );

  public deleteAllNotifications = asyncHandler(
    async (req: Request, res: Response) => {
      await prisma.notification.deleteMany();
      res.status(200).json("successfully deleted all notifications.");
    }
  );
}
