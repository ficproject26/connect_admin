const axios = require('axios');

async function testAgentBackend() {
  try {
    console.log("Testing GET http://13.232.157.132:5001/api/vendors ...");
    const res = await axios.get('http://13.232.157.132:5001/api/vendors');
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  } catch (err) {
    console.error("GET error:", err.message, err.response?.data);
  }
}

testAgentBackend();
