import express from "express";
import UsersController from "../controllers/UsersController";

const router = express.Router();
const usersController = new UsersController();

router
  //get
  .get("/", usersController.getAllUsers)
  .get("/me", usersController.getCurrentUserInfo)
  .get("/:handle", usersController.getUserInfo)
  .get("/me/following", usersController.getCurrentUserFollowingList)
  .get("/me/followers", usersController.getCurrentUserFollowerList)
  .get("/:id/following", usersController.getUserFollowingList)
  .get("/:id/followers", usersController.getUserFollowerList)

  //post
  .post("/:id/follow", usersController.followUser)
  .post("/:id/unfollow", usersController.unfollowUser);

export default router;
