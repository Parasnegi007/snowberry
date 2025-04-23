const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: function() {
            return this.isRegisteredUser;  // Only required if it's a registered user
        }
    },
    userName: {
        type: String,
        required: function() {
            return this.isRegisteredUser;  // Only required for registered users
        }
    },
    userEmail: {
        type: String,
        required: function() {
            return this.isRegisteredUser;  // Only required for registered users
        }
    },
    userPhone: {
        type: String,
        required: function() {
            return this.isRegisteredUser;  // Only required for registered users
        }
    },
    // For guest users, we'll use these fields
    guestName: {
        type: String,
        required: function() {
            return !this.isRegisteredUser;  // Required if it's a guest user
        }
    },
    guestEmail: {
        type: String,
        required: function() {
            return !this.isRegisteredUser;  // Required if it's a guest user
        }
    },
    guestPhone: {
        type: String,
        required: function() {
            return !this.isRegisteredUser;  // Required if it's a guest user
        }
    },
    isRegisteredUser: {
        type: Boolean,
        default: false
    },
    orderItems: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true },
            subtotal: { type: Number, required: true }
        }
    ],
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipcode: { type: String, required: true },
        country: { type: String, required: true }
    },
    paymentMethod: {
        type: String,
        enum: ["razorpay", "phonepe"],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending"
    },
    transactionId: { type: String },
    orderStatus: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Canceled"],
        default: "Pending"
    },
    totalPrice: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
