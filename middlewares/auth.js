import { expressjwt } from "express-jwt";
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