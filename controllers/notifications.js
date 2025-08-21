import { SubscriptionModel } from "../models/subscription.js";
import { subscribeValidator } from "../validators/subscribe.js";
import { sendPushNotification, sendUserNotification } from "../utils/push.js";
import { NotificationModel } from "../models/notifications.js";
import { UserModel } from "../models/users.js";

// ✅ Get all notifications for the current user (newest first)
export const getNotifications = async (req, res, next) => {
    try {
        const notifications = await NotificationModel.find({ user: req.auth.id })
            .sort({ createdAt: -1 }); // Newest first

        res.json(notifications);
    } catch (err) {
        next(err);
    }
};

// ✅ Get count of UNREAD notifications (for showing a badge on the bell icon)
export const getUnreadCount = async (req, res, next) => {
    try {
        const count = await NotificationModel.countDocuments({
            user: req.auth.id,
            isRead: false
        });
        res.json({ count });
    } catch (err) {
        next(err);
    }
};

// ✅ Mark one notification as read
// Verify the user ID from auth is correct
export const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.auth.id;

    
        // Double-check user exists and is valid
        const userExists = await UserModel.findById(userId);
        if (!userExists) {
            return res.status(401).json({ error: "User not found" });
        }

        const notification = await NotificationModel.findOneAndUpdate(
            { _id: id, user: userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.json(notification);
    } catch (err) {
        next(err);
    }
};
// ✅ Mark all notifications as read
export const markAllAsRead = async (req, res, next) => {
    try {
        await NotificationModel.updateMany(
            { user: req.auth.id, isRead: false },
            { isRead: true }
        );

        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        next(err);
    }
};

// ✅ Delete a notification
export const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;

        const notification = await NotificationModel.findOneAndDelete({
            _id: id,
            user: req.auth.id
        });

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.json({ message: "Notification deleted" });
    } catch (err) {
        next(err);
    }
};

// ✅ Delete ALL notifications for the current user
export const deleteAllNotifications = async (req, res, next) => {
    try {
        // Delete all documents where the user field matches the logged-in user's ID
        const result = await NotificationModel.deleteMany({ user: req.auth.id });

        // result.deletedCount tells us how many documents were deleted
        res.json({
            message: `Successfully deleted ${result.deletedCount} notifications.`
        });

    } catch (err) {
        next(err);
    }
};

// **** Push POP UP

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
// export const sendNotification = async (req, res, next) => {
//     try {
//         const payload = {
//             title: "New Update!",
//             body: "You’ve got something fresh on Potluck 🍲",
//             icon: "/logo-192.png"
//         };

//         await sendUserNotification(req.auth.id, payload);

//         res.json({ message: "Notifications sent." });
//     } catch (err) {
//         next(err);
//     }
// };

// ✅ Admin broadcast to ALL users
// export const broadcastToAll = async (req, res, next) => {
//     try {
//         const { title, body, url } = req.body;

//         const subscriptions = await SubscriptionModel.find(); // all subs

//         await Promise.all(
//             subscriptions.map(sub =>
//                 sendPushNotification(sub, { title, body, url })
//             )
//         );

//         res.json({ message: "Broadcast sent." });
//     } catch (err) {
//         next(err);
//     }
// };



// ✅ Send notification to current user and store in DB
export const sendNotification = async (req, res, next) => {
    try {
        const payload = {
            title: "New Update!",
            body: "You've got something fresh on Potluck 🍲",
            icon: "/logo-192.png",
            url: "/" // Default URL
        };

        // Send push notification
        await sendUserNotification(req.auth.id, payload);

        // Store notification in database
        const notification = new NotificationModel({
            user: req.auth.id,
            title: payload.title,
            body: payload.body,
            url: payload.url,
            type: 'system' // Using 'system' type as per your schema enum
        });

        await notification.save();

        res.json({
            message: "Notification sent and stored.",
            notificationId: notification._id
        });
    } catch (err) {
        next(err);
    }
};

// ✅ Admin broadcast to ALL users and store in DB for each user
export const broadcastToAll = async (req, res, next) => {
    try {
        const { title, body, url = "/" } = req.body;

        // Validate required fields
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required" });
        }

        const subscriptions = await SubscriptionModel.find().populate('user');

        // Send push notifications
        const pushResults = await Promise.allSettled(
            subscriptions.map(sub =>
                sendPushNotification(sub, { title, body, url })
            )
        );

        // Get all unique user IDs from subscriptions
        const userSubscriptions = subscriptions.filter(sub => sub.user);
        const uniqueUserIds = [...new Set(userSubscriptions.map(sub => sub.user._id.toString()))];

        // Store notifications for all users (even those without push subscriptions)
        // If you want to store only for users with subscriptions, use uniqueUserIds
        const allUsers = await UserModel.find({}, '_id'); // Get all user IDs

        const notificationPromises = allUsers.map(user =>
            new NotificationModel({
                user: user._id,
                title,
                body,
                url,
                type: 'system'
            }).save()
        );

        const dbResults = await Promise.allSettled(notificationPromises);

        // Log results for monitoring
        console.log("Broadcast results:", {
            pushNotificationsSent: pushResults.filter(r => r.status === 'fulfilled').length,
            pushNotificationsFailed: pushResults.filter(r => r.status === 'rejected').length,
            notificationsStored: dbResults.filter(r => r.status === 'fulfilled').length,
            storageFailed: dbResults.filter(r => r.status === 'rejected').length
        });

        res.json({
            message: "Broadcast completed.",
            stats: {
                pushSent: pushResults.filter(r => r.status === 'fulfilled').length,
                pushFailed: pushResults.filter(r => r.status === 'rejected').length,
                notificationsStored: dbResults.filter(r => r.status === 'fulfilled').length
            }
        });
    } catch (err) {
        next(err);
    }
};


// ✅ Unsubscribe from push notifications
export const unsubscribeToNotifications = async (req, res, next) => {
    try {
        // 1. Get the endpoint from the request body
        const { endpoint } = req.body;

        // 2. Basic validation: Check if endpoint is provided
        if (!endpoint) {
            return res.status(400).json({ error: "Endpoint is required." });
        }

        // 3. Find and delete the subscription
        //    - Delete by endpoint AND user ID for maximum security and accuracy.
        const result = await SubscriptionModel.findOneAndDelete({
            endpoint: endpoint,
            user: req.auth.id // Ensures a user can only delete their own subscriptions
        });

        // 4. Handle the result
        if (!result) {
            // Nothing was found to delete. This might be ok (idempotent), so we still return a success.
            return res.status(200).json({ message: "Subscription not found or already removed." });
        }

        // 5. Success response
        res.status(200).json({ message: "Unsubscribed from notifications successfully." });

    } catch (err) {
        next(err);
    }
};