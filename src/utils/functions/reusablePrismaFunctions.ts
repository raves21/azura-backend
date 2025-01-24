import { Media, PrismaClient } from "@prisma/client";
import AppError from "../types/errors";
import bcrypt from "bcrypt";
import { sign } from "jsonwebtoken";
import {
  CheckResourcePrivacyAndUserRelationshipArgs,
  DeleteExpiredSessionsAndLoginArgs,
  UpsertNotificationArgs
} from "../types/prisma";
import {
  ACCESS_TOKEN_DURATION,
  REFRESH_TOKEN_COOKIE_MAXAGE,
  REFRESH_TOKEN_DURATION,
  REFRESH_TOKEN_EXPIRY_DATE
} from "../constants/auth";

const prisma = new PrismaClient();

export const checkResourcePrivacyAndUserOwnership = async ({
  currentUserId,
  ownerId,
  privacy,
  successData,
  res
}: CheckResourcePrivacyAndUserRelationshipArgs) => {
  if (currentUserId !== ownerId) {
    let isValid = false;
    if (privacy === "FRIENDS_ONLY") {
      //check if currentUser is friends (following each other) with other user
      isValid = await areTheyFriends(currentUserId, ownerId);
    } else if (privacy === "PUBLIC") {
      isValid = true;
    }

    //check if validation passes
    if (isValid) {
      res.status(200).json({
        message: "success",
        data: { ...successData }
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
      data: { ...successData }
    });
  }
};

export const areTheyFriends = async (userAId: string, userBId: string) => {
  const followBack = await prisma.follow.findMany({
    where: {
      OR: [
        {
          followerId: userAId,
          followedId: userBId
        },
        {
          followedId: userAId,
          followerId: userBId
        }
      ]
    }
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
        id: foundMedia.id
      },
      data: {
        title: mediaWithNewValues.title,
        year: mediaWithNewValues.year,
        description: mediaWithNewValues.description,
        coverImage: mediaWithNewValues.coverImage,
        posterImage: mediaWithNewValues.posterImage,
        rating: mediaWithNewValues.rating,
        status: mediaWithNewValues.status
      }
    });
  }
};

export const upsertNotification = async ({
  recipientId,
  actorId,
  type,
  postId
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
            actorId
          }
        }
      }
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
            actorId
          }
        },
        updatedAt: new Date()
      }
    });
    return;
  } else {
    //if type is COMMENT or LIKE, check if notif with the same recipientId, postId, and type already exists.
    const existingNotification = await prisma.notification.findFirst({
      where: {
        recipientId,
        postId,
        type
      }
    });

    if (existingNotification) {
      //if notif exists, check if the actor already exists in its list of actors.
      const existingActor = await prisma.notificationActor.findFirst({
        where: {
          notificationId: existingNotification.id,
          actorId
        }
      });

      if (!existingActor) {
        //only if the actor does not already exist in its list of actors will we
        //create the actor, and update the notification's isRead and updatedAt.
        //this will prevent comment and like spammers from clogging up the user's
        //notifications.
        await prisma.notificationActor.create({
          data: {
            notificationId: existingNotification.id,
            actorId
          }
        });

        await prisma.notification.update({
          where: {
            id: existingNotification.id
          },
          data: {
            isRead: false,
            updatedAt: new Date()
          }
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
              actorId
            }
          },
          updatedAt: new Date()
        }
      });
    }
  }
};

export const deleteExpiredSessionsAndLogin = async ({
  password,
  foundUser,
  currentDate,
  res
}: DeleteExpiredSessionsAndLoginArgs) => {
  await prisma.userSession.deleteMany({
    where: {
      refreshTokenExpiresAt: {
        lt: currentDate
      }
    }
  });
  //evaluate password
  const matchedPassword = await bcrypt.compare(password, foundUser.password);

  //if passwords dont match throw error.
  if (!matchedPassword) {
    throw new AppError(
      422,
      "Invalid Format.",
      "Incorrect Email or Password",
      true
    );
  }

  //if passwords DO match, then create refreshToken
  const refreshToken = sign(
    {
      userId: foundUser.id,
      email: foundUser.email,
      handle: foundUser.handle
    },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: REFRESH_TOKEN_DURATION }
  );

  //save user's session in the UserSession table, along with their refreshToken
  const newlyCreatedUserSession = await prisma.userSession.create({
    data: {
      userId: foundUser.id,
      deviceName: `unknown device`,
      refreshToken,
      refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRY_DATE
    }
  });

  //create accessToken, including sessionId in its payload
  const accessToken = sign(
    {
      userId: foundUser.id,
      sessionId: newlyCreatedUserSession.sessionId,
      email: foundUser.email,
      handle: foundUser.handle
    },
    process.env.ACCESS_TOKEN_SECRET as string,
    { expiresIn: ACCESS_TOKEN_DURATION }
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_COOKIE_MAXAGE
    //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
  });

  res.status(200).json({
    message: `You are now logged in as ${foundUser.username}`,
    data: {
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        handle: foundUser.handle,
        avatar: foundUser.avatar
      },
      isDetachedMode: false,
      accessToken
    }
  });
};
