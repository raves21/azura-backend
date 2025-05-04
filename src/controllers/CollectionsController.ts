import { Response, Request } from "express-serve-static-core";
import { Media, MediaType, PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import {
  checkResourcePrivacyAndUserOwnership,
  areTheyFriends,
  updateExistingMedia,
  updateCollectionUpdatedAt,
} from "../utils/functions/reusablePrismaFunctions";
import { RequestWithSession } from "../utils/types/session";
import {
  COLLECTION_PREVIEW_MEDIAS_INCLUDE,
  ENTITY_OWNER_SELECT,
} from "../utils/constants/queries";
import PRISMA from "../utils/constants/prismaInstance";

export default class CollectionsController {
  public getCurrentUserCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserCollections = await PRISMA.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          updatedAt: order,
        },
        where: {
          ownerId: session.userId,
        },
        include: {
          owner: ENTITY_OWNER_SELECT,
          collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
        },
      });
      const totalItems = await PRISMA.collection.count({
        where: {
          ownerId: session.userId,
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
          owner: collection.owner,
          description: collection.description,
          previewMedias: collection.collectionItems.map(
            (collectionItem) => collectionItem.media
          ),
        })),
      });
    }
  );

  public getUserCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const { handle } = req.params;
      const session = req.session;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      //find owner of collection based on user handle
      const foundOwner = await PRISMA.user.findFirstOrThrow({
        where: {
          handle,
        },
      });

      //check if currentUser is friends with collection owner
      const isCurrentUserFriendsWithOwner = await areTheyFriends(
        session.userId as string,
        foundOwner.id
      );

      //retrieve collections that have privacy PUBLIC and FRIENDS_ONLY
      const userCollections = await PRISMA.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          updatedAt: order,
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
          owner: ENTITY_OWNER_SELECT,
          collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
        },
      });

      const totalItems = await PRISMA.collection.count({
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
          owner: collection.owner,
          description: collection.description,
          previewMedias: collection.collectionItems.map(
            (collectionItem) => collectionItem.media
          ),
        })),
      });
    }
  );

  public createCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const { name, description, privacy, photo } = req.body;
    const session = req.session;

    const newCollection = await PRISMA.collection.create({
      data: {
        ownerId: session.userId,
        name,
        description,
        privacy,
        photo,
      },
    });

    res.status(201).json({
      message: "create collection successful.",
      data: newCollection,
    });
  });

  public deleteCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { id } = req.params;

    const deletedCollection = await PRISMA.collection.delete({
      where: {
        id,
        ownerId: session.userId,
      },
    });
    res.status(200).json({
      message: "collection deleted successfuly.",
      data: deletedCollection,
    });
  });

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
        throw new AppError(422, "Please provide all needed credentials.", true);
      }

      //check if media already exists in Media table
      const foundMedia = await PRISMA.media.findFirst({
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
        const newCollectionItem = await PRISMA.collectionItem.create({
          data: {
            collectionId,
            mediaId: foundMedia.id,
            mediaType: foundMedia.type,
          },
        });

        //update collection's updatedAt
        updateCollectionUpdatedAt(collectionId);

        res.status(201).json({
          message: "collection item created successfully.",
          data: newCollectionItem,
        });
      } else {
        //if does not exist, create media and use it to create collectionItem
        const newMedia = await PRISMA.media.create({
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

        const newCollectionItem = await PRISMA.collectionItem.create({
          data: {
            collectionId,
            mediaId: newMedia.id,
            mediaType: newMedia.type,
          },
        });

        //update collection's updatedAt
        updateCollectionUpdatedAt(collectionId);

        res.status(201).json({
          message: "collection item created successfully",
          data: newCollectionItem,
        });
      }
    }
  );

  //delete one
  public deleteCollectionItem = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;

      const { id: collectionId } = req.params;
      const { mediaId, mediaType } = req.query;

      if (!mediaId || !mediaType) {
        throw new AppError(422, "Please provide all credentials.", true);
      }

      //check if collection exists, and if owner owns the collection
      await PRISMA.collection.findFirstOrThrow({
        where: {
          id: collectionId,
          ownerId: session.userId,
        },
      });

      await PRISMA.collectionItem.deleteMany({
        where: {
          mediaId: mediaId.toString(),
          collectionId,
          mediaType: mediaType as MediaType,
        },
      });

      res.status(200).json({ message: "deleted successfully." });
    }
  );

  //delete many
  public deleteCollectionItems = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      //array of collectionItemIds
      const { collectionItemsToDelete } = req.body;
      const { id: collectionId } = req.params;
      const session = req.session;

      //check if collection exists, and if owner owns the collection
      await PRISMA.collection.findFirstOrThrow({
        where: {
          id: collectionId,
          ownerId: session.userId,
        },
      });

      //delete all collectionItems with id that matches the collectionItemsToDelete ids
      const deletedCollectionItems = await PRISMA.collectionItem.deleteMany({
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

  public getCollectionInfo = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    //collection id
    const { id } = req.params;
    const session = req.session;

    const foundCollection = await PRISMA.collection.findFirstOrThrow({
      where: {
        id,
      },
      include: {
        owner: ENTITY_OWNER_SELECT,
        collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
      },
    });

    const successData = {
      id,
      name: foundCollection?.name,
      photo: foundCollection?.photo,
      description: foundCollection?.description,
      privacy: foundCollection?.privacy,
      owner: foundCollection?.owner,
      previewMedias: foundCollection.collectionItems.map(
        (collectionItem) => collectionItem.media
      ),
    };

    await checkResourcePrivacyAndUserOwnership({
      currentUserId: session.userId,
      ownerId: foundCollection.ownerId,
      privacy: foundCollection.privacy,
      successData,
      res,
    });
  });

  public getCollectionCollectionItems = asyncHandler(
    async (req: Request, res: Response) => {
      const { collectionId } = req.params;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const collectionItems = await PRISMA.collectionItem.findMany({
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        where: {
          collectionId,
        },
        select: {
          id: true,
          collectionId: true,
          media: true,
        },
      });

      const totalItems = await PRISMA.collectionItem.count({
        where: {
          collectionId,
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
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;
      const { collectionId, id } = req.params;

      const foundCollectionItem = await PRISMA.collectionItem.findFirstOrThrow({
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

      await checkResourcePrivacyAndUserOwnership({
        currentUserId: session.userId,
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

  public updateCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { id } = req.params;
    const { name, description, privacy, photo } = req.body;

    const updatedCollection = await PRISMA.collection.update({
      where: {
        id,
        ownerId: session.userId,
      },
      data: {
        name,
        description,
        privacy,
        photo,
      },
    });
    res.status(200).json({
      message: "collection updated successfully.",
      data: updatedCollection,
    });
  });

  public checkMediaExistenceInCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;
      const { mediaId, type, page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      if (!type || !mediaId) {
        throw new AppError(422, "Please provide all needed parameters.", true);
      }

      //retrieve all user's collections where mediaId matches the given mediaId in params
      const currentUserCollections = await PRISMA.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          updatedAt: order,
        },
        where: {
          ownerId: session.userId,
        },
        select: {
          id: true,
          name: true,
          collectionItems: {
            where: {
              AND: {
                mediaId: mediaId.toString(),
                mediaType: type.toString() as MediaType,
              },
            },
          },
        },
      });

      const totalItems = await PRISMA.collection.count({
        where: {
          ownerId: session.userId,
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
          doesGivenMediaExist: collection.collectionItems.length > 0,
        })),
      });
    }
  );

  public checkMediaExistenceInCollection = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithSession;
      const session = req.session;
      const { id } = req.params;
      const { mediaId, type } = req.query;

      if (!type || !mediaId) {
        throw new AppError(422, "Please provide all needed parameters.", true);
      }

      const mediaInCollection = await PRISMA.collection.findFirst({
        where: {
          id,
          ownerId: session.userId,
          collectionItems: {
            some: {
              mediaId: mediaId.toString(),
              mediaType: type.toString() as MediaType,
            },
          },
        },
      });

      if (mediaInCollection) {
        res.json({
          message: "media already exists in collection",
          data: {
            doesGivenMediaExist: true,
          },
        });
      }
      res.json({
        message: "media does not exist in collection",
        data: {
          doesGivenMediaExist: false,
        },
      });
    }
  );
}
