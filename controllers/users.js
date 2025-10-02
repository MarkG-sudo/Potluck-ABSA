import { UserModel } from "../models/users.js";
import { registerUserValidator, loginUserValidator, updateUserValidator, registerAdminValidator, forgotPasswordValidator , resetPasswordValidator } from "../validators/users.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mail.js";
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

        // ✅ Check if user already exists
        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // ✅ Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Create user (schema will auto-set status and profileCompleted)
        const user = await UserModel.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            role,
            source: "local"
        });

        // ✅ Send email to user based on role
        try {
            const userTemplatePath = path.join(
                __dirname,
                `../utils/${role === "potlucky" ? "signup-mail.html" : "pending-approval-mail.html"}`
            );

            if (fs.existsSync(userTemplatePath)) {
                let userEmailHTML = fs.readFileSync(userTemplatePath, "utf-8");
                userEmailHTML = userEmailHTML.replace(/{{firstName}}/g, firstName || "");

                await sendEmail({
                    from: {  
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: email,
                    subject: role === "potlucky"
                        ? "Welcome to Potluck 🎉"
                        : "Potluck Registration Received - Pending Approval",
                    html: userEmailHTML,
                });
            } else {
                console.warn(`Email template not found: ${userTemplatePath}`);
            }
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            // Continue registration even if email fails
        }

        // ✅ Notify Admin if potchef registration
        if (role === "potchef" && ADMIN_EMAIL) {
            try {
                const adminTemplatePath = path.join(__dirname, "../utils/notify-admin-on-user-register.html");

                if (fs.existsSync(adminTemplatePath)) {
                    let adminEmailHTML = fs.readFileSync(adminTemplatePath, "utf-8");
                    adminEmailHTML = adminEmailHTML
                        .replace(/{{firstName}}/g, firstName || "")
                        .replace(/{{lastName}}/g, lastName || "")
                        .replace(/{{email}}/g, email)
                        .replace(/{{phone}}/g, phone || "Not Provided")
                        .replace(/{{role}}/g, role);

                    await sendEmail({
                        from: {
                            name: process.env.SMTP_FROM_NAME,
                            email: process.env.SMTP_FROM_EMAIL
                        },
                        to: ADMIN_EMAIL,
                        subject: `New ${role} account pending approval`,
                        html: adminEmailHTML,
                    });
                } else {
                    console.warn("Admin notification template not found");
                }
            } catch (adminEmailError) {
                console.error("Admin notification email failed:", adminEmailError);
            }
        }

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status,
                profileCompleted: user.profileCompleted
            },
            ...(role === "potchef" && {
                tempToken: jwt.sign(
                    { id: user._id, temp: true, scope: 'profile_completion' },
                    process.env.JWT_PRIVATE_KEY,
                    { expiresIn: '1h' }
                ),
                requiresProfileCompletion: true
            })
        });

    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({
            message: "Registration failed",
            error: process.env.NODE_ENV === 'development' ? err.message : "Internal server error"
        });
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
            return res.status(404).json({ error: "Account does not exist! Email Not found" });
        }

        
        // ✅ Validate password for local users
        if (!user.password) {
            return res.status(401).json({ error: "Invalid credentials!" });
        }

        const isPasswordCorrect = await bcrypt.compare(value.password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ error: "Invalid credentials!. Password is incorrect" });
        }

        // ✅ Check approval status using new status field
        if (user.role === "potchef" && user.status !== "approved") {
            return res.status(403).json({
                error: "Your account is pending approval. Please wait for admin verification."
            });
        }

        // ✅ Generate both tokens (NEW REFRESH TOKEN LOGIC)
        const accessToken = jwt.sign(
            {
                id: user._id,
                role: user.role,
                type: 'access'
            },
            process.env.JWT_PRIVATE_KEY,
            { algorithm: "HS256", expiresIn: '15m' } // 15 minutes for access token
        );

        const refreshToken = jwt.sign(
            {
                id: user._id,
                type: 'refresh',
                tokenVersion: user.tokenVersion || 0 // For invalidation
            },
            process.env.JWT_REFRESH_SECRET,
            { algorithm: "HS256", expiresIn: '7d' } // 7 days for refresh token
        );

        // ✅ Update user login stats
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // ✅ Enhanced response with both tokens (NEW FORMAT)
        res.json({
            message: "Sign In Successful!",
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone:user.phone,
                role: user.role,
                status: user.status,
                profileCompleted: user.profileCompleted
            }
        });
    } catch (error) {
        next(error);
    }
};


// export const googleAuthSuccess = async (req, res) => {
//     try {
//         if (!req.user) {
//             return res.status(401).json({ error: "Google authentication failed" });
//         }

//         const user = req.user;

//         // ✅ Check if potchef is approved before allowing login
//         if (user.role === "potchef" && user.status !== "approved") {
//             return res.status(403).json({
//                 error: "Your chef account is pending approval. Please wait for admin verification."
//             });
//         }

//         // ✅ Update last login info
//         user.lastLogin = new Date();
//         user.loginCount = (user.loginCount || 0) + 1;
//         await user.save();

//         // ✅ Generate JWT token for Google-authenticated users
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
            status,
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
            .select("-password") // ✅ Remove Google token fields (no longer in schema)
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
        const user = await UserModel.findById(req.auth.id).select("-password");

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
        ).select("-password");

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

        // ✅ Update allowed fields (including payoutDetails for potchefs)
        const fieldsToUpdate = ["firstName", "lastName", "phone", "password", "payoutDetails"];
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


export const refreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.headers['x-refresh-token'];

        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token required" });
        }

        const tokens = await refreshAccessToken(refreshToken);

        res.json({
            message: "Token refreshed successfully",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 15 * 60, // 15 minutes
            user: tokens.user
        });

    } catch (error) {
        res.status(401).json({ error: "Token refresh failed: " + error.message });
    }
};


export const registerAdminBySuperAdmin = async (req, res) => {
    try {
        // ✅ Ensure requester is a super admin
        const requester = req.auth; 
        if (!requester || requester.role !== 'superadmin') {
            return res.status(403).json({ message: "Forbidden: Only super admins can create admin accounts" });
        }

        // ✅ Validate input using admin-specific validator
        const { error, value } = registerAdminValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const { firstName, lastName, email, phone, password } = value;

        // ✅ Check if user already exists
        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // ✅ Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Create admin user
        const user = await UserModel.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            role: "admin",
            status: "active",
            source: "created_by_superadmin"
        });

        // ✅ Send welcome email to new admin
        try {
            const adminTemplatePath = path.join(__dirname, "../utils/admin-created-mail.html");

            if (fs.existsSync(adminTemplatePath)) {
                let adminEmailHTML = fs.readFileSync(adminTemplatePath, "utf-8");
                adminEmailHTML = adminEmailHTML.replace(/{{firstName}}/g, firstName || "");

                await sendEmail({
                    from: {
                        name: process.env.SMTP_FROM_NAME,
                        email: process.env.SMTP_FROM_EMAIL
                    },
                    to: email,
                    subject: "Welcome to Potluck Admin Panel",
                    html: adminEmailHTML,
                });
            } else {
                console.warn("Admin welcome template not found");
            }
        } catch (emailError) {
            console.error("Admin welcome email failed:", emailError);
        }

        res.status(201).json({
            message: "Admin account created successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status
            }
        });

    } catch (err) {
        console.error("Admin registration error:", err);
        res.status(500).json({
            message: "Admin registration failed",
            error: process.env.NODE_ENV === 'development' ? err.message : "Internal server error"
        });
    }
};


export const forgotPassword = async (req, res) => {
    try {
        const { error, value } = forgotPasswordValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        const user = await UserModel.findOne({ email: value.email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: "No account found with that email" });
        }

        const resetToken = jwt.sign(
            { id: user._id, type: 'password_reset' },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '30m' }
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        const templatePath = path.join(__dirname, "../utils/reset-password-mail.html");
        if (fs.existsSync(templatePath)) {
            let emailHTML = fs.readFileSync(templatePath, "utf-8");
            emailHTML = emailHTML
                .replace(/{{firstName}}/g, user.firstName || "")
                .replace(/{{resetLink}}/g, resetLink);

            await sendEmail({
                from: {
                    name: process.env.SMTP_FROM_NAME,
                    email: process.env.SMTP_FROM_EMAIL
                },
                to: user.email,
                subject: "Reset Your Potluck Password",
                html: emailHTML
            });
        }

        res.json({ message: "Password reset link sent to your email" });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const resetPassword = async (req, res) => {
    try {
        const { error, value } = resetPasswordValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        let payload;
        try {
            payload = jwt.verify(value.token, process.env.JWT_PRIVATE_KEY);
        } catch (err) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        if (payload.type !== 'password_reset') {
            return res.status(403).json({ error: "Invalid token type" });
        }

        const user = await UserModel.findById(payload.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.password = await bcrypt.hash(value.newPassword, 10);
        await user.save();

        res.json({ message: "Password reset successful" });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};





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
//                 error: "This account was created via Google Sign-In. Please use Google login or set a password via profile completion."
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