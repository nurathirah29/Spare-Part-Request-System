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
    let printWindow = window.open('', '', 'width=1000,height=500');
    printWindow.document.write(`
    <html>
    <head>
        <title>Daily Transactions</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                font-size: 12px;
            }

            @media print {
                @page {
                    size: A5 landscape;
                    margin: 10mm;
                }

                html, body {
                    margin: 0 0 0 15px;
                    padding: 0;
                    font-size: 10px;
                }

                thead {
                    display: table-header-group;
                }

                .header {
                    text-align: center;
                    padding: 0 0 0 0;
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 3px;
                }

                .header-left {
                    flex: 1;
                    text-align: left;
                }

                .header-left img {
                    width: 90px;
                    height: auto;
                }

                .header-center {
                    flex: 2;
                    text-align: center;
                    padding: 0 15px;
                }

                .header-center h2 {
                    font: bold 16px 'Times New Roman', sans-serif;
                    margin: 0 0 3px 0;
                }

                .header-center h3 {
                    font: bold 14px 'Times New Roman', sans-serif;
                    text-decoration: underline;
                    margin: 0;
                }

                .header-right {
                    flex: 1;
                    text-align: right;
                    font: 11px 'Times New Roman', sans-serif;
                    line-height: 1.2;
                }

                .sub-header {
                    text-align: left;
                    font-size: 12px;
                    font-weight: bold;
                    margin: 5px 0;
                    padding: 12px 0 0 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9px;
                    margin-bottom: 3px;
                }

                th, td {
                    padding: 4px 2px;
                    font-size: 9px;
                    border: 1px solid black;
                    text-align: center;
                }

                tr, td, th {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                th:nth-child(1), td:nth-child(1) { width: 4%; } /* No */
                th:nth-child(2), td:nth-child(2) { width: 9%; } /* Reference No */
                th:nth-child(3), td:nth-child(3) { width: 13%; } /* Catalog Number */
                th:nth-child(4), td:nth-child(4) { width: 15%; } /* Item Name */
                th:nth-child(5), td:nth-child(5) { width: 7%; } /* Quantity */
                th:nth-child(6), td:nth-child(6) { width: 7%; } /* Request Section*/
                th:nth-child(7), td:nth-child(7) { width: 7%; } /* Card No. */
                th:nth-child(8), td:nth-child(8) { width: 7%; } /* User Section */
                th:nth-child(9), td:nth-child(9) { width: 7%; } /* Status */
                th:nth-child(10), td:nth-child(10) { width: 13%; } /* Remark */
            }
        </style>
    </head>
    <body>
        <table>
            <thead>
                <tr>
                    <td colspan="10" style="border: none;">
                        <div class="header">
                            <div class="header-top">
                                <div class="header-left">
                                    <img src="/static/images/logo.png" alt="Logo" onerror="this.style.display='none'">
                                </div>
                                <div class="header-center">
                                    <h2>EXCEL RIM SDN. BHD. <span style="font-size: 12px;">(682008-T)</span></h2>
                                    <h3>SPARE PART/OTHERS INTERNAL ISSUE NOTE</h3>
                                </div>
                                <div class="header-right">
                                    <div>Control Hard Copy</div>
                                    <div>2-8-P-12-F-05 Rev 03</div>
                                    <div>Eff. Date : 09/06/2025</div>
                                </div>
                            </div>
                            <div class="sub-header">
                                Date: ${today}
                            </div>
                        </div>
                    </td>
                </tr>
                <tr>
                    <th>No.</th>
                    <th>Reference No.</th>
                    <th>Catalog Number</th>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>User Section</th>
                    <th>Card No.</th>
                    <th>Requester Section</th>
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
    </body>
    </html>
    `);

    printWindow.document.close();

    // Ensure image loads before print
    setTimeout(() => {
        printWindow.print();
    }, 1000);
}

function exportToExcel() {
    // Get all rows of the transaction table
    const transactionRows = document.querySelectorAll("#transaction-table tbody tr");

    if (transactionRows.length === 0) {
        alert("No transactions available to export.");
        return;
    }

    // Create a new array to hold table data
    const tableData = [["Reference No.", "Catalog Number", "Item Name", "Quantity", "User Section", "Card No.", "Requester Section", "Status", "Remark"]];

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
                case 5:  // User Section -> dept_id
                    rowData.push(cell.innerText.trim());
                    break;
                case 6:  // Card No. -> emp_id
                    rowData.push(cell.innerText.trim());
                    break;
                case 7:  // Requester Section -> emp_dept
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