import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const mealSchema = new Schema({
    mealName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: {
        type: Number,
        required: true,
        min: 1, // At least 1 GHS
        validate: {
            validator: function (value) {
                return value % 1 === 0 || Number(value.toFixed(2)) === value;
            },
            message: 'Price must be a whole number or have max 2 decimal places'
        }
    },
    servings: { type: Number, required: true, min: 1 },

    // Inventory management
    initialServings: { type: Number, required: true, min: 1 },
    availableServings: { type: Number, min: 0 },
    soldCount: { type: Number, default: 0 },
    isSoldOut: {
        type: Boolean,
        default: false
    },

    category: { type: String, required: true, trim: true },
    cuisine: { type: String, required: true, trim: true },

    spiceLevel: {
        type: String,
        enum: ["Mild", "Medium", "Hot", "Very Hot"],
        required: true,
    },

    dietaryRestrictions: {
        type: [
            {
                type: String,
                enum: [
                    "Vegetarian",
                    "Vegan",
                    "Gluten-Free",
                    "Halal",
                    "Kosher",
                    "Dairy-Free",
                    "Nut-Free",
                    "Pescatarian",
                    "Low-Sodium",
                    "Low-Sugar",
                    "No-Pork",
                    "No-Beef",
                    "No-Shellfish",
                    "Other",
                ],
            },
        ],
        default: [],
    },
    customDietaryRestrictions: {
        type: [String],
        default: [],
    },

    mainIngredients: { type: [String], required: true },

    cookingTime: { type: Number, required: true, min: 1 },
    pickupLocation: { type: String, required: true, trim: true },

    // Enhanced availability with recurring options
    availabilityPattern: {
        type: String,
        enum: ['One-time', 'Daily', 'Weekly', 'Custom'],
        default: 'One-time'
    },
    availableFrom: { type: Date, required: true },
    availableTo: { type: Date, required: true },
    recurringDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    cutoffTime: {
        type: Number,
        default: 2
    }, // Hours before pickup when orders close

    photos: { type: [String], required: true, validate: v => v.length <= 5 },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    status: {
        type: String,
        enum: ["Available", "Unavailable"],
        default: "Available",
    },

    // Enhanced commission with validation
    commissionRate: {
        type: Number,
        default: 0.15,
        min: 0,
        max: 0.5,
        validate: {
            validator: function (value) {
                return value >= 0 && value <= 1;
            },
            message: 'Commission rate must be between 0 and 1'
        }
    },

    // Food safety and compliance
    preparationFacility: {
        type: String,
        enum: ['Home Kitchen', 'Commercial Kitchen', 'Cloud Kitchen'],
        required: true,
        default: 'Home Kitchen'
    },
    foodSafetyCertified: { type: Boolean, default: false },
    certificationNumber: { type: String },
    allergyWarnings: { type: [String], default: [] },
    storageInstructions: { type: String },
    reheatingInstructions: { type: String },

    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

}, {
    timestamps: true,
});

// Virtual for reviews
mealSchema.virtual("reviews", {
    ref: "MealReview",
    localField: "_id",
    foreignField: "meal",
    options: { sort: { createdAt: -1 } },
});

// Auto-calculate soldOut status
mealSchema.methods.updateAvailability = function () {
    this.isSoldOut = this.availableServings <= 0;
    return this.save();
};

// Text search indexes
mealSchema.index({
    mealName: 'text',
    description: 'text',
    mainIngredients: 'text',
    category: 'text',
    cuisine: 'text'
});

// Performance indexes
mealSchema.index({ status: 1, availableFrom: 1, availableTo: 1 });
mealSchema.index({ createdBy: 1, status: 1 });
mealSchema.index({ isSoldOut: 1, status: 1 });
mealSchema.index({ category: 1, cuisine: 1, spiceLevel: 1 });

mealSchema.set("toJSON", { virtuals: true });
mealSchema.plugin(toJSON);

export const MealModel = model("Meal", mealSchema);