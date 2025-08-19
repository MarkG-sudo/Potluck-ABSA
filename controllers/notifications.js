import { SubscriptionModel } from "../models/subscription.js";
import { subscribeValidator } from "../validators/subscribe.js";
import { sendPushNotification, sendUserNotification } from "../utils/push.js";

// ✅ Subscribe to push notifications
export const subscribeToNotifications = async (req, res, next) => {
    try {
        const { error, value } = subscribeValidator.validate(req.body);
        if (error) return res.status(400).json({ error: error.details.map(d => d.message) });

        const existing = await SubscriptionModel.findOne({ endpoint: value.endpoint });

        if (!existing) {
            await SubscriptionModel.create({
                ...value,
                user: req.auth.id
            });
        }

        res.status(201).json({ message: "Subscribed to notifications." });
    } catch (err) {
        next(err);
    }
};

// ✅ Trigger a notification for current user (manual or auto)
export const sendNotification = async (req, res, next) => {
    try {
        const payload = {
            title: "New Update!",
            body: "You’ve got something fresh on Potluck 🍲",
            icon: "/logo-192.png"
        };

        await sendUserNotification(req.auth.id, payload);

        res.json({ message: "Notifications sent." });
    } catch (err) {
        next(err);
    }
};

// ✅ Admin broadcast to ALL users
export const broadcastToAll = async (req, res, next) => {
    try {
        const { title, body, url } = req.body;

        const subscriptions = await SubscriptionModel.find(); // all subs

        await Promise.all(
            subscriptions.map(sub =>
                sendPushNotification(sub, { title, body, url })
            )
        );

        res.json({ message: "Broadcast sent." });
    } catch (err) {
        next(err);
    }
};
