import express from "express";
import CronController from "../controllers/CronController";

const router = express.Router();
const cronController = new CronController();

router
  .get("/clear-unused-media", cronController.clearUnusedMedia)
  .get("/clear-expired-otcs", cronController.clearExpiredOtcs)
  .get("/clear-old-notifications", cronController.clearOldNotifications)
export default router;
