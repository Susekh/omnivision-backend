const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    let token;
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.groundstaff_token) {
        token = req.cookies.groundstaff_token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        if (decoded.role !== 'groundstaff') {
            return res.status(403).json({ message: 'Access denied. Groundstaff only.' });
        }
        req.groundstaff = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token' });
    }
};