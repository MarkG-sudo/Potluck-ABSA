import { UserModel } from "../models/users.js";
import { completePotchefProfileValidator } from "../validators/users.js";
import axios from "axios";


// export const completePotchefProfile = async (req, res, next) => {
//     try {
//         const user = await UserModel.findById(req.auth.id);

//         if (!user) {
//             return res.status(404).json({ error: "User not found" });
//         }

//         if (user.role !== "potchef") {
//             return res.status(400).json({ error: "This endpoint is for potchef profile completion only" });
//         }

//         if (user.profileCompleted) {
//             return res.status(400).json({
//                 error: "Profile already completed. Use the update endpoint for changes."
//             });
//         }

//         const { error, value } = completePotchefProfileValidator.validate(req.body);
//         if (error) {
//             return res.status(422).json({ error: error.details.map(d => d.message) });
//         }

//         const { phone, payoutDetails } = value;

//         // ✅ Only update phone if provided (otherwise keep existing one)
//         if (phone && phone.trim() !== '') {
//             // Validate phone format if provided
//             if (!/^0\d{9}$/.test(phone)) {
//                 return res.status(422).json({
//                     error: "Phone number must be a valid 10-digit Ghana number starting with 0"
//                 });
//             }
//             user.phone = phone;
//         }

//         // ✅ Paystack integration
//         let paystackSubaccount = null;
//         try {
//             const subRes = await axios.post(
//                 "https://api.paystack.co/subaccount",
//                 {
//                     business_name: `${user.firstName} ${user.lastName}`.substring(0, 100),
//                     settlement_bank: payoutDetails.bank.bankCode,
//                     account_number: payoutDetails.bank.accountNumber,
//                     percentage_charge: 15,
//                     currency: "GHS"
//                 },
//                 {
//                     headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
//                     timeout: 10000
//                 }
//             );
//             paystackSubaccount = subRes.data.data.subaccount_code;
//         } catch (paystackError) {
//             console.error("❌ Paystack subaccount creation failed:", paystackError.response?.data);
//             return res.status(400).json({
//                 error: paystackError.response?.data?.message || "Bank account verification failed."

//             });
//         }

//         user.payoutDetails = payoutDetails;
//         user.paystack = {
//             subaccountCode: paystackSubaccount,
//             settlementBank: payoutDetails.bank.bankCode,
//             accountNumber: payoutDetails.bank.accountNumber,
//             percentageCharge: 15
//         };

//         // ✅ Explicitly set profileCompleted to true
//         user.profileCompleted = true;

//         // ✅ Timestamp the completion
//         user.profileCompletedAt = new Date();

//         await user.save();
        

//         res.json({
//             message: "Profile completed successfully.Your account is now pending approval",
//             profileCompleted: user.profileCompleted,
//             status: user.status,
//             user: {
//                 id: user._id,
//                 firstName: user.firstName,
//                 lastName: user.lastName,
//                 email: user.email,
//                 role: user.role,
//                 password: undefined
//             }
//         });
//     } catch (err) {
//         next(err);
//     }
// };


export const completePotchefProfile = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.auth.id);

        if (!user) {
            return res.status(404).json({
                status: "profile_completion_failed",
                reason: "user_not_found",
                error: "User not found"
            });
        }

        if (user.role !== "potchef") {
            return res.status(400).json({
                status: "profile_completion_failed",
                reason: "invalid_role",
                error: "This endpoint is for potchef profile completion only"
            });
        }

        if (user.profileCompleted) {
            return res.status(400).json({
                status: "profile_completion_failed",
                reason: "already_completed",
                error: "Profile already completed. Use the update endpoint for changes."
            });
        }

        // ✅ Enforce 15-minute completion window
        const now = new Date();
        const registeredAt = new Date(user.createdAt);
        const diffMinutes = (now - registeredAt) / (1000 * 60);
        if (diffMinutes > 15) {
            return res.status(403).json({
                status: "profile_completion_failed",
                reason: "expired_window",
                error: "Profile completion window has expired. Please request a new link."
            });
        }

        const { error, value } = completePotchefProfileValidator.validate(req.body);
        if (error) {
            user.profileCompletionAttempts = (user.profileCompletionAttempts || 0) + 1;
            user.lastProfileAttemptAt = new Date();
            await user.save();

            return res.status(422).json({
                status: "profile_completion_failed",
                reason: "validation_error",
                error: error.details.map(d => d.message)
            });
        }


        const { phone, payoutDetails } = value;

        if (phone && phone.trim() !== '') {
            if (!/^0\d{9}$/.test(phone)) {
                return res.status(422).json({
                    status: "profile_completion_failed",
                    reason: "invalid_phone_format",
                    error: "Phone number must be a valid 10-digit Ghana number starting with 0"
                });
            }
            user.phone = phone;
        }

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
                status: "profile_completion_failed",
                reason: "paystack_error",
                error: paystackError.response?.data?.message || "Bank account verification failed."
            });
        }

        user.payoutDetails = payoutDetails;
        user.paystack = {
            subaccountCode: paystackSubaccount,
            settlementBank: payoutDetails.bank.bankCode,
            accountNumber: payoutDetails.bank.accountNumber,
            percentageCharge: 15
        };

        user.profileCompleted = true;
        user.profileCompletedAt = new Date();

        await user.save();

        res.json({
            message: "Profile completed successfully. Your account is now pending approval",
            profileCompleted: user.profileCompleted,
            status: user.status,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                password: undefined
            }
        });
    } catch (paystackError) {
        const paystackData = paystackError.response?.data;

        const paystackMessage = paystackData?.message || "Paystack error occurred";
        const paystackStatus = paystackData?.status || null;

        let reason = "paystack_error";
        if (paystackMessage.toLowerCase().includes("bank")) {
            reason = "bank_verification_failed";
        } else if (paystackMessage.toLowerCase().includes("subaccount")) {
            reason = "subaccount_creation_failed";
        }

        console.error("❌ Paystack error:", paystackData);

        return res.status(400).json({
            status: "profile_completion_failed",
            reason,
            error: paystackMessage,
            paystackStatus
        });
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


export const sendProfileCompletionReminder = async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Find the user
        const user = await UserModel.findById(userId);
        if (!user || user.role !== "potchef" || user.profileCompleted) {
            return res.status(400).json({ error: "Invalid user for profile completion reminder" });
        }

        // 2. Rate-limit reminders (5-minute cooldown)
        const now = Date.now();
        const lastSent = new Date(user.lastReminderSentAt || 0).getTime();
        if (now - lastSent < 5 * 60 * 1000) {
            return res.status(429).json({ error: "Reminder already sent recently. Please wait." });
        }

        // 3. Generate a new temp token (24-hour expiry)
        const tempToken = jwt.sign(
            { id: user._id, temp: true, scope: 'profile_completion' },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '24h' }
        );

        // 4. Generate the magic link
        const completionLink = `${process.env.FRONTEND_URL}/complete-profile?token=${tempToken}`;

        // 5. Load and personalize the email template
        const reminderTemplatePath = path.join(__dirname, "../utils/profile-completion-reminder.html");
        if (fs.existsSync(reminderTemplatePath)) {
            let reminderHTML = fs.readFileSync(reminderTemplatePath, "utf-8");
            reminderHTML = reminderHTML
                .replace(/{{firstName}}/g, user.firstName || "")
                .replace(/{{completionLink}}/g, completionLink)
                .replace(/{{expiryNotice}}/g, "This link will expire in 24 hours.");

            await sendEmail({
                from: { name: process.env.SMTP_FROM_NAME, email: process.env.SMTP_FROM_EMAIL },
                to: user.email,
                subject: "Complete Your Potchef Profile 📝",
                html: reminderHTML,
            });
        }

        // 6. Track reminder metadata
        user.lastReminderSentAt = new Date();
        user.reminderCount = (user.reminderCount || 0) + 1;
        await user.save();

        res.json({ message: "Profile completion reminder sent successfully" });

    } catch (err) {
        console.error("Reminder error:", err);
        res.status(500).json({ error: "Failed to send reminder" });
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