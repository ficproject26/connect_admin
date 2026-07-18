const poll = async () => {
    const url = 'https://connect-admin-backend.onrender.com/api/auth/login';
    console.log('Polling Render backend to check for new deployment...');
    
    for (let i = 0; i < 15; i++) {
        try {
            const start = Date.now();
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
            });
            const text = await res.text();
            console.log(`[${new Date().toLocaleTimeString()}] Status: ${res.status}, Body: ${text}`);
            if (res.status === 200 || text.includes('Invalid Credentials') || text.includes('msg')) {
                console.log('🎉 Render has deployed the updated backend codebase!');
                break;
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        // Wait 20 seconds
        await new Promise(resolve => setTimeout(resolve, 20000));
    }
};

poll();
