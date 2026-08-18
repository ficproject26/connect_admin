const run = async () => {
    try {
        const endpoints = [
            'http://13.232.157.132:5001/api/products',
            'http://13.232.157.132:5001/api/public/products',
            'http://13.232.157.132:5001/api/admin/products'
        ];

        for (const url of endpoints) {
            console.log(`\n--- Fetching from ${url} ---`);
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    console.log(`Status ${res.status}, Returned ${Array.isArray(data) ? data.length : typeof data} items:`);
                    if (Array.isArray(data)) {
                        data.forEach(p => {
                            console.log(`- Product: ID=${p._id || p.id}, name=${p.name || p.title}, vendorId=${p.vendorId}, vendorEmail=${p.vendorEmail}, vendorStatus=${p.vendorStatus}, isActive=${p.isActive}`);
                        });
                    } else {
                        console.log(data);
                    }
                } else {
                    console.log(`Status ${res.status}: ${res.statusText}`);
                }
            } catch (err) {
                console.error(`Fetch error for ${url}:`, err.message);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
