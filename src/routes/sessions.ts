import express from "express";
import SessionsController from "../controllers/SessionsController";

const router = express.Router();
const sessionsController = new SessionsController();

router
  //get
  .get("/", sessionsController.getSessions)

  //post
  .post(
    "/sessions-except-current/logout",
    sessionsController.logoutSessionsExceptCurrent
  )
  .post("/:sessionId/logout", sessionsController.logoutSession);

export default router;
