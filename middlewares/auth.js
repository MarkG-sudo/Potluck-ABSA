import { expressjwt } from "express-jwt";
import jwt from "jsonwebtoken";
import { permissions } from "../utils/rbac.js";
import { UserModel } from "../models/users.js";

export const isAuthenticated = expressjwt({
    secret: process.env.JWT_PRIVATE_KEY,
    algorithms: ["HS256"],
    getToken: (req) => {
        if (req.headers.authorization?.startsWith("Bearer ")) {
            return req.headers.authorization.split(" ")[1];
        }
        return null;
    }
});

export const hasPermission = (action) => {
    return async (req, res, next) => {
        try {
            if (!req.auth || !req.auth.id) {
                return res.status(401).json({ error: "Authentication required." });
            }

            const user = await UserModel.findById(req.auth.id);

            if (!user) {
                return res.status(404).json({ error: "User not found!" });
            }

            const permission = permissions.find(p => p.role === user.role);
            if (!permission) {
                return res.status(403).json({ error: "No permissions defined for this role." });
            }

            if (!permission.actions.includes(action)) {
                return res.status(403).json({ error: "You do not have permission to perform this action." });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

// middlewares/tempAuth.js
export const allowTempAuth = (req, res, next) => {
    try {
        console.log("=== TEMP AUTH MIDDLEWARE ===");
        console.log("Full headers:", req.headers);

        const authHeader = req.headers.authorization;
        console.log("Auth header:", authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log("No Bearer token found");
            return res.status(401).json({ error: "Temp token required" });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log("Extracted token:", token);
        console.log("JWT Secret length:", process.env.JWT_PRIVATE_KEY?.length);

        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        console.log("Decoded token:", decoded);

        if (!decoded.temp) {
            console.log("Token missing temp flag");
            return res.status(401).json({ error: "Invalid temp token" });
        }

        req.auth = { id: decoded.id, temp: true };
        console.log("Authentication successful");
        next();

    } catch (error) {
        console.log("❌ Token verification error:", error.message);
        console.log("Error stack:", error.stack);
        res.status(401).json({ error: "Invalid or expired temp token" });
    }
};


// export const isAuthenticated = expressjwt({
//     secret: process.env.JWT_PRIVATE_KEY,
//     algorithms: ["HS256"]
// });

// export const hasPermission = (action) => {
//     return async (req, res, next) => {
//         try {
//             if (!req.auth || !req.auth.id) {
//                 return res.status(401).json({ error: "Authentication required." });
//             }

//             const user = await UserModel.findById(req.auth.id);

//             if (!user) {
//                 return res.status(404).json({ error: "User not found!" });
//             }

//             const permission = permissions.find(p => p.role === user.role);
//             if (!permission) {
//                 return res.status(403).json({ error: "No permissions defined for this role." });
//             }

//             if (!permission.actions.includes(action)) {
//                 return res.status(403).json({ error: "You do not have permission to perform this action." });
//             }

//             next();
//         } catch (error) {
//             next(error);
//         }
//     };
// };