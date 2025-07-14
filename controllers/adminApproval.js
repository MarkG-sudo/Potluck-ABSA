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
        const { action } = req.body;

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ error: "Invalid action. Use 'approve' or 'reject'." });
        }

        const user = await UserModel.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.isApproved && action === "approve") {
            return res.status(400).json({ error: "User is already approved" });
        }

        if (action === "approve") {
            user.isApproved = true;
            user.approvedAt = new Date();
            await user.save();

            // 📧 Send approval email
            const emailTemplatePath = path.join(__dirname, "../utils/account-approved-mail.html");
            let html = fs.readFileSync(emailTemplatePath, "utf-8");
            html = html.replace(/{{firstName}}/g, user.firstName);

            await mailtransporter.sendMail({
                from: '"Potluck" <no-reply@potluck.app>',
                to: user.email,
                subject: "✅ Your Potluck account is approved!",
                html,
            });

            return res.json({ message: `✅ ${user.firstName}'s account approved.` });
        } else {
            await UserModel.findByIdAndDelete(id);
            return res.json({ message: `❌ ${user.firstName}'s registration has been rejected and deleted.` });
        }

    } catch (err) {
        next(err);
    }
};

// Get all pending users
export const getPendingUsers = async (req, res, next) => {
    try {
        const users = await UserModel.find({ isApproved: false }).select("-password");
        res.json({ count: users.length, users });
    } catch (err) {
        next(err);
    }
};

// Get one pending user by ID
export const getPendingUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findOne({ _id: id, isApproved: false }).select("-password");

        if (!user) {
            return res.status(404).json({ error: "Pending user not found" });
        }

        res.json(user);
    } catch (err) {
        next(err);
    }
};