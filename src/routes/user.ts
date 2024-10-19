import express from "express";
import UserController from "../controllers/UserController";

const router = express.Router();
const userController = new UserController();

router
  .get("/users", userController.getAllUsers)
  .get("/profile", userController.getCurrentUserInfo)
  .get("/sessions", userController.getUserSessions);

router.post("/follow/:userId", userController.followUser);

export default router;
