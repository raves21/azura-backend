import express from "express";
import AccountController from "../controllers/AccountController";

const router = express.Router();
const accountController = new AccountController();

router
  .post("/verify-password", accountController.verifyPassword)
  .put("/details", accountController.updateUserDetails)
  .put("/password", accountController.updatePassword)
  .put("/email", accountController.updateEmail)
  .put("/handle", accountController.updateHandle)
  .delete("/account", accountController.deleteAccount);

export default router;
