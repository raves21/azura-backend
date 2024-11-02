import express from "express";
import NotificationsController from "../controllers/NotificationsController";

const router = express.Router();
const notificationsController = new NotificationsController();

router
  .get("/", notificationsController.getNotifications)
  .put("/:id", notificationsController.updateNotificationIsRead)
  .delete("/:id", notificationsController.deleteNotification)
  .delete("/", notificationsController.deleteAllNotifications);

export default router;
