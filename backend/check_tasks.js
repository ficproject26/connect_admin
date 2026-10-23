const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Task = require('./models/Task');
const User = require('./models/User');

dotenv.config();

const run = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';
        await mongoose.connect(uri);
        const tasks = await Task.find();
        console.log("ALL TASKS:", tasks);
        
        const agents = await User.find({ role: 'agent' });
        console.log("AGENTS:", agents.map(a => ({ id: a._id, name: a.name, email: a.email })));
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
