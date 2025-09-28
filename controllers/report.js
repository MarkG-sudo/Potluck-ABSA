import express from 'express';
import { MealOrder } from "../models/mealOrder.js";
import { isAdmin, isAdminOrSuperAdmin } from "../middlewares/isAdmin.js";


// ✅ Define the router
const reportRouter = express.Router();

// GET platform earnings overview (protected)
reportRouter.get('/financials/overview',  async (req, res) => {
    try {
        // Add date filters to reduce dataset size
        let dateFilter = {};

        // Optional: Filter by last 30 days by default to reduce data
        if (!req.query.startDate) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            dateFilter.paidAt = { $gte: thirtyDaysAgo };
        } else if (req.query.startDate) {
            dateFilter.paidAt = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate || new Date())
            };
        }

        const result = await MealOrder.aggregate([
            {
                $match: {
                    "payment.status": "paid",
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    totalPlatformEarnings: { $sum: "$platformEarnings" },
                    totalCommissions: { $sum: "$commission" },
                    totalVendorPayouts: { $sum: "$vendorEarnings" },
                    totalSalesValue: { $sum: "$totalPrice" },
                    orderCount: { $sum: 1 }
                }
            }
        ]);// 30 second timeout

        const financials = result[0] || {
            totalPlatformEarnings: 0,
            totalCommissions: 0,
            totalVendorPayouts: 0,
            totalSalesValue: 0,
            orderCount: 0
        };

        res.json(financials);
    } catch (error) {
        console.error("Financial overview error:", error);

        if (error.message.includes('timed out')) {
            return res.status(408).json({
                error: "Request timeout. Try filtering by date range."
            });
        }

        res.status(500).json({ error: error.message });
    }
});

// GET detailed transactions (protected)
reportRouter.get('/financials/transactions',  async (req, res) => {
    try {
        // Build filter object
        let filter = {
            "payment.status": "paid"
        };

        // Date range filtering (helps with performance)
        if (req.query.startDate) {
            filter.paidAt = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate || new Date())
            };
        }

        // Filter by chef
        if (req.query.chef) {
            filter.chef = req.query.chef;
        }

        // Build sort object
        let sort = {};
        const sortField = req.query.sortBy || 'paidAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        sort[sortField] = sortOrder;

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Execute query with timeout
        const orders = await MealOrder.find(filter)
            .populate('chef', 'firstName lastName email')
            .populate('buyer', 'firstName lastName email')
            .populate('meal', 'mealName')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .maxTimeMS(30000);

        // Get total count for pagination
        const totalOrders = await MealOrder.countDocuments(filter).maxTimeMS(30000);

        const totalPages = Math.ceil(totalOrders / limit);

        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            }
        });
    } catch (error) {
        console.error("Transactions error:", error);

        if (error.message.includes('timed out')) {
            return res.status(408).json({
                error: "Request timeout. Try with a smaller date range."
            });
        }

        res.status(500).json({ error: error.message });
    }
});

// ✅ Export the router
export default reportRouter;

// Total commission revenue for Potluck
// const totalRevenue = await MealOrder.aggregate([
//     { $group: { _id: null, total: { $sum: "$platformEarnings" } } }
// ]);
// console.log("💰 Total Platform Revenue:", totalRevenue[0]?.total || 0);

// const monthlyRevenue = await MealOrder.aggregate([
//     {
//         $group: {
//             _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
//             total: { $sum: "$platformEarnings" }
//         }
//     },
//     { $sort: { "_id.year": -1, "_id.month": -1 } }
// ]);