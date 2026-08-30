// Quick diagnostic: login as admin, then fetch /api/admin/agents
// Uses built-in fetch (Node 18+)

const BASE = 'https://connect-admin-qlcy.onrender.com';

async function main() {
    console.log('=== Step 1: Login ===');
    let loginRes;
    try {
        loginRes = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
        });
    } catch (e) {
        console.error('Login fetch error:', e.message);
        return;
    }

    console.log('Login status:', loginRes.status);
    const loginContentType = loginRes.headers.get('content-type') || '';
    console.log('Login content-type:', loginContentType);
    
    if (!loginRes.ok) {
        const text = await loginRes.text();
        console.error('Login failed:', text.substring(0, 500));
        return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    if (!token) {
        console.error('No token in login response:', JSON.stringify(loginData).substring(0, 500));
        return;
    }
    console.log('Token received:', token.substring(0, 30) + '...');

    console.log('\n=== Step 2: Fetch /api/admin/agents ===');
    let agentsRes;
    try {
        agentsRes = await fetch(`${BASE}/api/admin/agents`, {
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            }
        });
    } catch (e) {
        console.error('Agents fetch error:', e.message);
        return;
    }

    console.log('Agents status:', agentsRes.status);
    const agentsContentType = agentsRes.headers.get('content-type') || '';
    console.log('Agents content-type:', agentsContentType);

    if (agentsRes.status === 401 || agentsRes.status === 403) {
        const text = await agentsRes.text();
        console.error('AUTH REJECTED:', text.substring(0, 500));
        return;
    }

    if (!agentsRes.ok) {
        const text = await agentsRes.text();
        console.error('Non-OK response:', text.substring(0, 500));
        return;
    }

    const agentsData = await agentsRes.json();
    
    if (Array.isArray(agentsData)) {
        console.log(`\nAPI returned ARRAY with ${agentsData.length} agents`);
        agentsData.forEach((a, i) => {
            console.log(`  [${i}] name=${a.name}, level=${a.level}, status=${a.status}, email=${a.email}`);
        });
    } else if (agentsData && typeof agentsData === 'object') {
        console.log('\nAPI returned OBJECT with keys:', Object.keys(agentsData));
        if (Array.isArray(agentsData.agents)) {
            console.log(`agentsData.agents has ${agentsData.agents.length} items`);
        }
        if (Array.isArray(agentsData.data)) {
            console.log(`agentsData.data has ${agentsData.data.length} items`);
        }
        console.log('Full response (first 1000 chars):', JSON.stringify(agentsData).substring(0, 1000));
    } else {
        console.log('Unexpected response type:', typeof agentsData, JSON.stringify(agentsData).substring(0, 500));
    }
}

main().catch(e => console.error('Fatal:', e));
