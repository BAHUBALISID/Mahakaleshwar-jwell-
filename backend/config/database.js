const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize default metal categories
    await initializeMetalCategories();
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const initializeMetalCategories = async () => {
  const Rate = require('../models/Rate');
  const categories = [
    { name: 'Gold', unit: 'kg', active: true, purityLevels: ['24K', '22K', '18K', '14K'] },
    { name: 'Silver', unit: 'kg', active: true, purityLevels: ['99.9%', '92.5%', '90%'] },
    { name: 'Diamond', unit: 'carat', active: true, purityLevels: ['D-Flawless', 'G-VVS', 'I-VS', 'K-SI'] },
    { name: 'Platinum', unit: 'kg', active: true, purityLevels: ['95%', '90%', '85%'] },
    { name: 'Antique / Polki', unit: 'piece', active: true, purityLevels: ['Handmade', 'Machine'] },
    { name: 'Others', unit: 'piece', active: true, purityLevels: ['Custom'] }
  ];

  for (const category of categories) {
    const exists = await Rate.findOne({ metalType: category.name });
    if (!exists) {
      await Rate.create({
        metalType: category.name,
        rate: 0,
        unit: category.unit,
        purityLevels: category.purityLevels,
        active: category.active
      });
    }
  }
};

module.exports = connectDB;
