const express = require('express');
const app = express();
const dotenv = require('dotenv');
const path = require('path');
const auditLog = require('./middlewares/auditLog')
dotenv.config(); 
const cors = require('cors');
const connectToDb = require('./Db/db')
const userRoutes = require('./routes/user.routes');
const agencyRoutes = require('./routes/agency.router');
// Middleware (order matters!)
const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

connectToDb();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));
/*********************************************************************************** */
// // Middleware to set security headers
// app.use((req, res, next) => {
//   res.setHeader("X-Frame-Options", "SAMEORIGIN");

//   res.setHeader(
//     "Content-Security-Policy",
//     `default-src 'self' cdn.jsdelivr.net maps.googleapis.com cdn.arcgis.com basemaps.arcgis.com; img-src 'self' data: http://192.168.192.177:9000; frame-ancestors 'self'; script-src 'self' 'nonce-${global.nonce}'`
//   );

//   next();
// });

//****************************************************************************** */

app.use(auditLog);
app.use((req, res, next) => {
  console.log('Request content length:', req.headers['content-length']);
  next();
});

// app.use(cookieparser());
app.listen(port, () => {
  console.log(`HTTPS Server is running on port ${port}`);
});
app.use('/backend/user', userRoutes);
// app.use('/agencies',agencyRoutes);
app.use('/backend',agencyRoutes);

// app.use('/images', imageRoutes);
app.get('/backend',(req, res) => {
  res.send("Hey Server is Running");
  
})

module.exports = app;