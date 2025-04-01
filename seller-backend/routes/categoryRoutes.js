const express = require('express');
const multer = require('multer');
const path = require('path');
const Category = require('../models/categoryModel');
const router = express.Router();

// Set storage engine for uploaded images
const storage = multer.diskStorage({
  destination: './uploads/', // Path where images will be stored
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Ensure unique filenames
  },
});

// Init upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for image size
}).single('image'); // Expect a single file with the name 'image'

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Add a new category with image upload
router.post('/', upload, async (req, res) => {
  try {
    // Check if the required fields are present
    const { name, description, slug, featured } = req.body;
    if (!name || !description || !slug) {
      return res.status(400).json({ message: 'Name, description, and slug are required.' });
    }

    // Handle image file
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    // Create a new category
    const newCategory = new Category({
      name,
      description,
      image,
      slug,
      featured,
    });

    // Save the category to the database
    await newCategory.save();

    res.json({ message: 'Category added successfully!' });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ message: 'Error adding category' });
  }
});

// Update category with image upload
router.put('/:id', upload, async (req, res) => {
  try {
    // Check if the required fields are present
    const { name, description, slug, featured } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image; // Use existing image if no new one is uploaded

    await Category.findByIdAndUpdate(req.params.id, { name, description, image, slug, featured });
    res.json({ message: 'Category updated successfully!' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully!' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
});

module.exports = router;
