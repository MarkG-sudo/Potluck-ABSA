import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const franchiseeSchema = new Schema({
    businessName: { type: String, required: true },
    contactPerson: { type: String },
    contactNumber: {
        type: String,
        required: true,
        match: [/^0\d{9}$/, 'Must be a valid 10-digit Ghanaian number']
    },
    locationAddress: { type: String, required: true },
    googleMapsLink: { type: String, required: true },
    images: [{ type: String }], // Cloudinary URLs
    operatingHours: {
        open: { type: String },  // "08:00"
        close: { type: String }  // "21:00"
    },
    description: { type: String },
    isPublished: { type: Boolean, default: true }
}, { timestamps: true });

franchiseeSchema.plugin(toJSON);
export const FranchiseeModel = model("Franchisee", franchiseeSchema);
