async function loadTransactions() {
    try {
        const response = await fetch('/api/admin/transactions');
        if (!response.ok) throw new Error(`Failed to load transactions. Status: ${response.status}`);
        
        const data = await response.json();

        if (Array.isArray(data.transactions)) {
            data.transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
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
  
        // Ensure sorting is LIFO (most recent first)
        transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    
        if (!Array.isArray(transactions) || transactions.length === 0) {
            transactionTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No transactions found.</td></tr>';
        } else {
            transactionTableBody.innerHTML = '';
    
            const statusMap = {
                'Pending': 'highlight-pending',
                'Approve': 'highlight-approve',
                'On Hold': 'highlight-on-hold',
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

async function printCustomTransactions() {
    const transactionRows = document.querySelectorAll("#transaction-table tbody tr");
    if (transactionRows.length === 0) {
        alert("No transactions available to print.");
        return;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
    }

    let dateRange = "Date: ";
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const startDate = startDateInput ? startDateInput.value : null;
    const endDate = endDateInput ? endDateInput.value : null;

    if (startDate && endDate) {
        const start = formatDate(startDate);
        const end = formatDate(endDate);
        dateRange += start === end ? start : `${start} - ${end}`;
    } else {
        dateRange = "Date: N/A";
    }

    const status = document.getElementById('statusFilter').value;
    const searchElement = document.getElementById('searchBox');
    const search = searchElement ? searchElement.value.trim() : '';

    const queryParams = new URLSearchParams();
    if (status && status !== "all") queryParams.append('status', status);
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    if (search) queryParams.append('search', search);

    // Add "all_records=true" to ensure all filtered records are fetched
    queryParams.append('all_records', 'true');

    try {
        const response = await fetch(`/api/admin/transactions?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch transactions.');
        const data = await response.json();

        if (!Array.isArray(data.transactions)) {
            throw new Error("Invalid response format: 'transactions' is not an array.");
        }

        let allTransactionDetails = [];
        for (const transaction of data.transactions) {
            if (transaction.details && Array.isArray(transaction.details) && transaction.details.length > 0) {
                transaction.details.forEach(item => {
                    allTransactionDetails.push({
                        transaction_id: transaction.transaction_id,
                        catalog_number: item.catalog_number,
                        item_name: item.item_name,
                        quantity: item.quantity,
                        unit_uom: item.unit_uom,
                        emp_dept: transaction.emp_dept,
                        emp_id: transaction.emp_id,
                        dept_id: item.dept_id,
                        item_status: item.item_status,
                        remark: transaction.remark
                    });
                });
            } else {
                console.warn(`No details found for transaction ID: ${transaction.transaction_id}`);
            }
        }

        allTransactionDetails.sort((a, b) => a.emp_dept.localeCompare(b.emp_dept));

        let printWindow = window.open('', '', 'width=1200,height=700');
        printWindow.document.write(`
            <html>
            <head>
                <title>Filtered Transactions</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        position: relative;
                    }
                    .header img {
                        position: absolute;
                        top: 20px; 
                        left: 10px; 
                        width: 200px;
                        height: auto;
                    }
                    .header h2, .header h3 {
                        margin: 0;
                        padding-top: 20px;
                    }
                    .sub-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    .date {
                        text-align: right;
                        font-size: 16px;
                        font-weight: bold;
                    }
                    .table-container {
                        width: 100%;
                        margin: 0 auto;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    table, th, td {
                        border: 1px solid black;
                        text-align: center;
                        padding: 8px;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="/static/images/logo.png" alt="Excel Rim Sdn. Bhd.">
                    <h2>EXCEL RIM SDN. BHD. (682008-T)</h2>
                    <h3>SPARE PART ISSUE NOTE</h3>
                </div>
                <div class="sub-header">
                    <p class="date">${dateRange}</p>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Reference No.</th>
                                <th>Catalog Number</th>
                                <th>Item Name</th>
                                <th>Quantity</th>
                                <th>Request Section</th>
                                <th>Card No.</th>
                                <th>User Section</th>
                                <th>Status</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
        `);

        allTransactionDetails.forEach((item, index) => {
            console.log(item.dept_id, item.item_status);
            printWindow.document.write(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.transaction_id}</td>
                    <td>${item.catalog_number}</td>
                    <td>${item.item_name}</td>
                    <td>${item.quantity} ${item.unit_uom}</td>
                    <td>${item.dept_id}</td>  <!-- Request Section -->
                    <td>${item.emp_id}</td>
                    <td>${item.emp_dept}</td>
                    <td>${item.item_status}</td>  <!-- Status -->
                    <td>${item.remark}</td>
                </tr>
            `);
        });        

        printWindow.document.write(`
                    </tbody>
                </table>
            </div>
        </body>
        </html>
        `);

        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error fetching transactions for print:', error);
        alert('Failed to fetch transactions for printing.');
    }
}

window.onload = loadTransactions;

async function exportToExcel() {
    const transactionRows = document.querySelectorAll("#transaction-table tbody tr");
    if (transactionRows.length === 0) {
        alert("No transactions available to export.");
        return;
    }

    // Collect filter values
    const status = document.getElementById('statusFilter').value;
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const searchElement = document.getElementById('searchBox');
    
    const startDate = startDateInput ? startDateInput.value : null;
    const endDate = endDateInput ? endDateInput.value : null;
    const search = searchElement ? (searchElement.value || '') : '';

    const queryParams = new URLSearchParams();
    queryParams.append('all_records', 'true');

    if (status && status !== "all") queryParams.append('status', status);
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    if (search.trim() !== "") queryParams.append('search', search);

    try {
        const response = await fetch(`/api/admin/transactions?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch transactions.');
        const data = await response.json();

        const transactions = data.transactions;
        if (!Array.isArray(transactions) || transactions.length === 0) {
            alert("No transactions available to export.");
            return;
        }

        // Prepare data for Excel
        const exportData = [["Transaction ID", "Catalog Number", "Item Name", "Quantity", "User Section", "Card No.", "Remarks"]];

        // Process transactions and their details
        transactions.forEach(transaction => {
            if (transaction.details && Array.isArray(transaction.details) && transaction.details.length > 0) {
                transaction.details.forEach(item => {
                    exportData.push([
                        transaction.transaction_id,
                        item.catalog_number,
                        item.item_name,
                        `${item.quantity} ${item.unit_uom}`,
                        transaction.emp_dept,
                        transaction.emp_id,
                        item.dept_id,
                        item.item_status,
                        transaction.remark
                    ]);
                });
            } else {
                // If no details, still push the transaction info
                exportData.push([
                    transaction.transaction_id,
                    "N/A", "N/A", "N/A",
                    transaction.emp_dept,
                    transaction.emp_id,
                    transaction.remark || "N/A"
                ]);
            }
        });

        // Generate Excel file
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Filtered Transactions");

        // Download the Excel file
        const filename = `Filtered_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error('Error exporting transactions:', error);
        alert('Failed to export transactions.');
    }
}    