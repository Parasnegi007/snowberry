const express = require('express');
const router = express.Router();
const User = require('../../models/userModel');
const Product = require('../../models/productModel');

// 📌 Fetch Dashboard Stats (Without Orders & Sales)
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProducts = await Product.countDocuments();

        res.json({
            totalUsers,
            totalProducts,
            totalOrders: 0,  // Since Order model is missing
            totalSales: 0     // Since Order model is missing
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch dashboard stats", error: error.message });
    }
});

// 📌 Fetch Chart Data (Users & Products)
router.get('/chart-data', async (req, res) => {
    try {
        const timeRanges = ["Daily", "Weekly", "Monthly", "Yearly"];
        let chartData = {
            Users: {},
            Products: {}
        };

        for (let range of timeRanges) {
            chartData.Users[range] = await getUsersData(range);
            chartData.Products[range] = await getProductsData(range);
        }

        res.json(chartData);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch chart data", error: error.message });
    }
});

// 📌 Helper Functions to Aggregate Data
async function getUsersData(range) {
    const matchStage = getTimeMatchStage(range, "createdAt");
    const users = await User.aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 } } }  // ✅ FIXED
    ]);
    return users.length ? users[0].count : 0;
}

async function getProductsData(range) {
    const matchStage = getTimeMatchStage(range, "createdAt");
    const products = await Product.aggregate([
        { $match: matchStage },
        { $group: { _id: null, count: { $sum: 1 } } }  // ✅ FIXED
    ]);
    return products.length ? products[0].count : 0;
}

// 📌 Function to Get Time Filtering Stage for MongoDB Queries
function getTimeMatchStage(range, field) {
    const now = new Date();
    let startDate;

    switch (range) {
        case "Daily":
            startDate = new Date(now.setDate(now.getDate() - 7)); // Last 7 days
            break;
        case "Weekly":
            startDate = new Date(now.setDate(now.getDate() - 30)); // Last 30 days
            break;
        case "Monthly":
            startDate = new Date(now.setFullYear(now.getFullYear() - 1)); // Last 12 months
            break;
        case "Yearly":
            startDate = new Date(now.setFullYear(now.getFullYear() - 5)); // Last 5 years
            break;
        default:
            startDate = new Date("2000-01-01"); // All data
    }

    return { [field]: { $gte: startDate } };
}
// Total Orders API Endpoint
router.get("/orders", async (req, res) => {
    try {
        const { timePeriod, category } = req.query;

        // Filter orders based on the selected category
        let filter = {};
        if (category !== "all") {
            filter.categoryId = category;
        }

        // Example logic for time-based filtering (adjust as needed)
        const now = new Date();
        if (timePeriod === "daily") {
            filter.createdAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
        } else if (timePeriod === "weekly") {
            filter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        } else if (timePeriod === "monthly") {
            filter.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
        } else if (timePeriod === "yearly") {
            filter.createdAt = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
        }

        // Fetch orders from the database
        const orders = await Order.find(filter);

        // Aggregate data for the chart
        const labels = ["Week 1", "Week 2", "Week 3", "Week 4"]; // Example labels
        const data = [10, 20, 15, 30]; // Example data; replace with real stats

        res.json({ labels, data });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Error fetching orders" });
    }
});

router.get('/users-growth', async (req, res) => {
    try {
        const { timePeriod } = req.query;

        // Determine the start date based on the time period
        let startDate;
        const endDate = new Date(); // Current time
        switch (timePeriod) {
            case 'daily':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0); // Start of the current day
                break;
            case 'weekly':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7); // 7 days ago
                break;
            case 'monthly':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
                break;
            case 'yearly':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1); // 1 year ago
                break;
            default:
                return res.status(400).json({ message: "Invalid time period" });
        }

        // Count the number of users created within the time frame
        const totalUsers = await User.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        res.json({ totalUsers });
    } catch (error) {
        console.error("Error fetching user growth data:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
