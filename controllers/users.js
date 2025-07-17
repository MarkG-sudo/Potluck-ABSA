import { UserModel } from "../models/users.js";
import { registerUserValidator, loginUserValidator, updateUserValidator } from "../validators/users.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mailtransporter } from "../utils/mail.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hello@potluck.africa";

export const registerUser = async (req, res) => {
    try {
        // ✅ Validate input
        const { error, value } = registerUserValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { firstName, lastName, email, phone, password, role } = value;

        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine if role is potlucky (self-approved) or needs manual approval
        const isPotlucky = role === "potlucky";
        const isApproved = isPotlucky;
        const profileCompleted = isPotlucky;

        const user = await UserModel.create({
            firstName,
            lastName,
            email,
            phone,
            password: hashedPassword,
            role,
            isApproved,
            profileCompleted,
        });

        // Select email template path
        const userTemplatePath = path.join(
            __dirname,
            `../utils/${isPotlucky ? "signup-mail.html" : "pending-approval-mail.html"}`
        );

        let userEmailHTML = fs.readFileSync(userTemplatePath, "utf-8");
        userEmailHTML = userEmailHTML.replace(/{{firstName}}/g, firstName);

        // Send email to user
        await mailtransporter.sendMail({
            from: '"Potluck" <no-reply@potluck.app>',
            to: email,
            subject: isPotlucky
                ? "Welcome to Potluck 🎉"
                : "Potluck Registration Received - Pending Approval",
            html: userEmailHTML,
        });

        // Notify Admin if role requires manual approval
        if (!isPotlucky) {
            const adminTemplatePath = path.join(
                __dirname,
                "../utils/notify-admin-on-user-register.html"
            );
            let adminEmailHTML = fs.readFileSync(adminTemplatePath, "utf-8");

            adminEmailHTML = adminEmailHTML
                .replace(/{{firstName}}/g, firstName)
                .replace(/{{lastName}}/g, lastName)
                .replace(/{{email}}/g, email)
                .replace(/{{phone}}/g, phone || "Not Provided")
                .replace(/{{role}}/g, role);

            await mailtransporter.sendMail({
                from: '"Potluck Notifications" <no-reply@potluck.app>',
                to: process.env.ADMIN_EMAIL, // ✅ Use env variable
                subject: `New ${role} account pending approval`,
                html: adminEmailHTML,
            });
        }

        res.status(201).json({ message: "User registered successfully", user });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
export const signInUser = async (req, res, next) => {
    try {
        const { error, value } = loginUserValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const user = await UserModel.findOne({ email: value.email });
        if (!user) {
            return res.status(404).json({ error: "Account does not exist!" });
        }

        const isPasswordCorrect = await bcrypt.compare(value.password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ error: "Invalid credentials!" });
        }

        // ✅ Block unapproved potchef or operator accounts
        const rolesRequiringApproval = ["potchef", "franchisee"];
        if (rolesRequiringApproval.includes(user.role) && !user.isApproved) {
            return res.status(403).json({
                error: "Your account is pending approval. Please wait for admin verification."
            });
        }

        // ✅ Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_PRIVATE_KEY,
            {
                algorithm: "HS256",
                expiresIn: "24h"
            }
        );

        res.json({
            message: "Sign In Successful!",
            accessToken: token,
            role: user.role,
            name: user.firstName
        });
    } catch (error) {
        next(error);
    }
};

export const getOneUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await UserModel.findById(id).select("-password").lean();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const getAllUsers = async (req, res) => {
    try {
        const {
            role,
            profileCompleted,
            isApproved,
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};
        if (role) filter.role = role;
        if (profileCompleted !== undefined)
            filter.profileCompleted = profileCompleted === "true";
        if (isApproved !== undefined)
            filter.isApproved = isApproved === "true";

        const sort = {
            [sortBy]: sortOrder === "asc" ? 1 : -1
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const users = await UserModel.find(filter)
            .select("-password")
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const totalUsers = await UserModel.countDocuments(filter);

        const roleCounts = await UserModel.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        const roleSummary = {};
        roleCounts.forEach(r => {
            roleSummary[r._id] = r.count;
        });

        res.status(200).json({
            page: Number(page),
            limit: Number(limit),
            totalUsers,
            totalPages: Math.ceil(totalUsers / limit),
            users,
            roleCounts: roleSummary
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getMyProfile = async (req, res) => {
    try {
        const user = await UserModel.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateAvatar = async (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ message: "No avatar uploaded" });
        }

        const avatarUrl = req.file.path;

        const user = await UserModel.findByIdAndUpdate(
            req.auth.id,
            { avatar: avatarUrl },
            { new: true }
        );  

        res.status(200).json({ message: "Avatar updated", user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const deleteUser = async (req, res) => {
    try {
        await UserModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "User deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { error, value } = updateUserValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const user = await UserModel.findById(req.auth.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ If password is being updated, hash it
        if (value.password) {
            value.password = await bcrypt.hash(value.password, 10);
        }

        // ✅ Update avatar if file was uploaded
        if (req.file && req.file.path) {
            user.avatar = req.file.path;
        }

        // ✅ Update allowed text fields
        const fieldsToUpdate = ["firstName", "lastName", "phone", "password"];
        for (const field of fieldsToUpdate) {
            if (value[field] !== undefined) {
                user[field] = value[field];
            }
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: { ...user.toObject(), password: undefined }
        });
    } catch (err) {
        next(err);
    }
};