-- DropForeignKey
ALTER TABLE "NotificationActor" DROP CONSTRAINT "NotificationActor_actorId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationActor" DROP CONSTRAINT "NotificationActor_notificationId_fkey";

-- AddForeignKey
ALTER TABLE "NotificationActor" ADD CONSTRAINT "NotificationActor_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationActor" ADD CONSTRAINT "NotificationActor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
