import { Schema, model } from "mongoose";
import { toJSON } from "@reis/mongoose-to-json";

const userSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address']
    },
    phone: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0\d{9}$/.test(v); // Allow null for Google OAuth users
            },
            message: props => `${props.value} is not a valid Ghanaian phone number!`
        }
    },
    password: {
        type: String,
        minlength: 8,
        required: function () {
            return this.source === "local";
        }
    },
    avatar: { type: String, default: "" },

    // Role and Status
    role: {
        type: String,
        enum: ['potchef', 'potlucky', 'admin'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'active'],
        default: function () {
            return this.role === 'potchef' ? 'pending' : 'active';
        }
    },
    approvedAt: { type: Date },

    // Google OAuth
    googleId: { type: String, sparse: true, index: true },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    source: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },

    // Paystack Integration
    payoutDetails: {
        bank: {
            bankCode: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            accountName: { type: String, trim: true }
        },
        mobileMoney: {
            provider: { type: String, enum: ["mtn", "vodafone", "airteltigo"] },
            number: { type: String, trim: true }
        }
    },
    paystack: {
        subaccountCode: { type: String, trim: true },
        subaccountId: { type: String, trim: true },
        settlementBank: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        percentageCharge: { type: Number, default: 0 }
    },

    // Profile Management
    profileCompleted: {
        type: Boolean,
        default: function () {
            // Potchefs need complete profile, potlucky less stringent
            if (this.role === 'potchef') {
                return !!(this.phone && this.payoutDetails);
            }
            return !!this.phone; // Potlucky only needs phone
        }
    },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Meal" }],

    // Additional useful fields
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 }

}, {
    timestamps: true
});

// Index for better query performance
userSchema.index({ role: 1, status: 1 });

userSchema.plugin(toJSON);

export const UserModel = model('User', userSchema);