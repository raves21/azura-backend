import express from "express";
import ProfileController from "../controllers/ProfileController";

const router = express.Router();
const profileController = new ProfileController();

router
  .post("/verify-password", profileController.verifyPassword)
  .put("/details", profileController.updateUserDetails)
  .put("/password", profileController.updatePassword)
  .put("/email", profileController.updateEmail)
  .delete("/account", profileController.deleteAccount);

export default router;
