import { UserModel } from "../models/users.js";
import { registerUserValidator, loginUserValidator, updateUserValidator } from "../validators/users.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mail.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hello@potluck.africa";

// export const registerUser = async (req, res) => {
//     try {
//         // ✅ Validate input
//         const { error, value } = registerUserValidator.validate(req.body);
//         if (error) {
//             return res.status(422).json({ error: error.details.map(d => d.message) });
//         }

//         const { firstName, lastName, email, phone, password, role, payoutDetails, source = "local" } = value;

//         const userExists = await UserModel.findOne({ email });
//         if (userExists) {
//             return res.status(400).json({ message: "Email already in use" });
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Determine status based on role - potlucky auto-approved, potchef pending
//         const status = role === "potlucky" ? "active" : "pending";
//         const profileCompleted = role === "potlucky"; // Basic completion for potlucky

//         let paystackSubaccount = null;

//         // ✅ If registering as a Potchef → Create Paystack Subaccount
//         if (role === "potchef" && payoutDetails?.type === "bank") {
//             try {
//                 const subRes = await axios.post(
//                     "https://api.paystack.co/subaccount",
//                     {
//                         business_name: `${firstName} ${lastName}`,
//                         settlement_bank: payoutDetails.bank.bankCode,
//                         account_number: payoutDetails.bank.accountNumber,
//                         percentage_charge: 15,
//                         currency: "GHS"
//                     },
//                     { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
//                 );

//                 paystackSubaccount = subRes.data.data.subaccount_code;
//             } catch (paystackError) {
//                 console.error("Paystack subaccount creation failed:", paystackError.response?.data);
//                 // Still create user but mark as incomplete
//             }
//         }
//         // ✅ Save user with new schema structure
//         const user = await UserModel.create({
//             firstName,
//             lastName,
//             email,
//             phone,
//             password: hashedPassword,
//             role,
//             status: role === "potchef" ? "pending" : "active",
//             profileCompleted: role === "potchef" ? false : true, // Potchef not complete without payout
//             payoutDetails: payoutDetails || null, // Optional
//             paystack: paystackSubaccount ? { subaccountCode: paystackSubaccount } : undefined,
//             source
//         });

//         // ✅ Send email to user
//         const userTemplatePath = path.join(
//             __dirname,
//             `../utils/${role === "potlucky" ? "signup-mail.html" : "pending-approval-mail.html"}`
//         );

//         if (fs.existsSync(userTemplatePath)) {
//             let userEmailHTML = fs.readFileSync(userTemplatePath, "utf-8");
//             userEmailHTML = userEmailHTML.replace(/{{firstName}}/g, firstName);

//             await mailtransporter.sendMail({
//                 from: '"Potluck" <no-reply@potluck.app>',
//                 to: email,
//                 subject: role === "potlucky"
//                     ? "Welcome to Potluck 🎉"
//                     : "Potluck Registration Received - Pending Approval",
//                 html: userEmailHTML,
//             });
//         }

//         // ✅ Notify Admin if potchef registration
//         if (role === "potchef" && process.env.ADMIN_EMAIL) {
//             const adminTemplatePath = path.join(
//                 __dirname,
//                 "../utils/notify-admin-on-user-register.html"
//             );

//             if (fs.existsSync(adminTemplatePath)) {
//                 let adminEmailHTML = fs.readFileSync(adminTemplatePath, "utf-8");
//                 adminEmailHTML = adminEmailHTML
//                     .replace(/{{firstName}}/g, firstName)
//                     .replace(/{{lastName}}/g, lastName)
//                     .replace(/{{email}}/g, email)
//                     .replace(/{{phone}}/g, phone || "Not Provided")
//                     .replace(/{{role}}/g, role);

//                 await mailtransporter.sendMail({
//                     from: '"Potluck Notifications" <no-reply@potluck.app>',
//                     to: ADMIN_EMAIL,
//                     subject: `New ${role} account pending approval`,
//                     html: adminEmailHTML,
//                 });
//             }
//         }

//                const tempToken = jwt.sign(
//             { id: user._id, temp: true }, 
//             process.env.JWT_PRIVATE_KEY,
//             { expiresIn: '1h' } // Short-lived token
//         );

//         res.status(201).json({
//             message: "User registered successfully",
//             user: { ...user.toObject(), password: undefined },
//             tempToken // Send temporary token for profile completion
//         });
//     } catch (err) {
//         console.error("Registration error:", err.response?.data || err.message);
//         res.status(500).json({ message: "Server error", error: err.message });
//     }
// };

// export const signInUser = async (req, res, next) => {
//     try {
//         const { error, value } = loginUserValidator.validate(req.body);
//         if (error) {
//             return res.status(422).json({ error: error.details.map(d => d.message) });
//         }

//         const user = await UserModel.findOne({ email: value.email });
//         if (!user) {
//             return res.status(404).json({ error: "Account does not exist!" });
//         }

//         // ✅ Handle Google auth users trying to use password login
//         if (user.source === "google") {
//             return res.status(403).json({
//                 error: "This account uses Google Sign-In. Please use Google to log in."
//             });
//         }

//         // ✅ Validate password for local users
//         if (!user.password) {
//             return res.status(401).json({ error: "Invalid credentials!" });
//         }

//         const isPasswordCorrect = await bcrypt.compare(value.password, user.password);
//         if (!isPasswordCorrect) {
//             return res.status(401).json({ error: "Invalid credentials!" });
//         }

//         // ✅ Check approval status using new status field
//         if (user.role === "potchef" && user.status !== "approved") {
//             return res.status(403).json({
//                 error: "Your account is pending approval. Please wait for admin verification."
//             });
//         }

//         // ✅ Update last login info
//         user.lastLogin = new Date();
//         user.loginCount = (user.loginCount || 0) + 1;
//         await user.save();

//         // ✅ Generate JWT token
//         const token = jwt.sign(
//             { id: user._id, role: user.role },
//             process.env.JWT_PRIVATE_KEY,
//             { algorithm: "HS256", expiresIn: "24h" }
//         );

//         res.json({
//             message: "Sign In Successful!",
//             accessToken: token,
//             role: user.role,
//             name: user.firstName,
//             userId: user._id
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// export const googleAuthSuccess = async (req, res) => {
//     try {
//         if (!req.user) {
//             return res.status(401).json({ error: "Google authentication failed" });
//         }

//         const user = req.user;

//         // Check if potchef is approved before allowing login
//         if (user.role === "potchef" && user.status !== "approved") {
//             return res.status(403).json({
//                 error: "Your chef account is pending approval. Please wait for admin verification."
//             });
//         }

//         // Update last login info
//         user.lastLogin = new Date();
//         user.loginCount = (user.loginCount || 0) + 1;
//         await user.save();

//         // Generate JWT token for Google-authenticated users
//         const token = jwt.sign(
//             { id: user._id, role: user.role },
//             process.env.JWT_PRIVATE_KEY,
//             { algorithm: "HS256", expiresIn: "24h" }
//         );

//         res.json({
//             message: "Google authentication successful!",
//             accessToken: token,
//             role: user.role,
//             name: user.firstName,
//             userId: user._id
//         });

//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

export const registerUser = async (req, res) => {
    try {
        // ✅ Validate input
        const { error, value } = registerUserValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { firstName, lastName, email, phone, password, role, payoutDetails, source = "local" } = value;

        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // ✅ Only hash password if present (fix for Google users)
        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        // Determine status based on role - potlucky auto-approved, potchef pending
        const status = role === "potlucky" ? "active" : "pending";
        const profileCompleted = role === "potlucky"; // Basic completion for potlucky

        let paystackSubaccount = null;

        // ✅ If registering as a Potchef → Create Paystack Subaccount
        if (role === "potchef" && payoutDetails?.type === "bank") {
            try {
                const subRes = await axios.post(
                    "https://api.paystack.co/subaccount",
                    {
                        business_name: `${firstName} ${lastName}`,
                        settlement_bank: payoutDetails.bank.bankCode,
                        account_number: payoutDetails.bank.accountNumber,
                        percentage_charge: 15,
                        currency: "GHS"
                    },
                    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
                );

                paystackSubaccount = subRes.data.data.subaccount_code;
            } catch (paystackError) {
                console.error("Paystack subaccount creation failed:", paystackError.response?.data);

                // Optional: persist error reason for admin review
                // payoutDetailsError field can be added to schema if needed
            }
        }

        // ✅ Save user with new schema structure
        const user = await UserModel.create({
            firstName,
            lastName,
            email,
            phone,
            ...(hashedPassword ? { password: hashedPassword } : {}), // only set if defined
            role,
            status,
            profileCompleted,
            payoutDetails: payoutDetails || null,
            paystack: paystackSubaccount ? { subaccountCode: paystackSubaccount } : undefined,
            source
        });

        // ✅ Send email to user
        const userTemplatePath = path.join(
            __dirname,
            `../utils/${role === "potlucky" ? "signup-mail.html" : "pending-approval-mail.html"}`
        );

        if (fs.existsSync(userTemplatePath)) {
            let userEmailHTML = fs.readFileSync(userTemplatePath, "utf-8");

            // sanitize / replace placeholder
            userEmailHTML = userEmailHTML.replace(/{{firstName}}/g, firstName || "");

            await sendEmail({
                from: '"Potluck" <no-reply@potluck.app>',
                to: email,
                subject: role === "potlucky"
                    ? "Welcome to Potluck 🎉"
                    : "Potluck Registration Received - Pending Approval",
                html: userEmailHTML,
            });
        }

        // ✅ Notify Admin if potchef registration
        if (role === "potchef" && ADMIN_EMAIL) {
            const adminTemplatePath = path.join(
                __dirname,
                "../utils/notify-admin-on-user-register.html"
            );

            if (fs.existsSync(adminTemplatePath)) {
                let adminEmailHTML = fs.readFileSync(adminTemplatePath, "utf-8");
                adminEmailHTML = adminEmailHTML
                    .replace(/{{firstName}}/g, firstName || "")
                    .replace(/{{lastName}}/g, lastName || "")
                    .replace(/{{email}}/g, email)
                    .replace(/{{phone}}/g, phone || "Not Provided")
                    .replace(/{{role}}/g, role);

                await sendEmail({
                    from: '"Potluck Notifications" <no-reply@potluck.app>',
                    to: ADMIN_EMAIL,
                    subject: `New ${role} account pending approval`,
                    html: adminEmailHTML,
                });
            }
        }

        // ✅ Temp token for profile completion
        const tempToken = jwt.sign(
            { id: user._id, temp: true },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: "User registered successfully",
            user: { ...user.toObject(), password: undefined },
            tempToken
        });
    } catch (err) {
        console.error("Registration error:", err.response?.data || err.message);
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

        // ✅ Handle Google auth users trying to use password login
        if (user.source === "google") {
            return res.status(403).json({
                error: "This account was created via Google Sign-In. Please use Google login or set a password via profile completion."
            });
        }

        // ✅ Validate password for local users
        if (!user.password) {
            return res.status(401).json({ error: "Invalid credentials!" });
        }

        const isPasswordCorrect = await bcrypt.compare(value.password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ error: "Invalid credentials!" });
        }

        // ✅ Check approval status using new status field
        if (user.role === "potchef" && user.status !== "approved") {
            return res.status(403).json({
                error: "Your account is pending approval. Please wait for admin verification."
            });
        }

        // ✅ Update last login info
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // ✅ Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_PRIVATE_KEY,
            { algorithm: "HS256", expiresIn: "24h" }
        );

        res.json({
            message: "Sign In Successful!",
            accessToken: token,
            role: user.role,
            name: user.firstName,
            userId: user._id
        });
    } catch (error) {
        next(error);
    }
};

export const googleAuthSuccess = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Google authentication failed" });
        }

        const user = req.user;

        // ✅ Check if potchef is approved before allowing login
        if (user.role === "potchef" && user.status !== "approved") {
            return res.status(403).json({
                error: "Your chef account is pending approval. Please wait for admin verification."
            });
        }

        // ✅ Update last login info
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // ✅ Generate JWT token for Google-authenticated users
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_PRIVATE_KEY,
            { algorithm: "HS256", expiresIn: "24h" }
        );

        res.json({
            message: "Google authentication successful!",
            accessToken: token,
            role: user.role,
            name: user.firstName,
            userId: user._id
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getOneUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await UserModel.findById(id).select("-password -googleAccessToken -googleRefreshToken").lean();

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
            status, // Use status instead of isApproved
            profileCompleted,
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (profileCompleted !== undefined) {
            filter.profileCompleted = profileCompleted === "true";
        }

        const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const users = await UserModel.find(filter)
            .select("-password -googleAccessToken -googleRefreshToken")
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const totalUsers = await UserModel.countDocuments(filter);

        // Get counts by status and role for admin dashboard
        const statusCounts = await UserModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const roleCounts = await UserModel.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        res.status(200).json({
            page: Number(page),
            limit: Number(limit),
            totalUsers,
            totalPages: Math.ceil(totalUsers / limit),
            users,
            statusCounts,
            roleCounts
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getMyProfile = async (req, res) => {
    try {
        const user = await UserModel.findById(req.auth.id)
            .select("-password -googleAccessToken -googleRefreshToken");

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
        ).select("-password -googleAccessToken -googleRefreshToken");

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