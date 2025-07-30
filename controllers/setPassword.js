import bcrypt from "bcryptjs";
import { UserModel } from "../models/users.js";
import { setPasswordValidator } from "../validators/setPassword.js";

export const setPassword = async (req, res, next) => {
    try {
        const { error, value } = setPasswordValidator.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details.map(d => d.message) });
        }

        const user = await UserModel.findById(req.auth.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.source !== "google") {
            return res.status(403).json({ error: "This feature is only for Google-authenticated users." });
        }

        // Hash and save new password
        user.password = await bcrypt.hash(value.password, 10);
        user.source = "local"; // switch to allow local login
        await user.save();

        res.json({ message: "✅ Password set successfully. You can now log in with email & password." });
    } catch (err) {
        next(err);
    }
};
