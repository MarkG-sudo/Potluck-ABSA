import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const gAuthRouter = Router();


// Add this to your router for testing purposes only
gAuthRouter.get("/auth/google/test", (req, res) => {
    // Simulate what Passport would add to req.user
    req.user = {
        _id: "test_user_id_123",
        email: "test@example.com",
        isApproved: true,
        role: "user"
    };

    // Now call your callback logic manually
    const token = jwt.sign(
        {
            id: req.user._id,
            role: req.user.role,
            source: "google"
        },
        process.env.JWT_PRIVATE_KEY,
        {
            algorithm: "HS256",
            expiresIn: process.env.JWT_EXPIRES_IN || "24h"
        }
    );

    res.json({
        success: true,
        token: token,
        user: req.user
    });
});

// 🔗 Step 1: Initiate Google OAuth
gAuthRouter.get("/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account" // Forces account selection
    })
);

// 🔁 Step 2: OAuth Callback Handler
gAuthRouter.get("/auth/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
    }),
    async (req, res) => {
        try {
            // 1. Validate user exists
            if (!req.user) {
                throw new Error("No user data returned");
            }

            // 2. Handle approval status
            if (!req.user.isApproved) {
                return res.redirect(
                    `${process.env.FRONTEND_URL}/pending?` +
                    new URLSearchParams({
                        status: "awaiting-approval",
                        email: encodeURIComponent(req.user.email)
                    })
                );
            }

            // 3. Generate secure JWT
            const token = jwt.sign(
                {
                    id: req.user._id,
                    role: req.user.role,
                    source: "google" // For analytics
                },
                process.env.JWT_PRIVATE_KEY,
                {
                    algorithm: "HS256",
                    expiresIn: process.env.JWT_EXPIRES_IN || "24h"
                }
            );

            // 4. Secure redirect with token
            res.redirect(
                `${process.env.FRONTEND_URL}/oauth-success?` +
                new URLSearchParams({ token })
            );

        } catch (err) {
            console.error("OAuth processing error:", err);
            res.redirect(
                `${process.env.FRONTEND_URL}/login?` +
                new URLSearchParams({
                    error: "oauth_failed",
                    message: encodeURIComponent(err.message)
                })
            );
        }
    }
);


export default gAuthRouter;








































// import { Router } from "express";
// import passport from "passport";
// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";

// dotenv.config();

// const gAuthRouter = Router();

// // 🔗 Step 1: Redirect user to Google for authentication
// gAuthRouter.get("/auth/google",
//     passport.authenticate("google", { scope: ["profile", "email"] })
// );

// // 🔁 Step 2: Google OAuth callback
// // ✅ FIXED: added `async (req, res)` inside passport callback
// gAuthRouter.get("/auth/google/callback",
//     passport.authenticate("google", {
//         session: false,
//         failureRedirect: `${process.env.FRONTEND_URL}/login`,
//     }),
//     async (req, res) => {
//         try {
//             if (!req.user.isApproved) {
//                 return res.redirect(`${process.env.FRONTEND_URL}/pending?status=awaiting-approval`);
//             }

//             const token = jwt.sign(
//                 { id: req.user._id, role: req.user.role },
//                 process.env.JWT_PRIVATE_KEY,
//                 { algorithm: "HS256", expiresIn: "24h" }
//             );

//             return res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
//         } catch (err) {
//             console.error("OAuth error:", err);
//             res.redirect(`${process.env.FRONTEND_URL}/login?error=OAuthFailed`);
//         }
//     }
// );

// export default gAuthRouter;
