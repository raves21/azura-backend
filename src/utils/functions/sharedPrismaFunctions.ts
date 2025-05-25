import { Media, Privacy } from "@prisma/client";
import AppError from "../types/errors";
import bcrypt from "bcrypt";
import {
  CheckResourcePrivacyAndUserRelationshipArgs,
  DeleteExpiredSessionsAndLoginArgs,
  PostSetCollectionAttachmentIsViewablePropArgs,
  PostsSetCollectionAttachmentIsViewablePropArgs,
  UpsertNotificationArgs,
} from "../types/sharedPrismaFunctions";
import { TOKEN_COOKIE_MAXAGE, TOKEN_EXPIRY_DATE } from "../constants/auth";
import PRISMA from "../constants/prismaInstance";
import * as crypto from "crypto";
import { sub } from "date-fns";

export const checkResourcePrivacyAndUserOwnership = async ({
  currentUserId,
  ownerId,
  privacy,
  successData,
  res,
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
        data: { ...successData },
      });
    } else {
      //if validation does not pass, throw 404
      //so user does not know the resource exists
      throw new AppError(404, "Resource not found.", true);
    }
  } else {
    //if current user owns the resource
    res.status(200).json({
      message: "success",
      data: { ...successData },
    });
  }
};

export const areTheyFriends = async (userAId: string, userBId: string) => {
  const followBack = await PRISMA.follow.findMany({
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
    await PRISMA.media.update({
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
    const existingNotification = await PRISMA.notification.findFirst({
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
    await PRISMA.notification.create({
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
    const existingNotification = await PRISMA.notification.findFirst({
      where: {
        recipientId,
        postId,
        type,
      },
    });

    if (existingNotification) {
      //if notif exists, check if the actor already exists in its list of actors.
      const existingActor = await PRISMA.notificationActor.findFirst({
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
        await PRISMA.notificationActor.create({
          data: {
            notificationId: existingNotification.id,
            actorId,
          },
        });

        await PRISMA.notification.update({
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
      await PRISMA.notification.create({
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

export const deleteExpiredSessionsAndLogin = async ({
  userAgentInfo,
  password,
  foundUser,
  currentDate,
  res,
}: DeleteExpiredSessionsAndLoginArgs) => {
  //delete expired sessions
  await PRISMA.userSession.deleteMany({
    where: {
      expiresAt: {
        lt: currentDate,
      },
    },
  });
  //evaluate password
  const matchedPassword = await bcrypt.compare(password, foundUser.password);

  //if passwords dont match throw error.
  if (!matchedPassword) {
    throw new AppError(422, "Incorrect Email or Password", true);
  }

  //if passwords DO match, then create sessionToken
  const sessionToken = crypto.randomBytes(64).toString("hex");

  //save user's session in the UserSession table, along with their sessionToken
  const newUserSession = await PRISMA.userSession.create({
    data: {
      userId: foundUser.id,
      browser: userAgentInfo.browser,
      os: userAgentInfo.os,
      platform: userAgentInfo.platform,
      token: sessionToken,
      expiresAt: TOKEN_EXPIRY_DATE,
    },
  });

  //set sessionToken cookie
  res.cookie("sessionToken", sessionToken, {
    httpOnly: true,
    maxAge: TOKEN_COOKIE_MAXAGE,
    secure: !!Number(process.env.IS_PROD),
  });

  res.status(200).json({
    message: `You are now logged in as ${foundUser.username}`,
    data: {
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        handle: foundUser.handle,
        avatar: foundUser.avatar,
      },
      session: {
        os: newUserSession.os,
        platform: newUserSession.platform,
        browser: newUserSession.browser,
        expiresAt: newUserSession.expiresAt,
      },
      isDetachedMode: false,
    },
  });
};

export const updateCollectionUpdatedAt = async (collectionId: string) => {
  await PRISMA.collection.update({
    where: {
      id: collectionId,
    },
    data: {
      updatedAt: new Date(),
    },
  });
};

export const postsSetCollectionAttachmentIsViewableProp = async ({
  currentUserId,
  posts,
}: PostsSetCollectionAttachmentIsViewablePropArgs) => {
  const postsWithIsCollectionAttachmentViewableProp = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    if (post.collection) {
      if (post.collection.owner.id === currentUserId) {
        postsWithIsCollectionAttachmentViewableProp.push({
          ...post,
          isCollectionAttachmentViewable: true,
        });
      } else {
        //if collection privacy is friends only
        if (post.collection.privacy === Privacy.FRIENDS_ONLY) {
          //check if current user friends with collection owner
          const isCurrentUserFriendsWithCollectionOwner = await areTheyFriends(
            currentUserId,
            post.collection.owner.id
          );

          if (isCurrentUserFriendsWithCollectionOwner) {
            postsWithIsCollectionAttachmentViewableProp.push({
              ...post,
              isCollectionAttachmentViewable: true,
            });
          } else {
            postsWithIsCollectionAttachmentViewableProp.push({
              ...post,
              collection: {},
              isCollectionAttachmentViewable: false,
            });
          }
          //if collection privacy is only me
        } else if (post.collection.privacy === Privacy.ONLY_ME) {
          postsWithIsCollectionAttachmentViewableProp.push({
            ...post,
            collection: {},
            isCollectionAttachmentViewable: false,
          });
          //if collection privacy is public
        } else {
          postsWithIsCollectionAttachmentViewableProp.push({
            ...post,
            isCollectionAttachmentViewable: true,
          });
        }
      }
      //if post does not have collection attachment
    } else {
      postsWithIsCollectionAttachmentViewableProp.push(post);
    }
  }

  return postsWithIsCollectionAttachmentViewableProp;
};

export const postSetCollectionAttachmentIsViewableProp = async ({
  currentUserId,
  post,
}: PostSetCollectionAttachmentIsViewablePropArgs) => {
  let _post = post;

  if (_post.collection) {
    if (post.collection.owner.id === currentUserId) {
      return {
        ...post,
        isCollectionAttachmentViewable: true,
      };
    } else {
      //if collection privacy is friends only
      if (post.collection.privacy === Privacy.FRIENDS_ONLY) {
        //check if current user friends with collection owner
        const isCurrentUserFriendsWithCollectionOwner = await areTheyFriends(
          currentUserId,
          post.collection.owner.id
        );

        if (isCurrentUserFriendsWithCollectionOwner) {
          return {
            ...post,
            isCollectionAttachmentViewable: true,
          };
        } else {
          return {
            ...post,
            collection: {},
            isCollectionAttachmentViewable: false,
          };
        }
        //if collection privacy is only me
      } else if (post.collection.privacy === Privacy.ONLY_ME) {
        return {
          ...post,
          collection: {},
          isCollectionAttachmentViewable: false,
        };
        //if collection privacy is public
      } else {
        return {
          ...post,
          isCollectionAttachmentViewable: true,
        };
      }
    }
    //if post does not have collection attachment
  } else {
    return _post;
  }
};

export const clearOldNotifications = async({currentUserId}: {currentUserId: string}) => {
  const ODDS = 0.1 //10% chance
  const randomChance = Math.random()
  if(randomChance < ODDS){
      await PRISMA.notification.deleteMany({
        where: {
          recipientId: currentUserId,
          createdAt: {
            gte: sub(new Date(), { weeks: 2 }),
          },
        },
      });
  }
}