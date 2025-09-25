import { UserModel } from "../models/users.js";
import { completePotchefProfileValidator } from "../validators/users.js";
import axios from "axios";


export const completePotchefProfile = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.auth.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.role !== "potchef") {
            return res.status(400).json({ error: "This endpoint is for potchef profile completion only" });
        }

        // ✅ Prevent re-completion
        if (user.profileCompleted) {
            return res.status(400).json({
                error: "Profile already completed. Use the update endpoint for changes."
            });
        }

        const { error, value } = completePotchefProfileValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { phone, payoutDetails } = value;

        // ✅ Validate phone format
        if (!/^0\d{9}$/.test(phone)) {
            return res.status(422).json({
                error: "Phone number must be a valid 10-digit Ghana number starting with 0"
            });
        }

        user.phone = phone;

        // ✅ Paystack integration
        let paystackSubaccount = null;
        try {
            const subRes = await axios.post(
                "https://api.paystack.co/subaccount",
                {
                    business_name: `${user.firstName} ${user.lastName}`.substring(0, 100),
                    settlement_bank: payoutDetails.bank.bankCode,
                    account_number: payoutDetails.bank.accountNumber,
                    percentage_charge: 15,
                    currency: "GHS"
                },
                {
                    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
                    timeout: 10000
                }
            );
            paystackSubaccount = subRes.data.data.subaccount_code;
        } catch (paystackError) {
            console.error("❌ Paystack subaccount creation failed:", paystackError.response?.data);
            return res.status(400).json({
                error: "Bank account verification failed. Please check your bank details."
            });
        }

        user.payoutDetails = payoutDetails;
        user.paystack = {
            subaccountCode: paystackSubaccount,
            settlementBank: payoutDetails.bank.bankCode,
            accountNumber: payoutDetails.bank.accountNumber,
            percentageCharge: 15
        };

        // ✅ CRITICAL FIX: Explicitly set profileCompleted to true
        user.profileCompleted = true;

        await user.save();

        res.json({
            message: "Profile completed successfully",
            profileCompleted: user.profileCompleted, // Will now be true
            status: user.status, // "pending"
            user: {
                ...user.toObject(),
                password: undefined
            }
        });
    } catch (err) {
        next(err);
    }
};

export const getProfileCompletionStatus = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.auth.id)
            .select("role profileCompleted phone payoutDetails");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let missingFields = [];

        // ✅ Phone is required for both roles
        if (!user.phone || user.phone.trim() === "") {
            missingFields.push("phone number");
        }

        // ✅ Payout details only required for potchefs
        if (user.role === "potchef") {
            if (!user.payoutDetails?.bank?.bankCode || user.payoutDetails.bank.bankCode.trim() === "") {
                missingFields.push("bank code");
            }
            if (!user.payoutDetails?.bank?.accountNumber || user.payoutDetails.bank.accountNumber.trim() === "") {
                missingFields.push("account number");
            }
            if (!user.payoutDetails?.bank?.accountName || user.payoutDetails.bank.accountName.trim() === "") {
                missingFields.push("account name");
            }
        }

        const completionPercentage = user.profileCompleted ? 100 : Math.max(0, 100 - (missingFields.length * 25));

        res.json({
            profileCompleted: user.profileCompleted,
            missingFields,
            completionPercentage,
            requiresAction: user.role === "potchef" && !user.profileCompleted
        });
    } catch (err) {
        next(err);
    }
};

// import { UserModel } from "../models/users.js";
// import { updatePayoutDetailsValidator } from "../validators/users.js";
// import bcrypt from "bcryptjs";
// import axios from "axios";

// export const completeUserProfile = async (req, res, next) => {
//     try {
//         let user;

//         // Handle both temp auth and regular auth
//         if (req.auth.temp) {
//             // Temp token - allow profile completion even if pending
//             user = await UserModel.findById(req.auth.id);
//         } else {
//             // Regular auth - normal flow
//             user = await UserModel.findById(req.auth.id);
//         }

//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         // Potchefs need payout details, potlucky just need basic info
//         if (user.role === "potchef") {
//             console.log("Validating payout details...");

//             // ✅  Validate req.body.payoutDetails instead of req.body
//             const { error, value } = updatePayoutDetailsValidator.validate(req.body.payoutDetails);

//             if (error) {
//                 console.log("Validation error:", error.details);
//                 return res.status(400).json({ error: error.details.map(d => d.message) });
//             }

//             console.log("✅ Validation passed. Value:", value);

//             // Update payout details for potchefs
//             user.payoutDetails = value; // This now gets the validated inner object
//             console.log("Updated user payoutDetails:", user.payoutDetails);

//             // ✅ CREATE PAYSTACK SUBACCOUNT IF NOT EXISTS
//             if (!user.paystack?.subaccountCode) {
//                 try {
//                     const subRes = await axios.post(
//                         "https://api.paystack.co/subaccount",
//                         {
//                             business_name: `${user.firstName} ${user.lastName}`,
//                             settlement_bank: value.bank?.bankCode || value.mobileMoney?.provider,
//                             account_number: value.bank?.accountNumber || value.mobileMoney?.number,
//                             percentage_charge: 15,
//                             currency: "GHS"
//                         },
//                         { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
//                     );

//                     user.paystack = {
//                         subaccountCode: subRes.data.data.subaccount_code,
//                         subaccountId: subRes.data.data.id,
//                         settlementBank: value.bank?.bankCode || value.mobileMoney?.provider,
//                         accountNumber: value.bank?.accountNumber || value.mobileMoney?.number,
//                         percentageCharge: 15 // ← SET TO 15
//                     };
//                 } catch (paystackError) {
//                     console.error("❌ Paystack subaccount creation FAILED:");
//                     console.error("Error:", paystackError.message);
//                     console.error("Response data:", paystackError.response?.data);
//                     console.error("Bank details used:", {
//                         bankCode: value.bank?.bankCode,
//                         accountNumber: value.bank?.accountNumber,
//                         provider: value.mobileMoney?.provider
//                     });

//                     // Preserve existing paystack data or leave undefined
//                     user.paystack = user.paystack || undefined;
//                 }
//             }
//         }

//         // Update basic profile information
//         // Update basic profile information
//         const { phone, password } = req.body || {};

//         // ✅ Handle phone update
//         if (phone !== undefined) {
//             if (phone === null || phone === '') {
//                 user.phone = undefined; // Clear phone if empty
//             } else {
//                 user.phone = phone;
//             }
//         }

//         // ✅ Handle password update  
//         if (password) {
//             user.password = await bcrypt.hash(password, 10);
//             if (user.source === "google") {
//                 user.source = "local";
//             }
//         }

//         // Check if profile is complete based on role
//         if (user.role === "potchef") {
//             user.profileCompleted = !!(user.phone && user.payoutDetails);
//         } else {
//             user.profileCompleted = !!user.phone;
//         }

//         await user.save();

//         res.json({
//             message: "Profile updated successfully",
//             user: { ...user.toObject(), password: undefined }
//         });
//     } catch (err) {
//         next(err);
//     }
// };

// export const getProfileCompletionStatus = async (req, res, next) => {
//     try {
//         const user = await UserModel.findById(req.auth.id)
//             .select("role profileCompleted phone payoutDetails");

//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         let missingFields = [];

//         if (!user.phone) missingFields.push("phone number");

//         if (user.role === "potchef") {
//             if (!user.payoutDetails) {
//                 missingFields.push("payout details");
//             } else {
//                 if (user.payoutDetails.type === "bank") {
//                     if (!user.payoutDetails.bank?.bankCode) missingFields.push("bank code");
//                     if (!user.payoutDetails.bank?.accountNumber) missingFields.push("account number");
//                     if (!user.payoutDetails.bank?.accountName) missingFields.push("account name");
//                 } else if (user.payoutDetails.type === "mobileMoney") {
//                     if (!user.payoutDetails.mobileMoney?.provider) missingFields.push("mobile money provider");
//                     if (!user.payoutDetails.mobileMoney?.number) missingFields.push("mobile money number");
//                 }
//             }
//         }

//         res.json({
//             profileCompleted: user.profileCompleted,
//             missingFields,
//             completionPercentage: user.profileCompleted ? 100 : Math.max(0, 100 - (missingFields.length * 25))
//         });
//     } catch (err) {
//         next(err);
//     }
// };