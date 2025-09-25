// models/commissionAudit.js
import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const commissionAuditSchema = new Schema({
    admin: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    meal: {
        type: Schema.Types.ObjectId,
        ref: "Meal"
    },
    chef: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    oldRate: {
        type: Number,
        min: 0,
        max: 1
    },
    newRate: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    reason: {
        type: String,
        maxlength: 500
    },
    changeType: {
        type: String,
        enum: ["manual", "bulk", "automatic"]
    },
    mealsAffected: Number,
    effectiveFrom: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Virtuals for percentage display
commissionAuditSchema.virtual('oldRatePercent').get(function () {
    return this.oldRate ? (this.oldRate * 100).toFixed(1) + '%' : 'N/A';
});

commissionAuditSchema.virtual('newRatePercent').get(function () {
    return (this.newRate * 100).toFixed(1) + '%';
});

// Enable virtuals in JSON output
commissionAuditSchema.set("toJSON", { virtuals: true });

commissionAuditSchema.plugin(toJSON);

export const CommissionModel = model("Commission", commissionAuditSchema);