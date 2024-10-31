import express from "express";
import AuthController from "../controllers/AuthController";

const router = express.Router();
const authController = new AuthController();

router
  .post("/login", authController.login)
  .post("/signup", authController.signUp)
  .post("/logout", authController.logoutCurrentSession)
  .post("/detached/:sessionId/logout", authController.logoutSession)
  .get("/verify-handle", authController.verifyHandle);

export default router;
