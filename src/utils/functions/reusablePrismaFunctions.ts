import { Media, PrismaClient, Privacy } from "@prisma/client";
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
