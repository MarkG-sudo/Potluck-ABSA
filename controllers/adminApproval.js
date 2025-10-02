import { UserModel } from "../models/users.js";
import { sendEmail } from "../utils/mail.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const approveUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;

        // ✅ Validate ID format
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ error: "Invalid action. Use 'approve' or 'reject'." });
        }

        const user = await UserModel.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        // ✅ Check if user is already in final state
        if (user.status === "approved" && action === "approve") {
            return res.status(400).json({ error: "User is already approved" });
        }
        if (user.status === "rejected" && action === "reject") {
            return res.status(400).json({ error: "User is already rejected" });
        }

        // ✅ Prevent approval if payout or subaccount info is incomplete
        if (
            action === "approve" &&
            user.role === "potchef" &&
            (
                !user.payoutDetails?.bank?.accountNumber ||
                !user.payoutDetails?.bank?.bankCode ||
                !user.paystack?.subaccountCode
            )
        ) {
            return res.status(400).json({
                error: "Cannot approve chef. Payout details or Paystack subaccount info is missing."
            });
        }


        // ✅ Prevent approval of incomplete potchefs
        if (action === "approve" && user.role === "potchef" && !user.profileCompleted) {
            return res.status(400).json({
                error: "Cannot approve chef. Profile must be completed with payout details first."
            });
        }

        if (action === "approve") {
            user.status = "approved";
            user.approvedAt = new Date();
            user.approvedBy = req.auth?.id;
            await user.save();

            const populatedUser = await UserModel.findById(user._id).populate('approvedBy', 'firstName lastName email role');

            // ✅ Email sending (your code is perfect)
            const emailTemplatePath = path.join(__dirname, "../utils/account-approved-mail.html");
            if (fs.existsSync(emailTemplatePath)) {
                let html = fs.readFileSync(emailTemplatePath, "utf-8");
                html = html.replace(/{{firstName}}/g, user.firstName);

                await sendEmail({
                    from: {
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: user.email,
                    subject: "✅ Your Potluck account is approved!",
                    html,
                });
            }

            return res.json({
                message: `✅ ${user.firstName}'s account approved.`,
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    profileCompleted: user.profileCompleted,
                    approvedAt: populatedUser.approvedAt,
                    approvedBy: populatedUser.approvedBy
                    
                }
            });
        } else {
            user.status = "rejected";
            user.rejectionNotes = notes;
            await user.save();

            const emailTemplatePath = path.join(__dirname, "../utils/account-rejected-mail.html");
            if (fs.existsSync(emailTemplatePath)) {
                let html = fs.readFileSync(emailTemplatePath, "utf-8");
                html = html.replace(/{{firstName}}/g, user.firstName)
                    .replace(/{{notes}}/g, notes || "No reason provided");

                await sendEmail({
                    from: {
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: user.email,
                    subject: "❌ Your Potluck account application",
                    html,
                });
            }

            return res.json({
                message: `❌ ${user.firstName}'s account has been rejected.`,
                notes: notes
            });
        }

    } catch (err) {
        next(err);
    }
};


// Get all pending users - ✅ Add profileCompleted info for admin dashboard
export const getPendingUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const users = await UserModel.find({ status: "pending" })
            .select("-password")
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await UserModel.countDocuments({ status: "pending" });

        const usersWithCompletion = users.map(user => ({
            ...user,
            canBeApproved: user.role !== "potchef" || user.profileCompleted
        }));

        res.json({
            count: users.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            users: usersWithCompletion
        });
    } catch (err) {
        next(err);
    }
};

// Get users by status
export const getUsersByStatus = async (req, res, next) => {
    try {
        const { status } = req.params;
        const validStatuses = ["pending", "approved", "rejected", "active"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const users = await UserModel.find({ status })
            .select("-password -googleAccessToken -googleRefreshToken");
        res.json({ count: users.length, users });
    } catch (err) {
        next(err);
    }
};

// Get one pending user by ID - ✅ Add profile completion check
export const getPendingUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findOne({ _id: id, status: "pending" })
            .select("-password -googleAccessToken -googleRefreshToken");

        if (!user) {
            return res.status(404).json({ error: "Pending user not found" });
        }

        // ✅ Add approval eligibility info
        const userWithEligibility = {
            ...user.toObject(),
            canBeApproved: user.role !== "potchef" || user.profileCompleted,
            missingRequirements: user.role === "potchef" && !user.profileCompleted
                ? ["Payout details not completed"]
                : []
        };

        res.json(userWithEligibility);
    } catch (err) {
        next(err);
    }
};

// ✅ NEW: Get chefs pending profile completion
export const getChefsPendingProfile = async (req, res, next) => {
    try {
        const users = await UserModel.find({
            role: "potchef",
            status: "pending",
            profileCompleted: false
        }).select("-password -googleAccessToken -googleRefreshToken");

        res.json({
            count: users.length,
            users,
            message: "Chefs waiting for profile completion"
        });
    } catch (err) {
        next(err);
    }
};

// ✅ NEW: Get approval-ready users (can be approved immediately)
export const getApprovalReadyUsers = async (req, res, next) => {
    try {
        const users = await UserModel.find({
            status: "pending",
            $or: [
                { role: { $ne: "potchef" } }, // Non-chefs are always ready
                { role: "potchef", profileCompleted: true } // Chefs with complete profile
            ]
        }).select("-password -googleAccessToken -googleRefreshToken");

        res.json({
            count: users.length,
            users,
            message: "Users ready for immediate approval"
        });
    } catch (err) {
        next(err);
    }
};