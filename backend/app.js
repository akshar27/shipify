const cors = require('cors');
const express = require('express');
require('dotenv').config();

const app = express();

// ✅ Wide open CORS just to confirm
app.use(cors());
app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));
app.use('/api/trips', require('./routes/tripRoutes'));
app.use('/api/match', require('./routes/matchRoutes'));
app.use('/api/request', require('./routes/requestRoutes'));
app.use('/api/verification', require('./routes/verificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/rating', require('./routes/ratingRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
