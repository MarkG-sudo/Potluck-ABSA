import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const userSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/.+\@.+\..+/, 'Please fill a valid email address'] },
    phone: { type: String, },
    password: { type: String, required: true, minlength: 8 },
    avatar: { type: String, default: "" },
    role: {
        type: String,
        enum: ['potchef', 'potlucky', 'operator', 'admin'],
        required: true
    },
    isApproved: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
   

}, {
    timestamps: true
});
userSchema.plugin(toJSON);

export const UserModel = model('User', userSchema);