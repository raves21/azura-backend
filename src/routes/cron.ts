import express from "express";
import CronController from "../controllers/CronController";

const router = express.Router();
const cronController = new CronController();

router.delete("/clear-unused-media", cronController.clearUnusedMedia);

export default router;
