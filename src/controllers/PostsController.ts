import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  areTheyFriends,
  checkResourcePrivacyAndUserOwnership,
  updateExistingMedia,
} from "../utils/functions/reusablePrismaFunctions";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();

export default class PostsController {
  public getCurrentUserPosts = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;

      const currentUserPosts = await prisma.post.findMany({
        where: {
          ownerId: currentUser.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          content: true,
          privacy: true,
          media: {
            select: {
              id: true,
              title: true,
              type: true,
              posterImage: true,
              coverImage: true,
              year: true,
            },
          },
          collection: {
            select: {
              id: true,
              name: true,
              description: true,
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
          },
          createdAt: true,
          owner: {
            select: {
              id: true,
              username: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "success",
        data: currentUserPosts.map((post) => ({
          id: post.id,
          content: post.content,
          privacy: post.privacy,
          totalLikes: post._count.likes,
          totalComments: post._count.comments,
          owner: {
            id: post.owner.id,
            username: post.owner.username,
          },
          media: post.media,
          collection: post.collection
            ? {
                id: post.collection.id,
                name: post.collection.name,
                description: post.collection.description,
                previewPosters: post.collection.collectionItems.map(
                  (collectionItem) => collectionItem.media.posterImage
                ),
              }
            : null,
          createdAt: post.createdAt,
        })),
      });
    }
  );

  public getUserPosts = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = req.user;

    //check if currentUser is friends with owner
    const isCurrentUserFriendsWithOwner = await areTheyFriends(
      currentUser.userId,
      id
    );

    //retrieve posts that have privacy FRIENDS_ONLY and PUBLIC
    const userPosts = await prisma.post.findMany({
      where: {
        ownerId: id,
        privacy: {
          in: isCurrentUserFriendsWithOwner
            ? ["FRIENDS_ONLY", "PUBLIC"]
            : ["PUBLIC"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        media: true,
        collection: {
          select: {
            id: true,
            name: true,
            description: true,
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
        },
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "success",
      data: userPosts.map((post) => ({
        id: post.id,
        content: post.content,
        privacy: post.privacy,
        totalLikes: post._count.likes,
        totalComments: post._count.comments,
        owner: {
          id: post.owner.id,
          username: post.owner.username,
        },
        media: post.media,
        collection: post.collection
          ? {
              id: post.collection.id,
              name: post.collection.name,
              description: post.collection.description,
              previewPosters: post.collection.collectionItems.map(
                (collectionItem) => collectionItem.media.posterImage
              ),
            }
          : null,
        createdAt: post.createdAt,
      })),
    });
  });

  public getPostInfo = asyncHandler(async (req: Request, res: Response) => {
    //post id
    const { id } = req.params;
    const currentUser = req.user;

    const foundPost = await prisma.post.findFirst({
      where: {
        id,
      },
      include: {
        media: true,
        collection: {
          select: {
            id: true,
            name: true,
            description: true,
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
        },
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!foundPost) {
      throw new AppError(404, "NotFound", "Post not found.", true);
    }

    const successData = {
      id: foundPost.id,
      content: foundPost.content,
      privacy: foundPost.privacy,
      totalLikes: foundPost._count.likes,
      totalComments: foundPost._count.comments,
      owner: {
        id: foundPost.owner.id,
        username: foundPost.owner.username,
      },
      media: foundPost.media,
      collection: foundPost.collection
        ? {
            id: foundPost.collection.id,
            name: foundPost.collection.name,
            description: foundPost.collection.description,
            previewPosters: foundPost.collection.collectionItems.map(
              (collectionItem) => collectionItem.media.posterImage
            ),
          }
        : null,
      createdAt: foundPost.createdAt,
    };

    await checkResourcePrivacyAndUserOwnership({
      currentUserId: currentUser.userId,
      ownerId: foundPost.owner.id,
      privacy: foundPost.privacy,
      res,
      successData,
    });
  });

  public createPost = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { content, privacy, media, collectionId } = req.body;

    //check if media exists in req.body
    if (media) {
      //check if media exists in Media table
      const foundMedia = await prisma.media.findFirst({
        where: {
          id: media.id,
        },
      });
      if (!foundMedia) {
        //if not found, create the media
        const newMedia = await prisma.media.create({
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
        const newPostWithNewMedia = await prisma.post.create({
          data: {
            content,
            privacy,
            mediaId: newMedia.id,
            ownerId: currentUser.userId,
          },
        });

        res.status(201).json({
          message: "Post (with new media) successfully created.",
          data: newPostWithNewMedia,
        });
        return;
      }
      //if media already exists, then just use the foundMedia to create the new post
      //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
      //*the req.body. This is to ensure that all collectionItems referencing that media will show the latest
      //*version of that Media (because sometimes the 3rd party api change the details of the anime/movie/tv)
      await updateExistingMedia(foundMedia, media);
      const newPostWithFoundMedia = await prisma.post.create({
        data: {
          content,
          privacy,
          mediaId: foundMedia.id,
          ownerId: currentUser.userId,
        },
      });
      res.status(201).json({
        message: "Post (with found media) successfully created.",
        data: newPostWithFoundMedia,
      });
      return;
    }

    //check if collectionId exists in req.body
    if (collectionId) {
      //use the collectionId to create the new post
      const newPostWithCollection = await prisma.post.create({
        data: {
          ownerId: currentUser.userId,
          content,
          privacy,
          collectionId,
        },
      });
      res.status(201).json({
        message: "Post (with collection) successfully created.",
        data: newPostWithCollection,
      });
      return;
    }

    //if either media or collectionId exists in req.body, this means user just wants to make a post
    //without attaching anything.

    const newPostWithoutAttachments = await prisma.post.create({
      data: {
        ownerId: currentUser.userId,
        content,
        privacy,
      },
    });

    res.status(201).json({
      message: "Post (without attachments) created successfully.",
      data: newPostWithoutAttachments,
    });
    return;
  });

  public deletePost = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { id } = req.params;

    const deletedPost = await prisma.post.delete({
      where: {
        id,
        ownerId: currentUser.userId,
      },
    });

    res.status(200).json({
      message: "Post deleted successfully.",
      data: deletedPost,
    });
  });

  public updatePost = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { id } = req.params;
    //! NEEDS REFACTOR: make proper validation for req.body
    const { content, privacy, media, collectionId } = req.body;

    //check if media exists in req.body
    if (media) {
      //check if media exists in Media table
      const foundMedia = await prisma.media.findFirst({
        where: {
          id: media.id,
        },
      });
      if (!foundMedia) {
        //if not found, create new media
        const newMedia = await prisma.media.create({
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
        const updatedPostWithNewMedia = await prisma.post.update({
          where: {
            id,
          },
          data: {
            content,
            privacy,
            mediaId: newMedia.id,
            ownerId: currentUser.userId,
          },
        });
        res.status(200).json({
          message: "Post (with new media) updated succesfully.",
          data: updatedPostWithNewMedia,
        });
        return;
      }
      //if media already exists, then just use the foundMedia to update the post
      //*if foundMedia details are not the same with the req.body, update the foundMedia with the one from
      //*the req.body. This is to ensure that all collectionItems referencing that media will show the latest
      //*version of that Media (because sometimes the 3rd party api change the details of the anime/movie/tv)
      await updateExistingMedia(foundMedia, media);
      const updatedPostWithFoundMedia = await prisma.post.update({
        where: {
          id,
        },
        data: {
          content,
          privacy,
          mediaId: foundMedia.id,
          ownerId: currentUser.userId,
        },
      });
      res.status(201).json({
        message: "Post (with found media) updated successfully.",
        data: updatedPostWithFoundMedia,
      });
      return;
    }
    //check if collectionId exists in req.body
    if (collectionId) {
      //use the collectionId to create the new post
      const updatedPostWithCollection = await prisma.post.update({
        where: {
          id,
        },
        data: {
          ownerId: currentUser.userId,
          content,
          privacy,
          collectionId,
        },
      });
      res.status(201).json({
        message: "Post (with collection) updated successfully.",
        data: updatedPostWithCollection,
      });
      return;
    }

    //if either media or collectionId exists in req.body, this means user just wants to update a post
    //that has no attachments (no media or collection attached)
    const newPostWithoutAttachments = await prisma.post.update({
      where: {
        id,
      },
      data: {
        ownerId: currentUser.userId,
        content,
        privacy,
      },
    });

    res.status(201).json({
      message: "Post (without attachments) updated successfully.",
      data: newPostWithoutAttachments,
    });
    return;
  });

  public getPostComments = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { id } = req.params;

    //TODO: ADD PAGINATION
    const postComments = await prisma.comment.findMany({
      where: {
        postId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        postId: true,
        content: true,
        author: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "success",
      data: postComments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        author: comment.author,
        isOwnedByCurrentUser:
          comment.author.id === currentUser.userId ? true : false,
      })),
    });
  });

  public createPostComment = asyncHandler(
    async (req: Request, res: Response) => {
      const currentUser = req.user;
      //postId
      const { id } = req.params;
      const { content } = req.body;

      const newComment = await prisma.comment.create({
        data: {
          authorId: currentUser.userId,
          postId: id,
          content,
        },
      });

      res.status(201).json({
        message: "Comment created successfully.",
        data: newComment,
      });
    }
  );

  public updatePostComment = asyncHandler(
    async (req: Request, res: Response) => {
      const { postId, commentId } = req.params;
      const { content } = req.body;
      const currentUser = req.user;

      const updatedComment = await prisma.comment.update({
        where: {
          id: commentId,
          postId,
          authorId: currentUser.userId,
        },
        data: {
          content,
        },
      });

      res.status(200).json({
        message: "Comment updated successfully.",
        data: updatedComment,
      });
    }
  );

  public deletePostComment = asyncHandler(
    async (req: Request, res: Response) => {
      const { postId, commentId } = req.params;
      const currentUser = req.user;

      const foundPostOwner = await prisma.post.findFirst({
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

      if (foundPostOwner.ownerId !== currentUser.userId) {
        throw new AppError(
          403,
          "Unauthorized",
          "You cannot delete a comment from a post you do not own.",
          true
        );
      }

      const deletedPostComment = await prisma.comment.delete({
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
        data: { commentId: deletedPostComment.id },
      });
    }
  );

  public getPostLikes = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    //TODO: ADD PAGINATION
    const postLikes = await prisma.postLike.findMany({
      where: {
        postId: id,
      },
      select: {
        postId: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "success",
      data: postLikes,
    });
  });

  public likePost = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { id } = req.params;

    await prisma.postLike.create({
      data: {
        userId: currentUser.userId,
        postId: id,
      },
    });

    res.status(200).json({
      message: "Post liked successfully.",
    });
  });

  public unlikePost = asyncHandler(async (req: Request, res: Response) => {
    const currentUser = req.user;
    const { id } = req.params;

    await prisma.postLike.delete({
      where: {
        userId_postId: {
          userId: currentUser.userId,
          postId: id,
        },
      },
    });

    res.status(200).json({
      message: "Post unliked successfully.",
    });
  });
}