import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserModel } from "../models/users.js";
import { mailtransporter } from "../utils/mail.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    proxy: true  // Required for Render.com
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Validate profile email exists
        if (!profile.emails?.[0]?.value) {
            throw new Error("No email found in Google profile");
        }

        const email = profile.emails[0].value;
        let user = await UserModel.findOne({ email });

        if (!user) {
            const role = "potlucky";
            const isPotlucky = role === "potlucky";

            user = await UserModel.create({
                firstName: profile.name?.givenName || "",
                lastName: profile.name?.familyName || "",
                email,
                source: "google",
                role,
                isApproved: isPotlucky,
                profileCompleted: isPotlucky,
                source: "google"
            });

            // Email handling
            const templateName = isPotlucky ? "signup-mail.html" : "pending-approval-mail.html";
            const templatePath = path.join(__dirname, `../utils/${templateName}`);

            if (fs.existsSync(templatePath)) {
                let html = fs.readFileSync(templatePath, "utf-8");
                html = html.replace(/{{firstName}}/g, user.firstName);

                await mailtransporter.sendMail({
                    from: '"Potluck" <no-reply@potluck.app>',
                    to: user.email,
                    subject: isPotlucky
                        ? "Welcome to Potluck 🎉"
                        : "Potluck Registration Received - Pending Approval",
                    html
                });
            }

            if (!isPotlucky && process.env.ADMIN_EMAIL) {
                await mailtransporter.sendMail({
                    from: '"Potluck Notifications" <no-reply@potluck.app>',
                    to: process.env.ADMIN_EMAIL,
                    subject: `New ${role} account pending approval`,
                    html: `
                        <h3>New ${role} registered via Google</h3>
                        <p>Name: ${user.firstName} ${user.lastName}</p>
                        <p>Email: ${user.email}</p>
                    `
                });
            }
        }

        return done(null, user);
    } catch (err) {
        console.error('Google OAuth Error:', err);
        done(err, null);
    }
}));











// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
//     proxy: true  // MUst
// },  async (accessToken, refreshToken, profile, done) => {
//     try {
//         let user = await UserModel.findOne({ email: profile.emails[0].value });

//         if (!user) {
//             const role = "potlucky";
//             const isPotlucky = role === "potlucky";

//             user = await UserModel.create({
//                 firstName: profile.name.givenName,
//                 lastName: profile.name.familyName,
//                 email: profile.emails[0].value,
//                 password: "GOOGLE_AUTH",
//                 role,
//                 isApproved: isPotlucky,
//                 profileCompleted: isPotlucky,
//                 source: "google"
//             });

//             const templatePath = path.join(
//                 __dirname,
//                 `../utils/${isPotlucky ? "signup-mail.html" : "pending-approval-mail.html"}`
//             );
//             let html = fs.readFileSync(templatePath, "utf-8");
//             html = html.replace(/{{firstName}}/g, user.firstName);

//             await mailtransporter.sendMail({
//                 from: '"Potluck" <no-reply@potluck.app>',
//                 to: user.email,
//                 subject: isPotlucky
//                     ? "Welcome to Potluck 🎉"
//                     : "Potluck Registration Received - Pending Approval",
//                 html
//             });

//             if (!isPotlucky) {
//                 const adminHtml = `
//           <h3>New ${role} registered via Google</h3>
//           <p>Name: ${user.firstName} ${user.lastName}</p>
//           <p>Email: ${user.email}</p>
//         `;

//                 await mailtransporter.sendMail({
//                     from: '"Potluck Notifications" <no-reply@potluck.app>',
//                     to: process.env.ADMIN_EMAIL,
//                     subject: `New ${role} account pending approval`,
//                     html: adminHtml
//                 });
//             }
//         }

//         return done(null, user);
//     } catch (err) {
//         done(err, null);
//     }
// }));
