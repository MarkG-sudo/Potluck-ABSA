import jwt from "jsonwebtoken";
import { permissions } from "../utils/rbac.js";
import { UserModel } from "../models/users.js";
import { refreshAccessToken } from '../utils/tokenUtils.js';

const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    return null;
};

export const isAuthenticated = async (req, res, next) => {
    try {
        const accessToken = getTokenFromHeader(req);

        if (!accessToken) {
            return res.status(401).json({ error: "Access token required" });
        }

        try {
            // Try to verify access token first
            const decoded = jwt.verify(accessToken, process.env.JWT_PRIVATE_KEY);

            if (decoded.type !== 'access') {
                return res.status(401).json({ error: "Invalid token type" });
            }

            req.auth = decoded;
            return next();

        } catch (accessError) {
            // Access token expired or invalid, try refresh token
            if (accessError.name !== 'TokenExpiredError') {
                return res.status(401).json({ error: "Invalid access token" });
            }

            const refreshToken = req.headers['x-refresh-token'];

            if (!refreshToken) {
                return res.status(401).json({ error: "Session expired. Please login again." });
            }

            try {
                const newTokens = await refreshAccessToken(refreshToken);

                // Set new tokens in response headers
                res.set({
                    'X-New-Access-Token': newTokens.accessToken,
                    'X-Token-Expires-In': '900' // 15 minutes
                });

                req.auth = jwt.verify(newTokens.accessToken, process.env.JWT_PRIVATE_KEY);
                next();

            } catch (refreshError) {
                return res.status(401).json({ error: "Session expired. Please login again." });
            }
        }
    } catch (error) {
        res.status(401).json({ error: "Authentication failed" });
    }
};


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
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Temp token required" });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);

        if (!decoded.temp || decoded.scope !== 'profile_completion') {
            return res.status(401).json({ error: "Invalid temp token type" });
        }

        req.auth = decoded;
        next();

    } catch (error) {
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