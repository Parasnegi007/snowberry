const express = require("express");
const router = express.Router();
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel"); // Adjust the path as necessary based on your project structure
const mongoose = require("mongoose");
const authMiddleware = require('../middleware/authMiddleware');

// Create Order API Route
router.post("/create-order", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { cartItems, shippingAddress, paymentMethod, userInfo } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        if (!shippingAddress || !paymentMethod) {
            return res.status(422).json({ message: "Shipping address and payment method are required" });
        }

        let userId = req.user?._id || req.body.userId || null;

        // Debugging logs
        console.log("📩 Request Body User ID:", req.body.userId);
        console.log("🔐 Extracted User ID:", userId);
        if (userId) console.log("✅ User is registered");
        else console.log("❌ No User ID found, treating as guest");

        // Fetch user details if userId exists
        let userDetails = null;
        if (userId) {
            const user = await User.findById(userId).select("name email phone");
            if (user) {
                userDetails = {
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                };
            }
        }

        let totalPrice = 0;
        const orderItems = [];

        for (let item of cartItems) {
            const product = await Product.findById(item.productId).session(session);
            if (!product) {
                await session.abortTransaction();
                return res.status(404).json({ message: `Product with ID ${item.productId} not found` });
            }

            if (product.stock < item.quantity) {
                await session.abortTransaction();
                return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
            }

            product.stock -= item.quantity;
            await product.save({ session });

            const subtotal = product.price * item.quantity;
            totalPrice += subtotal;

            orderItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                subtotal: subtotal
            });
        }

        // Generate user-friendly Order ID
        const userFriendlyOrderId = generateOrderId(); // Implement this function to generate order IDs

        const orderData = {
            userId: userId,
            orderId: userFriendlyOrderId, // Add user-friendly Order ID
            orderItems,
            shippingAddress,
            paymentMethod,
            totalPrice,
            orderStatus: "Pending",
            paymentStatus: "Pending",
            orderDate: new Date(),
            isRegisteredUser: !!userId,
            trackingId: null, // Placeholder for tracking ID
            courierPartner: null, // Placeholder for courier partner
        };

        if (userId) {
            orderData.userName = userDetails?.name;
            orderData.userEmail = userDetails?.email;
            orderData.userPhone = userDetails?.phone;
        } else if (userInfo) {
            orderData.guestName = userInfo.name;
            orderData.guestEmail = userInfo.email;
            orderData.guestPhone = userInfo.phone;
        }

        const order = new Order(orderData);
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        console.log(`✅ Order ${userFriendlyOrderId} created. Waiting for payment...`);

        // Auto-cancel order if payment is not completed after 30 minutes (1800000 ms)
        setTimeout(async () => {
            try {
                const pendingOrder = await Order.findById(order._id);
                if (pendingOrder && pendingOrder.paymentStatus === "Pending") {
                    await restoreStock(pendingOrder.orderItems);
                    await Order.updateOne(
                        { _id: order._id },
                        { orderStatus: "Canceled", paymentStatus: "Failed" }
                    );
                    console.log(`⏰ Order ${order._id} auto-canceled due to non-payment.`);
                }
            } catch (err) {
                console.error(`❗ Error while auto-canceling order:`, err);
            }
        }, 15000); // Adjust timing as needed

        return res.status(201).json({
            message: "Order created successfully",
            orderId: userFriendlyOrderId, // Return the user-friendly Order ID
        });
    } catch (error) {
        console.error(error);

        if (session.inTransaction()) { // Ensure the transaction is still active before aborting
            await session.abortTransaction();
        }
        session.endSession();

        return res.status(500).json({ message: "Error creating order", error });
    }
});

// Restore Stock Function
async function restoreStock(orderItems) {
    for (let item of orderItems) {
        const product = await Product.findById(item.productId);
        if (product) {
            product.stock += item.quantity;
            await product.save();
        }
    }
}

// Function to generate user-friendly Order ID
function generateOrderId() {
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
    return `ORD-${timestamp}-${randomNumber}`;
}

router.post('/track-order', async (req, res) => {
    try {
        const { email, phone, orderId } = req.body;

        if (!email || !phone) {
            return res.status(400).json({ message: 'Email and phone are required.' });
        }

        // Build the query dynamically based on whether orderId is provided
        const query = {
            $or: [
                { guestEmail: email, guestPhone: phone },
                { userEmail: email, userPhone: phone }
            ]
        };

        if (orderId) {
            query.$or.push({ orderId }); // Add user-friendly orderId to the query
            query.$or.push({ _id: orderId }); // Fallback to MongoDB ObjectId
        }

        const orders = await Order.find(query).lean();

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for the given details.' });
        }

        // Format orders for frontend
        const formattedOrders = orders.map(order => ({
            _id: order._id, // MongoDB ObjectId
            orderId: order.orderId, // User-friendly Order ID
            trackingId: order.trackingId || "N/A", // Include tracking ID with fallback
            courierPartner: order.courierPartner || "N/A", // Include courier partner with fallback
            name: order.isRegisteredUser ? order.userName : order.guestName,
            email: order.isRegisteredUser ? order.userEmail : order.guestEmail,
            phone: order.isRegisteredUser ? order.userPhone : order.guestPhone,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            totalPrice: order.totalPrice,
            orderDate: order.createdAt,
            shippingAddress: order.shippingAddress,
            orderItems: order.orderItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }))
        }));

        res.status(200).json({ orders: formattedOrders });
    } catch (error) {
        console.error('Track Order Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.get('/my-orders', authMiddleware, async (req, res) => {
    try {
        console.log("Entering /my-orders route...");

        const userId = req.user.userId; // Extracted from the JWT by authMiddleware
        console.log("User ID from middleware:", userId);

        // Query orders by userId, sort by creation date (newest first), and populate product images
        const orders = await Order.find({ userId })
            .lean()
            .populate("orderItems.productId", "image") // Populate product images
            .sort({ createdAt: -1 }); // Sort by newest first

        console.log("Orders found:", orders);

        // Check if any orders were retrieved
        if (!orders || orders.length === 0) {
            console.log("No orders found for this user.");
            return res.status(404).json({ message: 'No orders found for this user.' });
        }

        // Format orders for the frontend
        const formattedOrders = orders.map(order => ({
            _id: order._id, // MongoDB Object ID (used for backend references)
            orderId: order.orderId, // User-friendly Order ID
            trackingId: order.trackingId || "N/A", // Tracking ID (default to "N/A" if missing)
            courierPartner: order.courierPartner || "N/A", // Courier Partner (default to "N/A" if missing)
            name: order.userName, // Registered user's name
            email: order.userEmail, // Registered user's email
            phone: order.userPhone, // Registered user's phone
            orderStatus: order.orderStatus, // Order status
            paymentMethod: order.paymentMethod, // Payment method
            paymentStatus: order.paymentStatus, // Payment status
            totalPrice: order.totalPrice, // Total price of the order
            orderDate: order.createdAt, // Creation date
            shippingAddress: order.shippingAddress, // Shipping address details
            orderItems: order.orderItems.map(item => ({
                name: item.name, // Product name
                quantity: item.quantity, // Quantity
                price: item.price, // Price per unit
                subtotal: item.subtotal, // Subtotal for the item
                image: item.productId?.image || 'fallback.jpg' // Product image (default to fallback)
            }))
        }));

        console.log("Formatted Orders:", formattedOrders);

        // Return formatted orders to the frontend
        res.status(200).json({ orders: formattedOrders });
    } catch (error) {
        console.error("My Orders Error:", error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// Fetch Product Details Route
router.get('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }

        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({
            name: product.name,
            price: product.price,
            image: product.image,
            description: product.description || "No description available."
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



module.exports = router;
