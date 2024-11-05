import express from "express";
import CronController from "../controllers/CronController";

const router = express.Router();
const cronController = new CronController();

router
  .post("/clear-unused-media", cronController.clearUnusedMedia)
  .post("/clear-expired-otcs", cronController.clearExpiredOtcs);

export default router;
