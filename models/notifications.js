import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const notificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    url: {
        type: String,
        default: "/"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ['order', 'system', 'promo'],
        default: 'order'
    }
}, {
    timestamps: true // This adds `createdAt` and `updatedAt`
});

// ✅ Create a TTL Index that deletes documents 7 days (604800 seconds) after `createdAt`
notificationSchema.index({ "createdAt": 1 }, { expireAfterSeconds: 604800 });

notificationSchema.plugin(toJSON);

export const NotificationModel = model('Notification', notificationSchema);