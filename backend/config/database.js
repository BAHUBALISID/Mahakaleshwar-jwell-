const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize admin user if not exists
    await initializeAdmin();
    
    // Initialize default rates if not exists
    await initializeRates();
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const initializeAdmin = async () => {
  const User = require('../models/User');
  const bcrypt = require('bcryptjs');
  
  const adminExists = await User.findOne({ username: process.env.ADMIN_USERNAME });
  
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await User.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
      role: 'admin',
      shopName: 'Shri Mahakaleshwar Jewellers',
      address: 'Anisabad, Patna, Bihar',
      gstin: '10AABCU9603R1Z1',
      phone: '0612-XXXXXX',
      email: 'mahakaleshwarjewellers@gmail.com'
    });
    
    console.log('Default admin user created');
  }
};

const initializeRates = async () => {
  const Rate = require('../models/Rate');
  
  const ratesExist = await Rate.findOne();
  
  if (!ratesExist) {
    await Rate.create({
      gold24K: 6000000, // ₹60,000 per 10g = ₹6,000,000 per kg
      gold22K: 5500000,
      gold18K: 4500000,
      silver999: 75000, // ₹75 per g = ₹75,000 per kg
      silver925: 69375,
      lastUpdated: new Date()
    });
    
    console.log('Default rates initialized');
  }
};

module.exports = connectDB;
