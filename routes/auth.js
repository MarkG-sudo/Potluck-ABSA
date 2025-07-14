import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const gAuthRouter = Router();

// 🔗 Step 1: Redirect user to Google for authentication
gAuthRouter.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// 🔁 Step 2: Google OAuth callback
// ✅ FIXED: added `async (req, res)` inside passport callback
gAuthRouter.get("/auth/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login`,
    }),
    async (req, res) => {
        try {
            if (!req.user.isApproved) {
                return res.redirect(`${process.env.FRONTEND_URL}/pending?status=awaiting-approval`);
            }

            const token = jwt.sign(
                { id: req.user._id, role: req.user.role },
                process.env.JWT_PRIVATE_KEY,
                { algorithm: "HS256", expiresIn: "24h" }
            );

            return res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
        } catch (err) {
            console.error("OAuth error:", err);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=OAuthFailed`);
        }
    }
);

export default gAuthRouter;
