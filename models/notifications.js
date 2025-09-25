import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const notificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            // Required only for user-specific notifications
            return this.scope === 'user';
        }
    },
    scope: {
        type: String,
        enum: ['user', 'admin', 'system'],
        required: true,
        default: 'user'
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
        enum: ['order', 'system', 'promo', 'payment', 'security', 'transfer'],
        default: 'order'
    }
}, {
    timestamps: true // This adds `createdAt` and `updatedAt`
});

// ✅ Create a TTL Index that deletes documents 7 days (604800 seconds) after `createdAt`
notificationSchema.index({ "createdAt": 1 }, { expireAfterSeconds: 604800 });

notificationSchema.plugin(toJSON);

export const NotificationModel = model('Notification', notificationSchema);