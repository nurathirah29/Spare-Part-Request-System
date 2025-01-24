async function openTransactionModal(transaction_id) {
    try {
        console.log(`Opening modal for transaction ID: ${transaction_id}`);

        const response = await fetch(`/api/admin/transactions/${transaction_id}`);
        if (!response.ok) throw new Error(`Failed to fetch transaction. Status: ${response.status}`);

        const transaction = await response.json();
        console.log('Transaction data:', transaction);

        if (!transaction || !transaction.transaction_id) {
            alert('Transaction not found');
            return;
        }

        // Populate modal fields for employee details
        document.getElementById('transaction_id').value = transaction.transaction_id;
        document.getElementById('transaction_id_label').textContent = transaction.transaction_id;
        document.getElementById('status').value = transaction.status || '';
        document.getElementById('remark').value = transaction.remark || '';

        // Ensure employee details are available
        if (transaction.emp_id && transaction.emp_name && transaction.emp_dept) {
            document.getElementById('emp_id').value = transaction.emp_id;
            document.getElementById('emp_name').value = transaction.emp_name;
            document.getElementById('emp_dept').value = transaction.emp_dept;
        } else {
            alert('Employee details are missing for this transaction.');
        }

        // Populate item details table
        const itemDetailsContainer = document.getElementById('item-details');
        itemDetailsContainer.innerHTML = '';

        if (transaction.details && transaction.details.length > 0) {
            transaction.details.forEach((item, index) => {
                const itemStatus = item.item_status || (transaction.status === 'Pending' ? 'Approve' : ''); // Default to 'Approve' if status is 'Pending'
                const itemRow = `
                    <tr>
                        <td>${index + 1}</td>
                        <td><input type="text" class="form-control" id="catalog_number_${index}" value="${item.catalog_number}" readonly/></td>
                        <td><input type="text" class="form-control" id="item_name_${index}" value="${item.item_name}" readonly/></td>
                        <td><input type="number" class="form-control" id="quantity_${index}" value="${item.quantity}" /></td>
                        <td>
                            <select class="form-control" id="dept_id_${index}">
                                <option value="AD" ${item.dept_id === "AD"? "selected": ""}>AD</option>
                                <option value="BP" ${item.dept_id === "BP"? "selected": ""}>BP</option>
                                <option value="BL" ${item.dept_id === "BL"? "selected": ""}>BL</option>
                                <option value="BT" ${item.dept_id === "BT"? "selected": ""}>BT</option>
                                <option value="DP" ${item.dept_id === "DP"? "selected": ""}>DP</option>
                                <option value="EA" ${item.dept_id === "EA"? "selected": ""}>EA</option>
                                <option value="EL" ${item.dept_id === "EL"? "selected": ""}>EL</option>
                                <option value="EN" ${item.dept_id === "EN"? "selected": ""}>EN</option>
                                <option value="HT" ${item.dept_id === "HT"? "selected": ""}>HT</option>
                                <option value="IF" ${item.dept_id === "IF"? "selected": ""}>IF</option>
                                <option value="IP" ${item.dept_id === "IP"? "selected": ""}>IP</option>
                                <option value="MD" ${item.dept_id === "MD"? "selected": ""}>MD</option>
                                <option value="OF" ${item.dept_id === "OF"? "selected": ""}>OF</option>
                                <option value="PC" ${item.dept_id === "PC"? "selected": ""}>PC</option>
                                <option value="PD" ${item.dept_id === "PD"? "selected": ""}>PD</option>
                                <option value="PK" ${item.dept_id === "PK"? "selected": ""}>PK</option>
                                <option value="QC" ${item.dept_id === "QC"? "selected": ""}>QC</option>
                                <option value="RL" ${item.dept_id === "RL"? "selected": ""}>RL</option>
                                <option value="SH" ${item.dept_id === "SH"? "selected": ""}>SH</option>
                                <option value="SP" ${item.dept_id === "SP"? "selected": ""}>SP</option>
                                <option value="ST" ${item.dept_id === "ST"? "selected": ""}>ST</option>
                                <option value="WD" ${item.dept_id === "WD"? "selected": ""}>WD</option>
                            </select>
                        </td>
                        <td>
                            <select class="form-control" id="item_status_${index}">
                                <option value="Pending" ${itemStatus === "Pending" ? "selected" : ""}>Pending</option>
                                <option value="Approve" ${itemStatus === "Approve" ? "selected" : ""}>Approve</option>
                                <option value="Cancel" ${itemStatus === "Cancel" ? "selected" : ""}>Cancel</option>
                            </select>
                        </td>
                    </tr>
                `;
                itemDetailsContainer.innerHTML += itemRow;
            });
        } else {
            itemDetailsContainer.innerHTML = '<tr><td colspan="5" class="text-center">No items available for this transaction.</td></tr>';
        }

        if (transaction.status === 'Pending') {
            const itemStatusFields = document.querySelectorAll('select[id^="item_status_"]');
            itemStatusFields.forEach(field => {
                field.value = 'Approve'; // Set all item statuses to 'Approve'
            });
        }

        document.getElementById('status').addEventListener('change', function () {
            const transactionStatus = this.value;
            const itemStatusFields = document.querySelectorAll('select[id^="item_status_"]');

            if (transactionStatus === 'Cancel') {
                itemStatusFields.forEach(field => {
                    field.value = 'Cancel'; // Set all item statuses to 'Cancel'
                    field.disabled = true; // Optional: Disable dropdown to prevent changes
                });
            } else if (transactionStatus === 'Pending') {
                itemStatusFields.forEach(field => {
                    field.value = 'Approve'; // Set all item statuses to 'Approve'
                });
            }
        });

        const modal = document.getElementById('transactionModal');
        if (modal) {
            $('#transactionModal').modal('show');
        } else {
            console.error('Modal not found.');
            alert('Modal not found.');
        }

    } catch (error) {
        console.error('Error opening modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

async function saveTransactionChanges() {
    const transaction_id = $("#transaction_id").val();
    const status = $("#status").val();
    const remark = $("#remark").val();

    // Validation for empty status or remark
    if (!status || !remark) {
        alert("Status and Remark cannot be empty!");
        return;
    }

    const items = [];
    let validationFailed = false;

    // Loop through each item to validate
    $('#item-details tr').each((index, row) => {
        const catalogNumber = $(`#catalog_number_${index}`).val();
        const itemName = $(`#item_name_${index}`).val();
        const quantity = $(`#quantity_${index}`).val();	
        const deptId = $(`#dept_id_${index}`).val();
        const itemRemark = $(`#remark_${index}`).val();
        const itemStatus = $(`#item_status_${index}`).val();

        if (!catalogNumber || !itemName) {
            alert(`Item ${index + 1}: Catalog number and Item Name are required.`);
            validationFailed = true;
            return false; 
        }

        if (!quantity || isNaN(quantity) || quantity <= 0) {
            alert(`Item ${index + 1}: Quantity must be a positive number.`);
            validationFailed = true;
            return false;
        }

        if (!itemStatus) {
            alert(`Item ${index + 1}: Item Status is required.`);
            validationFailed = true;
            return false;
        }

        items.push({
            catalog_number: catalogNumber,
            item_name: itemName,
            quantity: parseInt(quantity, 10),
            dept_id: deptId, 
            remark: itemRemark || "",
            item_status: itemStatus
        });
    });

    if (validationFailed || items.length === 0) {
        alert("Please provide valid data for all items.");
        return;  
    }

    const isConfirmed = confirm("Are you sure you want to update this transaction?");
    if (!isConfirmed) {
        return;  
    }

    const requestBody = { 
        status: status,
        remark: remark,
        items: items
    };

    try {
        const response = await fetch(`/api/admin/update_transaction/${transaction_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error response:", errorText);
            throw new Error(`Failed to update transaction: ${errorText}`);
        }

        alert('Transaction updated successfully!');
        closeModal();  
        loadTransactions();  
    } catch (error) {
        console.error('Error saving transaction:', error);
        alert(`Failed to update transaction: ${error.message}`);
    }
}

async function loadTransactions() {
    try {
        const response = await fetch('/api/admin/transactions');
        if (!response.ok) throw new Error(`Failed to load transactions. Status: ${response.status}`);
        
        const data = await response.json();

        if (Array.isArray(data.transactions)) {
            // Log transactions for debugging (no sorting here)
            console.log('Transactions (should already be in LIFO order):', data.transactions);

            populateTable(data, 1);
        } else {
            console.error("Expected 'transactions' to be an array, but received:", data.transactions);
            alert("Unexpected response format for transactions.");
        }
    } catch (err) {
        console.error("Error fetching transactions:", err);
        alert("Unable to load transactions.");
    }
}

async function fetchFilteredTransactions(page = 1) {
    const status = document.getElementById('statusFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const searchElement = document.getElementById('searchBox');
    const search = searchElement ? (searchElement.value || '') : '';
    const queryParams = new URLSearchParams();

    if (status !== "all") queryParams.append('status', status);
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    if (search.trim() !== "") queryParams.append('search', search);
    queryParams.append('page', page);
    
    const transactionTableBody = document.querySelector('#transaction-table tbody');
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    try {
        const response = await fetch(`/api/admin/transactions?${queryParams.toString()}`);
        if (!response.ok) throw new Error(`Failed to fetch transactions. Status: ${response.status}`);
  
        const data = await response.json();
        const transactions = data.transactions;
        const pagination = data.pagination;
  
        transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)); // Sorting is done here to make sure LIFO order
    
        if (!Array.isArray(transactions) || transactions.length === 0) {
            transactionTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found.</td></tr>';
        } else {
            transactionTableBody.innerHTML = '';
    
            const statusMap = {
                'Pending': 'highlight-pending',
                'Approve': 'highlight-approve',
                'On Hold': 'highlight-on-hold',
                'Cancel': 'highlight-cancel'
            };
    
            transactions.forEach(transaction => {
                const statusClass = statusMap[transaction.status] || '';
    
                const row = document.createElement('tr');
                row.innerHTML = `  
                    <td class="center">${transaction.transaction_date || '-'}</td>
                    <td class="center">${transaction.transaction_id}</td>
                    <td class="center">${transaction.emp_id}</td>
                    <td class="center">${transaction.emp_dept}</td>
                    <td class="center">${transaction.remark}</td>
                    <td class="center"><span class="${statusClass}">${transaction.status}</span></td>
                    <td class="center">
                        <button class="btn btn-info" onclick="openTransactionModal('${transaction.transaction_id}', true)">View</button>
                    </td>
                `;
                transactionTableBody.appendChild(row);
            });
        }

        updatePagination(pagination);

    } catch (error) {
        console.error('Error fetching transactions:', error);
        transactionTableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Failed to fetch transactions. Please try again later.</td></tr>`;
    }
}

function updatePagination(pagination) {
    const paginationContainer = document.getElementById('pagination-container');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const currentPage = pagination.current_page;
    const totalPages = pagination.total_pages;

    const pageItems = Array.from(paginationContainer.querySelectorAll('.page-item:not(#prev-button):not(#next-button)'));
    pageItems.forEach(item => item.remove());

    if (currentPage === 1) {
        prevButton.classList.add('disabled');
    } else {
        prevButton.classList.remove('disabled');
    }

    if (currentPage === totalPages) {
        nextButton.classList.add('disabled');
    } else {
        nextButton.classList.remove('disabled');
    }

    const maxPagesToShow = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.classList.add('page-item');
        if (i === currentPage) {
            pageItem.classList.add('active');
        }
        pageItem.innerHTML = `<a class="page-link" href="#" onclick="fetchFilteredTransactions(${i})">${i}</a>`;
        paginationContainer.insertBefore(pageItem, nextButton);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchFilteredTransactions(1); 
});