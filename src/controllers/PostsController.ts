import { Request, Response } from "express";
import PRISMA from "../utils/constants/prismaInstance";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  areTheyFriends,
  checkResourcePrivacyAndUserOwnership,
  updateExistingMedia,
  upsertNotification,
} from "../utils/functions/reusablePrismaFunctions";
import AppError from "../utils/types/errors";
import { RequestWithPayload } from "../utils/types/jwt";
import {
  COLLECTION_PREVIEW_MEDIAS_INCLUDE,
  CREATE_POST_SELECT,
  POSTS_INCLUDE,
} from "../utils/constants/queries";

export default class PostsController {
  public getCurrentUserPosts = asyncHandler(
    async (_: Request, res: Response) => {
      const req = _ as RequestWithPayload;
      const payload = req.jwtPayload;

      const { page, perPage, ascending } = req.query;

      const order = ascending == "true" ? "asc" : "desc";
      const _page = Number(page) || 1;
      const _perPage = Number(perPage) || 10;
      const skip = (_page - 1) * _perPage;

      const currentUserPosts = await PRISMA.post.findMany({
        where: {
          ownerId: payload.userId,
        },
        skip,
        take: _perPage,
        orderBy: {
          createdAt: order,
        },
        include: POSTS_INCLUDE(payload.userId),
      });

      const totalItems = await PRISMA.post.count({
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
        data: currentUserPosts.map((post) => ({
          id: post.id,
          content: post.content,
          privacy: post.privacy,
          totalLikes: post._count.likes,
          totalComments: post._count.comments,
          isLikedByCurrentUser: post.likes
            .map((like) => like.userId)
            .includes(payload.userId.toString()),
          owner: post.owner,
          media: post.media,
          collection: post.collection
            ? {
                id: post.collection.id,
                photo: post.collection.photo,
                name: post.collection.name,
                description: post.collection.description,
                owner: post.collection.owner,
                privacy: post.collection.privacy,
                previewMedias: post.collection.collectionItems.map(
                  (collectionItem) => collectionItem.media
                ),
              }
            : null,
          createdAt: post.createdAt,
        })),
      });
    }
  );

  public getUserPosts = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { handle } = req.params;
    const payload = req.jwtPayload;

    const { page, perPage, ascending } = req.query;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const foundOwner = await PRISMA.user.findFirstOrThrow({
      where: {
        handle,
      },
    });

    //check if currentUser is friends with owner
    const isCurrentUserFriendsWithOwner = await areTheyFriends(
      payload.userId,
      foundOwner.id
    );

    //retrieve posts that have privacy FRIENDS_ONLY and PUBLIC
    const userPosts = await PRISMA.post.findMany({
      where: {
        ownerId: foundOwner.id,
        privacy: {
          in: isCurrentUserFriendsWithOwner
            ? ["FRIENDS_ONLY", "PUBLIC"]
            : ["PUBLIC"],
        },
      },
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      include: POSTS_INCLUDE(payload.userId),
    });

    const totalItems = await PRISMA.post.count({
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
      data: userPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        isLikedByCurrentUser: post.likes
          .map((like) => like.userId)
          .includes(payload.userId.toString()),
        owner: post.owner,
        media: post.media,
        collection: post.collection
          ? {
              id: post.collection.id,
              photo: post.collection.photo,
              name: post.collection.name,
              description: post.collection.description,
              owner: post.collection.owner,
              privacy: post.collection.privacy,
              previewMedias: post.collection.collectionItems.map(
                (collectionItem) => collectionItem.media
              ),
            }
          : null,
        createdAt: post.createdAt,
      })),
    });
  });

  public getPostInfo = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    //post id
    const { id } = req.params;
    const payload = req.jwtPayload;

    const foundPost = await PRISMA.post.findFirstOrThrow({
      where: {
        id,
      },
      include: POSTS_INCLUDE(payload.userId),
    });

    const postFirstLikers = await PRISMA.post.findFirstOrThrow({
      where: {
        id,
      },
      select: {
        likes: {
          orderBy: {
            createdAt: "asc",
          },
          take: 2,
          select: {
            user: {
              select: {
                id: true,
                avatar: true,
                username: true,
              },
            },
          },
        },
      },
    });

    const successData = {
      id: foundPost.id,
      content: foundPost.content,
      privacy: foundPost.privacy,
      totalLikes: foundPost._count.likes,
      totalComments: foundPost._count.comments,
      isLikedByCurrentUser: foundPost.likes
        .map((like) => like.userId)
        .includes(payload.userId),
      owner: foundPost.owner,
      media: foundPost.media,
      postFirstLikers:
        postFirstLikers && postFirstLikers.likes.length !== 0
          ? postFirstLikers.likes.map((liker) => liker.user)
          : null,
      collection: foundPost.collection
        ? {
            id: foundPost.collection.id,
            photo: foundPost.collection.photo,
            name: foundPost.collection.name,
            description: foundPost.collection.description,
            owner: foundPost.collection.owner,
            privacy: foundPost.collection.privacy,
            previewMedias: foundPost.collection.collectionItems.map(
              (collectionItem) => collectionItem.media
            ),
          }
        : null,
      createdAt: foundPost.createdAt,
    };

    await checkResourcePrivacyAndUserOwnership({
      currentUserId: payload.userId,
      ownerId: foundPost.owner.id,
      privacy: foundPost.privacy,
      res,
      successData,
    });
  });

  public createPost = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { content, privacy, media, collectionId } = req.body;

    //check if media exists in req.body
    if (media) {
      //check if media exists in Media table
      const foundMedia = await PRISMA.media.findFirst({
        where: {
          id: media.id,
        },
      });
      if (!foundMedia) {
        //if not found, create the media
        const newMedia = await PRISMA.media.create({
          data: {
            id: media.id,
            title: media.title,
            type: media.type,
            year: media.year,
            description: media.description,
            coverImage: media.coverImage,
            posterImage: media.posterImage,
            rating: media.rating,
            status: media.status,
          },
        });
        //proceed to creating the post with newMedia
        const newPostWithNewMedia = await PRISMA.post.create({
          data: {
            content,
            privacy,
            mediaId: newMedia.id,
            ownerId: payload.userId,
          },
          select: CREATE_POST_SELECT,
        });

        res.status(201).json({
          message: "Post (with new media) successfully created.",
          data: { ...newPostWithNewMedia, collection: null },
        });
        return;
      }
      //if media already exists, then just use the foundMedia to create the new post
      //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
      //*the req.body. This is to ensure that all collectionItems referencing that media will show the latest
      //*version of that Media (because sometimes the 3rd party api change the details of the anime/movie/tv)
      await updateExistingMedia(foundMedia, media);
      const newPostWithExistingMedia = await PRISMA.post.create({
        data: {
          content,
          privacy,
          mediaId: foundMedia.id,
          ownerId: payload.userId,
        },
        select: CREATE_POST_SELECT,
      });
      res.status(201).json({
        message: "Post (with found media) successfully created.",
        data: { ...newPostWithExistingMedia, collection: null },
      });
      return;
    }

    //check if collectionId exists in req.body
    if (collectionId) {
      //use the collectionId to create the new post
      const newPostWithCollection = await PRISMA.post.create({
        data: {
          ownerId: payload.userId,
          content,
          privacy,
          collectionId,
        },
        include: {
          collection: {
            select: {
              id: true,
              photo: true,
              name: true,
              description: true,
              owner: true,
              privacy: true,
              collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
            },
          },
        },
      });
      res.status(201).json({
        message: "Post (with collection) successfully created.",
        data: {
          ...newPostWithCollection,
          collection: newPostWithCollection.collection
            ? {
                id: newPostWithCollection.collection.id,
                photo: newPostWithCollection.collection.photo,
                name: newPostWithCollection.collection.name,
                description: newPostWithCollection.collection.description,
                owner: newPostWithCollection.collection.owner,
                privacy: newPostWithCollection.collection.privacy,
                previewMedias:
                  newPostWithCollection.collection.collectionItems.map(
                    (collectionItem) => collectionItem.media
                  ),
              }
            : null,
        },
      });
      return;
    }

    //if either media or collectionId exists in req.body, this means user just wants to make a post
    //without attaching anything.

    const newPostWithNoAttachments = await PRISMA.post.create({
      data: {
        ownerId: payload.userId,
        content,
        privacy,
      },
      select: CREATE_POST_SELECT,
    });

    res.status(201).json({
      message: "Post (without attachments) created successfully.",
      data: { ...newPostWithNoAttachments, collection: null },
    });
    return;
  });

  public deletePost = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;

    await PRISMA.post.delete({
      where: {
        id,
        ownerId: payload.userId,
      },
    });

    res.status(200).json({
      message: "Post deleted successfully.",
    });
  });

  public updatePost = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;
    //! NEEDS REFACTOR: make proper validation for req.body
    const { content, privacy, media, collectionId } = req.body;

    //check if media exists in req.body
    if (media) {
      //check if media exists in Media table
      const foundMedia = await PRISMA.media.findFirst({
        where: {
          id: media.id,
        },
      });
      if (!foundMedia) {
        //if not found, create new media
        const newMedia = await PRISMA.media.create({
          data: {
            id: media.id,
            title: media.title,
            type: media.type,
            year: media.year,
            description: media.description,
            coverImage: media.coverImage,
            posterImage: media.posterImage,
            rating: media.rating,
            status: media.status,
          },
        });
        //proceed to updating the post with the new media
        await PRISMA.post.update({
          where: {
            id,
          },
          data: {
            content,
            privacy,
            mediaId: newMedia.id,
            ownerId: payload.userId,
          },
        });
        res.status(200).json({
          message: "Post (with new media) updated succesfully.",
        });
        return;
      }
      //if media already exists, then just use the foundMedia to update the post
      //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
      //*the req.body. This is to ensure that all collectionItems referencing that media will show the latest
      //*version of that Media (because sometimes the 3rd party api change the details of the anime/movie/tv)
      await updateExistingMedia(foundMedia, media);
      await PRISMA.post.update({
        where: {
          id,
        },
        data: {
          content,
          privacy,
          mediaId: foundMedia.id,
          ownerId: payload.userId,
        },
      });
      res.status(201).json({
        message: "Post (with found media) updated successfully.",
      });
      return;
    }
    //check if collectionId exists in req.body
    if (collectionId) {
      //use the collectionId to create the new post
      await PRISMA.post.update({
        where: {
          id,
        },
        data: {
          ownerId: payload.userId,
          content,
          privacy,
          collectionId,
        },
      });
      res.status(201).json({
        message: "Post (with collection) updated successfully.",
      });
      return;
    }

    //if either media or collectionId exists in req.body, this means user just wants to update a post
    //that has no attachments (no media or collection attached)
    await PRISMA.post.update({
      where: {
        id,
      },
      data: {
        ownerId: payload.userId,
        content,
        privacy,
      },
    });

    res.status(201).json({
      message: "Post (without attachments) updated successfully.",
    });
    return;
  });

  public getPostComments = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { id } = req.params;

    const { page, perPage, ascending } = req.query;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const postComments = await PRISMA.comment.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        postId: id,
      },
      select: {
        id: true,
        postId: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            avatar: true,
            username: true,
            handle: true,
          },
        },
      },
    });

    const totalItems = await PRISMA.comment.count({
      where: {
        postId: id,
      },
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: postComments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        author: comment.author,
        createdAt: comment.createdAt,
      })),
    });
  });

  public createPostComment = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    //postId
    const { id } = req.params;
    const { content } = req.body;

    const newComment = await PRISMA.comment.create({
      data: {
        authorId: payload.userId,
        postId: id,
        content,
      },
      select: {
        id: true,
        post: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    await upsertNotification({
      recipientId: newComment.post.ownerId,
      actorId: payload.userId,
      postId: id,
      type: "COMMENT",
    });

    res.status(201).json({
      message: "Comment created successfully.",
      data: {
        id: newComment.id,
      },
    });
  });

  public updatePostComment = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const payload = req.jwtPayload;

    await PRISMA.comment.update({
      where: {
        id: commentId,
        postId,
        authorId: payload.userId,
      },
      data: {
        content,
      },
    });

    res.status(200).json({
      message: "Comment updated successfully.",
    });
  });

  public deletePostComment = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { postId, commentId } = req.params;
    const payload = req.jwtPayload;

    const foundPostOwner = await PRISMA.post.findFirst({
      where: {
        id: postId,
      },
      select: {
        ownerId: true,
      },
    });

    if (!foundPostOwner) {
      throw new AppError(404, "NotFound", "Post not found.", true);
    }

    if (foundPostOwner.ownerId !== payload.userId) {
      throw new AppError(
        403,
        "Forbidden",
        "You cannot delete a comment from a post you do not own.",
        true
      );
    }

    await PRISMA.comment.delete({
      where: {
        id: commentId,
        postId,
      },
      select: {
        id: true,
      },
    });

    res.status(200).json({
      message: "Post deleted successfully.",
    });
  });

  public getPostLikes = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { id } = req.params;
    const payload = req.jwtPayload;
    const { page, perPage, ascending } = req.query;

    const order = ascending == "true" ? "asc" : "desc";
    const _page = Number(page) || 1;
    const _perPage = Number(perPage) || 10;
    const skip = (_page - 1) * _perPage;

    const postLikes = await PRISMA.postLike.findMany({
      skip,
      take: _perPage,
      orderBy: {
        createdAt: order,
      },
      where: {
        postId: id,
      },
      select: {
        postId: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            handle: true,
            following: {
              select: {
                followerId: true,
              },
            },
          },
        },
      },
    });

    const totalItems = await PRISMA.postLike.count({
      where: {
        postId: id,
      },
    });
    const totalPages = Math.ceil(totalItems / _perPage);

    res.status(200).json({
      message: "success",
      page: _page,
      perPage: _perPage,
      totalPages,
      data: postLikes.map((postLike) => ({
        postId: postLike.postId,
        user: {
          id: postLike.user.id,
          username: postLike.user.username,
          avatar: postLike.user.avatar,
          handle: postLike.user.handle,
          isFollowedByCurrentUser: postLike.user.following
            .map((follow) => follow.followerId)
            .includes(payload.userId),
        },
      })),
    });
  });

  public likePost = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;

    const newPostLike = await PRISMA.postLike.create({
      data: {
        userId: payload.userId,
        postId: id,
      },
      select: {
        post: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    await upsertNotification({
      recipientId: newPostLike.post.ownerId,
      actorId: payload.userId,
      postId: id,
      type: "LIKE",
    });

    res.status(200).json({
      message: "Post liked successfully.",
    });
  });

  public unlikePost = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { id } = req.params;

    await PRISMA.postLike.delete({
      where: {
        userId_postId: {
          userId: payload.userId,
          postId: id,
        },
      },
    });

    res.status(200).json({
      message: "Post unliked successfully.",
    });
  });
}
