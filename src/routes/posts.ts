import express from "express";
import PostsController from "../controllers/PostsController";

const router = express.Router();
const postsController = new PostsController();

router
  //get
  .get("/user/me", postsController.getCurrentUserPosts)
  .get("/user/:id", postsController.getUserPosts)
  .get("/:id", postsController.getPostInfo)
  .get("/:id/comments", postsController.getPostComments)
  .get("/:id/likes", postsController.getPostLikes)

  //post
  .post("/", postsController.createPost)
  .post("/:id/comments", postsController.createPostComment)
  .post("/:id/likes", postsController.likePost)

  //put
  .put("/:id", postsController.updatePost)
  .put("/:postId/comments/:commentId", postsController.updatePostComment)

  //delete
  .delete("/:id", postsController.deletePost)
  .delete("/:postId/comments/:commentId", postsController.deletePostComment)
  .delete("/:id/likes", postsController.unlikePost);

export default router;
