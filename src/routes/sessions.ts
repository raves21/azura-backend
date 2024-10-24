import express from "express";
import SessionsController from "../controllers/SessionsController";

const router = express.Router();
const sessionsController = new SessionsController();

router
  //get
  .get("/", sessionsController.getSessions)

  //post
  .post("/:sessionId/logout", sessionsController.logoutSession);

export default router;
