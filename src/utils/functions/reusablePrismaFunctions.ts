import { Media, NotificationType, PrismaClient, Privacy } from "@prisma/client";
import { Response } from "express";
import AppError from "../types/errors";

const prisma = new PrismaClient();

type CheckPrivacyAndUserRelationshipArgs = {
  currentUserId: string;
  ownerId: string;
  privacy: Privacy;
  successData: Record<string, any>;
  res: Response;
};

export const checkResourcePrivacyAndUserOwnership = async ({
  currentUserId,
  ownerId,
  privacy,
  successData,
  res,
}: CheckPrivacyAndUserRelationshipArgs) => {
  if (currentUserId !== ownerId) {
    let isEntityPrivacyAndUserRelationshipValid = false;
    if (privacy === "FRIENDS_ONLY") {
      //check if currentUser is friends (following each other) with other user
      isEntityPrivacyAndUserRelationshipValid = await areTheyFriends(
        currentUserId,
        ownerId
      );
    } else if (privacy === "PUBLIC") {
      isEntityPrivacyAndUserRelationshipValid = true;
    }

    //check if validation passes
    if (isEntityPrivacyAndUserRelationshipValid) {
      res.status(200).json({
        message: "success",
        data: { ...successData, isOwnedByCurrentUser: false },
      });
    } else {
      //if validation does not pass, throw 404
      //so user does not know the resource exists
      throw new AppError(404, "NotFound", "Resource not found.", true);
    }
  } else {
    //if current user owns the resource
    res.status(200).json({
      message: "success",
      data: { ...successData, isOwnedByCurrentUser: true },
    });
  }
};

export const areTheyFriends = async (userAId: string, userBId: string) => {
  const followBack = await prisma.follow.findMany({
    where: {
      OR: [
        {
          followerId: userAId,
          followedId: userBId,
        },
        {
          followedId: userAId,
          followerId: userBId,
        },
      ],
    },
  });

  if (followBack.length === 2) return true;
  return false;
};

export const updateExistingMedia = async (
  foundMedia: Media,
  mediaWithNewValues: Media
) => {
  //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
  //*the req.body. This is to ensure that all collectionItems and posts referencing that media will
  //*show the latestversion of that Media (because sometimes the 3rd party api changes the details
  //*of the anime/movie/tv)
  if (
    foundMedia.title !== mediaWithNewValues.title ||
    foundMedia.year !== mediaWithNewValues.year ||
    foundMedia.description !== mediaWithNewValues.description ||
    foundMedia.coverImage !== mediaWithNewValues.coverImage ||
    foundMedia.posterImage !== mediaWithNewValues.posterImage ||
    foundMedia.rating !== mediaWithNewValues.rating ||
    foundMedia.status !== mediaWithNewValues.status
  ) {
    await prisma.media.update({
      where: {
        id: foundMedia.id,
      },
      data: {
        title: mediaWithNewValues.title,
        year: mediaWithNewValues.year,
        description: mediaWithNewValues.description,
        coverImage: mediaWithNewValues.coverImage,
        posterImage: mediaWithNewValues.posterImage,
        rating: mediaWithNewValues.rating,
        status: mediaWithNewValues.status,
      },
    });
  }
};

type UpsertNotificationArgs = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
};

export const upsertNotification = async ({
  recipientId,
  actorId,
  type,
  postId,
}: UpsertNotificationArgs) => {
  //dont do anything if actor is the user himself
  if (actorId === recipientId) return;

  if (type === "FOLLOW") {
    //if type is FOLLOW, check if a notification with the given recipient, type,
    //with the actor in its list of actors already exists
    const existingNotification = await prisma.notification.findFirst({
      where: {
        recipientId,
        type,
        actors: {
          some: {
            actorId,
          },
        },
      },
    });

    //if a follow notification that has the actor in it already exists, dont do anything.
    //this is to prevent follow spammers from clogging up the user's notifs.
    if (existingNotification) return;

    //if it does not exist, create it.
    await prisma.notification.create({
      data: {
        type: "FOLLOW",
        recipientId,
        actors: {
          create: {
            actorId,
          },
        },
        updatedAt: new Date(),
      },
    });
    return;
  } else {
    //if type is COMMENT or LIKE, check if notif with the same recipientId, postId, and type already exists.
    const existingNotification = await prisma.notification.findFirst({
      where: {
        recipientId,
        postId,
        type,
      },
    });

    if (existingNotification) {
      //if notif exists, check if the actor already exists in its list of actors.
      const existingActor = await prisma.notificationActor.findFirst({
        where: {
          notificationId: existingNotification.id,
          actorId,
        },
      });

      if (!existingActor) {
        //only if the actor does not already exist in its list of actors will we
        //create the actor, and update the notification's isRead and updatedAt.
        //this will prevent comment and like spammers from clogging up the user's
        //notifications.
        await prisma.notificationActor.create({
          data: {
            notificationId: existingNotification.id,
            actorId,
          },
        });

        await prisma.notification.update({
          where: {
            id: existingNotification.id,
          },
          data: {
            isRead: false,
            updatedAt: new Date(),
          },
        });
        return;
      } else return;
    } else {
      //if notif with given recipientId, postId, and type does not exist, create it.
      await prisma.notification.create({
        data: {
          recipientId,
          postId,
          type,
          actors: {
            create: {
              actorId,
            },
          },
          updatedAt: new Date(),
        },
      });
    }
  }
};
