const bcrypt = require('bcryptjs');
const { uri } = require("../config.js");
const { MongoClient } = require('mongodb');

const client = new MongoClient(uri);

async function getAdminCollection() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    const db = client.db('billoneyedata');
    return db.collection('admins');
}

async function getAdminByEmail(email) {
    const collection = await getAdminCollection();
    return collection.findOne({ email });
}

async function createAdmin(admin) {
    const collection = await getAdminCollection();

    const existing = await collection.findOne({ email: admin.email });
    if (existing) {
        throw new Error('Email already exists');
    }

    const hashed = await bcrypt.hash(admin.password, 10);
    const newAdmin = {
        fullname: admin.fullname,
        email: admin.email,
        password: hashed,
        createdAt: new Date(),
    };

    const result = await collection.insertOne(newAdmin);
    return result.insertedId;
}

async function loginAdmin(email, password) {
    const admin = await getAdminByEmail(email);
    if (!admin) {
        throw new Error('Invalid email or password');
    }
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
        throw new Error('Invalid email or password');
    }
    return admin;
}

async function hasAnyAdmin() {
    const collection = await getAdminCollection();
    const count = await collection.estimatedDocumentCount();
    return count > 0;
}

function generateAuthToken(adminId) {
    // include role so middleware can verify
    return require('jsonwebtoken').sign(
        { _id: adminId, role: 'admin' },
        process.env.JWT_PRIVATE_KEY,
        { expiresIn: '24h' }
    );
}

module.exports = {
    getAdminByEmail,
    createAdmin,
    loginAdmin,
    generateAuthToken,
    hasAnyAdmin,
};
