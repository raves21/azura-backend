import express from "express";
import CronController from "../controllers/CronController";

const router = express.Router();
const cronController = new CronController();

router
  .delete("/clear-unused-media", cronController.clearUnusedMedia)
  .delete("/clear-expired-otcs", cronController.clearExpiredOtcs);

export default router;
