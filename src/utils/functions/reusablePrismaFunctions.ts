import { PrismaClient, Privacy } from "@prisma/client";
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
    } else {
      isEntityPrivacyAndUserRelationshipValid = false;
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

  if (followBack.length === 2) {
    return true;
  } else {
    return false;
  }
};
