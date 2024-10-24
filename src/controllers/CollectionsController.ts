import { Response, Request } from "express-serve-static-core";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import {
  checkResourcePrivacyAndUserOwnership,
  areTheyFriends,
} from "../utils/functions/reusablePrismaFunctions";

const prisma = new PrismaClient();

export default class CollectionsController {
  public getCurrentUserCollections = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;

      //TODO: ADD PAGINATION

      const currentUserCollections = await prisma.collection.findMany({
        where: {
          ownerId: currentUser.userId,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      res.status(200).json({
        message: "success",
        data: currentUserCollections,
      });
    }
  );

  public getUserCollections = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const currentUser = req.user;

      //check if currentUser is friends with collection owner
      const isCurrentUserFriendsWithOwner = await areTheyFriends(
        currentUser.userId as string,
        id
      );

      //TODO: ADD PAGINATION
      //retrieve collections that have privacy PUBLIC and FRIENDS_ONLY
      const userCollections = await prisma.collection.findMany({
        where: {
          ownerId: id,
          privacy: {
            in: isCurrentUserFriendsWithOwner
              ? ["FRIENDS_ONLY", "PUBLIC"]
              : ["PUBLIC"],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      res.status(200).json({
        message: "success",
        data: userCollections,
      });
    }
  );

  public createCollection = asyncHandler(
    async (req: Request, res: Response) => {
      const { name, description, privacy } = req.body;
      const currentUser = req.user;

      const newCollection = await prisma.collection.create({
        data: {
          ownerId: currentUser.userId,
          name,
          description,
          privacy,
        },
      });

      res.status(201).json({
        message: "create collection successful.",
        data: newCollection,
      });
    }
  );

  public deleteCollection = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;
      const { id } = req.params;

      const deletedCollection = await prisma.collection.delete({
        where: {
          id,
          ownerId: currentUser.userId,
        },
      });
      res.status(200).json({
        message: "collection deleted successfuly.",
        data: deletedCollection,
      });
    }
  );

  public addCollectionItem = asyncHandler(
    async (req: Request, res: Response) => {
      const { id: collectionId } = req.params;
      const {
        mediaId, //mediaId should be given by frontend (anilistId of anime or tmdbId of movie/tv)
        title,
        year,
        type,
        description,
        coverImage,
        posterImage,
        rating,
        status,
      } = req.body;

      if (
        !mediaId ||
        !title ||
        !year ||
        !type ||
        !description ||
        !coverImage ||
        !posterImage ||
        !rating
      ) {
        throw new AppError(
          400,
          "ValidationError",
          "Please provide all needed credentials.",
          true
        );
      }

      //check if media already exists in Media table
      const foundMedia = await prisma.media.findFirst({
        where: {
          id: mediaId,
        },
      });

      if (foundMedia) {
        //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
        //*the req.body. This is to ensure that all collectionItems referencing that media will show the latest
        //*version of that Media (because sometimes the 3rd party api change the details of the anime/movie/tv)
        if (
          foundMedia.title !== title ||
          foundMedia.year !== year ||
          foundMedia.description !== description ||
          foundMedia.coverImage !== coverImage ||
          foundMedia.posterImage !== posterImage ||
          foundMedia.rating !== rating ||
          foundMedia.status !== status
        ) {
          await prisma.media.update({
            where: {
              id: foundMedia.id,
            },
            data: {
              title,
              year,
              description,
              coverImage,
              posterImage,
              rating,
              status,
            },
          });
        }

        //proceed to creating the collection item
        const newCollectionItem = await prisma.collectionItem.create({
          data: {
            collectionId,
            mediaId: foundMedia.id,
          },
        });

        res.status(201).json({
          message: "collection item created successfully.",
          data: newCollectionItem,
        });
      } else {
        //if does not exist, create media and use it to create collectionItem
        const newMedia = await prisma.media.create({
          data: {
            id: mediaId,
            title,
            year,
            type,
            description,
            coverImage,
            posterImage,
            rating,
            status,
          },
        });

        const newCollectionItem = await prisma.collectionItem.create({
          data: {
            collectionId,
            mediaId: newMedia.id,
          },
        });
        res.status(201).json({
          message: "collection item created successfully",
          data: newCollectionItem,
        });
      }
    }
  );

  public deleteCollectionItems = asyncHandler(
    async (req: Request, res: Response) => {
      //array of collectionItemIds
      const { collectionItemsToDelete } = req.body;
      const { id: collectionId } = req.params;
      const currentUser = req.user;

      //check if collection exists, and if owner owns the collection
      const foundCollection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          ownerId: currentUser.userId,
        },
      });

      if (!foundCollection) {
        throw new AppError(404, "NotFound", "Collection not found.", true);
      }

      //delete all collectionItems with id that matches the collectionItemsToDelete ids
      const deletedCollectionItems = await prisma.collectionItem.deleteMany({
        where: {
          id: {
            in: collectionItemsToDelete,
          },
        },
      });

      res.status(200).json({
        message: "collection item/s successfully deleted.",
        deletedCount: deletedCollectionItems.count,
      });
    }
  );

  public getCollectionInfo = asyncHandler(
    async (req: Request, res: Response) => {
      //collection id
      const { id } = req.params;
      const currentUser = req.user;

      const foundCollection = await prisma.collection.findFirst({
        where: {
          id,
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
            },
          },
          collectionItems: true,
          // collectionItems: {
          //   include: {
          //     media: true,
          //   },
          // },
          _count: {
            select: {
              collectionItems: true,
            },
          },
        },
      });

      if (!foundCollection) {
        throw new AppError(404, "NotFound", `Collection not found.`, true);
      }

      const successData = {
        id,
        name: foundCollection?.name,
        description: foundCollection?.description,
        privacy: foundCollection?.privacy,
        owner: foundCollection?.owner,
        totalCollectionItems: foundCollection?._count.collectionItems,
        collectionItems: foundCollection?.collectionItems,
      };

      await checkResourcePrivacyAndUserOwnership({
        currentUserId: currentUser.userId,
        ownerId: foundCollection.ownerId,
        privacy: foundCollection.privacy,
        successData,
        res,
      });
    }
  );

  public getCollectionItemInfo = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;
      const { collectionId, id } = req.params;

      const foundCollectionItem = await prisma.collectionItem.findFirst({
        where: {
          id,
          collectionId,
        },
        include: {
          collection: {
            select: {
              ownerId: true,
              privacy: true,
            },
          },
          media: true,
        },
      });

      if (!foundCollectionItem) {
        throw new AppError(404, "NotFound", "Collection Item not found.", true);
      }

      await checkResourcePrivacyAndUserOwnership({
        currentUserId: currentUser.userId,
        ownerId: foundCollectionItem.collection.ownerId,
        privacy: foundCollectionItem.collection.privacy,
        res,
        successData: {
          id: foundCollectionItem.id,
          ownerId: foundCollectionItem.collection.ownerId,
          media: foundCollectionItem.media,
        },
      });
    }
  );

  public updateCollection = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;
      const { id } = req.params;
      const { name, description, privacy } = req.body;

      const updatedCollection = await prisma.collection.update({
        where: {
          id,
          ownerId: currentUser.userId,
        },
        data: {
          name,
          description,
          privacy,
        },
      });
      res.status(200).json({
        message: "collection updated successfully.",
        data: updatedCollection,
      });
    }
  );

  public checkMediaExistenceInCollections = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;
      const { mediaId } = req.params;

      //retrieve all user's collections
      const currentUserCollections = await prisma.collection.findMany({
        where: {
          ownerId: currentUser.userId,
        },
        select: {
          id: true,
          name: true,
          collectionItems: {
            select: {
              mediaId: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "success",
        data: currentUserCollections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          doesGivenMediaExist:
            collection.collectionItems.filter(
              (collectionItem) => collectionItem.mediaId === mediaId.toString()
            ).length === 0
              ? false
              : true,
        })),
      });
    }
  );
}
