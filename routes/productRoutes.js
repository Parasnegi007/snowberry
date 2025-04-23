const express = require("express");
const Product = require("../models/productModel");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
const mongoose = require("mongoose");

// Cloudinary Setup
const cloudinary = require("../utils/cloudinary");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "fruits-ecommerce/products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

const upload = multer({ storage });

console.log("✅ productRoutes.js is running!");
// 🔹 POST - Add New Product
router.post("/", upload.single("image"), async (req, res) => {
  const { name, price, description, categoryId, availableStock, featured, sale, mrp } = req.body;
  const image = req.file ? req.file.path : "";

  if (!name || !price || !categoryId || !availableStock || !mrp) {
    return res.status(400).json({ success: false, message: "Please fill in all required fields." });
  }

  try {
    const newProduct = new Product({
      name,
      price,
      description,
      image,
      categoryId,
      availableStock,
      featured,
      sale: sale || false, // Default to false if not provided
      mrp
    });

    const savedProduct = await newProduct.save();
    res.json({ success: true, message: "Product added successfully!", product: savedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to add product. Please try again later." });
  }
});


// 🔹 GET - All Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// 🔹 GET - Featured Products
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
// Route to fetch sale products
router.get("/sale-products", async (req, res) => {
  try {
    const saleProducts = await Product.find({ sale: true }); // Fetch products where the 'sale' flag is true
    res.status(200).json(saleProducts);
  } catch (error) {
    console.error("Error fetching sale products:", error);
    res.status(500).json({ message: "Server error. Unable to fetch sale products." });
  }
});
// 🔹 GET - Product by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
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
// 🔹 PUT - Update Product
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const { name, price, description, categoryId, availableStock, featured, sale, mrp } = req.body;
    const image = req.file ? req.file.path : "";

    const updateData = { name, price, description, categoryId, availableStock, featured, sale, mrp };
    if (image) updateData.image = image;

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


// 🔹 DELETE - Remove Product
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
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

// 🔹 GET - Products by Category ID
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

module.exports = router;
