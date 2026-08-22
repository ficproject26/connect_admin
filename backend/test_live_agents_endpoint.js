const http = require('http');

const postData = JSON.stringify({ email: 'admin@example.com', password: 'admin123' });

const run = async () => {
    // 1. Login to get token
    const loginReq = http.request({
        hostname: '13.203.197.69',
        port: 8004,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log('Login Status:', res.statusCode);
            try {
                const loginData = JSON.parse(body);
                const token = loginData.token;
                console.log('Token acquired:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

                if (token) {
                    // 2. Fetch /api/admin/agents
                    const agentReq = http.request({
                        hostname: '13.203.197.69',
                        port: 8004,
                        path: '/api/admin/agents',
                        method: 'GET',
                        headers: {
                            'x-auth-token': token,
                            'Content-Type': 'application/json'
                        }
                    }, (aRes) => {
                        let aBody = '';
                        console.log('GET /api/admin/agents Status:', aRes.statusCode);
                        aRes.on('data', chunk => aBody += chunk);
                        aRes.on('end', () => {
                            try {
                                const agents = JSON.parse(aBody);
                                console.log('Total agents returned:', Array.isArray(agents) ? agents.length : agents);
                                if (Array.isArray(agents)) {
                                    agents.forEach((a, i) => console.log(`Agent ${i+1}: name="${a.name}", email="${a.email}", role="${a.role}", level="${a.level}", status="${a.status}", kycStatus="${a.kycStatus}", isActive=${a.isActive}`));
                                } else {
                                    console.log('Raw response:', aBody);
                                }
                            } catch (e) {
                                console.log('JSON Parse error on /agents:', e.message, aBody.slice(0, 200));
                            }
                            process.exit(0);
                        });
                    });
                    agentReq.on('error', e => console.error('Agent Req Error:', e.message));
                    agentReq.end();
                }
            } catch (e) {
                console.log('Login parse error:', e.message, body.slice(0, 200));
                process.exit(1);
            }
        });
    });

    loginReq.on('error', e => console.error('Login Error:', e.message));
    loginReq.write(postData);
    loginReq.end();
};

run();
