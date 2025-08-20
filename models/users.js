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
                return /^0\d{9}$/.test(v); // must start with 0 and have exactly 10 digits
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
    role: {
        type: String,
        enum: ['potchef', 'potlucky', 'admin', 'pending'],
        required: true
    },
    // ✅ Paystack payouts
    payoutDetails: {
        type: {
            type: String,
            enum: ["bank", "momo"],
            required: false
        },
        bankCode: { type: String, trim: true }, // for bank transfers
        accountNumber: { type: String, trim: true }, // bank account or momo number
        momoProvider: { type: String, enum: ["mtn", "vodafone", "airteltigo"], trim: true }, // momo only
    },

    paystackSubaccount: {
        type: String, // ACCT_xxxxxxxx
        trim: true
    },
    isApproved: { type: Boolean, default: false },
    approvedAt: { type: Date },
    profileCompleted: { type: Boolean, default: false },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Meal" }],
    source: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },

}, {
    timestamps: true
});

userSchema.plugin(toJSON);

export const UserModel = model('User', userSchema);
