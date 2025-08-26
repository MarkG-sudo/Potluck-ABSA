// Total commission revenue for Potluck
const totalRevenue = await MealOrder.aggregate([
    { $group: { _id: null, total: { $sum: "$platformEarnings" } } }
]);
console.log("💰 Total Platform Revenue:", totalRevenue[0]?.total || 0);

const monthlyRevenue = await MealOrder.aggregate([
    {
        $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            total: { $sum: "$platformEarnings" }
        }
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } }
]);