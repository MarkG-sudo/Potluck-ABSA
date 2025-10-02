import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema({
    event: { type: String, required: true },
    reference: { type: String },
    payload: { type: Object, required: true },
    receivedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    source: { type: String, default: "paystack" },
    notes: { type: String }
});

export const WebhookLogModel = mongoose.model("WebhookLog", webhookLogSchema);
