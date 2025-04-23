const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: function () {
            return this.isRegisteredUser;
        }
    },
    userName: {
        type: String,
        required: function () {
            return this.isRegisteredUser;
        }
    },
    userEmail: {
        type: String,
        required: function () {
            return this.isRegisteredUser;
        }
    },
    userPhone: {
        type: String,
        required: function () {
            return this.isRegisteredUser;
        }
    },
    guestName: {
        type: String,
        required: function () {
            return !this.isRegisteredUser;
        }
    },
    guestEmail: {
        type: String,
        required: function () {
            return !this.isRegisteredUser;
        }
    },
    guestPhone: {
        type: String,
        required: function () {
            return !this.isRegisteredUser;
        }
    },
    isRegisteredUser: {
        type: Boolean,
        default: false
    },

    // ✅ New field: user-friendly Order ID
    orderId: {
        type: String,
        unique: true, // Optional but recommended
        required: true
    },

    // ✅ New field: AWB / Tracking ID
    trackingId: {
        type: String,
        default: null
    },

    // ✅ New field: Courier Partner
    courierPartner: {
        type: String,
        default: null
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
