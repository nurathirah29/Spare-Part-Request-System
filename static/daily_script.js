$(document).ready(function () {
    loadTodayTransactions(); 
    setInterval(loadTodayTransactions, 86400000); 
});

function loadTodayTransactions() {
    const currentDate = new Date().toISOString().split('T')[0];
    $.get(`/api/admin/daily_transactions`, function (data) {
        populateTable(data);
    });
}

function populateTable(data) {
    const tableBody = $('#transaction-table tbody');
    tableBody.empty();

    if (data.length === 0) {
        tableBody.append(`<tr><td colspan="8" class="text-center">No transactions for today.</td></tr>`);
        return;
    }

    data.forEach((transaction, index) => {
        const rowHtml = `
            <tr>
                <td class="center">${index + 1}</td>
                <td>${transaction.transaction_id}</td>
                <td>${transaction.catalog_number}</td>
                <td>${transaction.item_name}</td>
                <td class="center">${transaction.quantity} ${transaction.unit_uom}</td>
                <td class="center">${transaction.dept_id}</td>
                <td class="center">${transaction.emp_id}</td>
                <td class="center">${transaction.emp_dept}</td>
                <td class="center">${transaction.item_status}</td>
                <td class="center">${transaction.remark}</td>
            </tr>
        `;
        tableBody.append(rowHtml);
    });
}

function sortTransactions() {
    const sortOption = $('#sortDropdown').val();
    const table = $('#transaction-table');
    const rows = table.find('tbody > tr').get();

    if (sortOption === 'itemName') {
        rows.sort((a, b) => $(a).find('td:eq(3)').text().localeCompare($(b).find('td:eq(3)').text()));
    }

    $.each(rows, function (index, row) {
        table.find('tbody').append(row);
    });
}

async function printDailyTransactions() {
    const transactionRows = document.querySelectorAll("#transaction-table tbody tr");
    if (transactionRows.length === 0) {
        alert("No transactions available to print.");
        return;
    }

    let allTransactionDetails = [];
    const transactionIds = new Set();
    const today = new Date().toLocaleDateString('en-GB');

    // Open the print window and render the daily data
    let printWindow = window.open('', '', 'width=1200,height=700');
    printWindow.document.write(`
        <html>
        <head>
            <title>Daily Transactions</title>
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
                <p class="date">Date: ${today}</p>
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

    // Iterate through all transaction rows to fetch details
    for (const row of transactionRows) {
        const transactionId = row.children[1].innerText.trim();

        if (!transactionIds.has(transactionId)) {
            transactionIds.add(transactionId); 

            try {
                const response = await fetch(`/api/admin/transactions/${transactionId}`);
                if (!response.ok) throw new Error(`Failed to fetch transaction ${transactionId}.`);
                const transaction = await response.json();

                // Push each transaction detail into the array
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
            } catch (error) {
                console.error(`Error fetching details for Transaction ID ${transactionId}:`, error);
            }
        }
    }

    // Sort and remove duplicate entries
    allTransactionDetails = allTransactionDetails.sort((a, b) => a.emp_dept.localeCompare(b.emp_dept));
    allTransactionDetails = allTransactionDetails.filter(
        (item, index, self) =>
            index === self.findIndex(t =>
                t.transaction_id === item.transaction_id &&
                t.catalog_number === item.catalog_number &&
                t.item_name === item.item_name
            )
    );

    allTransactionDetails.forEach((item, index) => {
        printWindow.document.write(`
            <tr>
                <td>${index + 1}</td>
                <td>${item.transaction_id}</td>
                <td>${item.catalog_number}</td>
                <td>${item.item_name}</td>
                <td>${item.quantity} ${item.unit_uom}</td>
                <td>${item.dept_id}</td>
                <td>${item.emp_id}</td>
                <td>${item.emp_dept}</td>
                <td>${item.item_status}</td>
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
}

function exportToExcel() {
    // Get all rows of the transaction table
    const transactionRows = document.querySelectorAll("#transaction-table tbody tr");

    if (transactionRows.length === 0) {
        alert("No transactions available to export.");
        return;
    }

    // Create a new array to hold table data
    const tableData = [["Reference No.", "Catalog Number", "Item Name", "Quantity", "Request Section", "Card No.", "User Section", "Status", "Remark"]];

    // Populate the array with table data
    transactionRows.forEach(row => {
        const rowData = [];
        row.querySelectorAll("td").forEach((cell, index) => {
            switch (index) {
                case 1:  // Reference No. -> transaction_id
                    rowData.push(cell.innerText.trim());
                    break;
                case 2:  // Catalog Number
                    rowData.push(cell.innerText.trim());
                    break;
                case 3:  // Item Name
                    rowData.push(cell.innerText.trim());
                    break;
                case 4:  // Quantity
                    rowData.push(cell.innerText.trim());
                    break;
                case 5:  // Request Section -> dept_id
                    rowData.push(cell.innerText.trim());
                    break;
                case 6:  // Card No. -> emp_id
                    rowData.push(cell.innerText.trim());
                    break;
                case 7:  // User Section -> emp_dept
                    rowData.push(cell.innerText.trim());
                    break;
                case 8:  // Status -> item_status
                    rowData.push(cell.innerText.trim());
                    break;
                case 9:  // Remark -> remark
                    rowData.push(cell.innerText.trim());
                    break;
            }
        });
        tableData.push(rowData);
    });

    // Create a new worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");

    // Export the workbook to an Excel file
    XLSX.writeFile(workbook, `Daily_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
}