const Rate = require('../models/Rate');

class RateController {
  // Create or update rate
  async upsertRate(req, res) {
    try {
      const { metalType, purity, rate, gstApplicable, gstPercentage } = req.body;

      if (!metalType || !purity || rate === undefined) {
        return res.status(400).json({ error: 'Metal type, purity, and rate are required' });
      }

      // Check if rate already exists
      const existingRate = await Rate.findOne({
        metalType,
        purity
      });

      if (existingRate) {
        // Update existing rate
        existingRate.rate = rate;
        existingRate.gstApplicable = gstApplicable !== undefined ? gstApplicable : true;
        existingRate.gstPercentage = gstPercentage || 3;
        existingRate.lastUpdated = new Date();
        existingRate.updatedBy = req.user._id;

        await existingRate.save();

        res.json({
          success: true,
          message: 'Rate updated successfully',
          rate: existingRate
        });
      } else {
        // Create new rate
        const newRate = new Rate({
          metalType,
          purity,
          rate,
          gstApplicable: gstApplicable !== undefined ? gstApplicable : true,
          gstPercentage: gstPercentage || 3,
          updatedBy: req.user._id
        });

        await newRate.save();

        res.status(201).json({
          success: true,
          message: 'Rate created successfully',
          rate: newRate
        });
      }

    } catch (error) {
      console.error('Upsert rate error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get all rates
  async getRates(req, res) {
    try {
      const { metalType, activeOnly } = req.query;
      
      const filter = {};
      if (metalType) filter.metalType = metalType;
      if (activeOnly === 'true') filter.isActive = true;

      const rates = await Rate.find(filter)
        .populate('updatedBy', 'name email')
        .sort({ metalType: 1, purity: 1 })
        .lean();

      res.json({
        success: true,
        rates
      });

    } catch (error) {
      console.error('Get rates error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get active rates for dropdown
  async getActiveRates(req, res) {
    try {
      const rates = await Rate.find({ isActive: true })
        .select('metalType purity rate gstApplicable')
        .sort({ metalType: 1, purity: 1 })
        .lean();

      // Group by metal type
      const groupedRates = rates.reduce((acc, rate) => {
        if (!acc[rate.metalType]) {
          acc[rate.metalType] = [];
        }
        acc[rate.metalType].push({
          purity: rate.purity,
          rate: rate.rate,
          gstApplicable: rate.gstApplicable
        });
        return acc;
      }, {});

      res.json({
        success: true,
        rates: groupedRates
      });

    } catch (error) {
      console.error('Get active rates error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Toggle rate active status
  async toggleRateStatus(req, res) {
    try {
      const rate = await Rate.findById(req.params.id);

      if (!rate) {
        return res.status(404).json({ error: 'Rate not found' });
      }

      rate.isActive = !rate.isActive;
      rate.lastUpdated = new Date();
      rate.updatedBy = req.user._id;

      await rate.save();

      res.json({
        success: true,
        message: `Rate ${rate.isActive ? 'activated' : 'deactivated'} successfully`,
        rate
      });

    } catch (error) {
      console.error('Toggle rate status error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Delete rate
  async deleteRate(req, res) {
    try {
      const rate = await Rate.findById(req.params.id);

      if (!rate) {
        return res.status(404).json({ error: 'Rate not found' });
      }

      // Check if rate is being used in any bills
      const Bill = require('../models/Bill');
      const billCount = await Bill.countDocuments({
        'items.metalType': rate.metalType,
        'items.purity': rate.purity
      });

      if (billCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete rate. It is being used in existing bills.'
        });
      }

      await rate.deleteOne();

      res.json({
        success: true,
        message: 'Rate deleted successfully'
      });

    } catch (error) {
      console.error('Delete rate error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get rate history
  async getRateHistory(req, res) {
    try {
      const { metalType, purity, days = 30 } = req.query;
      
      const filter = {};
      if (metalType) filter.metalType = metalType;
      if (purity) filter.purity = purity;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      filter.updatedAt = { $gte: cutoffDate };

      const history = await Rate.find(filter)
        .select('metalType purity rate gstApplicable updatedAt updatedBy')
        .populate('updatedBy', 'name')
        .sort({ updatedAt: -1 })
        .lean();

      res.json({
        success: true,
        history
      });

    } catch (error) {
      console.error('Get rate history error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new RateController();
