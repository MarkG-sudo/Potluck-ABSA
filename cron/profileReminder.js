import cron from "node-cron";
import { UserModel } from "../models/users.js";
import { sendProfileCompletionReminder } from "../controllers/completeprofile.js"; 

export const startProfileReminderJob = () => {
    cron.schedule("*/30 * * * *", async () => {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const users = await UserModel.find({
            role: "potchef",
            profileCompleted: false,
            createdAt: { $lt: fifteenMinutesAgo },
            $or: [
                { lastReminderSentAt: { $lt: fiveMinutesAgo } },
                { lastReminderSentAt: { $exists: false } }
            ]
        });

        for (const user of users) {
            try {
                await sendProfileCompletionReminder({ params: { userId: user._id } }, { json: () => { } });
                console.log(`📬 Reminder sent to ${user.email} at ${new Date().toISOString()}`);
            } catch (err) {
                console.error(`❌ Failed to send reminder to ${user.email}:`, err.message);
            }
        }
    });
};