import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const mealSchema = new Schema({
    mealName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    servings: { type: Number, required: true, min: 1 },

    category: { type: String, required: true, trim: true },
    cuisine: { type: String, required: true, trim: true },

    spiceLevel: {
        type: String,
        enum: ["Mild", "Medium", "Hot", "Very Hot"],
        required: true,
    },

    dietaryRestrictions: {
        type: [String],
        enum: [
            "Vegetarian",
            "Vegan",
            "Gluten-Free",
            "Halal",
            "Kosher",
            "Dairy-Free",
            "Nut-Free",
        ],
        default: [],
    },

    mainIngredients: { type: [String], required: true },

    cookingTime: { type: Number, required: true, min: 1 }, // in minutes
    pickupLocation: { type: String, required: true, trim: true },

    availableFrom: { type: Date, required: true },
    availableTo: { type: Date, required: true },

    photos: { type: [String], required: true, validate: v => v.length <= 5 },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User", // 👨‍🍳 Chef who created the meal
        required: true,
    },

    status: {
        type: String,
        enum: ["Available", "Unavailable", "Pending", "Approved", "Rejected"],
        default: "Pending",
    },

    // ⭐ Commission rate at meal-level (default 15%)
    commissionRate: { type: Number, default: 0.15 },

    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});

// 🔎 Virtual for reviews
mealSchema.virtual("reviews", {
    ref: "MealReview",
    localField: "_id",
    foreignField: "meal",
    options: { sort: { createdAt: -1 } },
});

mealSchema.set("toJSON", { virtuals: true });

mealSchema.plugin(toJSON);

export const MealModel = model("Meal", mealSchema);











// import { Schema, model } from "mongoose";
// import { toJSON } from "@reis/mongoose-to-json";

// const mealSchema = new Schema({
//     mealName: { type: String, required: true, trim: true },
//     description: { type: String, required: true, trim: true },
//     price: { type: Number, required: true, min: 0 },
//     servings: { type: Number, required: true, min: 1 },

//     category: { type: String, required: true, trim: true },
//     cuisine: { type: String, required: true, trim: true },

//     spiceLevel: {
//         type: String,
//         enum: ["Mild", "Medium", "Hot", "Very Hot"],
//         required: true
//     },

//     dietaryRestrictions: {
//         type: [String],
//         enum: [
//             "Vegetarian",
//             "Vegan",
//             "Gluten-Free",
//             "Halal",
//             "Kosher",
//             "Dairy-Free",
//             "Nut-Free"
//         ],
//         default: []
//     },

//     mainIngredients: { type: [String], required: true },

//     cookingTime: { type: Number, required: true, min: 1 }, // in minutes
//     pickupLocation: { type: String, required: true, trim: true },

//     availableFrom: { type: Date, required: true },
//     availableTo: { type: Date, required: true },

//     photos: { type: [String], required: true, validate: v => v.length <= 5 },

//     createdBy: {
//         type: Schema.Types.ObjectId,
//         ref: "User",
//         required: true
//     },

//     status: {
//         type: String,
//         enum: ["Available", "Unavailable", "Pending", "Approved", "Rejected"],
//         default: "Pending"
//     },

//     averageRating: { type: Number, default: 0 },
//     reviewCount: { type: Number, default: 0 },
    


// }, {
//     timestamps: true
// });
// // Add virtual for all reviews
// mealSchema.virtual('reviews', {
//     ref: 'MealReview', // The model to use
//     localField: '_id', // Find reviews where `localField`
//     foreignField: 'meal', // is equal to `foreignField`
//     options: { sort: { createdAt: -1 } } // Optional: sort reviews
// });

// // Enable virtuals in JSON output
// mealSchema.set('toJSON', { virtuals: true });

// mealSchema.plugin(toJSON);

// export const MealModel = model("Meal", mealSchema);
