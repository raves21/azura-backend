import { Response, Request } from "express-serve-static-core";
import { Media, MediaType, PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import AppError from "../utils/types/errors";
import {
  checkResourcePrivacyAndUserOwnership,
  areTheyFriends,
  updateExistingMedia,
} from "../utils/functions/reusablePrismaFunctions";
import { RequestWithPayload } from "../utils/types/jwt";
import { ENTITY_OWNER_SELECT } from "../utils/constants/queries";
import PRISMA from "../utils/constants/prismaInstance";

export default class CollectionsController {
  public getCurrentUserCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;

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
          ownerId: payload.userId,
        },
        include: {
          owner: ENTITY_OWNER_SELECT,
          collectionItems: {
            take: 4,
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
      const totalItems = await PRISMA.collection.count({
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
          owner: collection.owner,
          previewMedias: collection.collectionItems.map(
            (collectionItem) => collectionItem.media
          ),
        })),
      });
    }
  );

  public getUserCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const { handle } = req.params;
      const payload = req.jwtPayload;

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
        payload.userId as string,
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
          collectionItems: {
            take: 4,
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
          previewMedias: collection.collectionItems.map(
            (collectionItem) => collectionItem.media
          ),
        })),
      });
    }
  );

  public createCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { name, description, privacy } = req.body;
    const payload = req.jwtPayload;

    const newCollection = await PRISMA.collection.create({
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
  });

  public deleteCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;

    const deletedCollection = await PRISMA.collection.delete({
      where: {
        id,
        ownerId: payload.userId,
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
        throw new AppError(
          422,
          "Invalid Format.",
          "Please provide all needed credentials.",
          true
        );
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
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;

      const { id: collectionId } = req.params;
      const { mediaId, mediaType } = req.query;

      if (!mediaId || !mediaType) {
        throw new AppError(
          422,
          "Invalid format.",
          "Please provide all credentials.",
          true
        );
      }

      //check if collection exists, and if owner owns the collection
      await PRISMA.collection.findFirstOrThrow({
        where: {
          id: collectionId,
          ownerId: payload.userId,
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
      const req = _ as RequestWithPayload;
      //array of collectionItemIds
      const { collectionItemsToDelete } = req.body;
      const { id: collectionId } = req.params;
      const payload = req.jwtPayload;

      //check if collection exists, and if owner owns the collection
      await PRISMA.collection.findFirstOrThrow({
        where: {
          id: collectionId,
          ownerId: payload.userId,
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
    const req = _ as RequestWithPayload;
    //collection id
    const { id } = req.params;
    const payload = req.jwtPayload;

    const foundCollection = await PRISMA.collection.findFirstOrThrow({
      where: {
        id,
      },
      include: {
        owner: ENTITY_OWNER_SELECT,
        _count: {
          select: {
            collectionItems: true,
          },
        },
      },
    });

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
  });

  public getCollectionCollectionItems = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

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
          collectionId: id,
        },
        select: {
          id: true,
          collectionId: true,
          media: true,
        },
      });

      const totalItems = await PRISMA.collectionItem.count({
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
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;
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

  public updateCollection = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;
    const { name, description, privacy } = req.body;

    const updatedCollection = await PRISMA.collection.update({
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
  });

  public checkMediaExistenceInCollections = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;
      const { mediaId } = req.params;
      const { type, page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      if (!type) {
        throw new AppError(
          422,
          "Invalid Format.",
          "Media type not provided.",
          true
        );
      }

      //retrieve all user's collections where mediaId matches the given mediaId in params
      const currentUserCollections = await PRISMA.collection.findMany({
        skip,
        take: _perPage,
        orderBy: {
          updatedAt: order,
        },
        where: {
          ownerId: payload.userId,
        },
        select: {
          id: true,
          name: true,
          collectionItems: {
            where: {
              mediaId,
              AND: {
                media: {
                  type: type.toString() as MediaType,
                },
              },
            },
          },
        },
      });

      const totalItems = await PRISMA.collection.count({
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
          doesGivenMediaExist: collection.collectionItems.length > 0,
        })),
      });
    }
  );
}
