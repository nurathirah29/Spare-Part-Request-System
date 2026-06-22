let currentPage = 1;
let itemToDelete = null;
let allItems = [];
let filteredItems = [];
let isEditMode = [];
let currentEditingItem = null;
const itemsPerPage = 10;

// Load items from API
function loadItems() {
    const searchText = document.getElementById('searchBox').value;

    $.ajax({
        url: '/api/items',
        method: 'GET',
        data: {
        search: searchText,
        page: currentPage,
        per_page: itemsPerPage,
        detailed: 'true'
        },
        success: function(response) {
        console.log('Full API Response:', response);
        console.log('Response.items:', response.items); 

        if (!response.items) {
            console.error('response.items is undefined!');
            return;
        }

        allItems = response.items;
        populateItemsTable(response.items);
        updatePagination(response.total_pages, response.page);
        },
        error: function(xhr) {
        console.error('Error loading items:', xhr.responseJSON);
        alert('Error loading items: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

function populateItemsTable(items) {
    const tbody = document.querySelector('#items-table tbody');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No items found.</td></tr>';
        return;
    }

    items.forEach(item => {
        const row = document.createElement('tr');
        
        // Handle image display
        let imageHtml = '<span class="text-muted">No image</span>';
        if (item.item_image) {
            imageHtml = `<img src="${item.item_image}" class="item-image-preview" alt="${item.item_name || 'Item'}" 
                            onerror="this.style.display='none';" style="max-width:50px;max-height:50px;">`;
        }
        
        // Clean the data and properly escape for HTML attributes
        const cleanCatalogNumber = item.catalog_number.trim();
        const cleanItemName = (item.item_name || 'Unnamed Item');
        
        // Create the row content
        row.innerHTML = `
            <td class="text-left pl-3"><strong>${item.catalog_number}</strong></td>
            <td class="text-left pl-3">${item.item_name || '-'}</td>
            <!-- <td>${item.category || '-'}</td> -->
            <td>${item.unit_uom || '-'}</td>
            <td>${(item.on_hand_qty !== null && item.on_hand_qty !== undefined && item.on_hand_qty !== 'None') ? item.on_hand_qty : '-'}</td>
            <td>${imageHtml}</td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick="editItem('${cleanCatalogNumber}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="viewItem('${cleanCatalogNumber}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        // Add event listener to delete button (safer than onclick with parameters)
        const deleteButton = row.querySelector('.btn-danger');
        deleteButton.addEventListener('click', function() {
            deleteItem(cleanCatalogNumber, cleanItemName);
        });
        
        tbody.appendChild(row);
    });
}

function openAddItemModal() {
    isEditMode = false;
    currentEditingItem = null;

    document.getElementById('itemModalLabel').textContent = 'Add New Item';
    document.getElementById('item-form').reset();
    document.getElementById('original_catalog_number').value = '';
    document.getElementById('itemImageFile').value = '';
    updateImagePreview('');

    // Make sure all fields are enabled
    const formElements = document.querySelectorAll('#item-form input, #item-form select, #item-form textarea');
    formElements.forEach(element => {
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
    });

    // Show save button
    document.querySelector('.modal-footer .btn-primary').style.display = 'inline-block';

    console.log('Add mode set');
    $('#itemModal').modal('show');
}

function handleFileInputChange(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const placeholder = document.getElementById('no-image-placeholder');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
        previewImg.src = e.target.result;
        previewContainer.style.display = 'block';
        placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

function editItem(catalogNumber) {
    catalogNumber = catalogNumber.trim();

    $.ajax({
        url: `/api/item/${encodeURIComponent(catalogNumber)}`, 
        method: 'GET',
        success: function(item) {
            console.log('Loading item for edit:', item);
            
            // Set edit mode
            isEditMode = true;
            currentEditingItem = catalogNumber;

            // Update modal title and form
            document.getElementById('itemModalLabel').textContent = 'Edit Item';
            document.getElementById('original_catalog_number').value = item.catalog_number;
            document.getElementById('catalog_number').value = item.catalog_number;
            document.getElementById('item_name').value = item.item_name || '';
            // document.getElementById('category').value = item.category || '';
            document.getElementById('unit_uom').value = item.unit_uom || '';
            
            // Clear image file input
            document.getElementById('itemImageFile').value = '';
            updateImagePreview(item.item_image);
            
            // Make all form fields editable
            const formElements = document.querySelectorAll('#item-form input, #item-form select, #item-form textarea');
            formElements.forEach(element => {
                element.removeAttribute('readonly');
                element.removeAttribute('disabled');
            });
            
            // Show save button
            document.querySelector('.modal-footer .btn-primary').style.display = 'inline-block';

            console.log('Edit mode set. Original catalog:', item.catalog_number);
            $('#itemModal').modal('show');
        },
        error: function(xhr) {
            alert('Error loading item: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}  

function viewItem(catalogNumber) {
    $.ajax({
        url: `/api/item/${catalogNumber}`,
        method: 'GET',
        success: function(item) {
        // Populate form
        document.getElementById('itemModalLabel').textContent = 'View Item Details';
        document.getElementById('original_catalog_number').value = item.catalog_number;
        document.getElementById('catalog_number').value = item.catalog_number;
        document.getElementById('item_name').value = item.item_name || '';
        // document.getElementById('category').value = item.category || '';
        document.getElementById('unit_uom').value = item.unit_uom || '';
        updateImagePreview(item.item_image);
        
        // Make all form fields readonly
        const formElements = document.querySelectorAll('#item-form input, #item-form select, #item-form textarea');
        formElements.forEach(element => element.setAttribute('readonly', true));
        
        // Disable file input for view mode
        document.getElementById('itemImageFile').setAttribute('disabled', true);
        
        // Hide save button
        document.querySelector('.modal-footer .btn-primary').style.display = 'none';

        $('#itemModal').modal('show');
        },
        error: function(xhr) {
        alert('Error loading item: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

function deleteItem(catalogNumber, itemName) {
    itemToDelete = catalogNumber;
    document.getElementById('delete-item-name').textContent = itemName;
    document.getElementById('delete-catalog-number').textContent = catalogNumber;
    $('#deleteModal').modal('show');
}

function confirmDelete() {
    if (!itemToDelete) return;

    $.ajax({
        url: `/api/item/${encodeURIComponent(itemToDelete)}`,
        method: 'DELETE',
        success: function(response) {
            alert('Item deleted successfully!');
            $('#deleteModal').modal('hide');
            loadItems(); 
            itemToDelete = null;
        },
        error: function(xhr) {
            alert('Error deleting item: ' + (xhr.responseJSON?.error || 'Unknown error'));
        }
    });
}

function saveItem() {
    const formData = new FormData();

    // Get form data
    formData.append('catalog_number', document.getElementById('catalog_number').value.trim());
    formData.append('item_name', document.getElementById('item_name').value.trim());
    // formData.append('category', document.getElementById('category').value.trim());
    formData.append('unit_uom', document.getElementById('unit_uom').value.trim());

    // Get file input
    const fileInput = document.getElementById('itemImageFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('item_image', fileInput.files[0]);
        console.log('File added to form:', fileInput.files[0].name);
    }

    // Basic validation
    const catalogNumber = formData.get('catalog_number');
    const itemName = formData.get('item_name');
    const unitUom = formData.get('unit_uom');

    if (!catalogNumber || !itemName || !unitUom) {
        alert('Please fill in all required fields.');
        return;
    }

    // Use the global variables for more reliable edit detection
    const originalCatalogNumber = document.getElementById('original_catalog_number').value.trim();

    console.log('Save item debug:', {
        isEditMode: isEditMode,
        currentEditingItem: currentEditingItem,
        originalCatalogNumber: originalCatalogNumber,
        newCatalogNumber: catalogNumber
    });

    if (isEditMode && currentEditingItem) {
        // Update existing item - use currentEditingItem and encode it properly
        const encodedCatalogNumber = encodeURIComponent(currentEditingItem.trim());
        console.log(`Updating item: ${currentEditingItem} (encoded: ${encodedCatalogNumber})`);
        
        $.ajax({
            url: `/api/item/${encodedCatalogNumber}`, // Use encoded catalog number
            method: 'PUT',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('Update successful:', response);
                alert('Item updated successfully!');
                $('#itemModal').modal('hide');
                resetModalState();
                loadItems();
            },
            error: function(xhr) {
                console.error('Update error:', xhr.responseJSON);
                alert('Error updating item: ' + (xhr.responseJSON?.error || 'Unknown error'));
            }
        });
    } else {
        // Add new item
        console.log('Adding new item');
        
        $.ajax({
            url: '/add_item',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('Add successful:', response);
                alert('Item added successfully!');
                $('#itemModal').modal('hide');
                resetModalState();
                loadItems();
            },
            error: function(xhr) {
                console.error('Add error:', xhr.responseJSON);
                alert('Error adding item: ' + (xhr.responseJSON?.error || 'Unknown error'));
            }
        });
    }
}

function resetModalState() {
    isEditMode = false;
    currentEditingItem = null;

    // Reset form
    document.getElementById('item-form').reset();
    document.getElementById('original_catalog_number').value = '';
    document.getElementById('itemImageFile').value = '';
    updateImagePreview('');
}

// Update the modal hidden event listener
$(document).ready(function() {
    $('#itemModal').on('hidden.bs.modal', function() {
        console.log('Modal hidden, resetting state');
        resetModalState();
        
        // Re-enable all form elements
        const formElements = document.querySelectorAll('#item-form input, #item-form select, #item-form textarea');
        formElements.forEach(element => {
            element.removeAttribute('readonly');
            element.removeAttribute('disabled');
        });
        document.querySelector('.modal-footer .btn-primary').style.display = 'inline-block';
    });
});

function filterItems() {
    currentPage = 1; // Reset to first page when filtering
    loadItems();
}

function clearFilters() {
    document.getElementById('searchBox').value = '';
    currentPage = 1;
    loadItems();
}

function updateImagePreview(imageUrl) {
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const placeholder = document.getElementById('no-image-placeholder');

    if (imageUrl && imageUrl.trim() !== '') {
        previewImg.src = imageUrl;
        previewContainer.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        previewContainer.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

function updatePagination(totalPages, currentPageNum) {
    const paginationContainer = document.getElementById('pagination-container');

    // Clear all existing pagination items
    paginationContainer.innerHTML = '';

    // Don't show pagination if there's only 1 page or no pages
    if (totalPages <= 1) {
        return;
    }

    // Define how many page numbers to show
    const maxVisiblePages = 5;

    // Calculate start and end page numbers
    let startPage = Math.max(1, currentPageNum - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    const prevButton = document.createElement('li');
    prevButton.className = `page-item ${currentPageNum <= 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Previous';
    prevLink.onclick = (e) => {
        e.preventDefault();
        if (currentPage > 1) {
        currentPage--;
        loadItems();
        }
    };
    prevButton.appendChild(prevLink);
    paginationContainer.appendChild(prevButton);

    // Add first page and ellipsis if needed
    if (startPage > 1) {
        // First page
        const firstPageItem = document.createElement('li');
        firstPageItem.className = 'page-item';
        const firstPageLink = document.createElement('a');
        firstPageLink.className = 'page-link';
        firstPageLink.href = '#';
        firstPageLink.textContent = '1';
        firstPageLink.onclick = (e) => {
        e.preventDefault();
        currentPage = 1;
        loadItems();
        };
        firstPageItem.appendChild(firstPageLink);
        paginationContainer.appendChild(firstPageItem);
        
        // Add ellipsis if there's a gap
        if (startPage > 2) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        const ellipsisLink = document.createElement('a');
        ellipsisLink.className = 'page-link';
        ellipsisLink.href = '#';
        ellipsisLink.textContent = '...';
        ellipsisItem.appendChild(ellipsisLink);
        paginationContainer.appendChild(ellipsisItem);
        }
    }

    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPageNum ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.onclick = (e) => {
        e.preventDefault();
        currentPage = i;
        loadItems();
        };
        
        pageItem.appendChild(pageLink);
        paginationContainer.appendChild(pageItem);
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
        // Add ellipsis if there's a gap
        if (endPage < totalPages - 1) {
        const ellipsisItem = document.createElement('li');
        ellipsisItem.className = 'page-item disabled';
        const ellipsisLink = document.createElement('a');
        ellipsisLink.className = 'page-link';
        ellipsisLink.href = '#';
        ellipsisLink.textContent = '...';
        ellipsisItem.appendChild(ellipsisLink);
        paginationContainer.appendChild(ellipsisItem);
        }
        
        // Last page
        const lastPageItem = document.createElement('li');
        lastPageItem.className = 'page-item';
        const lastPageLink = document.createElement('a');
        lastPageLink.className = 'page-link';
        lastPageLink.href = '#';
        lastPageLink.textContent = totalPages;
        lastPageLink.onclick = (e) => {
        e.preventDefault();
        currentPage = totalPages;
        loadItems();
        };
        lastPageItem.appendChild(lastPageLink);
        paginationContainer.appendChild(lastPageItem);
    }

    // Next button
    const nextButton = document.createElement('li');
    nextButton.className = `page-item ${currentPageNum >= totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Next';
    nextLink.onclick = (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
        currentPage++;
        loadItems();
        }
    };
    nextButton.appendChild(nextLink);
    paginationContainer.appendChild(nextButton);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Search box enter key
    document.getElementById('searchBox').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
        filterItems();
        }
    });

    document.getElementById('itemImageFile').addEventListener('change', handleFileInputChange);

    // Reset form when modal is hidden
    $('#itemModal').on('hidden.bs.modal', function() {
        const formElements = document.querySelectorAll('#item-form input, #item-form select, #item-form textarea');
        formElements.forEach(element => {
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
        });
        document.querySelector('.modal-footer .btn-primary').style.display = 'inline-block';
        
        // Reset file input and image preview
        document.getElementById('itemImageFile').value = '';
        updateImagePreview('');
    });

    // Initialize page
    loadItems();
});