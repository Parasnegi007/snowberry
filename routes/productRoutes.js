const express = require("express");
const Product = require("../models/productModel");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
const multer = require('multer');
const path = require('path'); // Added path module import
const mongoose = require("mongoose");

console.log("✅ productRoutes.js is running!");

// ✅ Define Storage for Multer

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Folder where images will be stored
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname); // Unique filename
    },
});
// ✅ Initialize Multer after defining storage
const upload = multer({ storage: storage });

// 🔹 GET Featured Products
router.get("/featured", async (req, res) => {
    console.log("✅ /api/products/featured was called!");
    try {
        const products = await Product.find({ featured: true });
        res.json(products);
    } catch (error) {
        console.error("Error fetching featured products:", error);
        res.status(500).json({ message: "Error fetching featured products" });
    }
});

// 🔹 GET All Products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Error fetching products" });
    }
});


router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Check if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({ message: "Error fetching product details" });
    }
});
router.put("/:id", upload.single("image"), async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Check if the ID is valid
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const { name, price, description, categoryId, availableStock, featured } = req.body;
        const image = req.file ? req.file.filename : null; // ✅ Only update if a new image is uploaded

        const updateData = { name, price, description, categoryId, availableStock, featured };

        if (image) {
            updateData.image = image; // ✅ Update image only if provided
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product updated successfully!", product: updatedProduct });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Error updating product" });
    }
});
// ❌ Delete Product Route
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Validate Product ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting product:", error);
        res.status(500).json({ message: "Error deleting product" });
    }
});


// 🔹 GET Products by Category
router.get("/category/:categoryId", async (req, res) => {
    try {
        const { categoryId } = req.params;
        const products = await Product.find({ categoryId });

        if (!products.length) {
            return res.status(404).json({ message: "No products found in this category" });
        }

        res.json(products);
    } catch (error) {
        console.error("Error fetching products by category:", error);
        res.status(500).json({ message: "Error fetching products by category" });
    }
});


// Route to add a new product
// Use "/" because the route is mounted at '/api/products' in index.js
router.post('/', upload.single('image'), async (req, res) => {
    // Code to save product
    const { name, price, description, categoryId, availableStock, featured } = req.body;
    const image = req.file ? req.file.path : null; // Get the file path if uploaded

    if (!name || !price || !categoryId || !availableStock) {
        return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    try {
        const newProduct = new Product({
            name,
            price,
            description,
            image,
            categoryId,
            availableStock,
            featured
        });

        await newProduct.save(); // Save product to database

        res.json({ success: true, message: 'Product added successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to add product. Please try again later.' });
    }
});

module.exports = router;
