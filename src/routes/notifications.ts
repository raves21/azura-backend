import express from "express";
import NotificationsController from "../controllers/NotificationsController";

const router = express.Router();
const notificationsController = new NotificationsController();

router
  .get("/", notificationsController.getNotifications)
  .get("/unread-notifications", notificationsController.getUnreadNotifsCount)
  .post(
    "/mark-notification-as-read",
    notificationsController.markNotificationAsRead,
  )
  .delete("/:id", notificationsController.deleteNotification)
  .delete("/", notificationsController.deleteAllNotifications)
  .post("/mark-all-as-read", notificationsController.markAllAsRead);

export default router;
