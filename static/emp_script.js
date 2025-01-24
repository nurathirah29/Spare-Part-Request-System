let itemsInRequest = [];
let isEmployeeEntered = false;
let isItemScanned = false;
let currentItem = null;

function startRequest() {
    if (isEmployeeEntered) {
        document.getElementById('start-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'flex';
    }
}

async function fetchEmployeeDetails() {
    const empId = document.getElementById('emp_id').value.trim();

    if (!empId) {
        alert('Please enter Employee ID');
        return;
    }

    try {
        const response = await fetch(`/api/employee/${empId}`);
        const data = await response.json();

        if (data.error) {
            alert('Invalid Credential');
            document.getElementById('emp_id').value = '';
            return;
        }

        document.getElementById('empIdDisplay').textContent = data.emp_id;
        isEmployeeEntered = true;

        document.getElementById('start-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'flex';

        document.getElementById('barcode').focus();

    } catch (error) {
        console.error('Error fetching employee details', error);
        alert('Employee not found');
    }
}

async function handleStart() {
    const empId = document.getElementById('emp_id').value.trim();

    if (!empId) {
        alert('Please enter Employee ID');
        return;
    }

    try {
        const response = await fetch(`/api/employee/${empId}`);
        const data = await response.json();

        if (data.error) {
            alert('Invalid Credential');
            document.getElementById('emp_id').value = '';
            return;
        }

        document.getElementById('empIdDisplay').textContent = data.emp_id;
        isEmployeeEntered = true;

        document.getElementById('start-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'flex';

        setTimeout(() => {
            document.getElementById('barcode').focus();
        }, 0); 

    } catch (error) {
        console.error('Error fetching employee details', error);
        alert('Employee not found');
    }
}

async function openItemListModal() {
    try {
        const searchKeyword = document.getElementById('itemListSearch').value.toLowerCase();
        const response = await fetch(`/api/items?search=${searchKeyword}`);
        const items = await response.json();

        if (items.error) {
            alert('Failed to load item list');
            return;
        }

        const itemListTable = document.getElementById('itemListTable');
        itemListTable.innerHTML = '';

        items.forEach(item => {
            const row = `
                <tr>
                    <td><img src="${item.item_image}" class="item-image"></td>
                    <td>${item.catalog_number}</td>
                    <td>${item.item_name}</td>
                    <td><button onclick="selectItem('${item.catalog_number}')">Select</button></td>
                </tr>`;
            itemListTable.innerHTML += row;
        });

        document.getElementById('itemListModal').style.display = 'block';

    } catch (error) {
        console.error('Error fetching items:', error);
        alert('Failed to load item list');
    }
}

function filterItems() {
    openItemListModal();
}

async function scanItem() {
    const barcode = document.getElementById('barcode').value.trim().toUpperCase();

    if (!barcode) {
        alert('Please scan or enter barcode');
        return;
    }

    if (currentItem && currentItem.catalog_number === barcode) {
        alert('Item already scanned');
        return;
    }

    try {
        const response = await fetch(`/api/item/${barcode}`);
        const data = await response.json();

        if (data.error) {
            alert('Item not found');
            return;
        }

        currentItem = {
            item_name: data.item_name,
            category: data.category,
            item_image: data.item_image || '/static/images/default.jpg',
            catalog_number: data.catalog_number,
            unit_uom: data.unit_uom
        };

        isItemScanned = true;
    } catch (error) {
        console.error("Error", error);
        alert('Item not found');
    }
}

async function department() {
    try {
        const response = await fetch(`/api/department/${document.getElementById('dept').value}`);
        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error("Error validating department", error);
        return false;
    }
}

async function addToList() {
    if (!isItemScanned) {
        alert('Please scan an item first');
        return;
    }

    const quantity = document.getElementById('quantity').value.trim();
    const deptId = document.getElementById('dept').value;

    if (!quantity || !deptId) {
        alert('Please fill in all required fields');
        return;
    }

    // Extract numeric quantity (remove non-numeric characters)
    const numericQuantity = quantity.replace(/[^\d]/g, '').trim();

    // Validate the numeric quantity
    if (!numericQuantity || isNaN(numericQuantity) || parseInt(numericQuantity) <= 0) {
        alert('Please enter a valid numeric quantity');
        return;
    }

    const isDeptValid = await department(deptId);

    if (!isDeptValid) {
        alert('Invalid Department');
        return;
    }

    // Add the current item (that was scanned earlier)
    const item = {
        ...currentItem,  // Spread the current item details
        quantity: numericQuantity,  // Only pass the numeric quantity
        department: deptId,
        date: formatDate(new Date())
    };

    itemsInRequest.push(item);
    renderItemList();

    // Reset item after adding
    currentItem = null;
    isItemScanned = false;
    document.getElementById('barcode').value = '';  // Reset barcode input
}

function renderItemList() {
    const itemTableBody = document.getElementById('itemsInRequest');
    itemTableBody.innerHTML = '';

    itemsInRequest.forEach((item, index) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><img src="${item.item_image}" alt="${item.item_name}" class="item-image"></td>
            <td>${item.item_name}</td>
            <td>${item.category}</td>
            <td>${item.quantity} ${item.unit_uom}</td>  
            <td>${item.department}</td>
            <td>${item.date || 'N/A'}</td>
            <td><button class="remove-button" onclick="removeItem(${index})">Remove</button></td>
        `;
        itemTableBody.appendChild(row);
    });
}

async function removeItem(index) {
    const item = itemsInRequest[index];

    // Confirm removal
    const isConfirmed = confirm(`Are you sure you want to remove ${item.item_name}?`);
    if (!isConfirmed) return;

    try {
        await fetch(`/api/item/update_quantity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catalog_number: item.catalog_number,
                quantity: item.quantity.split(" ")[0], 
            }),
        });

        // Remove the item from the list and re-render
        itemsInRequest.splice(index, 1);
        renderItemList();
    } catch (error) {
        console.error('Error removing item:', error);
        alert('Failed to remove item. Please try again.');
    }
}

async function submitAllItems() {
    const userConfirmed = confirm("Are you sure you want to submit this request?");
    if (!userConfirmed) {
        return; // Exit if user cancels
    }

    if (!itemsInRequest.length) {
        alert('No items to submit');
        return;
    }

    // Construct requestData with required fields
    const requestData = {
        emp_id: document.querySelector('#emp_id').value, // Assuming an input with id 'emp_id'
        items: itemsInRequest, // Ensure this is an array with item details
        remark: document.querySelector('#remark').value || '' // Optional remark
    };

    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true; // Disable button immediately to prevent double submission

    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData), // Now requestData is properly defined
        });

        const data = await response.json();
        if (data.success) {
            showNotification(`${data.transaction_id}`);
            clearForm();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error submitting transactions:', error);
        alert('Transaction submission failed.');
    } finally {
        submitButton.disabled = false; 
    }
}

function clearForm() {
    document.getElementById('barcode').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('dept').value = '';
    document.getElementById('emp_id').value = '';
    document.getElementById('remark').value = '';
    
    itemsInRequest = [];
    renderItemList(); 
}

function showNotification(referenceNumber) {
    const notificationBar = document.getElementById('notificationBar');
    const refNumElement = document.getElementById('referenceNumber');

    if (notificationBar && refNumElement) {
        refNumElement.textContent = referenceNumber;
        notificationBar.style.display = 'flex';
        setTimeout(() => {
            closeNotification();
        }, 15000);
    } else {
        console.error("Notification bar or reference number element not found.");
    }
}

function closeNotification() {
    const notificationBar = document.getElementById('notificationBar');

    if (notificationBar) {
        notificationBar.style.display = 'none';
        goToStartPage();
    }
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function resetForm() {
    document.getElementById('barcode').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('uom').value = '';
    document.getElementById('remark').value = '';
    window.currentItem = null;
    isItemScanned = false;
}

function goToStartPage() {
    document.getElementById('start-page').style.display = 'flex';
    document.getElementById('main-page').style.display = 'none';
}
