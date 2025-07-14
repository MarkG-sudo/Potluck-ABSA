import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const mealOrderSchema = new Schema(
    {
        meal: {
            type: Schema.Types.ObjectId,
            ref: "Meal",
            required: true
        },
        buyer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        chef: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        quantity: {
            type: Number,
            min: 1,
            required: true
        },
        totalPrice: {
            type: Number,
            min: 0,
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Accepted", "Rejected", "Cancelled", "Delivered"],
            default: "Pending"
        },
        pickupTime: {
            type: Date,
            required: true
        },
        notes: {
            type: String,
            trim: true
        },        
        acceptedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" }

    },
    {
        timestamps: true
    }
);

mealOrderSchema.plugin(toJSON);

export const MealOrder = model("MealOrder", mealOrderSchema);
