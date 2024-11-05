import express from "express";
import ProfileController from "../controllers/ProfileController";

const router = express.Router();
const profileController = new ProfileController();

router
  .get("/verify-password", profileController.verifyPassword)
  .put("/details", profileController.updateUserDetails)
  .put("/password", profileController.updatePassword)
  .put("/email", profileController.updateEmail);

export default router;
