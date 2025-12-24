// frontend/js/billing.js
/**
 * Billing System - Collects ALL 15+ fields and sends to backend
 * STRICTLY FOLLOWS BUSINESS RULES
 */

class BillingSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        
        // Initialize with empty arrays for all items
        this.items = []; // New items for purchase
        this.exchangeItems = []; // Exchange items
        this.currentItemId = 1;
        this.currentExchangeId = 1;
        
        // Customer data
        this.customer = {
            name: '',
            mobile: '',
            address: '',
            dob: '',
            pan: '',
            aadhaar: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.addNewItem(); // Start with one empty item
        this.loadDefaultRates();
    }

    setupEventListeners() {
        // Customer form listeners
        document.getElementById('customerName')?.addEventListener('change', (e) => {
            this.customer.name = e.target.value;
        });
        document.getElementById('customerMobile')?.addEventListener('change', (e) => {
            this.customer.mobile = e.target.value;
        });
        document.getElementById('customerAddress')?.addEventListener('change', (e) => {
            this.customer.address = e.target.value;
        });
        document.getElementById('customerDOB')?.addEventListener('change', (e) => {
            this.customer.dob = e.target.value;
        });
        document.getElementById('customerPAN')?.addEventListener('change', (e) => {
            this.customer.pan = e.target.value;
        });
        document.getElementById('customerAadhaar')?.addEventListener('change', (e) => {
            this.customer.aadhaar = e.target.value;
        });

        // Add item button
        document.getElementById('addItemBtn')?.addEventListener('click', () => {
            this.addNewItem();
        });

        // Add exchange button
        document.getElementById('addExchangeBtn')?.addEventListener('click', () => {
            this.addExchangeItem();
        });

        // Generate bill button
        document.getElementById('generateBillBtn')?.addEventListener('click', () => {
            this.generateBill();
        });

        // Print bill button
        document.getElementById('printBillBtn')?.addEventListener('click', () => {
            this.printBill();
        });

        // Discount input
        document.getElementById('discount')?.addEventListener('change', (e) => {
            this.updateBillSummary();
        });

        // GST type change
        document.getElementById('gstType')?.addEventListener('change', (e) => {
            this.updateBillSummary();
        });

        // Payment mode change
        document.getElementById('paymentMode')?.addEventListener('change', (e) => {
            this.updateBillSummary();
        });

        // Clear form button
        document.querySelectorAll('.btn-outline').forEach(btn => {
            if (btn.textContent.includes('Clear')) {
                btn.addEventListener('click', () => this.clearForm());
            }
        });
    }

    addNewItem() {
        const container = document.getElementById('itemsContainer');
        const itemId = `item-${this.currentItemId++}`;
        
        // Remove initial placeholder if present
        const placeholder = container.querySelector('.text-center.text-muted');
        if (placeholder) placeholder.remove();
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        itemRow.id = itemId;
        
        // Create ALL 15+ fields as per BUSINESS RULES
        itemRow.innerHTML = `
            <!-- Product -->
            <input type="text" class="form-control item-product" placeholder="Product" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'product', this.value)">
            
            <!-- Unit -->
            <input type="text" class="form-control item-unit" placeholder="Unit (PCS/Set)" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'unit', this.value)">
            
            <!-- Num -->
            <input type="text" class="form-control item-num" placeholder="Num" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'num', this.value)">
            
            <!-- Stmp -->
            <input type="text" class="form-control item-stmp" placeholder="Stmp" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'stmp', this.value)">
            
            <!-- Qty -->
            <input type="number" class="form-control item-qty" placeholder="Qty" value="1" min="1"
                   onchange="window.billingSystem.updateItem('${itemId}', 'qty', this.value); window.billingSystem.calculateNetWeight('${itemId}')">
            
            <!-- Gr.Wt -->
            <input type="number" class="form-control item-grWt" placeholder="Gr.Wt" step="0.001" min="0"
                   onchange="window.billingSystem.calculateNetWeight('${itemId}')">
            
            <!-- Less -->
            <input type="number" class="form-control item-less" placeholder="Less" step="0.001" min="0"
                   onchange="window.billingSystem.calculateNetWeight('${itemId}')">
            
            <!-- Nt.Wt (calculated, but user can edit) -->
            <input type="number" class="form-control item-ntWt" placeholder="Nt.Wt" step="0.001" min="0"
                   onchange="window.billingSystem.updateItem('${itemId}', 'ntWt', this.value)" readonly>
            
            <!-- Tnch(%) -->
            <input type="text" class="form-control item-tnch" placeholder="Tnch(%)" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'tnch', this.value)">
            
            <!-- Huid -->
            <input type="text" class="form-control item-huid" placeholder="HUID" 
                   onchange="window.billingSystem.updateItem('${itemId}', 'huid', this.value)">
            
            <!-- HuCrg -->
            <input type="number" class="form-control item-huCrg" placeholder="HuCrg" step="0.01" min="0"
                   onchange="window.billingSystem.updateItem('${itemId}', 'huCrg', this.value)">
            
            <!-- Mk (Making Type) -->
            <select class="form-control item-mk" onchange="window.billingSystem.updateItem('${itemId}', 'mk', this.value)">
                <option value="FIX">FIX</option>
                <option value="%">%</option>
                <option value="GRM">GRM</option>
            </select>
            
            <!-- MkCrg -->
            <input type="number" class="form-control item-mkCrg" placeholder="MkCrg" step="0.01" min="0"
                   onchange="window.billingSystem.updateItem('${itemId}', 'mkCrg', this.value)">
            
            <!-- Rate -->
            <input type="number" class="form-control item-rate" placeholder="Rate" step="0.01" min="0"
                   onchange="window.billingSystem.updateItem('${itemId}', 'rate', this.value)">
            
            <!-- DisMk% -->
            <input type="number" class="form-control item-disMk" placeholder="DisMk%" step="0.01" min="0" max="100"
                   onchange="window.billingSystem.updateItem('${itemId}', 'disMk', this.value)">
            
            <!-- Metal Type -->
            <select class="form-control item-metal" onchange="window.billingSystem.updateItem('${itemId}', 'metalType', this.value)">
                <option value="">Select Metal</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
                <option value="Antique / Polki">Antique / Polki</option>
                <option value="Others">Others</option>
            </select>
            
            <!-- Purity -->
            <input type="text" class="form-control item-purity" placeholder="Purity (e.g., 22K)"
                   onchange="window.billingSystem.updateItem('${itemId}', 'purity', this.value)">
            
            <!-- Delete button -->
            <button class="btn btn-danger btn-sm" onclick="window.billingSystem.removeItem('${itemId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemRow);
        
        // Initialize item object with ALL fields
        this.items.push({
            id: itemId,
            product: '',
            unit: '',
            num: '',
            stmp: '',
            qty: 1,
            grWt: 0,
            less: 0,
            ntWt: 0,
            tnch: '',
            huid: '',
            huCrg: 0,
            mk: 'FIX',
            mkCrg: 0,
            rate: 0,
            disMk: 0,
            metalType: '',
            purity: '',
            isExchange: false
        });
        
        this.updateResponsiveLayout();
    }

    addExchangeItem() {
        const container = document.getElementById('exchangeItems');
        const itemId = `exchange-${this.currentExchangeId++}`;
        
        // Show exchange section if hidden
        document.getElementById('exchangeSection').style.display = 'block';
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row exchange-row';
        itemRow.id = itemId;
        
        itemRow.innerHTML = `
            <!-- Old Product -->
            <input type="text" class="form-control exchange-product" placeholder="Old Product" 
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'product', this.value)">
            
            <!-- Metal Type -->
            <select class="form-control exchange-metal" onchange="window.billingSystem.updateExchangeItem('${itemId}', 'metalType', this.value)">
                <option value="">Select Metal</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
                <option value="Antique / Polki">Antique / Polki</option>
                <option value="Others">Others</option>
            </select>
            
            <!-- Purity -->
            <input type="text" class="form-control exchange-purity" placeholder="Purity" 
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'purity', this.value)">
            
            <!-- Qty -->
            <input type="number" class="form-control exchange-qty" placeholder="Qty" value="1" min="1"
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'qty', this.value); window.billingSystem.calculateExchangeNetWeight('${itemId}')">
            
            <!-- Gr.Wt -->
            <input type="number" class="form-control exchange-grWt" placeholder="Gr.Wt" step="0.001" min="0"
                   onchange="window.billingSystem.calculateExchangeNetWeight('${itemId}')">
            
            <!-- Less -->
            <input type="number" class="form-control exchange-less" placeholder="Less" step="0.001" min="0"
                   onchange="window.billingSystem.calculateExchangeNetWeight('${itemId}')">
            
            <!-- Nt.Wt -->
            <input type="number" class="form-control exchange-ntWt" placeholder="Nt.Wt" step="0.001" min="0" readonly
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'ntWt', this.value)">
            
            <!-- Wastage % -->
            <input type="number" class="form-control exchange-wastage" placeholder="Wastage %" step="0.01" min="0" max="100"
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'wastage', this.value)">
            
            <!-- Melting Charges -->
            <input type="number" class="form-control exchange-melting" placeholder="Melting Charges" step="0.01" min="0"
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'meltingCharges', this.value)">
            
            <!-- Current Rate -->
            <input type="number" class="form-control exchange-rate" placeholder="Current Rate" step="0.01" min="0"
                   onchange="window.billingSystem.updateExchangeItem('${itemId}', 'rate', this.value)">
            
            <!-- Delete button -->
            <button class="btn btn-danger btn-sm" onclick="window.billingSystem.removeExchangeItem('${itemId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemRow);
        
        // Initialize exchange item object
        this.exchangeItems.push({
            id: itemId,
            product: '',
            metalType: '',
            purity: '',
            qty: 1,
            grWt: 0,
            less: 0,
            ntWt: 0,
            wastage: 0,
            meltingCharges: 0,
            rate: 0,
            isExchange: true
        });
        
        this.updateResponsiveLayout();
    }

    calculateNetWeight(itemId) {
        const row = document.getElementById(itemId);
        if (!row) return;
        
        const grWt = parseFloat(row.querySelector('.item-grWt').value) || 0;
        const less = parseFloat(row.querySelector('.item-less').value) || 0;
        
        // Calculate net weight (Gr.Wt - Less)
        const ntWt = Math.max(0, grWt - less);
        
        // Update the net weight field
        const ntWtInput = row.querySelector('.item-ntWt');
        ntWtInput.value = ntWt.toFixed(3);
        
        // Update item object
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            this.items[itemIndex].grWt = grWt;
            this.items[itemIndex].less = less;
            this.items[itemIndex].ntWt = ntWt;
        }
        
        this.updateBillSummary();
    }

    calculateExchangeNetWeight(itemId) {
        const row = document.getElementById(itemId);
        if (!row) return;
        
        const grWt = parseFloat(row.querySelector('.exchange-grWt').value) || 0;
        const less = parseFloat(row.querySelector('.exchange-less').value) || 0;
        
        // Calculate net weight (Gr.Wt - Less)
        const ntWt = Math.max(0, grWt - less);
        
        // Update the net weight field
        const ntWtInput = row.querySelector('.exchange-ntWt');
        ntWtInput.value = ntWt.toFixed(3);
        
        // Update exchange item object
        const itemIndex = this.exchangeItems.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            this.exchangeItems[itemIndex].grWt = grWt;
            this.exchangeItems[itemIndex].less = less;
            this.exchangeItems[itemIndex].ntWt = ntWt;
        }
        
        this.updateBillSummary();
    }

    updateItem(itemId, field, value) {
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            // Convert numeric fields
            if (['qty', 'grWt', 'less', 'ntWt', 'huCrg', 'mkCrg', 'rate', 'disMk'].includes(field)) {
                this.items[itemIndex][field] = parseFloat(value) || 0;
            } else {
                this.items[itemIndex][field] = value;
            }
            
            // If purity is being set for Gold, auto-set tnch if empty
            if (field === 'purity' && this.items[itemIndex].metalType === 'Gold') {
                const purity = value;
                const tnchMap = {
                    '24K': '99.9%',
                    '22K': '91.6%',
                    '18K': '75.0%',
                    '14K': '58.3%',
                    '916': '91.6%',
                    '750': '75.0%',
                    '585': '58.5%'
                };
                if (tnchMap[purity] && !this.items[itemIndex].tnch) {
                    this.items[itemIndex].tnch = tnchMap[purity];
                    const row = document.getElementById(itemId);
                    if (row) {
                        const tnchInput = row.querySelector('.item-tnch');
                        if (tnchInput) tnchInput.value = tnchMap[purity];
                    }
                }
            }
            
            this.updateBillSummary();
        }
    }

    updateExchangeItem(itemId, field, value) {
        const itemIndex = this.exchangeItems.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            // Convert numeric fields
            if (['qty', 'grWt', 'less', 'ntWt', 'wastage', 'meltingCharges', 'rate'].includes(field)) {
                this.exchangeItems[itemIndex][field] = parseFloat(value) || 0;
            } else {
                this.exchangeItems[itemIndex][field] = value;
            }
            this.updateBillSummary();
        }
    }

    removeItem(itemId) {
        this.items = this.items.filter(item => item.id !== itemId);
        const element = document.getElementById(itemId);
        if (element) element.remove();
        
        // Show placeholder if no items left
        if (this.items.length === 0) {
            const container = document.getElementById('itemsContainer');
            container.innerHTML = `
                <div class="text-center text-muted" style="padding: 20px;">
                    <i class="fas fa-plus-circle fa-2x" style="margin-bottom: 10px;"></i>
                    <p>Click "Add Item" to start adding jewellery items</p>
                </div>
            `;
        }
        
        this.updateBillSummary();
    }

    removeExchangeItem(itemId) {
        this.exchangeItems = this.exchangeItems.filter(item => item.id !== itemId);
        const element = document.getElementById(itemId);
        if (element) element.remove();
        
        // Hide exchange section if no exchange items
        if (this.exchangeItems.length === 0) {
            document.getElementById('exchangeSection').style.display = 'none';
        }
        
        this.updateBillSummary();
    }

    updateResponsiveLayout() {
        const itemRows = document.querySelectorAll('.item-row');
        const screenWidth = window.innerWidth;
        
        itemRows.forEach(row => {
            if (screenWidth < 768) {
                row.style.gridTemplateColumns = '1fr';
            } else if (screenWidth < 1200) {
                if (row.classList.contains('exchange-row')) {
                    row.style.gridTemplateColumns = 'repeat(3, 1fr)';
                } else {
                    row.style.gridTemplateColumns = 'repeat(4, 1fr)';
                }
            } else {
                if (row.classList.contains('exchange-row')) {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr 1fr auto';
                } else {
                    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto';
                }
            }
        });
    }

    async loadDefaultRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Store rates for reference
                    this.rates = data.rates;
                }
            }
        } catch (error) {
            console.error('Failed to load rates:', error);
        }
    }

    async updateBillSummary() {
        // This is only a UI preview - actual calculations happen in backend
        // BUSINESS RULE: Frontend must NEVER calculate GST
        
        let metalValue = 0;
        let makingCharges = 0;
        
        // Calculate approximate values for UI preview (without GST)
        this.items.forEach(item => {
            const qty = item.qty || 1;
            const ntWt = item.ntWt || 0;
            const rate = item.rate || 0;
            const mk = item.mk || 'FIX';
            const mkCrg = item.mkCrg || 0;
            const disMk = item.disMk || 0;
            const huCrg = item.huCrg || 0;
            
            // Metal value
            metalValue += ntWt * rate * qty;
            
            // Making charges
            let making = 0;
            if (mk === 'FIX') {
                making = mkCrg * qty;
            } else if (mk === '%') {
                making = (ntWt * rate * qty) * (mkCrg / 100);
            } else if (mk === 'GRM') {
                making = ntWt * mkCrg * qty;
            }
            
            // Apply discount on making
            if (disMk > 0) {
                making = making - (making * disMk / 100);
            }
            
            makingCharges += making + (huCrg * qty);
        });
        
        // Calculate exchange value (Market Rate - 3%) - BUSINESS RULE
        let exchangeValue = 0;
        this.exchangeItems.forEach(item => {
            const qty = item.qty || 1;
            const ntWt = item.ntWt || 0;
            const rate = item.rate || 0;
            const wastage = item.wastage || 0;
            const melting = item.meltingCharges || 0;
            
            // Exchange rate = Current rate - 3%
            const exchangeRate = rate * 0.97;
            
            // Apply wastage deduction
            const wastageDeduction = (wastage / 100) * ntWt;
            const effectiveWeight = ntWt - wastageDeduction;
            
            // Calculate exchange value
            let itemValue = effectiveWeight * exchangeRate * qty;
            itemValue -= melting;
            itemValue = Math.max(0, itemValue);
            
            exchangeValue += itemValue;
        });
        
        // Subtotal
        const subTotal = metalValue + makingCharges;
        
        // Get discount
        const discount = parseFloat(document.getElementById('discount')?.value) || 0;
        
        // IMPORTANT: GST is NOT calculated in frontend (BUSINESS RULE)
        // GST will be calculated in backend only (3% on metal value)
        
        // Grand total (without GST for preview)
        let grandTotal = subTotal - discount;
        
        // Balance calculation
        let balancePayable = 0;
        let balanceRefundable = 0;
        
        if (exchangeValue > 0) {
            if (grandTotal > exchangeValue) {
                balancePayable = grandTotal - exchangeValue;
            } else {
                balanceRefundable = exchangeValue - grandTotal;
            }
            
            // Show exchange summary
            const exchangeSummary = document.getElementById('exchangeSummary');
            if (exchangeSummary) {
                exchangeSummary.style.display = 'block';
                document.getElementById('exchangeValue').textContent = `₹${exchangeValue.toFixed(2)}`;
                document.getElementById('balancePay').textContent = `₹${balancePayable.toFixed(2)}`;
                document.getElementById('balanceRefund').textContent = `₹${balanceRefundable.toFixed(2)}`;
            }
        } else {
            const exchangeSummary = document.getElementById('exchangeSummary');
            if (exchangeSummary) exchangeSummary.style.display = 'none';
            balancePayable = grandTotal;
        }
        
        // Update UI
        document.getElementById('metalValue').textContent = `₹${metalValue.toFixed(2)}`;
        document.getElementById('makingCharges').textContent = `₹${makingCharges.toFixed(2)}`;
        document.getElementById('subTotal').textContent = `₹${subTotal.toFixed(2)}`;
        document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
        
        // Update amount in words
        this.updateAmountInWords(grandTotal);
        
        // Update items list in summary
        this.updateItemsList();
    }

    updateAmountInWords(amount) {
        const amountInWords = document.getElementById('amountInWords');
        if (amountInWords) {
            amountInWords.textContent = this.numberToWords(amount);
        }
    }

    numberToWords(num) {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        const rupees = Math.floor(num);
        const paise = Math.round((num - rupees) * 100);
        
        if (rupees === 0 && paise === 0) {
            return 'Zero Rupees Only';
        }
        
        let words = '';
        
        // Convert rupees
        if (rupees > 0) {
            // Convert crore part
            if (rupees >= 10000000) {
                const crore = Math.floor(rupees / 10000000);
                words += this.convertNumberToWords(crore) + ' Crore ';
                rupees %= 10000000;
            }
            
            // Convert lakh part
            if (rupees >= 100000) {
                const lakh = Math.floor(rupees / 100000);
                words += this.convertNumberToWords(lakh) + ' Lakh ';
                rupees %= 100000;
            }
            
            // Convert thousand part
            if (rupees >= 1000) {
                const thousand = Math.floor(rupees / 1000);
                words += this.convertNumberToWords(thousand) + ' Thousand ';
                rupees %= 1000;
            }
            
            // Convert hundred part
            if (rupees >= 100) {
                const hundred = Math.floor(rupees / 100);
                words += this.convertNumberToWords(hundred) + ' Hundred ';
                rupees %= 100;
            }
            
            // Convert tens and units
            if (rupees > 0) {
                if (words !== '') words += 'and ';
                words += this.convertNumberToWords(rupees) + ' ';
            }
            
            words += 'Rupees';
        }
        
        // Convert paise
        if (paise > 0) {
            if (words !== '') words += ' and ';
            words += this.convertNumberToWords(paise) + ' Paise';
        }
        
        return words + ' Only';
    }

    convertNumberToWords(num) {
        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        if (num < 10) return units[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) {
            const ten = Math.floor(num / 10);
            const unit = num % 10;
            return tens[ten] + (unit > 0 ? ' ' + units[unit] : '');
        }
        return '';
    }

    updateItemsList() {
        const itemsList = document.getElementById('itemsList');
        if (!itemsList) return;
        
        let html = '';
        
        this.items.forEach(item => {
            const desc = item.product || 'Unnamed Item';
            const metal = item.metalType ? `${item.metalType} ${item.purity}` : 'N/A';
            const weight = item.ntWt ? item.ntWt.toFixed(3) : '0';
            const amount = ((item.ntWt || 0) * (item.rate || 0) * (item.qty || 1)).toFixed(2);
            
            html += `
                <tr>
                    <td>${desc}</td>
                    <td>${metal}</td>
                    <td>${weight} g</td>
                    <td>₹${amount}</td>
                </tr>
            `;
        });
        
        if (html === '') {
            html = '<tr><td colspan="4" class="text-center text-muted">No items added</td></tr>';
        }
        
        itemsList.innerHTML = html;
        
        // Update exchange items list
        const exchangeList = document.getElementById('exchangeItemsList');
        const exchangeSection = document.getElementById('exchangeItemsSection');
        
        if (exchangeList && exchangeSection) {
            let exchangeHtml = '';
            
            this.exchangeItems.forEach(item => {
                const desc = item.product || 'Old Item';
                const metal = item.metalType ? `${item.metalType} ${item.purity}` : 'N/A';
                const weight = item.ntWt ? item.ntWt.toFixed(3) : '0';
                
                // Calculate exchange value (Market Rate - 3%) - BUSINESS RULE
                const rate = item.rate || 0;
                const exchangeRate = rate * 0.97;
                const wastage = item.wastage || 0;
                const melting = item.meltingCharges || 0;
                const qty = item.qty || 1;
                const ntWt = item.ntWt || 0;
                
                const wastageDeduction = (wastage / 100) * ntWt;
                const effectiveWeight = ntWt - wastageDeduction;
                let value = effectiveWeight * exchangeRate * qty - melting;
                value = Math.max(0, value);
                
                exchangeHtml += `
                    <tr>
                        <td>${desc}</td>
                        <td>${metal}</td>
                        <td>${weight} g</td>
                        <td>₹${value.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            if (exchangeHtml === '') {
                exchangeSection.style.display = 'none';
            } else {
                exchangeSection.style.display = 'block';
                exchangeList.innerHTML = exchangeHtml;
            }
        }
    }

    validateBill() {
        // Validate customer
        if (!this.customer.name || !this.customer.mobile) {
            this.showAlert('danger', 'Customer name and mobile are required');
            return false;
        }
        
        // Validate items
        if (this.items.length === 0) {
            this.showAlert('danger', 'At least one item is required');
            return false;
        }
        
        // Validate all items have required fields
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            
            if (!item.metalType || !item.purity) {
                this.showAlert('danger', `Item ${i + 1}: Metal type and purity are required`);
                return false;
            }
            
            if (!item.rate || item.rate <= 0) {
                this.showAlert('danger', `Item ${i + 1}: Rate is required and must be greater than 0`);
                return false;
            }
            
            if (!item.ntWt || item.ntWt <= 0) {
                this.showAlert('danger', `Item ${i + 1}: Net weight must be greater than 0`);
                return false;
            }
        }
        
        // Validate exchange items
        for (let i = 0; i < this.exchangeItems.length; i++) {
            const item = this.exchangeItems[i];
            
            if (!item.metalType || !item.purity) {
                this.showAlert('danger', `Exchange Item ${i + 1}: Metal type and purity are required`);
                return false;
            }
            
            if (!item.rate || item.rate <= 0) {
                this.showAlert('danger', `Exchange Item ${i + 1}: Current rate is required and must be greater than 0`);
                return false;
            }
        }
        
        return true;
    }

    async generateBill() {
        if (!this.validateBill()) {
            return;
        }
        
        const btn = document.getElementById('generateBillBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Generating...';
        btn.disabled = true;
        
        try {
            // Prepare bill data with ALL fields
            const billData = {
                customer: this.customer,
                items: this.items,
                exchangeItems: this.exchangeItems,
                gstType: document.getElementById('gstType')?.value || 'intra',
                paymentMode: document.getElementById('paymentMode')?.value || 'cash',
                discount: parseFloat(document.getElementById('discount')?.value) || 0
            };
            
            console.log('Sending bill data:', billData);
            
            const response = await fetch(`${this.apiBase}/bills/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(billData)
            });
            
            const data = await response.json();
            
            console.log('Server response:', data);
            
            if (data.success) {
                this.showAlert('success', 'Bill generated successfully!');
                this.showBillPreview(data.bill);
                document.getElementById('printBillBtn').disabled = false;
                
                // Store bill for printing
                window.currentBill = data.bill;
            } else {
                throw new Error(data.message || 'Failed to generate bill');
            }
        } catch (error) {
            console.error('Generate bill error:', error);
            this.showAlert('danger', error.message || 'Failed to generate bill');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    showBillPreview(bill) {
        if (!bill) return;
        
        // Update preview modal with bill details
        document.getElementById('previewBillNumber').textContent = bill.billNumber;
        document.getElementById('previewBillDate').textContent = new Date(bill.billDate).toLocaleDateString();
        document.getElementById('previewCustomerName').textContent = bill.customer.name;
        document.getElementById('previewCustomerMobile').textContent = bill.customer.mobile;
        document.getElementById('previewCustomerAddress').textContent = bill.customer.address || 'N/A';
        document.getElementById('previewPaymentMode').textContent = bill.paymentMode;
        document.getElementById('previewGSTType').textContent = bill.gstType === 'intra' ? 'CGST+SGST' : 'IGST';
        
        // Update items in preview
        const previewItems = document.getElementById('previewItems');
        let itemsHtml = '';
        
        bill.items.forEach(item => {
            if (!item.isExchange) {
                itemsHtml += `
                    <tr>
                        <td>${item.product}</td>
                        <td>${item.metalType} ${item.purity}</td>
                        <td>${item.ntWt.toFixed(3)} g</td>
                        <td>₹${item.totalValue.toFixed(2)}</td>
                    </tr>
                `;
            }
        });
        
        previewItems.innerHTML = itemsHtml;
        
        // Update exchange items if any
        const hasExchange = bill.items.some(item => item.isExchange);
        if (hasExchange) {
            document.getElementById('exchangePreviewSection').style.display = 'block';
            const previewExchange = document.getElementById('previewExchangeItems');
            let exchangeHtml = '';
            
            bill.items.forEach(item => {
                if (item.isExchange) {
                    exchangeHtml += `
                        <tr>
                            <td>${item.product}</td>
                            <td>${item.metalType} ${item.purity}</td>
                            <td>${item.ntWt.toFixed(3)} g</td>
                            <td>₹${item.totalValue.toFixed(2)}</td>
                        </tr>
                    `;
                }
            });
            
            previewExchange.innerHTML = exchangeHtml;
        } else {
            document.getElementById('exchangePreviewSection').style.display = 'none';
        }
        
        // Update summary
        document.getElementById('previewMetalValue').textContent = `₹${bill.summary.metalValue.toFixed(2)}`;
        document.getElementById('previewMakingCharges').textContent = `₹${bill.summary.makingValue.toFixed(2)}`;
        document.getElementById('previewSubTotal').textContent = `₹${bill.summary.subTotal.toFixed(2)}`;
        document.getElementById('previewDiscount').textContent = `₹${bill.discount || 0}`;
        document.getElementById('previewGSTMetal').textContent = `₹${bill.summary.gst.gstAmount.toFixed(2)}`;
        document.getElementById('previewGrandTotal').textContent = `₹${bill.summary.grandTotal.toFixed(2)}`;
        document.getElementById('previewAmountWords').textContent = this.numberToWords(bill.summary.grandTotal);
        
        if (hasExchange) {
            document.getElementById('previewExchangeDetails').style.display = 'block';
            document.getElementById('previewOldItemsTotal').textContent = `₹${bill.summary.exchangeValue.toFixed(2)}`;
            
            if (bill.summary.balancePayable > 0) {
                document.getElementById('previewBalance').textContent = `₹${bill.summary.balancePayable.toFixed(2)} Payable`;
            } else {
                document.getElementById('previewBalance').textContent = `₹${bill.summary.balanceRefundable.toFixed(2)} Refundable`;
            }
        } else {
            document.getElementById('previewExchangeDetails').style.display = 'none';
        }
        
        // Generate QR code
        const qrText = `Bill No: ${bill.billNumber}\nDate: ${new Date(bill.billDate).toLocaleDateString()}\nAmount: ₹${bill.summary.grandTotal.toFixed(2)}`;
        const qrImg = document.getElementById('previewBillQR');
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrText)}`;
        }
        
        // Show modal
        document.getElementById('billPreviewModal').classList.add('show');
    }

    printBill() {
        if (!window.currentBill) {
            this.showAlert('warning', 'Please generate a bill first');
            return;
        }
        
        const printContainer = document.getElementById('printContainer');
        if (printContainer) {
            printContainer.innerHTML = this.generatePrintHTML(window.currentBill);
            printContainer.style.display = 'block';
            
            // Wait for content to render
            setTimeout(() => {
                window.print();
                
                // Hide container after printing
                setTimeout(() => {
                    printContainer.style.display = 'none';
                }, 1000);
            }, 500);
        } else {
            window.print();
        }
    }

    generatePrintHTML(bill) {
        const regularItems = bill.items.filter(item => !item.isExchange);
        const exchangeItems = bill.items.filter(item => item.isExchange);
        
        return `
            <div class="invoice-container">
                <div style="text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 20px;">
                    <h2 style="color: #D4AF37; margin: 0;">Shri Mahakaleshwar Jewellers</h2>
                    <p style="margin: 5px 0; color: #666;">Anisabad, Patna, Bihar - 800002</p>
                    <p style="margin: 5px 0; color: #666;">Mobile: +91 9876543210 | GSTIN: 10ABCDE1234F1Z5</p>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                    <div>
                        <div><strong>Bill No:</strong> ${bill.billNumber}</div>
                        <div><strong>Date:</strong> ${new Date(bill.billDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div><strong>Invoice Type:</strong> ${exchangeItems.length > 0 ? 'Sale with Exchange' : 'Sale'}</div>
                        <div><strong>Payment Mode:</strong> ${bill.paymentMode.toUpperCase()}</div>
                        <div><strong>GST Type:</strong> ${bill.gstType === 'intra' ? 'CGST+SGST' : 'IGST'}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: white; border: 1px solid #eee; border-radius: 5px;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">Customer Details</h4>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${bill.customer.name}</p>
                    <p style="margin: 5px 0;"><strong>Mobile:</strong> ${bill.customer.mobile}</p>
                    <p style="margin: 5px 0;"><strong>Address:</strong> ${bill.customer.address || 'N/A'}</p>
                </div>
                
                <h4 style="color: #333; margin-bottom: 10px;">Items</h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metal & Purity</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Weight</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${regularItems.map(item => `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.product}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.metalType} ${item.purity}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.ntWt.toFixed(3)} g</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">₹${item.totalValue.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                ${exchangeItems.length > 0 ? `
                    <h4 style="color: #333; margin-bottom: 10px;">Exchange Items</h4>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Metal & Purity</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Weight</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Value (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${exchangeItems.map(item => `
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.product}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.metalType} ${item.purity}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.ntWt.toFixed(3)} g</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">₹${item.totalValue.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                        <span>Metal Value:</span>
                        <span>₹${bill.summary.metalValue.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                        <span>Making Charges:</span>
                        <span>₹${bill.summary.makingValue.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                        <span>Sub Total:</span>
                        <span>₹${bill.summary.subTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                        <span>Discount:</span>
                        <span>-₹${(bill.discount || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                        <span>GST on Metal (3%):</span>
                        <span>₹${bill.summary.gst.gstAmount.toFixed(2)}</span>
                    </div>
                    ${exchangeItems.length > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                            <span>Old Items Value:</span>
                            <span>₹${bill.summary.exchangeValue.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 2px solid #D4AF37;">
                            <span>Balance:</span>
                            <span>₹${bill.summary.balancePayable > 0 ? bill.summary.balancePayable.toFixed(2) + ' Payable' : bill.summary.balanceRefundable.toFixed(2) + ' Refundable'}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; color: #D4AF37; border-bottom: 2px solid #D4AF37;">
                        <span>${exchangeItems.length > 0 ? 'Balance ' : 'Grand '}Total:</span>
                        <span>₹${bill.summary.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: white; border: 1px solid #eee; border-radius: 5px;">
                    <p style="margin: 0;"><strong>Amount in Words:</strong> ${this.numberToWords(bill.summary.grandTotal)}</p>
                </div>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 15px; background: white; border: 1px solid #eee; border-radius: 5px;">
                        <h5 style="margin: 0 0 10px 0;">Bill QR Code</h5>
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Bill%20No%3A%20${bill.billNumber}%0ADate%3A%20${new Date(bill.billDate).toLocaleDateString()}%0AAmount%3A%20₹${bill.summary.grandTotal.toFixed(2)}" 
                             alt="Bill QR Code" style="max-width: 150px; height: auto;">
                        <p style="margin: 10px 0 0 0; color: #666;">Scan for bill details</p>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <div style="text-align: center;">
                        <div style="border-top: 1px solid #333; width: 200px; margin-bottom: 10px;"></div>
                        <p style="margin: 0;">Customer Signature</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="border-top: 1px solid #333; width: 200px; margin-bottom: 10px;"></div>
                        <p style="margin: 0;">Authorized Signature</p>
                        <p style="margin: 0; color: #666;">For Shri Mahakaleshwar Jewellers</p>
                    </div>
                </div>
            </div>
        `;
    }

    clearForm() {
        if (!confirm('Are you sure you want to clear the form? All data will be lost.')) {
            return;
        }
        
        // Reset customer data
        this.customer = {
            name: '',
            mobile: '',
            address: '',
            dob: '',
            pan: '',
            aadhaar: ''
        };
        
        // Reset forms
        document.getElementById('customerForm')?.reset();
        
        // Clear items
        this.items = [];
        this.exchangeItems = [];
        this.currentItemId = 1;
        this.currentExchangeId = 1;
        
        // Clear containers
        document.getElementById('itemsContainer').innerHTML = `
            <div class="text-center text-muted" style="padding: 20px;">
                <i class="fas fa-plus-circle fa-2x" style="margin-bottom: 10px;"></i>
                <p>Click "Add Item" to start adding jewellery items</p>
            </div>
        `;
        
        document.getElementById('exchangeItems').innerHTML = '';
        document.getElementById('exchangeSection').style.display = 'none';
        
        // Reset summary
        document.getElementById('discount').value = '0';
        document.getElementById('gstType').value = 'intra';
        document.getElementById('paymentMode').value = 'cash';
        
        // Update UI
        this.updateBillSummary();
        document.getElementById('printBillBtn').disabled = true;
        
        this.showAlert('info', 'Form cleared successfully');
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.getElementById('alertContainer');
        if (container) {
            container.appendChild(alertDiv);
            
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated()) {
        window.billingSystem = new BillingSystem();
    } else {
        window.location.href = 'login.html';
    }
});

// Make functions globally accessible
window.updateCustomer = (field, value) => {
    if (window.billingSystem) {
        window.billingSystem.customer[field] = value;
    }
};

window.clearForm = () => {
    if (window.billingSystem) {
        window.billingSystem.clearForm();
    }
};

window.printBill = () => {
    if (window.billingSystem) {
        window.billingSystem.printBill();
    }
};
