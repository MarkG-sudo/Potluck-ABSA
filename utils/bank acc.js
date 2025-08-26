import { Router } from "express";
import { getBanks, resolveAccount } from "../utils/paystack.js";
import NodeCache from "node-cache";
import { hasPermission, isAuthenticated, allowTempAuth } from '../middlewares/auth.js'; // 

const bankRouter = Router();
const cache = new NodeCache({ stdTTL: 86400 });

// ✅ Helper function to check if user has permission (works for both temp and regular auth)
const hasBankPermission = (req, res, next) => {
    // If it's a temp auth user, allow access (they need to complete profile)
    if (req.auth.temp) {
        return next();
    }

    // If it's a regular authenticated user, check permissions
    return hasPermission('get_banks')(req, res, next);
};

bankRouter.get("/banks",
    allowTempAuth, // ← Allow temp tokens FIRST
    hasBankPermission, // ← Then check permissions accordingly
    async (req, res) => {
        try {
            // Check cache first
            const cachedBanks = cache.get("ghana-banks");
            if (cachedBanks) {
                return res.json(cachedBanks);
            }

            const banks = await getBanks();

            // Cache the result
            cache.set("ghana-banks", banks);

            res.json(banks);

        } catch (error) {
            console.error("Bank fetch error:", error.response?.data || error.message);
            res.status(500).json({
                error: "Failed to fetch banks list",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

bankRouter.get("/resolve-account",
    allowTempAuth, // ← Allow temp tokens
    hasBankPermission, // ← Custom permission check
    async (req, res) => {
        try {
            const { accountNumber, bankCode } = req.query;

            if (!accountNumber || !bankCode) {
                return res.status(400).json({
                    error: "accountNumber and bankCode query parameters are required"
                });
            }

            const accountInfo = await resolveAccount(accountNumber, bankCode);
            res.json(accountInfo);

        } catch (error) {
            console.error("Resolve account error:", error.response?.data || error.message);
            res.status(400).json({
                error: "Account resolution failed",
                details: process.env.NODE_ENV === 'development'
                    ? (error.response?.data?.message || error.message)
                    : "Please check the account number and bank code."
            });
        }
    });

export default bankRouter;