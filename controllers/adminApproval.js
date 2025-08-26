import { UserModel } from "../models/users.js";
import { mailtransporter } from "../utils/mail.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const approveUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ error: "Invalid action. Use 'approve' or 'reject'." });
        }

        const user = await UserModel.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Check current status
        if (user.status === "approved" && action === "approve") {
            return res.status(400).json({ error: "User is already approved" });
        }

        if (user.status === "rejected" && action === "reject") {
            return res.status(400).json({ error: "User is already rejected" });
        }

        // ✅ NEW: Prevent approval of potchefs without complete profile
        if (action === "approve" && user.role === "potchef" && !user.profileCompleted) {
            return res.status(400).json({
                error: "Cannot approve chef. Profile must be completed with payout details first."
            });
        }

        if (action === "approve") {
            // Update user status
            user.status = "approved";
            user.approvedAt = new Date();
            await user.save();

            // 📧 Send approval email
            const emailTemplatePath = path.join(__dirname, "../utils/account-approved-mail.html");
            if (fs.existsSync(emailTemplatePath)) {
                let html = fs.readFileSync(emailTemplatePath, "utf-8");
                html = html.replace(/{{firstName}}/g, user.firstName);

                await mailtransporter.sendMail({
                    from: '"Potluck" <no-reply@potluck.app>',
                    to: user.email,
                    subject: "✅ Your Potluck account is approved!",
                    html,
                });
            }

            return res.json({
                message: `✅ ${user.firstName}'s account approved.`,
                user: { ...user.toObject(), password: undefined }
            });
        } else {
            // Reject action
            user.status = "rejected";
            user.rejectionNotes = notes; // Optional: store rejection reason
            await user.save();

            // 📧 Send rejection email
            const emailTemplatePath = path.join(__dirname, "../utils/account-rejected-mail.html");
            if (fs.existsSync(emailTemplatePath)) {
                let html = fs.readFileSync(emailTemplatePath, "utf-8");
                html = html.replace(/{{firstName}}/g, user.firstName)
                    .replace(/{{notes}}/g, notes || "No reason provided");

                await mailtransporter.sendMail({
                    from: '"Potluck" <no-reply@potluck.app>',
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
        const users = await UserModel.find({ status: "pending" })
            .select("-password -googleAccessToken -googleRefreshToken")
            .lean(); // Use lean for better performance

        // ✅ Add profile completion status for admin UI
        const usersWithCompletion = users.map(user => ({
            ...user,
            canBeApproved: user.role !== "potchef" || user.profileCompleted
        }));

        res.json({
            count: users.length,
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