import { Response, Request } from "express-serve-static-core";
import { Media, PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import {
  checkResourcePrivacyAndUserOwnership,
  areTheyFriends,
  updateExistingMedia,
} from "../utils/functions/reusablePrismaFunctions";
import { RequestWithPayload } from "../utils/types/jwt";

const prisma = new PrismaClient();

export default class CollectionsController {
  public getCurrentUserCollections = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserCollections = await prisma.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          ownerId: payload.userId,
        },
        include: {
          collectionItems: {
            take: 3,
            select: {
              media: {
                select: {
                  posterImage: true,
                },
              },
            },
          },
        },
      });
      const totalItems = await prisma.collection.count({
        where: {
          ownerId: payload.userId,
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: currentUserCollections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          photo: collection.photo,
          privacy: collection.privacy,
          previewPosters: collection.collectionItems.map(
            (collectionItem) => collectionItem.media.posterImage
          ),
        })),
      });
    }
  );

  public getUserCollections = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { handle } = req.params;
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const foundOwner = await prisma.user.findFirst({
        where: {
          handle,
        },
      });

      if (!foundOwner) {
        throw new AppError(404, "NotFound", "Collection not found.", true);
      }

      //check if currentUser is friends with collection owner
      const isCurrentUserFriendsWithOwner = await areTheyFriends(
        payload.userId as string,
        foundOwner.id
      );

      //retrieve collections that have privacy PUBLIC and FRIENDS_ONLY
      const userCollections = await prisma.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          ownerId: foundOwner.id,
          privacy: {
            in: isCurrentUserFriendsWithOwner
              ? ["FRIENDS_ONLY", "PUBLIC"]
              : ["PUBLIC"],
          },
        },
        include: {
          collectionItems: {
            take: 3,
            select: {
              media: {
                select: {
                  posterImage: true,
                },
              },
            },
          },
        },
      });

      const totalItems = await prisma.collection.count({
        where: {
          ownerId: foundOwner.id,
          privacy: {
            in: isCurrentUserFriendsWithOwner
              ? ["FRIENDS_ONLY", "PUBLIC"]
              : ["PUBLIC"],
          },
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.status(200).json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: userCollections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          photo: collection.photo,
          privacy: collection.privacy,
          previewPosters: collection.collectionItems.map(
            (collectionItem) => collectionItem.media.posterImage
          ),
        })),
      });
    }
  );

  public createCollection = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const { name, description, privacy } = req.body;
      const payload = req.jwtPayload;

      const newCollection = await prisma.collection.create({
        data: {
          ownerId: payload.userId,
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
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;
      const { id } = req.params;

      const deletedCollection = await prisma.collection.delete({
        where: {
          id,
          ownerId: payload.userId,
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
          422,
          "Invalid Format.",
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
        //! NEEDS REFACTOR: make proper validation for req.body
        const media: Media = {
          id: foundMedia.id,
          title,
          year,
          description,
          coverImage,
          posterImage,
          rating,
          status,
          type: foundMedia.type,
          createdAt: foundMedia.createdAt,
        };
        await updateExistingMedia(foundMedia, media);
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
    async (req: RequestWithPayload, res: Response) => {
      //array of collectionItemIds
      const { collectionItemsToDelete } = req.body;
      const { id: collectionId } = req.params;
      const payload = req.jwtPayload;

      //check if collection exists, and if owner owns the collection
      const foundCollection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          ownerId: payload.userId,
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
    async (req: RequestWithPayload, res: Response) => {
      //collection id
      const { id } = req.params;
      const payload = req.jwtPayload;

      const foundCollection = await prisma.collection.findFirst({
        where: {
          id,
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              handle: true,
            },
          },
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
      };

      await checkResourcePrivacyAndUserOwnership({
        currentUserId: payload.userId,
        ownerId: foundCollection.ownerId,
        privacy: foundCollection.privacy,
        successData,
        res,
      });
    }
  );

  public getCollectionCollectionItems = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const collectionItems = await prisma.collectionItem.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          collectionId: id,
        },
        select: {
          collectionId: true,
          media: true,
        },
      });

      const totalItems = await prisma.collectionItem.count({
        where: {
          collectionId: id,
        },
      });
      const totalPages = Math.ceil(totalItems / _perPage);

      res.json({
        message: "success",
        page: _page,
        perPage: _perPage,
        totalPages,
        data: collectionItems,
      });
    }
  );

  public getCollectionItemInfo = asyncHandler(
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;
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
        currentUserId: payload.userId,
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
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;
      const { id } = req.params;
      const { name, description, privacy } = req.body;

      const updatedCollection = await prisma.collection.update({
        where: {
          id,
          ownerId: payload.userId,
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
    async (req: RequestWithPayload, res: Response) => {
      const payload = req.jwtPayload;
      const { mediaId } = req.params;

      //retrieve all user's collections
      const currentUserCollections = await prisma.collection.findMany({
        where: {
          ownerId: payload.userId,
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
          doesGivenMediaExist: collection.collectionItems
            .map((collectionItem) => collectionItem.mediaId)
            .includes(mediaId.toString()),
        })),
      });
    }
  );
}
