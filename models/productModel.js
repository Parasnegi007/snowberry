const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String },
    featured: { type: Boolean, default: false },
    availableStock: { type: Number, default: 0 }
    
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
