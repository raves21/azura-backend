import express from "express";
import OTCController from "../controllers/OTCController";

const router = express.Router();
const otcController = new OTCController();

router
  .post("/send", otcController.sendOTC)
  .get("/verify", otcController.verifyOTC);

export default router;
