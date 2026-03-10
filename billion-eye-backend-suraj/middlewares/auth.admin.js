const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Invalid token format.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token' });
    }
};
