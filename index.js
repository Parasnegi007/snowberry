require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./database'); // Import MongoDB connection
const multer = require('multer');
const app = express();

// Routes
const categoryRoutes = require('./seller-backend/routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');

// ✅ Connect to MongoDB using environment variables
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));

// ✅ Enable CORS
app.use(cors({
  origin: [
    "https://snowberry.vercel.app", 
    "https://snowwberry.vercel.app"
  ],
}));

// Middleware to parse JSON (must be before routes)
app.use(express.json());

// ✅ Register Routes
app.use('/api/users', require('./routes/userRoutes'));       // 🔹 User Routes
app.use('/api/products', require('./routes/productRoutes')); // 🔹 Product Routes
app.use('/api/dashboard', require('./seller-backend/routes/dashboardRoutes')); 
app.use('/api/categories', categoryRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/orders', orderRoutes);

// ✅ Default route for server status
app.get('/', (req, res) => {
  res.send('🍏 Snowberry API');
});

// ✅ Debug Log: Confirm routes are registered
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`✅ Registered route: ${r.route.path} [${Object.keys(r.route.methods)}]`);
  }
});

// ✅ Error Handling Middleware
app.use((req, res, next) => {
  res.status(404).json({ message: "API route not found!" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// ✅ Listen on the dynamic port (Vercel auto-assigns the port)
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
