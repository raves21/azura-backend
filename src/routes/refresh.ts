import express from "express";
import RefreshTokenController from "../controllers/RefreshTokenController";

const router = express.Router();
const refreshTokenController = new RefreshTokenController();

router.get("/", refreshTokenController.grantNewAccessToken);

export default router;
