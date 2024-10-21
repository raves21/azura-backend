import express from "express";
import UsersController from "../controllers/UsersController";

const router = express.Router();
const usersController = new UsersController();

router
  .get("/", usersController.getAllUsers)
  .get("/me", usersController.getSelfInfo)
  .get("/:id", usersController.getUserInfo);

router
  .post("/:id/follow", usersController.followUser)
  .post("/:id/unfollow", usersController.unfollowUser);

export default router;
