const Rate = require('../models/Rate');
const { validationResult } = require('express-validator');

// @desc    Get all rates (admin only)
// @route   GET /api/rates
// @access  Private/Admin
exports.getAllRates = async (req, res) => {
  try {
    const rates = await Rate.find()
      .populate('updatedBy', 'name email')
      .sort({ metalType: 1, purity: 1 });
    
    res.json({
      success: true,
      count: rates.length,
      rates
    });
  } catch (error) {
    console.error('Get rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get active rates for billing
// @route   GET /api/rates/active
// @access  Private
exports.getActiveRates = async (req, res) => {
  try {
    const rates = await Rate.find({ isActive: true })
      .select('metalType purity rate gstApplicable unit')
      .sort({ metalType: 1, purity: 1 });
    
    // Group by metalType for frontend dropdowns
    const groupedRates = rates.reduce((acc, rate) => {
      if (!acc[rate.metalType]) {
        acc[rate.metalType] = [];
      }
      acc[rate.metalType].push({
        purity: rate.purity,
        rate: rate.rate,
        gstApplicable: rate.gstApplicable,
        unit: rate.unit
      });
      return acc;
    }, {});
    
    res.json({
      success: true,
      rates: groupedRates
    });
  } catch (error) {
    console.error('Get active rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new rate
// @route   POST /api/rates
// @access  Private/Admin
exports.createRate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const { metalType, purity, rate, gstApplicable, unit } = req.body;
    
    // Check if rate already exists
    const existingRate = await Rate.findOne({ metalType, purity });
    if (existingRate) {
      return res.status(400).json({
        success: false,
        message: 'Rate already exists for this metal and purity'
      });
    }
    
    const newRate = new Rate({
      metalType,
      purity,
      rate,
      gstApplicable: gstApplicable !== undefined ? gstApplicable : true,
      unit: unit || 'per gram',
      updatedBy: req.user.id
    });
    
    await newRate.save();
    
    res.status(201).json({
      success: true,
      message: 'Rate created successfully',
      rate: newRate
    });
  } catch (error) {
    console.error('Create rate error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Rate already exists for this metal and purity'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update rate
// @route   PUT /api/rates/:id
// @access  Private/Admin
exports.updateRate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const { metalType, purity, rate, gstApplicable, isActive, unit } = req.body;
    
    let existingRate = await Rate.findById(req.params.id);
    
    if (!existingRate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }
    
    // Check if updating to duplicate metal+purity
    if (metalType && purity) {
      const duplicate = await Rate.findOne({
        metalType,
        purity,
        _id: { $ne: req.params.id }
      });
      
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Rate already exists for this metal and purity'
        });
      }
    }
    
    // Update fields
    if (metalType) existingRate.metalType = metalType;
    if (purity) existingRate.purity = purity;
    if (rate !== undefined) existingRate.rate = rate;
    if (gstApplicable !== undefined) existingRate.gstApplicable = gstApplicable;
    if (isActive !== undefined) existingRate.isActive = isActive;
    if (unit) existingRate.unit = unit;
    existingRate.updatedBy = req.user.id;
    existingRate.lastUpdated = Date.now();
    
    await existingRate.save();
    
    res.json({
      success: true,
      message: 'Rate updated successfully',
      rate: existingRate
    });
  } catch (error) {
    console.error('Update rate error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Rate already exists for this metal and purity'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete rate
// @route   DELETE /api/rates/:id
// @access  Private/Admin
exports.deleteRate = async (req, res) => {
  try {
    const rate = await Rate.findById(req.params.id);
    
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }
    
    await rate.deleteOne();
    
    res.json({
      success: true,
      message: 'Rate deleted successfully'
    });
  } catch (error) {
    console.error('Delete rate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Bulk update rates
// @route   PUT /api/rates/bulk/update
// @access  Private/Admin
exports.bulkUpdateRates = async (req, res) => {
  try {
    const { rates } = req.body;
    
    if (!Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rates array is required'
      });
    }
    
    const updatePromises = rates.map(async (rate) => {
      const { id, rate: newRate } = rate;
      return Rate.findByIdAndUpdate(
        id,
        { 
          rate: newRate,
          updatedBy: req.user.id,
          lastUpdated: Date.now()
        },
        { new: true }
      );
    });
    
    const updatedRates = await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `${updatedRates.length} rates updated successfully`,
      rates: updatedRates
    });
  } catch (error) {
    console.error('Bulk update rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get rate history
// @route   GET /api/rates/:id/history
// @access  Private/Admin
exports.getRateHistory = async (req, res) => {
  try {
    const rate = await Rate.findById(req.params.id);
    
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Rate not found'
      });
    }
    
    // In a real system, you might have a separate RateHistory model
    // For now, we'll return basic change info
    res.json({
      success: true,
      history: [
        {
          date: rate.lastUpdated,
          rate: rate.rate,
          updatedBy: rate.updatedBy
        }
      ]
    });
  } catch (error) {
    console.error('Get rate history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
