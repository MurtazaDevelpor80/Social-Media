const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = "your_jwt_secret"; // Change in production

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/social_media', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// Define schemas for User, Post, and Comment
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const postSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    imageUrl: String,
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// File upload (for images in posts)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Routes
// 1. Register user
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.json({ message: 'User registered successfully!' });
});

// 2. Login user
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token });
});

// 3. Create a post
app.post('/posts', upload.single('image'), async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const post = new Post({
        user: user._id,
        content: req.body.content,
        imageUrl: req.file ? req.file.path : null
    });
    await post.save();
    res.json({ message: 'Post created successfully!' });
});

// 4. Like a post
app.post('/posts/:id/like', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const post = await Post.findById(req.params.id);
    if (!post.likes.includes(decoded.userId)) {
        post.likes.push(decoded.userId);
        await post.save();
    }
    res.json({ message: 'Post liked!' });
});

// 5. Comment on a post
app.post('/posts/:id/comment', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const post = await Post.findById(req.params.id);
    post.comments.push({ user: decoded.userId, text: req.body.text });
    await post.save();
    res.json({ message: 'Comment added!' });
});

// 6. Follow another user
app.post('/users/:id/follow', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    const userToFollow = await User.findById(req.params.id);

    if (!user.following.includes(userToFollow._id)) {
        user.following.push(userToFollow._id);
        userToFollow.followers.push(user._id);
        await user.save();
        await userToFollow.save();
    }
    res.json({ message: 'User followed!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
