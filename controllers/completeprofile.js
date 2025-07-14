
import { UserModel } from "../models/users.js";
import { completeProfileValidator } from "../validators/completeProfile.js";

export const updateGoogleUserProfile = async (req, res, next) => {
    try {
        const { error, value } = completeProfileValidator.validate(req.body);
        if (error) return res.status(400).json({ error: error.details.map(d => d.message) });

        const user = await UserModel.findById(req.auth.id);
        if (!user || user.role !== "pending") {
            return res.status(403).json({ error: "Profile update not allowed or already completed." });
        }

        user.role = value.role;
        user.phone = value.phone;
        user.profileCompleted = true;
        user.isApproved = value.role === "potlucky"; // auto-approve only potlucky

        await user.save();

        res.json({ message: "Profile updated", user });
    } catch (err) {
        next(err);
    }
};
