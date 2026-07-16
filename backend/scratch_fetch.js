const axios = require('axios');

async function run() {
    try {
        const PORT = process.env.PORT || 5001;
        const loginRes = await axios.post(`http://localhost:${PORT}/api/auth/login`, {
            email: 'admin@example.com',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log('Login successful, token:', token);
        
        const vendorsRes = await axios.get(`http://localhost:${PORT}/api/admin/vendors`, {
            headers: { 'x-auth-token': token }
        });
        console.log('Vendors returned:', vendorsRes.data);
    } catch (err) {
        console.error('Error fetching vendors API:', err.response ? err.response.data : err.message);
    }
}

run();
