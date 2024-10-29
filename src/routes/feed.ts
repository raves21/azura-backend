import express from "express";
import FeedController from "../controllers/FeedController";

const router = express.Router();
const feedController = new FeedController();

router
  .get("/for-you", feedController.getForYouPosts)
  .get("/following", feedController.getFollowingPosts);

export default router;
