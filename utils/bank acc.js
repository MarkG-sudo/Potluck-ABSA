import { Router } from "express";
import { getBanks, resolveAccount } from "../utils/paystack.js";
import NodeCache from "node-cache";
import { hasPermission, isAuthenticated, allowTempAuth } from "../middlewares/auth.js";
import Joi from "joi";

const bankRouter = Router();

// ✅ Dynamic TTL (shorter in dev, 24h in prod)
const cache = new NodeCache({
    stdTTL: process.env.NODE_ENV === "production" ? 86400 : 3600
});

// ✅ Consistent response helper
const sendResponse = (res, success, data = null, error = null) => {
    res.status(success ? 200 : 400).json({
        success,
        ...(success ? { data } : { error }),
    });
};

// ✅ Input validator
const resolveAccountSchema = Joi.object({
    accountNumber: Joi.string().pattern(/^\d{8,12}$/).required()
        .messages({ "string.pattern.base": "accountNumber must be 8-12 digits" }),
    bankCode: Joi.string().pattern(/^\d+$/).required()
        .messages({ "string.pattern.base": "bankCode must be numeric" }),
});

// ✅ Permission helper (allows temp token or RBAC check)
const hasBankPermission = (req, res, next) => {
    if (req.auth?.temp) {
        return next();
    }
    return hasPermission("get_banks")(req, res, next);
};

// ---------------- ROUTES ----------------

// ✅ Get banks (cached)
bankRouter.get(
    "/banks",
    allowTempAuth,
    hasBankPermission,
    async (req, res) => {
        try {
            const cachedBanks = cache.get("ghana-banks");
            if (cachedBanks) {
                return sendResponse(res, true, cachedBanks);
            }

            const banks = await getBanks();
            cache.set("ghana-banks", banks);

            return sendResponse(res, true, banks);
        } catch (error) {
            console.error("Bank fetch error:", {
                message: error.message,
                response: error.response?.data,
            });
            return sendResponse(res, false, null, "Failed to fetch banks list");
        }
    }
);

// ✅ Resolve account number
bankRouter.get(
    "/resolve-account",
    allowTempAuth,
    hasBankPermission,
    async (req, res) => {
        try {
            // Validate query params
            const { error, value } = resolveAccountSchema.validate(req.query);
            if (error) {
                return sendResponse(res, false, null, error.details[0].message);
            }

            const { accountNumber, bankCode } = value;
            const accountInfo = await resolveAccount(accountNumber, bankCode);

            return sendResponse(res, true, accountInfo);
        } catch (error) {
            console.error("Resolve account error:", {
                message: error.message,
                response: error.response?.data,
            });

            return sendResponse(
                res,
                false,
                null,
                process.env.NODE_ENV === "development"
                    ? error.response?.data?.message || error.message
                    : "Account resolution failed. Please check the details."
            );
        }
    }
);

export default bankRouter;



// import { Router } from "express";
// import { getBanks, resolveAccount } from "../utils/paystack.js";
// import NodeCache from "node-cache";
// import { hasPermission, isAuthenticated, allowTempAuth } from '../middlewares/auth.js'; // 

// const bankRouter = Router();
// const cache = new NodeCache({ stdTTL: 86400 });

// // ✅ Helper function to check if user has permission (works for both temp and regular auth)
// const hasBankPermission = (req, res, next) => {
//     // If it's a temp auth user, allow access (they need to complete profile)
//     if (req.auth.temp) {
//         return next();
//     }

//     // If it's a regular authenticated user, check permissions
//     return hasPermission('get_banks')(req, res, next);
// };

// bankRouter.get("/banks",
//     allowTempAuth, // ← Allow temp tokens FIRST
//     hasBankPermission, // ← Then check permissions accordingly
//     async (req, res) => {
//         try {
//             // Check cache first
//             const cachedBanks = cache.get("ghana-banks");
//             if (cachedBanks) {
//                 return res.json(cachedBanks);
//             }

//             const banks = await getBanks();

//             // Cache the result
//             cache.set("ghana-banks", banks);

//             res.json(banks);

//         } catch (error) {
//             console.error("Bank fetch error:", error.response?.data || error.message);
//             res.status(500).json({
//                 error: "Failed to fetch banks list",
//                 details: process.env.NODE_ENV === 'development' ? error.message : undefined
//             });
//         }
//     });

// bankRouter.get("/resolve-account",
//     allowTempAuth, // ← Allow temp tokens
//     hasBankPermission, // ← Custom permission check
//     async (req, res) => {
//         try {
//             const { accountNumber, bankCode } = req.query;

//             if (!accountNumber || !bankCode) {
//                 return res.status(400).json({
//                     error: "accountNumber and bankCode query parameters are required"
//                 });
//             }

//             const accountInfo = await resolveAccount(accountNumber, bankCode);
//             res.json(accountInfo);

//         } catch (error) {
//             console.error("Resolve account error:", error.response?.data || error.message);
//             res.status(400).json({
//                 error: "Account resolution failed",
//                 details: process.env.NODE_ENV === 'development'
//                     ? (error.response?.data?.message || error.message)
//                     : "Please check the account number and bank code."
//             });
//         }
//     });

// export default bankRouter;