class BillingSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.currentBill = {
            customer: {
                name: '',
                mobile: '',
                address: '',
                dob: '',
                pan: '',
                aadhaar: ''
            },
            items: [],
            exchangeItems: [],
            discount: 0,
            paymentMode: 'cash',
            paymentStatus: 'paid',
            isIntraState: true // Default to intra-state
        };
        this.rates = {};
        this.init();
    }

    async init() {
        await this.loadRates();
        this.setupEventListeners();
        this.updateSummary();
        this.makeResponsive();
    }

    makeResponsive() {
        // Make form controls visible and responsive
        const style = document.createElement('style');
        style.textContent = `
            .item-row, .exchange-items-container .item-row {
                display: grid;
                gap: 8px;
                padding: 10px;
                background: #f5f5f5;
                border-radius: 5px;
                margin-bottom: 10px;
                align-items: center;
            }
            
            /* Mobile-first responsive grid */
            .item-row {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .exchange-items-container .item-row {
                grid-template-columns: repeat(3, 1fr);
            }
            
            /* Tablet */
            @media (min-width: 768px) {
                .item-row {
                    grid-template-columns: repeat(4, 1fr);
                }
                
                .exchange-items-container .item-row {
                    grid-template-columns: repeat(6, 1fr);
                }
            }
            
            /* Desktop */
            @media (min-width: 992px) {
                .item-row {
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto;
                }
                
                .exchange-items-container .item-row {
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto;
                }
            }
            
            .item-row input,
            .item-row select {
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .item-row button {
                padding: 8px 12px;
                white-space: nowrap;
            }
            
            /* Make form controls visible */
            .form-control {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
                position: static !important;
            }
            
            /* Responsive summary grid */
            .summary-grid {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            @media (min-width: 992px) {
                .summary-grid {
                    flex-direction: row;
                }
                
                .summary-left {
                    flex: 1;
                }
                
                .summary-right {
                    width: 400px;
                }
            }
            
            /* Make all dropdowns visible */
            select {
                background-color: white;
                border: 1px solid #ced4da;
                height: 38px;
                appearance: auto;
                -webkit-appearance: menulist;
                -moz-appearance: menulist;
                opacity: 1;
            }
            
            /* Touch-friendly buttons */
            .btn {
                padding: 10px 20px;
                font-size: 16px;
                min-height: 44px; /* Minimum touch target size */
            }
            
            /* Touch-friendly inputs */
            input, select, textarea {
                font-size: 16px; /* Prevents zoom on iOS */
                min-height: 44px;
            }
        `;
        document.head.appendChild(style);
    }

    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`);
            const data = await response.json();
            
            if (data.success) {
                this.rates = data.rates.reduce((acc, rate) => {
                    acc[rate.metalType] = rate;
                    return acc;
                }, {});
                
                // Populate metal type dropdowns
                this.populateMetalTypes();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            this.showAlert('danger', 'Failed to load rates. Please refresh the page.');
        }
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.getElementById('alertContainer').appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    populateMetalTypes() {
        const metalSelects = document.querySelectorAll('.metal-type');
        metalSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Metal</option>' + 
                Object.keys(this.rates)
                    .map(metal => `<option value="${metal}">${metal}</option>`)
                    .join('');
        });
    }

    setupEventListeners() {
        // Customer form
        document.getElementById('customerForm').addEventListener('input', (e) => {
            const field = e.target.name.replace('customer.', '');
            this.currentBill.customer[field] = e.target.value;
        });

        // GST type selection
        const gstTypeSelect = document.getElementById('gstType');
        if (gstTypeSelect) {
            gstTypeSelect.addEventListener('change', (e) => {
                this.currentBill.isIntraState = e.target.value === 'intra';
                this.updateSummary();
            });
        }

        // Add item button
        document.getElementById('addItemBtn').addEventListener('click', () => {
            this.addItemRow();
        });

        // Add exchange item button
        document.getElementById('addExchangeBtn').addEventListener('click', () => {
            this.addExchangeItemRow();
        });

        // Discount input
        document.getElementById('discount').addEventListener('input', (e) => {
            this.currentBill.discount = parseFloat(e.target.value) || 0;
            this.updateSummary();
        });

        // Payment mode
        document.getElementById('paymentMode').addEventListener('change', (e) => {
            this.currentBill.paymentMode = e.target.value;
        });

        // Generate bill button
        document.getElementById('generateBillBtn').addEventListener('click', () => {
            this.generateBill();
        });

        // Print button
        document.getElementById('printBillBtn').addEventListener('click', () => {
            this.printBill();
        });

        // Clear form button
        document.getElementById('clearFormBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the form?')) {
                this.clearForm();
            }
        });

        // Make dropdowns visible on focus
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'SELECT') {
                e.target.style.opacity = '1';
                e.target.style.zIndex = '1000';
            }
        }, true);

        // Handle window resize for responsiveness
        window.addEventListener('resize', () => this.updateResponsiveLayout());
    }

    updateResponsiveLayout() {
        // Update grid layout based on screen size
        const itemRows = document.querySelectorAll('.item-row');
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 992;
        
        itemRows.forEach(row => {
            if (row.closest('.exchange-items-container')) {
                if (isMobile) {
                    row.style.gridTemplateColumns = 'repeat(3, 1fr)';
                } else if (isTablet) {
                    row.style.gridTemplateColumns = 'repeat(6, 1fr)';
                } else {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto';
                }
            } else {
                if (isMobile) {
                    row.style.gridTemplateColumns = 'repeat(2, 1fr)';
                } else if (isTablet) {
                    row.style.gridTemplateColumns = 'repeat(4, 1fr)';
                } else {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr auto';
                }
            }
        });
    }

    addItemRow(isExchange = false) {
        const itemsContainer = isExchange ? 
            document.getElementById('exchangeItems') : 
            document.getElementById('itemsContainer');
        
        const itemId = Date.now();
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        itemRow.id = `item-${itemId}`;
        
        if (isExchange) {
            itemRow.innerHTML = `
                <input type="text" class="form-control item-description" placeholder="Description" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'description', this.value)">
                
                <select class="form-control metal-type" 
                        onchange="window.billingSystem.updateItem(${itemId}, 'metalType', this.value);
                                 window.billingSystem.updatePurities(this.value, ${itemId})">
                    <option value="">Select Metal</option>
                    ${Object.keys(this.rates).map(metal => 
                        `<option value="${metal}">${metal}</option>`
                    ).join('')}
                </select>
                
                <select class="form-control purity" 
                        onchange="window.billingSystem.updateItem(${itemId}, 'purity', this.value)">
                    <option value="">Select Purity</option>
                </select>
                
                <input type="number" class="form-control weight" step="0.001" placeholder="Weight" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'weight', this.value)">
                
                <input type="number" class="form-control wastage" step="0.1" placeholder="Wastage %" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'wastageDeduction', this.value)">
                
                <input type="number" class="form-control melting" step="0.01" placeholder="Melting Charges" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'meltingCharges', this.value)">
                
                <button class="btn btn-danger btn-sm" 
                        onclick="window.billingSystem.removeItem(${itemId}, true)">
                    <i class="fas fa-times"></i>
                </button>
            `;
        } else {
            itemRow.innerHTML = `
                <input type="text" class="form-control item-description" placeholder="Description" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'description', this.value)">
                
                <select class="form-control metal-type" 
                        onchange="window.billingSystem.updateItem(${itemId}, 'metalType', this.value);
                                 window.billingSystem.updatePurities(this.value, ${itemId})">
                    <option value="">Select Metal</option>
                    ${Object.keys(this.rates).map(metal => 
                        `<option value="${metal}">${metal}</option>`
                    ).join('')}
                </select>
                
                <select class="form-control purity" 
                        onchange="window.billingSystem.updateItem(${itemId}, 'purity', this.value)">
                    <option value="">Select Purity</option>
                </select>
                
                <input type="number" class="form-control weight" step="0.001" placeholder="Weight" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'weight', this.value)">
                
                <input type="number" class="form-control making-charges" step="0.01" placeholder="Making Charges" 
                       oninput="window.billingSystem.updateItem(${itemId}, 'makingCharges', this.value)">
                
                <select class="form-control making-charges-type" 
                        onchange="window.billingSystem.updateItem(${itemId}, 'makingChargesType', this.value)">
                    <option value="percentage">%</option>
                    <option value="fixed">₹</option>
                </select>
                
                <button class="btn btn-danger btn-sm" 
                        onclick="window.billingSystem.removeItem(${itemId}, false)">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        itemsContainer.appendChild(itemRow);
        
        // Add to current bill
        if (isExchange) {
            this.currentBill.exchangeItems.push({
                id: itemId,
                description: '',
                metalType: '',
                purity: '',
                weight: 0,
                wastageDeduction: 0,
                meltingCharges: 0
            });
        } else {
            this.currentBill.items.push({
                id: itemId,
                description: '',
                metalType: '',
                purity: '',
                weight: 0,
                makingCharges: 0,
                makingChargesType: 'percentage'
            });
        }
        
        this.updateResponsiveLayout();
    }

    updatePurities(metalType, itemId) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.querySelector(`#item-${itemId} .purity`);
        const purities = rate.purityLevels || ['22K', '18K', '14K'];
        puritySelect.innerHTML = '<option value="">Select Purity</option>' + 
            purities.map(purity => `<option value="${purity}">${purity}</option>`).join('');
    }

    updateItem(itemId, field, value) {
        // Find item in either items or exchangeItems
        let item = this.currentBill.items.find(item => item.id === itemId);
        let isExchange = false;
        
        if (!item) {
            item = this.currentBill.exchangeItems.find(item => item.id === itemId);
            isExchange = true;
        }
        
        if (item) {
            item[field] = field === 'weight' || field === 'makingCharges' || 
                         field === 'wastageDeduction' || field === 'meltingCharges' ?
                         parseFloat(value) || 0 : value;
            
            this.updateSummary();
        }
    }

    removeItem(itemId, isExchange) {
        // Remove from DOM
        const element = document.getElementById(`item-${itemId}`);
        if (element) element.remove();
        
        // Remove from current bill
        if (isExchange) {
            this.currentBill.exchangeItems = this.currentBill.exchangeItems.filter(
                item => item.id !== itemId
            );
        } else {
            this.currentBill.items = this.currentBill.items.filter(
                item => item.id !== itemId
            );
        }
        
        this.updateSummary();
    }

    async updateSummary() {
        // Calculate totals
        let subTotal = 0;
        let totalMetalAmount = 0;
        let totalMakingCharges = 0;
        let totalGST = 0;
        let itemsHtml = '';
        
        // Calculate new items
        for (const item of this.currentBill.items) {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let itemAmount = 0;
                    let metalAmount = 0;
                    
                    // Calculate metal amount based on unit
                    if (rate.unit === 'kg') {
                        metalAmount = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        metalAmount = rate.rate * item.weight;
                    } else {
                        metalAmount = rate.rate;
                    }
                    
                    // Calculate making charges
                    let makingChargesAmount = 0;
                    if (item.makingChargesType === 'percentage') {
                        makingChargesAmount = (metalAmount * item.makingCharges) / 100;
                    } else {
                        makingChargesAmount = item.makingCharges;
                    }
                    
                    // Calculate GST
                    const gstOnMetal = (metalAmount * (rate.gstRate || 3)) / 100;
                    const gstOnMaking = (makingChargesAmount * (rate.gstOnMaking || 5)) / 100;
                    
                    const total = metalAmount + makingChargesAmount + gstOnMetal + gstOnMaking;
                    subTotal += total;
                    totalMetalAmount += metalAmount;
                    totalMakingCharges += makingChargesAmount;
                    totalGST += gstOnMetal + gstOnMaking;
                    
                    itemsHtml += `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit}</td>
                            <td>₹${total.toFixed(2)}</td>
                        </tr>
                    `;
                }
            }
        }
        
        // Calculate exchange items
        let exchangeTotal = 0;
        let exchangeHtml = '';
        
        for (const item of this.currentBill.exchangeItems) {
            if (item.metalType && item.weight > 0) {
                const rate = this.rates[item.metalType];
                if (rate) {
                    let itemValue = 0;
                    
                    if (rate.unit === 'kg') {
                        itemValue = (rate.rate / 1000) * item.weight;
                    } else if (rate.unit === 'carat') {
                        itemValue = rate.rate * item.weight;
                    } else {
                        itemValue = rate.rate;
                    }
                    
                    // Apply wastage deduction
                    if (item.wastageDeduction > 0) {
                        itemValue = itemValue * ((100 - item.wastageDeduction) / 100);
                    }
                    
                    // Apply melting charges
                    if (item.meltingCharges > 0) {
                        itemValue -= item.meltingCharges;
                    }
                    
                    exchangeTotal += Math.max(0, itemValue);
                    
                    exchangeHtml += `
                        <tr>
                            <td>${item.description || 'Old Item'}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.weight.toFixed(3)} ${rate.unit === 'kg' ? 'g' : rate.unit}</td>
                            <td>₹${itemValue.toFixed(2)}</td>
                        </tr>
                    `;
                }
            }
        }
        
        // Calculate totals
        const discount = this.currentBill.discount || 0;
        const totalBeforeGST = totalMetalAmount + totalMakingCharges - discount;
        const grandTotal = totalBeforeGST + totalGST;
        
        // Calculate balance
        const balance = exchangeTotal - grandTotal;
        
        // Update summary display
        document.getElementById('subTotal').textContent = `₹${subTotal.toFixed(2)}`;
        document.getElementById('discountDisplay').textContent = `₹${discount.toFixed(2)}`;
        document.getElementById('totalAfterDiscount').textContent = `₹${(totalMetalAmount + totalMakingCharges - discount).toFixed(2)}`;
        document.getElementById('gst').textContent = `₹${totalGST.toFixed(2)}`;
        document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
        document.getElementById('exchangeValue').textContent = `₹${exchangeTotal.toFixed(2)}`;
        
        // Show/hide exchange summary
        const exchangeSummary = document.getElementById('exchangeSummary');
        const exchangeItemsSection = document.getElementById('exchangeItemsSection');
        if (exchangeTotal > 0) {
            exchangeSummary.style.display = 'block';
            exchangeItemsSection.style.display = 'block';
            
            if (balance >= 0) {
                document.getElementById('balanceRefund').textContent = `₹${balance.toFixed(2)}`;
                document.getElementById('balancePay').textContent = '₹0.00';
            } else {
                document.getElementById('balancePay').textContent = `₹${Math.abs(balance).toFixed(2)}`;
                document.getElementById('balanceRefund').textContent = '₹0.00';
            }
        } else {
            exchangeSummary.style.display = 'none';
            exchangeItemsSection.style.display = 'none';
        }
        
        // Update items list in summary
        document.getElementById('itemsList').innerHTML = itemsHtml;
        document.getElementById('exchangeItemsList').innerHTML = exchangeHtml;
        
        // Update amount in words
        if (grandTotal > 0) {
            const amountInWords = await this.getAmountInWords(grandTotal);
            document.getElementById('amountInWords').textContent = amountInWords;
        } else {
            document.getElementById('amountInWords').textContent = 'Zero Rupees Only';
        }
        
        // Update GST type display
        const gstTypeLabel = document.getElementById('gstTypeLabel');
        if (gstTypeLabel) {
            gstTypeLabel.textContent = this.currentBill.isIntraState ? 'CGST+SGST' : 'IGST';
        }
    }

    async getAmountInWords(amount) {
        try {
            const response = await fetch(`${this.apiBase}/utils/amount-words`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount })
            });
            
            const data = await response.json();
            return data.words || this.numberToWordsLocal(amount);
        } catch (error) {
            console.error('Error getting amount in words:', error);
            return this.numberToWordsLocal(amount);
        }
    }

    numberToWordsLocal(num) {
        // Simplified local implementation
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        const rupees = Math.floor(num);
        const paise = Math.round((num - rupees) * 100);
        
        let words = '';
        
        if (rupees === 0) {
            words = 'Zero';
        }
        
        words += ' Rupees';
        
        if (paise > 0) {
            words += ' and ' + (paise < 10 ? units[paise] : 
                     paise < 20 ? teens[paise - 10] : 
                     tens[Math.floor(paise / 10)] + (paise % 10 ? ' ' + units[paise % 10] : '')) + ' Paise';
        }
        
        return words + ' Only';
    }

    validateBill() {
        // Validate customer details
        if (!this.currentBill.customer.name?.trim()) {
            this.showAlert('danger', 'Customer name is required');
            return false;
        }
        
        if (!this.currentBill.customer.mobile?.trim() || !/^[0-9]{10}$/.test(this.currentBill.customer.mobile)) {
            this.showAlert('danger', 'Valid 10-digit mobile number is required');
            return false;
        }
        
        if (!this.currentBill.customer.address?.trim()) {
            this.showAlert('danger', 'Customer address is required');
            return false;
        }
        
        // Validate at least one item
        if (this.currentBill.items.length === 0) {
            this.showAlert('danger', 'At least one item is required');
            return false;
        }
        
        // Validate all items have required fields
        for (const item of this.currentBill.items) {
            if (!item.description || !item.metalType || !item.purity || item.weight <= 0) {
                this.showAlert('danger', 'Please fill all item details correctly');
                return false;
            }
        }
        
        return true;
    }

    async generateBill() {
        if (!this.validateBill()) return;
        
        const btn = document.getElementById('generateBillBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Generating...';
        btn.disabled = true;
        
        try {
            // Prepare data for API
            const billData = {
                customer: this.currentBill.customer,
                items: this.currentBill.items.map(item => ({
                    description: item.description,
                    metalType: item.metalType,
                    purity: item.purity,
                    weight: item.weight,
                    makingCharges: item.makingCharges || 0,
                    makingChargesType: item.makingChargesType || 'percentage'
                })),
                exchangeItems: this.currentBill.exchangeItems.map(item => ({
                    description: item.description,
                    metalType: item.metalType,
                    purity: item.purity,
                    weight: item.weight,
                    wastageDeduction: item.wastageDeduction || 0,
                    meltingCharges: item.meltingCharges || 0
                })),
                discount: this.currentBill.discount,
                paymentMode: this.currentBill.paymentMode,
                paymentStatus: this.currentBill.paymentStatus,
                isIntraState: this.currentBill.isIntraState
            };
            
            const response = await fetch(`${this.apiBase}/bills/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(billData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Bill generated successfully!');
                
                // Show bill preview
                this.showBillPreview(data.bill);
                
                // Enable print button
                document.getElementById('printBillBtn').disabled = false;
            } else {
                this.showAlert('danger', data.message || 'Failed to generate bill');
            }
        } catch (error) {
            console.error('Generate bill error:', error);
            this.showAlert('danger', 'Network error. Please try again.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    showBillPreview(bill) {
        // Store current bill for printing
        window.currentBill = bill;
        
        // Update preview modal
        document.getElementById('previewBillNumber').textContent = bill.billNumber;
        document.getElementById('previewBillDate').textContent = 
            new Date(bill.billDate).toLocaleDateString();
        document.getElementById('previewCustomerName').textContent = bill.customer.name;
        document.getElementById('previewCustomerMobile').textContent = bill.customer.mobile;
        document.getElementById('previewCustomerAddress').textContent = bill.customer.address;
        
        // Update items in preview
        const itemsHtml = bill.items
            .filter(item => !item.isExchangeItem)
            .map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                    <td>₹${item.amount.toFixed(2)}</td>
                </tr>
            `).join('');
        
        document.getElementById('previewItems').innerHTML = itemsHtml;
        
        // Update exchange items if any
        if (bill.exchangeDetails.hasExchange) {
            const exchangeItems = bill.items.filter(item => item.isExchangeItem);
            const exchangeHtml = exchangeItems.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.weight.toFixed(3)} ${item.metalType === 'Diamond' ? 'ct' : 'g'}</td>
                    <td>-₹${Math.abs(item.amount).toFixed(2)}</td>
                </tr>
            `).join('');
            
            document.getElementById('previewExchangeItems').innerHTML = exchangeHtml;
            document.getElementById('exchangeSection').style.display = 'block';
        } else {
            document.getElementById('exchangeSection').style.display = 'none';
        }
        
        // Update totals
        document.getElementById('previewSubTotal').textContent = `₹${bill.subTotal.toFixed(2)}`;
        document.getElementById('previewDiscount').textContent = `₹${bill.discount.toFixed(2)}`;
        document.getElementById('previewGST').textContent = `₹${bill.gst.toFixed(2)}`;
        document.getElementById('previewGrandTotal').textContent = `₹${bill.grandTotal.toFixed(2)}`;
        document.getElementById('previewAmountWords').textContent = bill.amountInWords;
        
        // Update exchange totals
        if (bill.exchangeDetails.hasExchange) {
            document.getElementById('previewOldItemsTotal').textContent = 
                `₹${bill.exchangeDetails.oldItemsTotal.toFixed(2)}`;
            document.getElementById('previewBalance').textContent = 
                bill.exchangeDetails.balancePayable > 0 ?
                `₹${bill.exchangeDetails.balancePayable.toFixed(2)} Payable` :
                `₹${bill.exchangeDetails.balanceRefundable.toFixed(2)} Refundable`;
        }
        
        // Show QR codes if available
        if (bill.qrCodes && bill.qrCodes.billQR) {
            document.getElementById('previewBillQR').src = 
                `data:image/png;base64,${bill.qrCodes.billQR}`;
        }
        
        // Show preview modal
        document.getElementById('billPreviewModal').classList.add('show');
    }

    printBill() {
        if (!window.currentBill) {
            this.showAlert('warning', 'Please generate a bill first');
            return;
        }
        
        // Open print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bill ${window.currentBill.billNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .invoice-container { max-width: 800px; margin: 0 auto; }
                    .shop-name { text-align: center; color: #D4AF37; }
                    .bill-info { display: flex; justify-content: space-between; margin: 20px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .calc-row { display: flex; justify-content: space-between; margin: 5px 0; }
                    .total { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
                    @media print { body { font-size: 12px; } }
                </style>
            </head>
            <body>
                ${this.generatePrintHTML(window.currentBill)}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for images to load
        printWindow.onload = () => {
            printWindow.print();
        };
    }

    generatePrintHTML(bill) {
        // ... (keep the existing print HTML generation code, add GST details)
        return `
            <div class="invoice-container">
                <div class="invoice-header">
                    <h1 class="shop-name">Shri Mahakaleshwar Jewellers</h1>
                    <p class="shop-address">Anisabad, Patna, Bihar - 800002</p>
                    <p class="shop-contact">Mobile: +91 XXXXX XXXXX | GSTIN: XXXXXXXX</p>
                </div>
                
                <div class="bill-info">
                    <div>
                        <div class="bill-number">Bill No: ${bill.billNumber}</div>
                        <div class="bill-date">Date: ${new Date(bill.billDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div>Invoice Type: ${bill.exchangeDetails.hasExchange ? 'Sale with Exchange' : 'Sale'}</div>
                        <div>Payment Mode: ${bill.paymentMode.toUpperCase()}</div>
                        <div>GST Type: ${bill.isIntraState ? 'CGST + SGST' : 'IGST'}</div>
                    </div>
                </div>
                
                <!-- GST Details -->
                <div class="gst-details">
                    <h4>GST Breakdown:</h4>
                    <div class="calc-row">
                        <span>Metal Value:</span>
                        <span>₹${(bill.gstDetails?.metalAmount || 0).toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Making Charges:</span>
                        <span>₹${(bill.gstDetails?.makingCharges || 0).toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>GST on Metal (${bill.gstDetails?.gstOnMetal || 3}%):</span>
                        <span>₹${(bill.gstDetails?.gstOnMetal || 0).toFixed(2)}</span>
                    </div>
                    <div class="calc-row">
                        <span>GST on Making (${bill.gstDetails?.gstOnMaking || 5}%):</span>
                        <span>₹${(bill.gstDetails?.gstOnMaking || 0).toFixed(2)}</span>
                    </div>
                    ${bill.isIntraState ? `
                        <div class="calc-row">
                            <span>CGST:</span>
                            <span>₹${(bill.gstDetails?.totalCGST || 0).toFixed(2)}</span>
                        </div>
                        <div class="calc-row">
                            <span>SGST:</span>
                            <span>₹${(bill.gstDetails?.totalSGST || 0).toFixed(2)}</span>
                        </div>
                    ` : `
                        <div class="calc-row">
                            <span>IGST:</span>
                            <span>₹${(bill.gstDetails?.totalIGST || 0).toFixed(2)}</span>
                        </div>
                    `}
                </div>
                
                <!-- Rest of the bill content remains similar -->
                ${bill.gstDetails ? `
                    <div class="gst-summary">
                        <p><strong>Total GST:</strong> ₹${bill.gst.toFixed(2)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    clearForm() {
        // Reset customer form
        document.getElementById('customerForm').reset();
        this.currentBill.customer = {
            name: '',
            mobile: '',
            address: '',
            dob: '',
            pan: '',
            aadhaar: ''
        };
        
        // Clear items
        document.getElementById('itemsContainer').innerHTML = '';
        document.getElementById('exchangeItems').innerHTML = '';
        this.currentBill.items = [];
        this.currentBill.exchangeItems = [];
        
        // Reset other fields
        this.currentBill.discount = 0;
        this.currentBill.paymentMode = 'cash';
        this.currentBill.paymentStatus = 'paid';
        this.currentBill.isIntraState = true;
        
        document.getElementById('discount').value = '0';
        document.getElementById('paymentMode').value = 'cash';
        if (document.getElementById('gstType')) {
            document.getElementById('gstType').value = 'intra';
        }
        
        // Reset summary
        this.updateSummary();
        
        // Disable print button
        document.getElementById('printBillBtn').disabled = true;
        
        this.showAlert('info', 'Form cleared successfully');
    }
}

// Initialize billing system when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated() && window.auth.isStaff()) {
        window.billingSystem = new BillingSystem();
        
        // Add GST type selector to the UI
        const paymentOptions = document.querySelector('.payment-options');
        if (paymentOptions && !document.getElementById('gstType')) {
            paymentOptions.innerHTML += `
                <select id="gstType" class="form-control" style="width: auto; margin-left: 10px;">
                    <option value="intra">Intra-State (CGST+SGST)</option>
                    <option value="inter">Inter-State (IGST)</option>
                </select>
            `;
            
            // Re-attach event listener
            document.getElementById('gstType').addEventListener('change', (e) => {
                window.billingSystem.currentBill.isIntraState = e.target.value === 'intra';
                window.billingSystem.updateSummary();
            });
        }
        
        // Close modal handlers
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').classList.remove('show');
            });
        });
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('show');
                }
            });
        });
    } else {
        window.location.href = 'login.html';
    }
});
