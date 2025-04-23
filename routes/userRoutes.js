console.log("✅ userRoutes.js has been loaded!");

const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken'); // Import JWT
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const Product = require("../models/productModel"); // Import Product model
const UnregUser = require("../models/unregModel");
const UnregModel=require("../models/unregModel");



// 🔹 1️⃣ Send OTP via Email
router.post('/send-otp-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required!" });
        }

        // Generate a 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP in database (expires in 5 mins)
        await OTP.create({ email, otp: otpCode });

        // Set up Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP for verification is: ${otpCode}. It is valid for 5 minutes.`,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "OTP sent successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
});
router.post('/send-otp-update', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { email, phone } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ message: "Email or phone number is required!" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in database (or update if already exists)
        await OTP.findOneAndUpdate({ email: user.email }, { otp: otpCode }, { upsert: true });

        // Set up Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email || user.email, // Send OTP to the new email if provided, otherwise use existing
            subject: "OTP for Profile Update",
            text: `Your OTP for updating profile is: ${otpCode}. It is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "OTP sent successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
});


// User Registration Route
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, otp } = req.body;

        if (!name || !email || !phone || !password || !otp) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // Verify OTP again before signup
        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: "Invalid or expired OTP!" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists!" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({ name, email, phone, password: hashedPassword });
        await newUser.save();

        // ✅ Now delete OTP after successful signup
        await OTP.deleteOne({ email });

        res.status(201).json({ message: "User registered successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// 🔹 3️⃣ User Login API
router.post("/login", async (req, res) => {  // ✅ Ensure this is async
    try {
        const { email, phone, password } = req.body;
        const user = await User.findOne({ $or: [{ email }, { phone }] }).select("+password");

        if (!user) return res.status(400).json({ message: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid password!" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // ✅ Ensure guest cart merge happens in an `async` function
        const guestCart = JSON.parse(req.body.guestCart || "[]");
        if (guestCart.length > 0) {
            guestCart.forEach(async (guestItem) => {  // ❌ This is inside forEach
                const existingItem = user.cart.find(item => item.productId.toString() === guestItem.productId);
                if (existingItem) {
                    existingItem.quantity += guestItem.quantity;
                } else {
                    user.cart.push({ productId: guestItem.productId, quantity: guestItem.quantity });
                }
            });
            await user.save();  // ✅ Fix: Ensure this is inside `async`
        }

        res.json({ message: "Login successful!", token, user: { name: user.name, email: user.email, phone: user.phone } });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});




// 🔹 4️⃣ Forgot Password (Send OTP)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required!" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.create({ email, otp: otpCode });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            text: `Your OTP for password reset is: ${otpCode}. It is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "OTP sent successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
});

// 🔹 5️⃣ Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: "Invalid or expired OTP!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.updateOne({ email }, { $set: { password: hashedPassword } });

        await OTP.deleteOne({ email });

        res.status(200).json({ message: "Password reset successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// 🔹 6️⃣ Verify OTP Route (Move Above module.exports)
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return res.status(400).json({ message: "Invalid or expired OTP!" });
        }

        res.status(200).json({ message: "OTP Verified Successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});


// 🔹 7️⃣ Get User Details (Protected Route)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password'); // Exclude password

        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
});
// 🔹 Update User Profile (with OTP verification for email/phone changes)
router.put('/update-profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, email, phone, otp } = req.body;

        if (!name && !email && !phone) {
            return res.status(400).json({ message: "At least one field is required!" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }
         // ✅ Check if new email already exists in the database (excluding current user)
         if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: "Email already exists!" });
            }
        }

        // ✅ Check if new phone already exists in the database (excluding current user)
        if (phone && phone !== user.phone) {
            const existingPhone = await User.findOne({ phone });
            if (existingPhone) {
                return res.status(400).json({ message: "Phone number already exists!" });
            }
        }

        // ✅ Verify OTP if email or phone is changing
        if ((email && email !== user.email) || (phone && phone !== user.phone)) {
            if (!otp) {
                return res.status(400).json({ message: "OTP is required to update email or phone!" });
            }

            const otpRecord = await OTP.findOne({ email: email || user.email, otp });
            if (!otpRecord) {
                return res.status(400).json({ message: "Invalid or expired OTP!" });
            }

            await OTP.deleteOne({ email: email || user.email });
        }

        // ✅ Update user details in MongoDB
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                name: name || user.name, 
                email: email || user.email, 
                phone: phone || user.phone 
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: "Profile updated successfully!", user: updatedUser });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});
router.post('/send-otp-update', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { email, phone } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ message: "Email or phone number is required!" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // ✅ Generate the same OTP for both email and phone
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in database (or update if already exists)
        await OTP.findOneAndUpdate({ email: user.email }, { otp: otpCode }, { upsert: true });

        // Set up Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // ✅ Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email || user.email, 
            subject: "OTP for Profile Update",
            text: `Your OTP for updating your profile is: ${otpCode}. It is valid for 5 minutes.`
        };

        await transporter.sendMail(mailOptions);

        // ✅ Send OTP to phone (Simulated - Use an SMS API in production)
        console.log(`OTP sent to phone ${phone || user.phone}: ${otpCode}`);

        res.status(200).json({ message: "OTP sent to both email and phone!" });

    } catch (error) {
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
});

// 🔹 GET Wishlist
router.get("/wishlist", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate("wishlist");
        res.json(user.wishlist);
    } catch (error) {
        res.status(500).json({ message: "Error fetching wishlist" });
    }
});

// 🔹 ADD to Wishlist
router.post("/wishlist", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ message: "Item is already in wishlist" }); // ✅ Ensures response
        }

        user.wishlist.push(productId);
        await user.save();

        res.status(200).json({ message: "Added to Wishlist" }); // ✅ Always returns success message
    } catch (error) {
        console.error("❌ Error adding to wishlist:", error);
        res.status(500).json({ message: "Error adding to wishlist", error: error.message });
    }
});


// 🔹 REMOVE from Wishlist
router.delete("/wishlist/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        await User.findByIdAndUpdate(req.user.userId, { $pull: { wishlist: productId } });
        res.json({ message: "Removed from Wishlist" });
    } catch (error) {
        res.status(500).json({ message: "Error removing from wishlist" });
    }
});


// ✅ Get User Cart
router.get("/cart", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate("cart.productId");

        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        res.json(user.cart.map(item => ({
            productId: item.productId._id,
            name: item.productId.name,
            price: item.productId.price,
            image: item.productId.image,
            quantity: item.quantity
        })));
    } catch (error) {
        res.status(500).json({ message: "Error fetching cart", error: error.message });
    }
});

router.delete("/cart/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user.userId);

        const cartItem = user.cart.find(item => item.productId.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        user.cart = user.cart.filter(item => item.productId.toString() !== productId);
        await user.save();

        res.json({ message: "Item removed from cart", cart: user.cart });
    } catch (error) {
        res.status(500).json({ message: "Error removing item", error: error.message });
    }
});


// ✅ Add to Cart
router.post("/cart", authMiddleware, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const user = await User.findById(req.user.userId);

        // Check if product is already in cart
        const cartItem = user.cart.find(item => item.productId.toString() === productId);
        if (cartItem) {
            cartItem.quantity += quantity;
        } else {
            user.cart.push({ productId, quantity });
        }

        await user.save();
        res.json({ message: "Added to cart", cart: user.cart });
    } catch (error) {
        res.status(500).json({ message: "Error adding to cart" });
    }
});


// 🔹 UPDATE Cart Quantity
router.put("/cart/:productId", authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1." });
        }

        const user = await User.findById(req.user.userId);
        const cartItem = user.cart.find(item => item.productId.toString() === productId);

        if (cartItem) {
            cartItem.quantity = quantity;
            await user.save();
            return res.json({ message: "Cart updated", cart: user.cart });
        }

        res.status(404).json({ message: "Product not found in cart" });
    } catch (error) {
        res.status(500).json({ message: "Error updating cart", error: error.message });
    }
});


console.log("✅ userRoutes.js is running!");

//USERS 

// ✅ Get all users (Newest first)
router.get("/", async (req, res) => {
    console.log("✅ /api/users route was hit! Fetching users...");
    try {
        const users = await User.find().sort({ createdAt: -1 });
        console.log("✅ Users fetched successfully.");
        res.json(users);
    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({ error: "Server error fetching users" });
    }
});


router.get("/users/search", async (req, res) => {
    try {
        const { query } = req.query;
        const users = await User.find({
            $or: [
                { name: { $regex: query, $options: "i" } },
                { email: { $regex: query, $options: "i" } },
                { phone: { $regex: query, $options: "i" } }
            ]
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Server error searching users" });
    }
});

// 📌 Allow Both Logged-in & Guest Users to Submit Queries
router.post("/contact", async (req, res) => {
    let { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required!" });
    }

    try {
        // ✅ Nodemailer Setup
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // ✅ Email Content
        const mailOptions = {
            from: email,
            to: process.env.EMAIL_USER, // ✅ Your email (Receives the query)
            subject: "New Contact Form Submission",
            text: `📌 Name: ${name}\n📧 Email: ${email}\n💬 Message:\n${message}`,
        };

        // ✅ Send Email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Message sent successfully!" });
    } catch (error) {
        console.error("❌ Error sending email:", error);
        res.status(500).json({ message: "Error sending message" });
    }
});
// Handle query submission

router.post("/send-query", authMiddleware, async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ message: "Query cannot be empty!" });
    }

    try {
        // ✅ Fetch user details using req.user.userId
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // ✅ Use user's name and email for sending the query
        const { name, email } = user;

        // ✅ Nodemailer Setup
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // ✅ Email Content
        const mailOptions = {
            from: `${name} <${email}>`, // ✅ Fixed to use user's details
            to: process.env.EMAIL_USER, // Admin or query recipient
            subject: "New User Query",
            text: `📧 From: ${name} (${email})\n💬 Query:\n${query}`,
        };

        // ✅ Send Email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Query sent successfully!" });
    } catch (error) {
        console.error("❌ Error sending query:", error);
        res.status(500).json({ message: "Error sending query." });
    }
});
// Route to save address for a logged-in user
router.post("/addAddress", authMiddleware, async (req, res) => {
    try {
        const { street, city, state, zipcode, country } = req.body;

        if (!street || !city || !state || !zipcode || !country) {
            return res.status(400).json({ message: "All address fields are required!" });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // ✅ Remove empty address entries before adding a new one
        user.address = user.address.filter(addr => 
            addr.street && addr.city && addr.state && addr.zipcode && addr.country
        );

        // ✅ Push the new address to the array
        user.address.push({ street, city, state, zipcode, country });

        // ✅ Save updated user data
        await user.save();

        res.status(200).json({ message: "Address saved successfully!", address: user.address });
    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).json({ message: "Server error!" });
    }
});
router.get("/getAddresses", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ name: user.name, address: user.address });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).json({ message: "Server error!" });
    }
});


// Route to save address for a guest user
router.post("/guest/addAddress", async (req, res) => {
    try {
        const { name, email, phone, street, city, state, zipcode, country } = req.body;

        if (!name || !email || !phone || !street || !city || !state || !zipcode || !country) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // Check if guest user already exists based on email
        let guestUser = await UnregModel.findOne({ email });

        if (!guestUser) {
            // Create a new guest user entry if not found
            guestUser = new UnregModel({ name, email, phone, address: [] });
        }

        // ✅ Remove empty address entries before adding a new one
        guestUser.address = guestUser.address.filter(addr =>
            addr.street && addr.city && addr.state && addr.zipcode && addr.country
        );

        // ✅ Push the new address to the array
        guestUser.address.push({ street, city, state, zipcode, country });

        // ✅ Save updated guest user data
        await guestUser.save();

        res.status(200).json({ message: "Guest address saved successfully!", address: guestUser.address });
    } catch (error) {
        console.error("Error saving guest address:", error);
        res.status(500).json({ message: "Server error!" });
    }
});

// Route to get addresses for a guest user based on email
router.get("/guest/getAddresses/:email", async (req, res) => {
    try {
        const { email } = req.params;

        // Fetch guest user by email
        const guestUser = await UnregModel.findOne({ email });

        if (!guestUser) {
            return res.status(404).json({ message: "Guest user not found" });
        }

        res.status(200).json({ name: guestUser.name, address: guestUser.address });
    } catch (error) {
        console.error("Error fetching guest addresses:", error);
        res.status(500).json({ message: "Server error!" });
    }
});
// DELETE route to remove guest addresses
router.delete('/guest/deleteAddress/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const unregUser = await UnregUser.findOne({ email });

        if (!unregUser) {
            return res.status(404).json({ message: "Guest address not found" });
        }

        // Remove address from the array (assuming address array is named 'addresses')
        unregUser.addresses = unregUser.addresses.filter(addr => addr.email !== email);
        await unregUser.save();

        res.status(200).json({ message: "Guest address deleted successfully" });
    } catch (error) {
        console.error("Error deleting guest address:", error);
        res.status(500).json({ message: "Failed to delete guest address" });
    }
});



// ✅ Fix: Move module.exports to the end
module.exports = router;
