const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';
        await mongoose.connect(dbURI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
