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

// GET chef earnings and commission report
reportRouter.get('/financials/chef-earnings',  async (req, res) => {
    try {
        // Build filter object
        let filter = {
            "payment.status": "paid"
        };

        // Date range filtering
        if (req.query.startDate) {
            filter.paidAt = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate || new Date())
            };
        }

        // Filter by specific chef
        if (req.query.chefId) {
            filter.chef = req.query.chefId;
        }

        // Filter by payment method
        if (req.query.paymentMethod) {
            filter["payment.method"] = req.query.paymentMethod;
        }

        // Build sort object
        let sort = {};
        const sortField = req.query.sortBy || 'totalSales';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        sort[sortField] = sortOrder;

        // ✅ FIXED: maxTimeMS now in aggregate options
        const chefEarnings = await MealOrder.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: "$chef",
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: "$totalPrice" },
                    totalCommission: { $sum: "$commission" },
                    totalVendorEarnings: { $sum: "$vendorEarnings" },
                    totalPlatformEarnings: { $sum: "$platformEarnings" },
                    // Track cash payments separately
                    cashOrders: {
                        $sum: {
                            $cond: [{ $eq: ["$payment.method", "cash"] }, 1, 0]
                        }
                    },
                    cashAmount: {
                        $sum: {
                            $cond: [{ $eq: ["$payment.method", "cash"] }, "$totalPrice", 0]
                        }
                    },
                    cashCommissionOwed: {
                        $sum: {
                            $cond: [{ $eq: ["$payment.method", "cash"] }, "$commission", 0]
                        }
                    },
                    // Online payments
                    onlineOrders: {
                        $sum: {
                            $cond: [{ $ne: ["$payment.method", "cash"] }, 1, 0]
                        }
                    },
                    onlineAmount: {
                        $sum: {
                            $cond: [{ $ne: ["$payment.method", "cash"] }, "$totalPrice", 0]
                        }
                    },
                    onlineCommission: {
                        $sum: {
                            $cond: [{ $ne: ["$payment.method", "cash"] }, "$commission", 0]
                        }
                    },
                    // Recent order for last activity
                    lastOrderDate: { $max: "$paidAt" },
                    firstOrderDate: { $min: "$paidAt" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "chefInfo"
                }
            },
            {
                $unwind: {
                    path: "$chefInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    chefId: "$_id",
                    chefName: {
                        $concat: [
                            "$chefInfo.firstName",
                            " ",
                            "$chefInfo.lastName"
                        ]
                    },
                    chefEmail: "$chefInfo.email",
                    totalOrders: 1,
                    totalSales: 1,
                    totalCommission: 1,
                    totalVendorEarnings: 1,
                    totalPlatformEarnings: 1,
                    // Cash breakdown
                    cashOrders: 1,
                    cashAmount: 1,
                    cashCommissionOwed: 1,
                    // Online breakdown  
                    onlineOrders: 1,
                    onlineAmount: 1,
                    onlineCommission: 1,
                    // Activity
                    lastOrderDate: 1,
                    firstOrderDate: 1,
                    // Calculated fields
                    commissionRate: {
                        $cond: [
                            { $gt: ["$totalSales", 0] },
                            { $divide: ["$totalCommission", "$totalSales"] },
                            0
                        ]
                    },
                    outstandingBalance: "$cashCommissionOwed" // What chef owes for cash orders
                }
            },
            {
                $sort: sort
            }
        ], {
            maxTimeMS: 30000 // ✅ CORRECT: maxTimeMS in options object
        });

        // Get detailed orders for each chef (optional - for drill-down)
        const chefDetails = {};
        if (req.query.includeOrders === 'true') {
            const detailedOrders = await MealOrder.find(filter)
                .populate('chef', 'firstName lastName email')
                .populate('buyer', 'firstName lastName')
                .populate('meal', 'mealName')
                .sort({ paidAt: -1 })
                .maxTimeMS(30000);

            // Group orders by chef
            detailedOrders.forEach(order => {
                const chefId = order.chef._id.toString();
                if (!chefDetails[chefId]) {
                    chefDetails[chefId] = [];
                }
                chefDetails[chefId].push({
                    orderId: order._id,
                    meal: order.meal?.mealName,
                    buyer: `${order.buyer?.firstName} ${order.buyer?.lastName}`,
                    quantity: order.quantity,
                    totalPrice: order.totalPrice,
                    commission: order.commission,
                    vendorEarnings: order.vendorEarnings,
                    paymentMethod: order.payment.method,
                    paidAt: order.paidAt,
                    status: order.status
                });
            });
        }

        // Calculate platform totals
        const platformTotals = {
            totalChefs: chefEarnings.length,
            totalSales: chefEarnings.reduce((sum, chef) => sum + chef.totalSales, 0),
            totalCommission: chefEarnings.reduce((sum, chef) => sum + chef.totalCommission, 0),
            totalCashCommissionOwed: chefEarnings.reduce((sum, chef) => sum + chef.cashCommissionOwed, 0),
            totalOnlineCommission: chefEarnings.reduce((sum, chef) => sum + chef.onlineCommission, 0)
        };

        res.json({
            chefEarnings,
            platformTotals,
            ...(req.query.includeOrders === 'true' && { detailedOrders: chefDetails }),
            filters: {
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                chefId: req.query.chefId,
                paymentMethod: req.query.paymentMethod
            }
        });

    } catch (error) {
        console.error("Chef earnings report error:", error);

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