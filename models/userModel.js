const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true, select: false }, // ✅ Fixed comma

    phone: { type: String, required: true, unique: true }, 
    status: { type: String, enum: ["active", "blocked"], default: "active" }, 

    createdAt: { type: Date, default: Date.now }, 

    // ✅ New Schema (Array of Objects)
address: [{
    street: { type: String, required: true }, 
    city: { type: String, required: true },  
    state: { type: String, required: true },  
    zipcode: { type: String, required: true }, 
    country: { type: String, required: true } 
}]
    // ✅ Cart (Initially Empty)
   , cart: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            quantity: { type: Number, default: 1 }
        }
    ], 

    // ✅ Wishlist (Initially Empty)
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }] 

}, { timestamps: true });

const User = mongoose.model("User", userSchema);
module.exports = User;
