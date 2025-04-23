const express = require("express");
const router = express.Router();
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel"); // Adjust the path as necessary based on your project structure
const mongoose = require("mongoose");

// Create Order API Route
router.post("/create-order", async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { cartItems, shippingAddress, paymentMethod, userInfo } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        if (!shippingAddress || !paymentMethod) {
            return res.status(422).json({ message: "Shipping address and payment method are required" });
        }

        let userId = req.user?._id || req.body.userId || null;

        // Debugging logs to check if userId is received
        console.log("📩 Request Body User ID:", req.body.userId);
        console.log("🔐 Extracted User ID:", userId);
        
        if (userId) {
            console.log("✅ User is registered");
        } else {
            console.log("❌ No User ID found, treating as guest");
        }
        


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

        const orderData = {
            userId: userId,
            orderItems,
            shippingAddress,
            paymentMethod,
            totalPrice,
            orderStatus: "Pending",
            paymentStatus: "Pending",
            orderDate: new Date(),
            isRegisteredUser: !!userId
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

        console.log(`✅ Order ${order._id} created. Waiting for payment...`);

        // Auto-cancel order if payment is not completed after 30 minutes (1800000 ms)
        // Use 15000 ms (15 sec) for testing
        setTimeout(async () => {
            try {
                const pendingOrder = await Order.findById(order._id);
                if (pendingOrder && pendingOrder.paymentStatus === "Pending") {
                    // Restore stock before canceling
                    await restoreStock(pendingOrder.orderItems);
                    
                    // Cancel the order
                    await Order.updateOne(
                        { _id: order._id },
                        { orderStatus: "Canceled", paymentStatus: "Failed" }
                    );
                    console.log(`⏰ Order ${order._id} auto-canceled due to non-payment.`);
                }
            } catch (err) {
                console.error(`❗ Error while auto-canceling order:`, err);
            }
        }, 15000); // 30 mins for production, 15 secs for testing

        return res.status(201).json({ message: "Order created successfully", orderId: order._id });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(error);
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

module.exports = router;
