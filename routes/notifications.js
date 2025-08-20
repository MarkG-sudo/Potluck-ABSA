import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { subscribeToNotifications, sendNotification, broadcastToAll, unsubscribeToNotifications } from "../controllers/notifications.js";

const notificationRouter = Router();

notificationRouter.post("/subscribe", isAuthenticated, subscribeToNotifications);
notificationRouter.post("/notify", isAuthenticated, sendNotification); // for testing

notificationRouter.post("/broadcast",  isAuthenticated, isAdmin,  broadcastToAll);

notificationRouter.post("/unsubscribe", isAuthenticated, unsubscribeToNotifications);




export default notificationRouter;
