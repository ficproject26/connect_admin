const axios = require('axios');

async function run() {
    try {
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log('Login successful, token resolved');
        
        const agentsRes = await axios.get('http://localhost:5000/api/admin/agents', {
            headers: { 'x-auth-token': token }
        });
        console.log('Agents API returned:', agentsRes.data.map(a => ({ name: a.name, status: a.status })));

        // Check if tie-ups endpoint exists and what it returns
        try {
            const tieupsRes = await axios.get('http://localhost:5000/api/admin/tie-ups', {
                headers: { 'x-auth-token': token }
            });
            console.log('Tie-ups API returned:', tieupsRes.data);
        } catch (e) {
            console.log('Tie-ups API error:', e.response ? e.response.status : e.message);
        }
    } catch (err) {
        console.error('API Error:', err.response ? err.response.data : err.message);
    }
}

run();
