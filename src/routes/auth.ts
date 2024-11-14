import express from "express";
import AuthController from "../controllers/AuthController";

const router = express.Router();
const authController = new AuthController();

router
  .get("/check-handle-availability", authController.checkHandleAvailabilty)
  .get("/check-email-availability", authController.checkEmailAvailability)
  .get("/forgot-password/find-user-by-email", authController.findUserByEmail)
  .post("/forgot-password/change-password", authController.updatePassword)
  .post("/login", authController.login)
  .post("/signup", authController.signUp)
  .post("/logout", authController.logoutCurrentSession)
  .post("/detached/:sessionId/logout", authController.logoutSession);

export default router;
