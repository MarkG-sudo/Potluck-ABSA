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
            enum: ["Pending", "Preparing", "Ready", "Delivering", "Delivered", "Cancelled"],
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
        readyAt: { type: Date, default: null },        
        deliveringAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        paidAt: { type: Date, default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" }

    },
    {
        timestamps: true
    }
);
// ✅ Always auto-populate meal, chef, buyer when querying
function autoPopulate(next) {
    this.populate("meal", "mealName price status")
        .populate("chef", "firstName lastName email")
        .populate("buyer", "firstName lastName email");
    next();
}

mealOrderSchema.pre("find", autoPopulate);
mealOrderSchema.pre("findOne", autoPopulate);
mealOrderSchema.pre("findById", autoPopulate);

mealOrderSchema.plugin(toJSON);

export const MealOrder = model("MealOrder", mealOrderSchema);
