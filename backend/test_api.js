const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
    try {
        console.log("Logging in as agent...");
        const PORT = process.env.PORT || 5001;
        const res = await axios.post(`http://localhost:${PORT}/api/auth/login`, {
            email: 'kathir@gmail.com',
            password: 'password' // Assuming default password
        });
        
        const token = res.data.token;
        console.log("Got token:", token.substring(0, 20) + "...");

        const taskRes = await axios.get(`http://localhost:${PORT}/api/agent/tasks`, {
            headers: { 'x-auth-token': token }
        });

        console.log("API TASKS:", taskRes.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
};

run();
