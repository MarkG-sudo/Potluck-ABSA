import webPush from "web-push";
import { SubscriptionModel } from "../models/subscription.js";

webPush.setVapidDetails(
    "mailto:hello@potluck.africa",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// ✅ Utility to send push notification to a single subscription
export const sendPushNotification = async (sub, payload) => {
    try {
        await webPush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            console.log("Deleting expired subscription:", sub._id);
            await SubscriptionModel.deleteOne({ _id: sub._id });
        } else {
            console.error("Push error:", err);
        }
    }
};

// ✅ Utility to send notification to a specific user
export const sendUserNotification = async (userId, payload) => {
    const subscriptions = await SubscriptionModel.find({ user: userId });
    if (!subscriptions.length) return;

    await Promise.all(
        subscriptions.map(sub => sendPushNotification(sub, payload))
    );
};

export default webPush;
