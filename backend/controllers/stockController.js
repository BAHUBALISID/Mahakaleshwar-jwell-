const Stock = require('../models/Stock');
const Bill = require('../models/Bill');
const { auth } = require('../middleware/auth');

class StockController {
  // Get all stock items
  async getAllStock(req, res) {
    try {
      const { 
        metalType, 
        purity, 
        lowStockOnly,
        page = 1,
        limit = 100,
        sortBy = 'metalType',
        sortOrder = 'asc'
      } = req.query;

      // Build filter
      const filter = {};
      if (metalType) filter.metalType = metalType;
      if (purity) filter.purity = purity;
      if (lowStockOnly === 'true') filter.isLowStock = true;

      // Sort options
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get stock items with pagination
      const stock = await Stock.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Stock.countDocuments(filter);

      res.json({
        success: true,
        stock,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get all stock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get single stock item
  async getStockItem(req, res) {
    try {
      const stock = await Stock.findById(req.params.id).lean();

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      res.json({
        success: true,
        stock
      });

    } catch (error) {
      console.error('Get stock item error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Create new stock item
  async createStockItem(req, res) {
    try {
      const {
        metalType,
        purity,
        productName,
        quantity,
        weight,
        costPrice,
        sellingReferencePrice,
        lowStockThreshold,
        notes
      } = req.body;

      // Validation
      if (!metalType || !purity || !productName) {
        return res.status(400).json({ 
          error: 'Metal type, purity, and product name are required' 
        });
      }

      // Check if stock item already exists
      const existingStock = await Stock.findOne({
        metalType,
        purity,
        productName
      });

      if (existingStock) {
        return res.status(400).json({
          error: 'Stock item already exists for this metal, purity, and product'
        });
      }

      // Create new stock item
      const stock = new Stock({
        metalType,
        purity,
        productName,
        quantity: quantity || 0,
        weight: weight || 0,
        costPrice: costPrice || null,
        sellingReferencePrice: sellingReferencePrice || null,
        lowStockThreshold: lowStockThreshold || 5,
        notes: notes || '',
        createdBy: req.user._id
      });

      await stock.save();

      // Add initial transaction
      stock.transactions.push({
        transactionType: 'in',
        quantity: quantity || 0,
        weight: weight || 0,
        metalType,
        purity,
        productName,
        costPrice: costPrice || null,
        sellingPrice: sellingReferencePrice || null,
        notes: 'Initial stock entry',
        createdBy: req.user._id
      });

      await stock.save();

      res.status(201).json({
        success: true,
        message: 'Stock item created successfully',
        stock
      });

    } catch (error) {
      console.error('Create stock item error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Update stock item
  async updateStockItem(req, res) {
    try {
      const stock = await Stock.findById(req.params.id);

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      // Update fields
      const updateFields = [
        'metalType', 'purity', 'productName', 'quantity', 'weight',
        'costPrice', 'sellingReferencePrice', 'lowStockThreshold', 'notes'
      ];

      updateFields.forEach(field => {
        if (req.body[field] !== undefined) {
          stock[field] = req.body[field];
        }
      });

      stock.lastUpdated = new Date();
      await stock.save();

      res.json({
        success: true,
        message: 'Stock item updated successfully',
        stock
      });

    } catch (error) {
      console.error('Update stock item error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Delete stock item
  async deleteStockItem(req, res) {
    try {
      const stock = await Stock.findById(req.params.id);

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      // Check if stock has transactions
      if (stock.transactions.length > 0 && stock.quantity > 0) {
        return res.status(400).json({
          error: 'Cannot delete stock item with existing quantity or transactions'
        });
      }

      await stock.deleteOne();

      res.json({
        success: true,
        message: 'Stock item deleted successfully'
      });

    } catch (error) {
      console.error('Delete stock item error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Adjust stock quantity
  async adjustStock(req, res) {
    try {
      const stock = await Stock.findById(req.params.id);

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      const {
        adjustmentType, // 'in', 'out', 'adjustment'
        quantity,
        weight,
        costPrice,
        sellingPrice,
        notes
      } = req.body;

      if (!adjustmentType || (quantity === undefined && weight === undefined)) {
        return res.status(400).json({ 
          error: 'Adjustment type and quantity/weight are required' 
        });
      }

      // Update stock based on adjustment type
      if (adjustmentType === 'in') {
        stock.quantity += quantity || 0;
        stock.weight += weight || 0;
      } else if (adjustmentType === 'out') {
        stock.quantity = Math.max(0, stock.quantity - (quantity || 0));
        stock.weight = Math.max(0, stock.weight - (weight || 0));
      } else if (adjustmentType === 'adjustment') {
        stock.quantity = quantity || stock.quantity;
        stock.weight = weight || stock.weight;
      }

      // Update cost/selling price if provided
      if (costPrice !== undefined) stock.costPrice = costPrice;
      if (sellingPrice !== undefined) stock.sellingReferencePrice = sellingPrice;

      // Add transaction record
      stock.transactions.push({
        transactionType: adjustmentType,
        quantity: quantity || 0,
        weight: weight || 0,
        metalType: stock.metalType,
        purity: stock.purity,
        productName: stock.productName,
        costPrice: costPrice || stock.costPrice,
        sellingPrice: sellingPrice || stock.sellingReferencePrice,
        notes: notes || 'Manual adjustment',
        createdBy: req.user._id
      });

      stock.lastUpdated = new Date();
      await stock.save();

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        stock: {
          _id: stock._id,
          productName: stock.productName,
          metalType: stock.metalType,
          purity: stock.purity,
          quantity: stock.quantity,
          weight: stock.weight,
          isLowStock: stock.isLowStock
        }
      });

    } catch (error) {
      console.error('Adjust stock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get stock history
  async getStockHistory(req, res) {
    try {
      const stock = await Stock.findById(req.params.id);

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      res.json({
        success: true,
        stock: {
          _id: stock._id,
          productName: stock.productName,
          metalType: stock.metalType,
          purity: stock.purity
        },
        transactions: stock.transactions.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        )
      });

    } catch (error) {
      console.error('Get stock history error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get low stock alerts
  async getLowStockAlerts(req, res) {
    try {
      const lowStockItems = await Stock.find({ isLowStock: true }).lean();

      const alerts = {
        outOfStock: {
          count: 0,
          items: []
        },
        lowStock: {
          count: 0,
          items: []
        },
        slowMoving: {
          count: 0,
          items: []
        }
      };

      lowStockItems.forEach(item => {
        if (item.quantity === 0) {
          alerts.outOfStock.count++;
          alerts.outOfStock.items.push({
            product: item.productName,
            metal: `${item.metalType} ${item.purity}`,
            quantity: item.quantity
          });
        } else {
          alerts.lowStock.count++;
          alerts.lowStock.items.push({
            product: item.productName,
            metal: `${item.metalType} ${item.purity}`,
            quantity: item.quantity,
            weight: item.weight,
            daysToStockOut: this.calculateDaysToStockOut(item)
          });
        }
      });

      // Check for slow moving items (no transactions in last 30 days)
      // This is a simplified version
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // In a real implementation, you would check transaction history
      // For now, we'll check items with high quantity but no recent sales
      const allStock = await Stock.find().lean();
      allStock.forEach(item => {
        if (item.quantity > 10 && item.quantity === item.lowStockThreshold * 2) {
          alerts.slowMoving.count++;
          alerts.slowMoving.items.push({
            product: item.productName,
            metal: `${item.metalType} ${item.purity}`,
            quantity: item.quantity,
            lastUpdated: item.lastUpdated
          });
        }
      });

      res.json({
        success: true,
        alerts,
        summary: {
          totalLowStock: lowStockItems.length,
          totalOutOfStock: alerts.outOfStock.count,
          totalSlowMoving: alerts.slowMoving.count
        }
      });

    } catch (error) {
      console.error('Get low stock alerts error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  calculateDaysToStockOut(item) {
    // Simplified calculation
    // In real implementation, use sales velocity
    const avgDailyUsage = 0.1; // Example: 0.1 units per day
    return Math.round(item.quantity / avgDailyUsage);
  }

  // Reconcile stock
  async reconcileStock(req, res) {
    try {
      const stock = await Stock.findById(req.params.id);

      if (!stock) {
        return res.status(404).json({ error: 'Stock item not found' });
      }

      const {
        actualQuantity,
        actualWeight,
        notes
      } = req.body;

      if (actualQuantity === undefined && actualWeight === undefined) {
        return res.status(400).json({ 
          error: 'Actual quantity or weight is required' 
        });
      }

      const quantityDiff = actualQuantity - stock.quantity;
      const weightDiff = actualWeight - stock.weight;

      // Update stock to actual values
      if (actualQuantity !== undefined) stock.quantity = actualQuantity;
      if (actualWeight !== undefined) stock.weight = actualWeight;

      // Add reconciliation transaction
      stock.transactions.push({
        transactionType: 'adjustment',
        quantity: quantityDiff || 0,
        weight: weightDiff || 0,
        metalType: stock.metalType,
        purity: stock.purity,
        productName: stock.productName,
        notes: `Reconciliation: ${notes || 'Physical count adjustment'}`,
        createdBy: req.user._id
      });

      stock.lastUpdated = new Date();
      await stock.save();

      res.json({
        success: true,
        message: 'Stock reconciled successfully',
        reconciliation: {
          previousQuantity: stock.quantity - quantityDiff,
          previousWeight: stock.weight - weightDiff,
          newQuantity: stock.quantity,
          newWeight: stock.weight,
          quantityDifference: quantityDiff,
          weightDifference: weightDiff
        },
        stock
      });

    } catch (error) {
      console.error('Reconcile stock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Bulk update stock
  async bulkUpdateStock(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ 
          error: 'Updates array is required' 
        });
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const stock = await Stock.findById(update._id);
          
          if (!stock) {
            errors.push({ _id: update._id, error: 'Stock item not found' });
            continue;
          }

          // Update fields
          if (update.quantity !== undefined) stock.quantity = update.quantity;
          if (update.weight !== undefined) stock.weight = update.weight;
          if (update.costPrice !== undefined) stock.costPrice = update.costPrice;
          if (update.sellingReferencePrice !== undefined) 
            stock.sellingReferencePrice = update.sellingReferencePrice;

          stock.lastUpdated = new Date();
          await stock.save();

          results.push({
            _id: stock._id,
            productName: stock.productName,
            updated: true
          });

        } catch (error) {
          errors.push({ _id: update._id, error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk update completed: ${results.length} updated, ${errors.length} failed`,
        results,
        errors
      });

    } catch (error) {
      console.error('Bulk update stock error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get stock valuation
  async getStockValuation(req, res) {
    try {
      const stock = await Stock.find().lean();

      const valuation = {
        totalItems: stock.length,
        totalQuantity: 0,
        totalWeight: 0,
        costValue: 0,
        sellingValue: 0,
        metalBreakdown: {}
      };

      stock.forEach(item => {
        valuation.totalQuantity += item.quantity;
        valuation.totalWeight += item.weight;
        
        // Calculate cost value
        if (item.costPrice) {
          valuation.costValue += item.weight * item.costPrice;
        }
        
        // Calculate selling value
        if (item.sellingReferencePrice) {
          valuation.sellingValue += item.weight * item.sellingReferencePrice;
        }

        // Metal breakdown
        const key = `${item.metalType}_${item.purity}`;
        if (!valuation.metalBreakdown[key]) {
          valuation.metalBreakdown[key] = {
            metalType: item.metalType,
            purity: item.purity,
            items: 0,
            quantity: 0,
            weight: 0,
            sellingValue: 0
          };
        }
        
        valuation.metalBreakdown[key].items++;
        valuation.metalBreakdown[key].quantity += item.quantity;
        valuation.metalBreakdown[key].weight += item.weight;
        
        if (item.sellingReferencePrice) {
          valuation.metalBreakdown[key].sellingValue += 
            item.weight * item.sellingReferencePrice;
        }
      });

      // Calculate profit margin
      valuation.profitMargin = valuation.costValue > 0 ?
        ((valuation.sellingValue - valuation.costValue) / valuation.costValue) * 100 : 0;

      // Convert metal breakdown to array
      valuation.metalBreakdownArray = Object.values(valuation.metalBreakdown)
        .sort((a, b) => b.sellingValue - a.sellingValue);

      res.json({
        success: true,
        valuation
      });

    } catch (error) {
      console.error('Get stock valuation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Export stock data
  async exportStock(req, res) {
    try {
      const stock = await Stock.find().lean();

      // Format data for export
      const exportData = stock.map(item => ({
        'ID': item._id,
        'Product Name': item.productName,
        'Metal Type': item.metalType,
        'Purity': item.purity,
        'Quantity': item.quantity,
        'Weight (g)': item.weight,
        'Cost Price (₹/g)': item.costPrice || 0,
        'Selling Price (₹/g)': item.sellingReferencePrice || 0,
        'Stock Value (₹)': item.weight * (item.sellingReferencePrice || 0),
        'Low Stock Threshold': item.lowStockThreshold,
        'Stock Status': item.isLowStock ? 'Low Stock' : 'Normal',
        'Last Updated': new Date(item.lastUpdated).toISOString(),
        'Notes': item.notes || ''
      }));

      res.json({
        success: true,
        data: exportData,
        metadata: {
          exportedAt: new Date().toISOString(),
          totalItems: exportData.length,
          format: 'JSON'
        }
      });

    } catch (error) {
      console.error('Export stock error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new StockController();
