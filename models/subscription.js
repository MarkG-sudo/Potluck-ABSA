import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const subscriptionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    }
}, { timestamps: true });

subscriptionSchema.plugin(toJSON);

export const SubscriptionModel = model("SubscriptionModel", subscriptionSchema);
