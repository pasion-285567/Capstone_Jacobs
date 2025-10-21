import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    orderBy,
    query,
    where,
    Timestamp,
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let inventoryItems = [];
let orders = [];
let categories = [];
let tables = [];
let feedbacks = [];
let currentEditingItem = null;
let currentEditingCategory = null;
let currentEditingInventory = null;
let currentEditingTable = null;
let currentQRCode = null;

// ============================================
// CHECK SESSION ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', function () {
    const adminSession = sessionStorage.getItem('adminSession');

    if (adminSession) {
        const sessionData = JSON.parse(adminSession);

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        initializeDashboard();
    }
});

// ============================================
// LOGIN
// ============================================
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    const usersSnapshot = await getDocs(collection(db, 'users'));
    let authenticated = false;
    let adminName = '';

    usersSnapshot.forEach(doc => {
        const user = doc.data();
        if (user.username === email && user.password === password && user.role === 'admin') {
            authenticated = true;
            adminName = user.name || email;
        }
    });

    if (authenticated) {
        const sessionData = {
            email: email,
            name: adminName,
            loginTime: new Date().toISOString(),
            role: 'admin'
        };
        sessionStorage.setItem('adminSession', JSON.stringify(sessionData));

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        await initializeDashboard();
        showNotification(`Welcome ${adminName}!`, 'success');
    } else {
        showError('Invalid email or password!');
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

window.logout = function () {
    sessionStorage.removeItem('adminSession');

    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    showNotification('Logged out successfully!', 'info');
};

// ============================================
// INITIALIZE DASHBOARD
// ============================================
async function initializeDashboard() {
    setupNavigation();
    await initializeCategories();
    await loadAllData();
    setupRealtimeListeners();
    updateOverviewStats();
}

function setupNavigation() {
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);

            document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    switch (sectionId) {
        case 'inventory':
            renderInventory();
            break;
        case 'menu-items':
            renderMenuItems();
            break;
        case 'categories':
            renderCategories();
            break;
        case 'tables':
            renderTables();
            break;
        case 'feedbacks':
            renderFeedbacks();
            break;
        case 'reports':
            updateReportsData();
            break;
    }
}

// ============================================
// INITIALIZE CATEGORIES
// ============================================
async function initializeCategories() {
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    for (const category of defaultCategories) {
        await setDoc(doc(db, 'categories', category.id), {
            name: category.name,
            image: category.image
        });
    }
}


// ============================================
// REALTIME LISTENERS
// ============================================
function setupRealtimeListeners() {
    const inventoryQuery = query(collection(db, 'inventory'), orderBy('name'));
    onSnapshot(inventoryQuery, (snapshot) => {
        inventoryItems = [];
        snapshot.forEach(doc => {
            inventoryItems.push({ id: doc.id, ...doc.data() });
        });
        renderInventory();
        renderMenuItems();
        updateOverviewStats();
    });

    const ordersQuery = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    onSnapshot(ordersQuery, (snapshot) => {
        orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            orders.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
            });
        });
        updateOverviewStats();
    });

    const tablesQuery = query(collection(db, 'tables'), orderBy('tableNumber'));
    onSnapshot(tablesQuery, (snapshot) => {
        tables = [];
        snapshot.forEach(doc => {
            tables.push({ id: doc.id, ...doc.data() });
        });
        renderTables();
    });

    const feedbacksQuery = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
    onSnapshot(feedbacksQuery, (snapshot) => {
        feedbacks = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            feedbacks.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
            });
        });
        renderFeedbacks();
    });
}

// ============================================
// LOAD ALL DATA
// ============================================
async function loadAllData() {
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    categories = [];
    categoriesSnapshot.forEach(doc => {
        categories.push({ id: doc.id, ...doc.data() });
    });

    const inventorySnapshot = await getDocs(collection(db, 'inventory'));
    inventoryItems = [];
    inventorySnapshot.forEach(doc => {
        const itemData = doc.data();
        const category = categories.find(c => c.id === itemData.category);
        inventoryItems.push({
            id: doc.id,
            ...itemData,
            categoryName: category ? category.name : itemData.category
        });
    });

    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    orders = [];
    ordersSnapshot.forEach(doc => {
        const data = doc.data();
        orders.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
        });
    });

    await loadTables();
    await loadFeedbacks();

    renderInventory();
    renderMenuItems();
    renderCategories();
    renderTables();
    renderFeedbacks();
    updateOverviewStats();
}

// ============================================
// OVERVIEW STATS
// ============================================
function updateOverviewStats() {
    const availableItems = inventoryItems.filter(item =>
        item.showInMenu && item.status === 'available' && item.stock > 0
    );
    document.getElementById('totalMenuItems').textContent = availableItems.length;
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'pending').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= today && order.status === 'completed';
    });
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    document.getElementById('todayRevenue').textContent = `₱${todayRevenue.toFixed(2)}`;
}

// ============================================
// RENDER MENU ITEMS
// ============================================
function renderMenuItems() {
    const tbody = document.getElementById('menuTableBody');
    const menuItems = inventoryItems.filter(item => item.showInMenu);

    if (menuItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>🍽️</div>
                    <div>No menu items found</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = menuItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}"
                     alt="${item.name}" class="menu-item-image">
            </td>
            <td><strong>${item.name}</strong></td>
            <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
            <td><strong>₱${parseFloat(item.price).toFixed(2)}</strong></td>
            <td><span class="status-badge status-${item.status || 'available'}">${item.status || 'available'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editMenuItem('${item.id}')">Edit</button>
                    <button class="btn-delete" onclick="removeFromMenu('${item.id}')">Remove</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.editMenuItem = function (itemId) {
    openInventoryModal(itemId);
};

window.removeFromMenu = async function (itemId) {
    if (confirm('Remove this item from the menu?')) {
        await updateDoc(doc(db, 'inventory', itemId), { showInMenu: false });
        showNotification('Item removed from menu!', 'success');
    }
};

// ============================================
// RENDER CATEGORIES
// ============================================
function renderCategories() {
    const container = document.getElementById('categoriesGrid');
    container.innerHTML = '';

    categories.forEach(category => {
        let itemCount;

        if (category.id === 'all-meals') {
            itemCount = inventoryItems.length;
        } else {
            itemCount = inventoryItems.filter(item => {
                const itemCat = (item.category || '').toLowerCase().trim();
                const catId = category.id.toLowerCase().trim();
                const catName = (category.name || '').toLowerCase().trim();
                return itemCat === catId || itemCat === catName;
            }).length;
        }

        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <div class="category-header">
                <div class="category-name">${category.name}</div>
                <div class="category-count">${itemCount} items</div>
            </div>
            <div class="category-actions">
                <button class="btn-edit" onclick="editCategory('${category.id}')"
                    ${category.id === 'all-meals' ? 'disabled' : ''}>Edit</button>
                <button class="btn-view" onclick="filterInventoryByCategory('${category.id}')">View Items</button>
                ${category.id === 'all-meals' ? '' :
                `<button class="btn-delete" onclick="deleteCategory('${category.id}')">Delete</button>`}
            </div>
        `;
        container.appendChild(categoryCard);
    });
}

window.filterInventoryByCategory = function (categoryId) {
    showSection('inventory');
    const tbody = document.getElementById('inventoryTableBody');

    const filteredItems = inventoryItems.filter(item => {
        if (categoryId === 'all-meals') return true;

        const itemCat = (item.category || '').toLowerCase().trim();
        const catId = categoryId.toLowerCase().trim();
        const category = categories.find(c => c.id === categoryId);
        const catName = category ? (category.name || '').toLowerCase().trim() : '';

        return itemCat === catId || itemCat === catName;
    });

    if (filteredItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📦</div>
                    <div>No items found in this category</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filteredItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}"
                     alt="${item.name}" class="menu-item-image">
            </td>
            <td><strong>${item.name}</strong></td>
            <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
            <td>
                <input type="number" value="${item.stock || 0}" 
                       onchange="updateStock('${item.id}', this.value)"
                       style="width: 70px; padding: 5px; border: 2px solid #ddd; border-radius: 5px;">
            </td>
            <td><strong>₱${parseFloat(item.price).toFixed(2)}</strong></td>
            <td>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" ${item.showInMenu ? 'checked' : ''} 
                           onchange="toggleShowInMenu('${item.id}', this.checked)">
                    <span style="font-size: 0.9rem;">${item.showInMenu ? 'Visible' : 'Hidden'}</span>
                </label>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editInventoryItem('${item.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteInventoryItem('${item.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
};

// ============================================
// CATEGORY MODAL - UPDATED
// ============================================
window.openCategoryModal = function (categoryId = null) {
    currentEditingCategory = categoryId;
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');

    if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            title.textContent = 'Edit Category';
            document.getElementById('categoryName').value = category.name;
        }
    } else {
        title.textContent = 'Add New Category';
        document.getElementById('categoryForm').reset();
    }

    modal.classList.add('active');
};

window.closeCategoryModal = function () {
    document.getElementById('categoryModal').classList.remove('active');
    document.getElementById('categoryForm').reset();
    currentEditingCategory = null;
};

document.getElementById('categoryForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const categoryName = document.getElementById('categoryName').value.trim();

    const categoryId = categoryName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .trim();

    const categoryData = {
        name: categoryName,
        image: `images/categories/${categoryId}.webp`
    };

    if (currentEditingCategory) {
        await updateDoc(doc(db, 'categories', currentEditingCategory), categoryData);
        showNotification('Category updated!', 'success');
    } else {
        const existingCat = categories.find(c => c.id === categoryId);
        if (existingCat) {
            showNotification('Category with similar name already exists!', 'error');
            return;
        }

        await setDoc(doc(db, 'categories', categoryId), categoryData);
        showNotification('Category added!', 'success');
    }

    await loadAllData();
    closeCategoryModal();
});

window.editCategory = function (categoryId) {
    openCategoryModal(categoryId);
};

window.deleteCategory = async function (categoryId) {
    if (categoryId === 'all-meals') {
        showNotification('Cannot delete the All Meals category', 'error');
        return;
    }

    if (confirm('Delete this category? Items will need to be reassigned.')) {
        const itemsInCategory = inventoryItems.filter(item =>
            item.category === categoryId ||
            item.category === categories.find(c => c.id === categoryId)?.name
        );

        if (itemsInCategory.length > 0) {
            const proceed = confirm(`${itemsInCategory.length} items will need reassignment. Continue?`);
            if (!proceed) return;
        }

        await deleteDoc(doc(db, 'categories', categoryId));
        showNotification('Category deleted!', 'success');
        await loadAllData();
    }
};

// ============================================
// RENDER INVENTORY
// ============================================
async function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');

    if (inventoryItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📦</div>
                    <div>No inventory items found</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = inventoryItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}"
                     alt="${item.name}" class="menu-item-image">
            </td>
            <td><strong>${item.name}</strong></td>
            <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
            <td>
                <input type="number" value="${item.stock || 0}" 
                       onchange="updateStock('${item.id}', this.value)"
                       style="width: 70px; padding: 5px; border: 2px solid #ddd; border-radius: 5px;">
            </td>
            <td><strong>₱${parseFloat(item.price).toFixed(2)}</strong></td>
            <td>
                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                    <input type="checkbox" ${item.showInMenu ? 'checked' : ''} 
                           onchange="toggleShowInMenu('${item.id}', this.checked)">
                    <span style="font-size: 0.9rem;">${item.showInMenu ? 'Visible' : 'Hidden'}</span>
                </label>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editInventoryItem('${item.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteInventoryItem('${item.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.updateStock = async function (itemId, newStock) {
    const stock = parseInt(newStock);
    if (isNaN(stock) || stock < 0) {
        showNotification('Invalid stock value', 'error');
        await renderInventory();
        return;
    }

    await updateDoc(doc(db, 'inventory', itemId), {
        stock: stock,
        status: stock > 0 ? 'available' : 'unavailable'
    });
    showNotification('Stock updated!', 'success');
};

window.toggleShowInMenu = async function (itemId, show) {
    await updateDoc(doc(db, 'inventory', itemId), { showInMenu: show });
    showNotification(show ? 'Added to menu!' : 'Removed from menu!', 'success');
};

// ============================================
// INVENTORY MODAL
// ============================================
window.openInventoryModal = async function (itemId = null) {
    currentEditingInventory = itemId;
    const modal = document.getElementById('inventoryModal');
    const title = document.getElementById('inventoryModalTitle');
    const preview = document.getElementById('inventoryImagePreview');
    const fileInput = document.getElementById('inventoryImageFile');

    fileInput.value = '';
    preview.src = '';
    preview.style.display = 'none';

    if (itemId) {
        const docSnap = await getDoc(doc(db, 'inventory', itemId));
        if (docSnap.exists()) {
            const item = docSnap.data();
            title.textContent = 'Edit Inventory Item';
            document.getElementById('inventoryName').value = item.name;
            document.getElementById('inventoryCategory').value = item.category;
            document.getElementById('inventoryPrice').value = item.price;
            document.getElementById('inventoryStock').value = item.stock || 0;
            document.getElementById('inventoryShowInMenu').checked = item.showInMenu || false;

            if (item.image) {
                preview.src = item.image;
                preview.style.display = 'block';
            }
            fileInput.removeAttribute('required');
        }
    } else {
        title.textContent = 'Add Inventory Item';
        document.getElementById('inventoryForm').reset();
        fileInput.setAttribute('required', 'required');
    }

    modal.classList.add('active');
};

window.closeInventoryModal = function () {
    document.getElementById('inventoryModal').classList.remove('active');
    document.getElementById('inventoryForm').reset();
    currentEditingInventory = null;
};

document.getElementById('inventoryImageFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('inventoryImagePreview');

    if (file) {
        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image', 'error');
            this.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (evt) {
            preview.src = evt.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.getElementById('inventoryForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const itemName = document.getElementById('inventoryName').value.trim();
    const itemCategory = document.getElementById('inventoryCategory').value;
    const itemPrice = parseFloat(document.getElementById('inventoryPrice').value);
    const itemStock = parseInt(document.getElementById('inventoryStock').value);
    const showInMenu = document.getElementById('inventoryShowInMenu').checked;
    const imageFile = document.getElementById('inventoryImageFile').files[0];

    if (!itemName || !itemCategory || isNaN(itemPrice) || isNaN(itemStock)) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await convertImageToBase64(imageFile);
    } else if (currentEditingInventory) {
        const docSnap = await getDoc(doc(db, 'inventory', currentEditingInventory));
        if (docSnap.exists()) imageBase64 = docSnap.data().image;
    }

    const itemData = {
        name: itemName,
        category: itemCategory,
        price: itemPrice,
        stock: itemStock,
        image: imageBase64,
        status: itemStock > 0 ? 'available' : 'unavailable',
        showInMenu: showInMenu,
        updatedAt: Timestamp.now()
    };

    if (!currentEditingInventory) itemData.createdAt = Timestamp.now();

    if (currentEditingInventory) {
        await updateDoc(doc(db, 'inventory', currentEditingInventory), itemData);
        showNotification('Item updated!', 'success');
    } else {
        await addDoc(collection(db, 'inventory'), itemData);
        showNotification('Item added!', 'success');
    }

    closeInventoryModal();
    await renderInventory();
});

window.editInventoryItem = function (itemId) {
    openInventoryModal(itemId);
};

window.deleteInventoryItem = async function (itemId) {
    if (confirm('Delete this inventory item?')) {
        await deleteDoc(doc(db, 'inventory', itemId));
        showNotification('Item deleted!', 'success');
        await renderInventory();
    }
};

// ============================================
// TABLES MANAGEMENT
// ============================================
async function loadTables() {
    const tablesSnapshot = await getDocs(collection(db, 'tables'));
    tables = [];
    tablesSnapshot.forEach(doc => {
        tables.push({ id: doc.id, ...doc.data() });
    });
    tables.sort((a, b) => a.tableNumber - b.tableNumber);
}

function renderTables() {
    const container = document.getElementById('tablesGrid');

    if (tables.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🪑</div>
                <div class="empty-message">No tables found</div>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    tables.forEach(table => {
        const tableCard = document.createElement('div');
        tableCard.className = `table-card ${table.status}`;
        tableCard.innerHTML = `
            <div class="table-number">Table ${table.tableNumber}</div>
            <div class="table-info">
                Status: <span class="status-badge status-${table.status}">${table.status}</span>
            </div>
            <div class="table-actions">
                <button class="btn-qr" onclick="showQRCode(${table.tableNumber})">📱 QR Code</button>
                <button class="btn-edit" onclick="editTable('${table.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteTable('${table.id}')">Delete</button>
            </div>
        `;
        container.appendChild(tableCard);
    });
}

window.openTableModal = function (tableId = null) {
    currentEditingTable = tableId;
    const modal = document.getElementById('tableModal');
    const title = document.getElementById('tableModalTitle');

    if (tableId) {
        const table = tables.find(t => t.id === tableId);
        if (table) {
            title.textContent = 'Edit Table';
            document.getElementById('tableNumber').value = table.tableNumber;
            document.getElementById('tableStatus').value = table.status;
            document.getElementById('tableNumber').disabled = true;
        }
    } else {
        title.textContent = 'Add New Table';
        document.getElementById('tableForm').reset();
        document.getElementById('tableNumber').disabled = false;
    }

    modal.classList.add('active');
};

window.closeTableModal = function () {
    document.getElementById('tableModal').classList.remove('active');
    document.getElementById('tableForm').reset();
    currentEditingTable = null;
};

document.getElementById('tableForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const tableNumber = parseInt(document.getElementById('tableNumber').value);
    const tableStatus = document.getElementById('tableStatus').value;

    const tableData = {
        tableNumber: tableNumber,
        status: tableStatus,
        qrUrl: `${window.location.origin}/?table=${tableNumber}`,
        updatedAt: Timestamp.now()
    };

    if (!currentEditingTable) {
        const existing = tables.find(t => t.tableNumber === tableNumber);
        if (existing) {
            showNotification('Table number already exists!', 'error');
            return;
        }
        tableData.createdAt = Timestamp.now();
    }

    if (currentEditingTable) {
        await updateDoc(doc(db, 'tables', currentEditingTable), tableData);
        showNotification('Table updated!', 'success');
    } else {
        await addDoc(collection(db, 'tables'), tableData);
        showNotification('Table added!', 'success');
    }

    await loadTables();
    renderTables();
    closeTableModal();
});

window.editTable = function (tableId) {
    openTableModal(tableId);
};

window.deleteTable = async function (tableId) {
    if (confirm('Delete this table?')) {
        await deleteDoc(doc(db, 'tables', tableId));
        showNotification('Table deleted!', 'success');
        await loadTables();
        renderTables();
    }
};

// ============================================
// QR CODE GENERATION
// ============================================
window.showQRCode = function (tableNumber) {
    const modal = document.getElementById('qrModal');
    const title = document.getElementById('qrModalTitle');
    const container = document.getElementById('qrCodeContainer');
    const urlDisplay = document.getElementById('qrUrl');

    const qrUrl = `${window.location.origin}/?table=${tableNumber}`;

    title.textContent = `Table ${tableNumber} QR Code`;
    urlDisplay.textContent = qrUrl;
    container.innerHTML = '';

    currentQRCode = new QRCode(container, {
        text: qrUrl,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    modal.classList.add('active');
};

window.closeQRModal = function () {
    document.getElementById('qrModal').classList.remove('active');
    currentQRCode = null;
};

window.downloadQRCode = function () {
    const canvas = document.querySelector('#qrCodeContainer canvas');
    if (canvas) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const tableNum = document.getElementById('qrModalTitle').textContent.match(/\d+/)[0];
        link.download = `table-${tableNum}-qr.png`;
        link.href = url;
        link.click();
        showNotification('QR Code downloaded!', 'success');
    }
};

// ============================================
// CUSTOMER FEEDBACKS
// ============================================
async function loadFeedbacks() {
    const feedbacksQuery = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(feedbacksQuery);
    feedbacks = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        feedbacks.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
        });
    });
}

function renderFeedbacks() {
    const container = document.getElementById('feedbacksContainer');

    if (feedbacks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⭐</div>
                <div class="empty-message">No feedback yet</div>
            </div>
        `;
        document.getElementById('totalFeedbacks').textContent = '0';
        document.getElementById('avgRating').textContent = '0.0';
        return;
    }

    const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
    const avgRating = (totalRating / feedbacks.length).toFixed(1);

    document.getElementById('totalFeedbacks').textContent = feedbacks.length;
    document.getElementById('avgRating').textContent = avgRating;

    container.innerHTML = feedbacks.map(feedback => {
        const stars = '⭐'.repeat(feedback.rating);
        const date = feedback.timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="feedback-card">
                <div class="feedback-header">
                    <div class="feedback-table">Table ${feedback.tableNumber}</div>
                    <div class="feedback-rating">${stars}</div>
                </div>
                <div class="feedback-date">${date}</div>
                <div class="feedback-comment ${!feedback.comment ? 'no-comment' : ''}">
                    ${feedback.comment || 'No comment provided'}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// REPORTS
// ============================================
function updateReportsData() {
    const today = new Date();
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const completedOrders = orders.filter(order => order.status === 'completed');

    const weeklySales = completedOrders
        .filter(order => new Date(order.timestamp) >= weekStart)
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const monthlySales = completedOrders
        .filter(order => new Date(order.timestamp) >= monthStart)
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const itemCounts = {};
    completedOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
            });
        }
    });

    const popularItem = Object.keys(itemCounts).length > 0
        ? Object.keys(itemCounts).reduce((a, b) => itemCounts[a] > itemCounts[b] ? a : b)
        : 'No data';

    document.getElementById('weeklySales').textContent = `₱${weeklySales.toFixed(2)}`;
    document.getElementById('monthlySales').textContent = `₱${monthlySales.toFixed(2)}`;
    document.getElementById('popularItem').textContent = popularItem.length > 15 ? popularItem.substring(0, 15) + '...' : popularItem;
}

// ============================================
// NOTIFICATION
// ============================================
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

window.showNotification = showNotification;

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const adminSession = sessionStorage.getItem('adminSession');
    if (!adminSession) {
        await loadAllData();
    }
});