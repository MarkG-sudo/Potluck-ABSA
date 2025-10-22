import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const mealOrderSchema = new Schema(
    {
        meal: {
            type: Schema.Types.ObjectId,
            ref: "Meal",
            required: true,
        },
        buyer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        chef: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        quantity: {
            type: Number,
            min: 1,
            required: true,
        },
        totalPrice: {
            type: Number,
            min: 0,
            required: true,
        },
        status: {
            type: String,
            enum: [
                "Pending",
                "Preparing",
                "Ready",
                "Delivering",
                "Delivered",
                "Cancelled",
            ],
            default: "Pending",
        },
        pickupTime: {
            type: Date,
            required: true,
        },
        notes: { type: String, trim: true },

        // 💰 Commission + earnings snapshot
        commissionRate: { type: Number, default: 0.15 },
        commission: { type: Number, min: 0 },
        vendorEarnings: { type: Number, min: 0 },
        platformEarnings: { type: Number, min: 0 },

        payment: {
            method: {
                type: String,
                enum: ["card", "momo", "bank", "cash"],
                required: true,
            },

                    status: {
                type: String,
                enum: ["pending", "paid", "failed"],
                default: "pending",
            },
            reference: { type: String },
            transactionId: { type: String }, // Paystack transaction ID
            channel: { type: String }, // card | bank | mobile_money
            metadata: { type: Schema.Types.Mixed }, // raw Paystack response if needed
        },

        notifiedPaid: { type: Boolean, default: false },

        acceptedAt: { type: Date, default: null },
        readyAt: { type: Date, default: null },
        deliveringAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        cancelReason: { type: String, trim: true },
        paidAt: { type: Date, default: null },

        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// ✅ Auto-populate meal, chef, buyer
function autoPopulate(next) {
    if (!this._mongooseOptions.populate) {
        this.populate("meal", "mealName price status")
            .populate("chef", "firstName lastName email")
            .populate("buyer", "firstName lastName phone email"); // 🔑 include email
    }
    next();
}

mealOrderSchema.pre("find", autoPopulate);
mealOrderSchema.pre("findOne", autoPopulate);
mealOrderSchema.pre("findById", autoPopulate);

mealOrderSchema.plugin(toJSON);

export const MealOrder = model("MealOrder", mealOrderSchema);
















// import { Schema, model } from "mongoose";
// import { toJSON } from "@reis/mongoose-to-json";

// const mealOrderSchema = new Schema(
//     {
//         meal: {
//             type: Schema.Types.ObjectId,
//             ref: "Meal",
//             required: true
//         },
//         buyer: {
//             type: Schema.Types.ObjectId,
//             ref: "User",
//             required: true
//         },
//         chef: {
//             type: Schema.Types.ObjectId,
//             ref: "User",
//             required: true
//         },
//         quantity: {
//             type: Number,
//             min: 1,
//             required: true
//         },
//         totalPrice: {
//             type: Number,
//             min: 0,
//             required: true
//         },
//         status: {
//             type: String,
//             enum: ["Pending", "Preparing", "Ready", "Delivering", "Delivered", "Cancelled"],
//             default: "Pending"
//         },
//         pickupTime: {
//             type: Date,
//             required: true
//         },
//         notes: {
//             type: String,
//             trim: true
//         },  
//         commission: { type: Number, min: 0 },        // 15% fee
//         vendorEarnings: { type: Number, min: 0 },   // after commission
//         platformEarnings: { type: Number, min: 0 }, // commission stored for platform reporting ✅
        
//         payment: {
//             method: { type: String, enum: ["card", "momo", "bank", "cash"], required: true },
//             status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
//             reference: { type: String },
//             transactionId: { type: String },   // 🔹 Paystack transaction ID
//             channel: { type: String },         // 🔹 "card", "bank", "mobile_money"
//         },

//         acceptedAt: { type: Date, default: null },
//         readyAt: { type: Date, default: null },        
//         deliveringAt: { type: Date, default: null },
//         deliveredAt: { type: Date, default: null },
//         cancelledAt: { type: Date, default: null },
//         paidAt: { type: Date, default: null },
//         updatedBy: { type: Schema.Types.ObjectId, ref: "User" }

//     },
//     {
//         timestamps: true
//     }
// ); 
// function autoPopulate(next) {
//     // Only apply default population if no specific population was requested
//     if (!this._mongooseOptions.populate) {
//         this.populate("meal", "mealName price status")
//             .populate("chef", "firstName lastName email")
//             .populate("buyer", "firstName lastName phone");
//     }
//     next();
// }
// // ✅ Always auto-populate meal, chef, buyer when querying
// // function autoPopulate(next) {
// //     this.populate("meal", "mealName price status")
// //         .populate("chef", "firstName lastName email")
// //         .populate("buyer", "firstName lastName phone email");
// //     next();
// // }

// mealOrderSchema.pre("find", autoPopulate);
// mealOrderSchema.pre("findOne", autoPopulate);
// mealOrderSchema.pre("findById", autoPopulate);

// mealOrderSchema.plugin(toJSON);

// export const MealOrder = model("MealOrder", mealOrderSchema);
