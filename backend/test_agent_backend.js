const axios = require('axios');

async function testAgentBackend() {
  try {
    console.log("Testing GET https://connect-agent-oy0d.onrender.com/api/vendors ...");
    const res = await axios.get('https://connect-agent-oy0d.onrender.com/api/vendors');
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  } catch (err) {
    console.error("GET error:", err.message, err.response?.data);
  }
}

testAgentBackend();
