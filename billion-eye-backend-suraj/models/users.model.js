const bcrypt = require('bcryptjs');
const { uri } = require("../config.js"); ////docker purpose

const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

// const uri = process.env.DB_CONNECT;
const client = new MongoClient(uri);

async function getUserCollection() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    const db = client.db('billoneyedata');
    return db.collection('users');
}

// Ignore this function
async function registerUser(user) {
    const collection = await getUserCollection();
    console.log('[registerUser] Accessed user collection.');

    // Check if the email is already registered
    const existingUser = await collection.findOne({ email: user.email });
    if (existingUser) {
        console.error('[registerUser] Email already exists:', user.email);
        throw new Error('Email already exists');
    }
    console.log('[registerUser] Email is not registered, proceeding.');

    // Hash the user's password
    const hashedPassword = await bcrypt.hash(user.password, 10);
    console.log('[registerUser] Password hashed.',user.password);
    
    // Insert user into the database
    const newUser = {
        fullname: user.fullname,
        email: user.email,
        password: hashedPassword,
        createdAt: new Date(),
    };

    const result = await collection.insertOne(newUser);
    console.log('[registerUser] New user inserted:', { userId: result.insertedId, email: user.email });
    
    return result.insertedId;
}

// Ignore this function
async function getUserByEmail(email) {
    console.log('[getUserByEmail] Fetching user by email:', email);
    const collection = await getUserCollection();
    const user = await collection.findOne({ email });
    if (user) {
        console.log('[getUserByEmail] User found:', email);
    } else {
        console.log('[getUserByEmail] User not found:', email);
    }
    return user;
}

// Ignore this function
async function loginUser(email, password) {
    console.log('Login attempt with email:', email);
    console.log(password);
    const collection = await getUserCollection();
    
    const user = await collection.findOne({ email });
    if (!user) {
        console.error('User not found for email:', email);
        throw new Error('Invalid email or password');
    }
    
    console.log('Stored hashed password:', user.password);
    console.log('Entered password:', password);

    // const isPasswordValid = await bcrypt.compare(user.password);
    // console.log()
    const isPasswordValid = user.password ;
    // console.log(isPasswordValid);
    // console.log('Password match result:', password);


    if (!isPasswordValid) {
        console.error('Password mismatch for user:', email);
        throw new Error('Invalid email or password');
    }

    console.log('Login successful for user:', email);
    return user;
}





function generateAuthToken(userId) {
    return jwt.sign(
        { _id: userId },                // Payload (e.g., user ID)
        process.env.JWT_PRIVATE_KEY,    // Secret key
        { expiresIn: '24h' }            // Expiration time
    );
}

module.exports = {
    registerUser,
    getUserByEmail,
    loginUser,
    generateAuthToken,
};
