import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { subscribeToNotifications, sendNotification, broadcastToAll, unsubscribeToNotifications, getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } from "../controllers/notifications.js";

const notificationRouter = Router();

// FOR SYSTEM PUSH POP UP

notificationRouter.post("/subscribe", isAuthenticated, subscribeToNotifications);
notificationRouter.post("/notify", isAuthenticated, sendNotification); // for testing

notificationRouter.post("/broadcast",  isAuthenticated, isAdmin,  broadcastToAll);

notificationRouter.post("/unsubscribe", isAuthenticated, unsubscribeToNotifications);

// FOR Bell NOTIFICATION ICON
notificationRouter.get("/notifications", isAuthenticated, getNotifications);
notificationRouter.get("/notifications/count", isAuthenticated, getUnreadCount);
notificationRouter.patch("/notifications/:id/read", isAuthenticated, markAsRead);
notificationRouter.patch("/notifications/read-all", isAuthenticated, markAllAsRead);
notificationRouter.delete("/notifications/:id/delete", isAuthenticated, deleteNotification);
notificationRouter.delete("/notifications/delete-all", isAuthenticated, deleteAllNotifications); 




export default notificationRouter;
