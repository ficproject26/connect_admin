const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
    try {
        console.log("Logging in as admin (staff/branch admin)...");
        // We need an admin user. We'll find one in DB and generate a token
        await mongoose.connect(process.env.MONGO_URI);
        const User = require('./models/User');
        const jwt = require('jsonwebtoken');

        const user = await User.findOne({ role: 'admin' }); // Get any admin
        console.log("Found admin:", user.name, user.email, "role:", user.adminRole);

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

        console.log("Got token.");

        const res = await axios.get('http://localhost:5000/api/admin/dashboard-stats', {
            headers: { 'x-auth-token': token }
        });

        console.log("API STATS:", res.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    } finally {
        process.exit();
    }
};

run();
