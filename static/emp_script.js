let itemsInRequest = [];
let isEmployeeEntered = false;
let isItemScanned = false;
let currentItem = null;
let searchTimeout;
let barcodeSearchTimeout;

function startRequest() {
    if (isEmployeeEntered) {
        document.getElementById('start-page').style.display = 'none';
        document.getElementById('main-page').style.display = 'flex';
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

        await loadDepartments();

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
                    <td><button class="select-btn" onclick="selectItem('${item.catalog_number}')">Select</button></td>
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
    clearTimeout(searchTimeout);
    
    const searchValue = document.getElementById('itemListSearch').value.trim();
    
    // Only search if 3 or more characters
    if (searchValue.length >= 3) {
        searchTimeout = setTimeout(openItemListModal, 500);
    } else if (searchValue.length === 0) {
        // Optional: Clear the table when search is empty
        document.getElementById('itemListTable').innerHTML = '';
    }
}

async function scanItem() {
    const barcode = document.getElementById('barcode').value.trim().toUpperCase();

    if (!barcode) {
        alert('Please scan or enter barcode');
        return;
    }

    if (barcode.length < 3) {
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

async function department(deptId) {
    if (!deptId) return false;

    try {
        const response = await fetch(`/api/department/${deptId}`);
        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error("Error validating department", error);
        return false;
    }
}

// Load departments
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();
        
        if (departments.error) {
            console.error('Failed to load departments:', departments.error);
            return;
        }
        
        const deptSelect = document.getElementById('dept');
        deptSelect.innerHTML = '<option value="">Select</option>';

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.dept_id;
            option.textContent = `${dept.dept_id} - ${dept.dept_name}`;
            deptSelect.appendChild(option);
        });

        if ($.fn.select2) {
            try {
                $('#dept').select2('destroy');
            } catch (e) {

            }
            $('#dept').select2({
                placeholder: "Select department",
                allowClear: true,
                width: '100%'
            });
        }
        
    } catch (error) {
        console.error('Error loading departments:', error);
        alert('Failed to load departments');
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
        ...currentItem,  // current item details
        quantity: numericQuantity,
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
    if (!userConfirmed) return;

    if (!itemsInRequest.length) {
        alert('No items to submit');
        return;
    }

    const empIdInput = document.querySelector('#emp_id');
    const remarkInput = document.querySelector('#remark');
    const submitButton = document.querySelector('.submit-button');

    // Construct requestData with required fields
    const requestData = {
        emp_id: empIdInput?.value || '',
        items: itemsInRequest,
        remark: remarkInput?.value || ''
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
        });

        let data;
        try {
            data = await response.json();
        } catch (error) {
            console.error('Error submitting transactions:', error);
            alert('Transaction submission failed.');
        }

        if (response.ok && data.success) {
            showNotification(`Transaction ID: ${data.transaction_id}`);
            clearForm();
        } else if (response.status === 409) {
            alert(`Duplicate transaction: ${data.transaction_id}`);
        } else {
            alert(`Error: ${data.error || 'Unknown error'}`);
        }
    } catch (err) {
        console.error('Submission failed:', err);
        alert('Submission failed due to network or server issue');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
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

window.addEventListener('DOMContentLoaded', function() {
    loadDepartments();
});