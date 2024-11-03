import express from "express";
import TrendingController from "../controllers/TrendingController";

const router = express.Router();
const trendingController = new TrendingController();

router.get("/", trendingController.getTrendingPosts);

export default router;
