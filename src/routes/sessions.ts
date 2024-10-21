import express from "express";
import SessionsController from "../controllers/SessionsController";

const router = express.Router();
const sessionsController = new SessionsController();

router
  .get("/", sessionsController.getSessions)
  .post("/:sessionId/logout", sessionsController.logoutSession);

export default router;
