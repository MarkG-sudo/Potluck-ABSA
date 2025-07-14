import { Schema, model } from "mongoose";

const mealReviewSchema = new Schema({
    meal: { type: Schema.Types.ObjectId, ref: "Meal", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Prevent duplicate reviews
mealReviewSchema.index({ meal: 1, reviewer: 1 }, { unique: true });

export const MealReview = model("MealReview", mealReviewSchema);
