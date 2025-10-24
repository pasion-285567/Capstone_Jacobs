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
let archivedItems = [];
let dailySalesChart, weeklySalesChart, monthlySalesChart;
let adminNotifications = [];

// Cafe-related variables
let cafeCategories = [];
let cafeInventoryItems = [];
let archivedCafeItems = [];
let currentEditingCafeCategory = null;
let currentEditingCafeInventory = null;
// Sorting state
let currentSort = {
    inventory: { column: null, ascending: true },
    cafeInventory: { column: null, ascending: true },
    menu: { column: null, ascending: true },
    cafeMenu: { column: null, ascending: true }
};

// ============================================
// CHECK SESSION ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', function () {
    const adminSession = sessionStorage.getItem('adminSession');

    if (!adminSession) {
        // No session, redirect to login
        window.location.href = 'login.html';
        return;
    }

    // Valid admin session, show dashboard
    document.getElementById('dashboard').classList.add('active');
    initializeDashboard();
});

window.logout = function () {
    sessionStorage.removeItem('adminSession');
    window.location.href = 'login.html';
};

// ============================================
// INITIALIZE DASHBOARD
// ============================================
async function initializeDashboard() {
    setupNavigation();
    await initializeCategories();
    await loadAllData();
    await loadAdminNotifications();
    setupRealtimeListeners();
    updateOverviewStats();

    // Initialize date inputs
    if (document.getElementById('salesDate')) {
        document.getElementById('salesDate').valueAsDate = new Date();
    }
    if (document.getElementById('transactionDate')) {
        document.getElementById('transactionDate').valueAsDate = new Date();
    }

    // Setup analytics range change listener
    const analyticsRange = document.getElementById('analyticsRange');
    if (analyticsRange) {
        analyticsRange.addEventListener('change', function () {
            const customRange = document.getElementById('customDateRange');
            if (this.value === 'custom') {
                customRange.style.display = 'flex';
                const today = new Date();
                document.getElementById('endDate').valueAsDate = today;
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                document.getElementById('startDate').valueAsDate = weekAgo;
            } else {
                customRange.style.display = 'none';
                updateAnalytics();
            }
        });
    }
}

// ============================================
// INVENTORY TYPE SWITCHING (Meals vs Cafe)
// ============================================
window.switchInventoryType = function (type) {
    document.getElementById('inventoryTypeMeals').classList.toggle('active', type === 'meals');
    document.getElementById('inventoryTypeCafe').classList.toggle('active', type === 'cafe');

    document.getElementById('mealsInventorySection').classList.toggle('active', type === 'meals');
    document.getElementById('cafeInventorySection').classList.toggle('active', type === 'cafe');

    if (type === 'meals') {
        renderInventory();
    } else {
        renderCafeInventory();
    }
};

// ============================================
// APPLY CURRENT SORT
// ============================================
function applySortIfNeeded(items, sortType) {
    const sort = currentSort[sortType];

    if (!sort.column) return items;

    return [...items].sort((a, b) => {
        let valA, valB;

        switch (sort.column) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category).toLowerCase();
                valB = (b.categoryName || b.category).toLowerCase();
                break;
            case 'stock':
                valA = a.stock || 0;
                valB = b.stock || 0;
                break;
            case 'price':
                valA = parseFloat(a.price) || 0;
                valB = parseFloat(b.price) || 0;
                break;
            case 'menu':
                valA = a.showInMenu ? 1 : 0;
                valB = b.showInMenu ? 1 : 0;
                break;
            case 'status':
                valA = (a.status || 'available').toLowerCase();
                valB = (b.status || 'available').toLowerCase();
                break;
        }

        if (valA < valB) return sort.ascending ? -1 : 1;
        if (valA > valB) return sort.ascending ? 1 : -1;
        return 0;
    });
}

// ============================================
// SORTING FUNCTIONS
// ============================================
window.sortInventory = function (column) {
    const sort = currentSort.inventory;

    if (sort.column === column) {
        sort.ascending = !sort.ascending;
    } else {
        sort.column = column;
        sort.ascending = true;
    }

    inventoryItems.sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category).toLowerCase();
                valB = (b.categoryName || b.category).toLowerCase();
                break;
            case 'stock':
                valA = a.stock || 0;
                valB = b.stock || 0;
                break;
            case 'price':
                valA = parseFloat(a.price) || 0;
                valB = parseFloat(b.price) || 0;
                break;
            case 'menu':
                valA = a.showInMenu ? 1 : 0;
                valB = b.showInMenu ? 1 : 0;
                break;
        }

        if (valA < valB) return sort.ascending ? -1 : 1;
        if (valA > valB) return sort.ascending ? 1 : -1;
        return 0;
    });

    renderInventory();
    updateSortIndicators('inventory', column, sort.ascending);
};

window.sortCafeInventory = function (column) {
    const sort = currentSort.cafeInventory;

    if (sort.column === column) {
        sort.ascending = !sort.ascending;
    } else {
        sort.column = column;
        sort.ascending = true;
    }

    cafeInventoryItems.sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category).toLowerCase();
                valB = (b.categoryName || b.category).toLowerCase();
                break;
            case 'stock':
                valA = a.stock || 0;
                valB = b.stock || 0;
                break;
            case 'menu':
                valA = a.showInMenu ? 1 : 0;
                valB = b.showInMenu ? 1 : 0;
                break;
        }

        if (valA < valB) return sort.ascending ? -1 : 1;
        if (valA > valB) return sort.ascending ? 1 : -1;
        return 0;
    });

    renderCafeInventory();
    updateSortIndicators('cafeInventory', column, sort.ascending);
};

window.sortMenu = function (column) {
    const sort = currentSort.menu;

    if (sort.column === column) {
        sort.ascending = !sort.ascending;
    } else {
        sort.column = column;
        sort.ascending = true;
    }

    inventoryItems.sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category).toLowerCase();
                valB = (b.categoryName || b.category).toLowerCase();
                break;
            case 'price':
                valA = parseFloat(a.price) || 0;
                valB = parseFloat(b.price) || 0;
                break;
            case 'status':
                valA = (a.status || 'available').toLowerCase();
                valB = (b.status || 'available').toLowerCase();
                break;
        }

        if (valA < valB) return sort.ascending ? -1 : 1;
        if (valA > valB) return sort.ascending ? 1 : -1;
        return 0;
    });

    renderMenuItems();
    updateSortIndicators('menu', column, sort.ascending);
};

window.sortCafeMenu = function (column) {
    const sort = currentSort.cafeMenu;

    if (sort.column === column) {
        sort.ascending = !sort.ascending;
    } else {
        sort.column = column;
        sort.ascending = true;
    }

    cafeInventoryItems.sort((a, b) => {
        let valA, valB;

        switch (column) {
            case 'name':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category).toLowerCase();
                valB = (b.categoryName || b.category).toLowerCase();
                break;
            case 'status':
                valA = (a.status || 'available').toLowerCase();
                valB = (b.status || 'available').toLowerCase();
                break;
        }

        if (valA < valB) return sort.ascending ? -1 : 1;
        if (valA > valB) return sort.ascending ? 1 : -1;
        return 0;
    });

    renderCafeMenuItems();
    updateSortIndicators('cafeMenu', column, sort.ascending);
};

function updateSortIndicators(table, column, ascending) {
    // Remove all existing sort indicators
    document.querySelectorAll('.sort-indicator').forEach(el => el.remove());

    // Find the correct table and add indicator
    let tableId;
    switch (table) {
        case 'inventory':
            tableId = 'inventoryTableBody';
            break;
        case 'cafeInventory':
            tableId = 'cafeInventoryTableBody';
            break;
        case 'menu':
            tableId = 'menuTableBody';
            break;
        case 'cafeMenu':
            tableId = 'cafeMenuTableBody';
            break;
    }

    const tbody = document.getElementById(tableId);
    if (!tbody) return;

    const thead = tbody.parentElement.querySelector('thead');
    if (!thead) return;

    const ths = thead.querySelectorAll('th');
    ths.forEach(th => {
        if (th.onclick && th.onclick.toString().includes(column)) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent = ascending ? ' ▲' : ' ▼';
            indicator.style.fontSize = '0.8em';
            indicator.style.marginLeft = '5px';
            th.appendChild(indicator);
        }
    });
}

// ============================================
// MENU TYPE SWITCHING (Meals vs Cafe)
// ============================================
window.switchMenuType = function (type) {
    document.getElementById('menuTypeMeals').classList.toggle('active', type === 'meals');
    document.getElementById('menuTypeCafe').classList.toggle('active', type === 'cafe');

    document.getElementById('mealsMenuSection').classList.toggle('active', type === 'meals');
    document.getElementById('cafeMenuSection').classList.toggle('active', type === 'cafe');

    if (type === 'meals') {
        renderMenuItems();
    } else {
        renderCafeMenuItems();
    }
};

// ============================================
// CATEGORY TYPE SWITCHING (Meals vs Cafe)
// ============================================
window.switchCategoryType = function (type) {
    document.getElementById('categoryTypeMeals').classList.toggle('active', type === 'meals');
    document.getElementById('categoryTypeCafe').classList.toggle('active', type === 'cafe');

    document.getElementById('mealsCategoriesSection').classList.toggle('active', type === 'meals');
    document.getElementById('cafeCategoriesSection').classList.toggle('active', type === 'cafe');

    if (type === 'meals') {
        renderCategories();
    } else {
        renderCafeCategories();
    }
};

// ============================================
// RENDER CAFE MENU ITEMS (NEW FUNCTION)
// ============================================
function renderCafeMenuItems() {
    const tbody = document.getElementById('cafeMenuTableBody');
    const cafeMenuItems = cafeInventoryItems.filter(item => item.showInMenu);

    if (cafeMenuItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>☕</div>
                    <div>No cafe menu items found</div>
                </td>
            </tr>`;
        return;
    }

    // Apply current sort if any
    const sortedItems = applySortIfNeeded(cafeMenuItems, 'cafeMenu');

    tbody.innerHTML = sortedItems.map(item => {
        let pricesDisplay = '';
        if (item.sizes && Object.keys(item.sizes).length > 0) {
            pricesDisplay = Object.entries(item.sizes)
                .map(([size, price]) => `<div style="font-size: 0.85rem;">${size}: ₱${parseFloat(price).toFixed(2)}</div>`)
                .join('');
        } else {
            pricesDisplay = `<strong>₱${parseFloat(item.price).toFixed(2)}</strong>`;
        }

        return `
            <tr>
                <td>
                    <img src="${item.image || 'logo2.png'}"
                         alt="${item.name}" class="menu-item-image">
                </td>
                <td><strong>${item.name}</strong></td>
                <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
                <td>${pricesDisplay}</td>
                <td><span class="status-badge status-${item.status || 'available'}">${item.status || 'available'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editCafeMenuItem('${item.id}')">Edit</button>
                        <button class="btn-delete" onclick="removeFromCafeMenu('${item.id}')">Remove</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Update sort indicators if there's an active sort
    if (currentSort.cafeMenu.column) {
        updateSortIndicators('cafeMenu', currentSort.cafeMenu.column, currentSort.cafeMenu.ascending);
    }
}

window.editCafeMenuItem = function (itemId) {
    openCafeInventoryModal(itemId);
};

window.removeFromCafeMenu = async function (itemId) {
    if (confirm('Remove this item from the cafe menu?')) {
        await updateDoc(doc(db, 'cafe_inventory', itemId), { showInMenu: false });
        showNotification('Item removed from cafe menu!', 'success');
    }
};

// ============================================
// INVENTORY TABS & ARCHIVES
// ============================================
window.switchInventoryTab = function (tab) {
    // Get all tab buttons within the meals inventory section
    const mealsSection = document.getElementById('mealsInventorySection');
    const tabBtns = mealsSection.querySelectorAll('.tab-btn');
    const tabContents = mealsSection.querySelectorAll('.tab-content');

    // Remove active class from all
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    if (tab === 'active') {
        tabBtns[0].classList.add('active');
        document.getElementById('activeInventoryTab').classList.add('active');
        renderInventory();
    } else {
        tabBtns[1].classList.add('active');
        document.getElementById('archivedInventoryTab').classList.add('active');
        renderArchivedInventory();
    }
};

async function loadArchivedItems() {
    const archivedSnapshot = await getDocs(collection(db, 'archived_inventory'));
    archivedItems = [];
    archivedSnapshot.forEach(doc => {
        const data = doc.data();
        archivedItems.push({
            id: doc.id,
            ...data,
            archivedAt: data.archivedAt?.toDate ? data.archivedAt.toDate() : new Date()
        });
    });
}

function renderArchivedInventory() {
    const tbody = document.getElementById('archivedTableBody');

    if (archivedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📦</div>
                    <div>No archived items</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = archivedItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'logo2.png'}"
                     alt="${item.name}" class="menu-item-image">
            </td>
            <td><strong>${item.name}</strong></td>
            <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
            <td>${item.stock || 0}</td>
            <td><strong>₱${parseFloat(item.price).toFixed(2)}</strong></td>
            <td>${item.archivedAt.toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="restoreInventoryItem('${item.id}')">Restore</button>
                    <button class="btn-delete" onclick="permanentDeleteItem('${item.id}')">Delete Permanently</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.restoreInventoryItem = async function (itemId) {
    if (confirm('Restore this item to inventory?')) {
        const itemDoc = await getDoc(doc(db, 'archived_inventory', itemId));
        if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            delete itemData.archivedAt;
            await addDoc(collection(db, 'inventory'), itemData);
            await deleteDoc(doc(db, 'archived_inventory', itemId));
            showNotification('Item restored successfully!', 'success');
            await loadArchivedItems();
            renderArchivedInventory();
        }
    }
};

window.permanentDeleteItem = async function (itemId) {
    if (confirm('Permanently delete this item? This action cannot be undone!')) {
        await deleteDoc(doc(db, 'archived_inventory', itemId));
        showNotification('Item permanently deleted!', 'success');
        await loadArchivedItems();
        renderArchivedInventory();
    }
};

// ============================================
// CAFE CATEGORIES MANAGEMENT
// ============================================
async function loadCafeCategories() {
    const snapshot = await getDocs(collection(db, 'cafe_categories'));
    cafeCategories = [];
    snapshot.forEach(doc => {
        cafeCategories.push({ id: doc.id, ...doc.data() });
    });

    // Update category dropdown in cafe inventory modal
    const categorySelect = document.getElementById('cafeItemCategory');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Select category</option>' +
            cafeCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }
}

function renderCafeCategories() {
    const container = document.getElementById('cafeCategoriesGrid');

    if (cafeCategories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">☕</div>
                <div class="empty-message">No cafe categories found</div>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    cafeCategories.forEach(category => {
        const itemCount = cafeInventoryItems.filter(item => item.category === category.id).length;
        const hasSizes = category.sizes && category.sizes.length > 0;

        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <div class="category-header">
                <div class="category-name">${category.name}</div>
                <div class="category-count">${itemCount} items</div>
            </div>
            <div style="margin: 10px 0; color: #666; font-size: 0.85rem;">
                ${hasSizes ? `<strong>Sizes:</strong> ${category.sizes.join(', ')}` : '<em>No sizes</em>'}
            </div>
            <div class="category-actions">
                <button class="btn-edit" onclick="editCafeCategory('${category.id}')">Edit</button>
                <button class="btn-view" onclick="filterCafeInventoryByCategory('${category.id}')">View Items</button>
                <button class="btn-delete" onclick="deleteCafeCategory('${category.id}')">Delete</button>
            </div>
        `;
        container.appendChild(categoryCard);
    });
}

window.openCafeCategoryModal = function (categoryId = null) {
    currentEditingCafeCategory = categoryId;
    const modal = document.getElementById('cafeCategoryModal');
    const title = document.getElementById('cafeCategoryModalTitle');
    const sizesContainer = document.getElementById('sizesContainer');

    // Reset
    document.getElementById('cafeCategoryForm').reset();
    sizesContainer.innerHTML = `
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 10px;">
            Add sizes if this category needs different sizes (e.g., Small, Medium, Large)
        </p>
    `;

    if (categoryId) {
        const category = cafeCategories.find(c => c.id === categoryId);
        if (category) {
            title.textContent = 'Edit Cafe Category';
            document.getElementById('cafeCategoryName').value = category.name;

            if (category.sizes && category.sizes.length > 0) {
                category.sizes.forEach(size => {
                    addSizeField(size);
                });
            }
        }
    } else {
        title.textContent = 'Add Cafe Category';
    }

    modal.classList.add('active');
};

window.closeCafeCategoryModal = function () {
    document.getElementById('cafeCategoryModal').classList.remove('active');
    currentEditingCafeCategory = null;
};

window.addSizeField = function (value = '') {
    const sizesContainer = document.getElementById('sizesContainer');
    const sizeId = 'size_' + Date.now();

    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'size-field';
    sizeDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    sizeDiv.innerHTML = `
        <input type="text" class="size-input" placeholder="e.g., Small, Medium, Large" 
               value="${value}" style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 8px;">
        <button type="button" onclick="this.parentElement.remove()" 
                style="background: #dc3545; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer;">
            Remove
        </button>
    `;
    sizesContainer.appendChild(sizeDiv);
};

document.getElementById('cafeCategoryForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const categoryName = document.getElementById('cafeCategoryName').value.trim();
    const sizeInputs = document.querySelectorAll('.size-input');
    const sizes = Array.from(sizeInputs)
        .map(input => input.value.trim())
        .filter(size => size !== '');

    const categoryId = categoryName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .trim();

    const categoryData = {
        name: categoryName,
        sizes: sizes,
        image: `images/cafe/${categoryId}.webp`
    };

    if (currentEditingCafeCategory) {
        await updateDoc(doc(db, 'cafe_categories', currentEditingCafeCategory), categoryData);
        showNotification('Cafe category updated!', 'success');
    } else {
        const existingCat = cafeCategories.find(c => c.id === categoryId);
        if (existingCat) {
            showNotification('Category with similar name already exists!', 'error');
            return;
        }

        await setDoc(doc(db, 'cafe_categories', categoryId), categoryData);
        showNotification('Cafe category added!', 'success');
    }

    await loadCafeCategories();
    renderCafeCategories();
    closeCafeCategoryModal();
});

window.editCafeCategory = function (categoryId) {
    openCafeCategoryModal(categoryId);
};

window.deleteCafeCategory = async function (categoryId) {
    const itemsInCategory = cafeInventoryItems.filter(item => item.category === categoryId);

    if (itemsInCategory.length > 0) {
        const proceed = confirm(`${itemsInCategory.length} items will need reassignment. Continue?`);
        if (!proceed) return;
    }

    if (confirm('Delete this cafe category?')) {
        await deleteDoc(doc(db, 'cafe_categories', categoryId));
        showNotification('Cafe category deleted!', 'success');
        await loadCafeCategories();
        renderCafeCategories();
    }
};

// ============================================
// CAFE INVENTORY MANAGEMENT
// ============================================
async function loadCafeInventory() {
    const snapshot = await getDocs(collection(db, 'cafe_inventory'));
    cafeInventoryItems = [];
    snapshot.forEach(doc => {
        const itemData = doc.data();
        const category = cafeCategories.find(c => c.id === itemData.category);
        cafeInventoryItems.push({
            id: doc.id,
            ...itemData,
            categoryName: category ? category.name : itemData.category
        });
    });
}

async function loadArchivedCafeItems() {
    const snapshot = await getDocs(collection(db, 'archived_cafe_inventory'));
    archivedCafeItems = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        archivedCafeItems.push({
            id: doc.id,
            ...data,
            archivedAt: data.archivedAt?.toDate ? data.archivedAt.toDate() : new Date()
        });
    });
}

window.switchCafeInventoryTab = function (tab) {
    // Get all tab buttons within the cafe inventory section
    const cafeSection = document.getElementById('cafeInventorySection');
    const tabBtns = cafeSection.querySelectorAll('.tab-btn');
    const tabContents = cafeSection.querySelectorAll('.tab-content');

    // Remove active class from all
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    if (tab === 'active') {
        tabBtns[0].classList.add('active');
        document.getElementById('activeCafeInventoryTab').classList.add('active');
        renderCafeInventory();
    } else {
        tabBtns[1].classList.add('active');
        document.getElementById('archivedCafeInventoryTab').classList.add('active');
        renderArchivedCafeInventory();
    }
};

function renderCafeInventory() {
    const tbody = document.getElementById('cafeInventoryTableBody');

    if (cafeInventoryItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>☕</div>
                    <div>No cafe items found</div>
                </td>
            </tr>`;
        return;
    }

    // Apply current sort if any
    const sortedItems = applySortIfNeeded(cafeInventoryItems, 'cafeInventory');

    tbody.innerHTML = sortedItems.map(item => {
        let pricesDisplay = '';
        if (item.sizes && Object.keys(item.sizes).length > 0) {
            pricesDisplay = Object.entries(item.sizes)
                .map(([size, price]) => `<div style="font-size: 0.85rem;">${size}: ₱${parseFloat(price).toFixed(2)}</div>`)
                .join('');
        } else {
            pricesDisplay = `<strong>₱${parseFloat(item.price).toFixed(2)}</strong>`;
        }

        return `
            <tr>
                <td>
                    <img src="${item.image || 'logo2.png'}"
                         alt="${item.name}" class="menu-item-image">
                </td>
                <td><strong>${item.name}</strong></td>
                <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
                <td>
                    <input type="number" value="${item.stock || 0}" 
                           onchange="updateCafeStock('${item.id}', this.value)"
                           style="width: 70px; padding: 5px; border: 2px solid #ddd; border-radius: 5px;">
                </td>
                <td>${pricesDisplay}</td>
                <td>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                        <input type="checkbox" ${item.showInMenu ? 'checked' : ''} 
                               onchange="toggleCafeShowInMenu('${item.id}', this.checked)">
                        <span style="font-size: 0.9rem;">${item.showInMenu ? 'Visible' : 'Hidden'}</span>
                    </label>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editCafeInventoryItem('${item.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteCafeInventoryItem('${item.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Update sort indicators
    if (currentSort.cafeInventory.column) {
        updateSortIndicators('cafeInventory', currentSort.cafeInventory.column, currentSort.cafeInventory.ascending);
    }
}

function renderArchivedCafeInventory() {
    const tbody = document.getElementById('archivedCafeTableBody');

    if (archivedCafeItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>📦</div>
                    <div>No archived cafe items</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = archivedCafeItems.map(item => {
        let pricesDisplay = '';
        if (item.sizes && Object.keys(item.sizes).length > 0) {
            pricesDisplay = Object.entries(item.sizes)
                .map(([size, price]) => `<div style="font-size: 0.85rem;">${size}: ₱${parseFloat(price).toFixed(2)}</div>`)
                .join('');
        } else {
            pricesDisplay = `<strong>₱${parseFloat(item.price).toFixed(2)}</strong>`;
        }

        return `
            <tr>
                <td>
                    <img src="${item.image || 'logo2.png'}"
                         alt="${item.name}" class="menu-item-image">
                </td>
                <td><strong>${item.name}</strong></td>
                <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
                <td>${item.stock || 0}</td>
                <td>${pricesDisplay}</td>
                <td>${item.archivedAt.toLocaleDateString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="restoreCafeInventoryItem('${item.id}')">Restore</button>
                        <button class="btn-delete" onclick="permanentDeleteCafeItem('${item.id}')">Delete Permanently</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.updateCafeStock = async function (itemId, newStock) {
    const stock = parseInt(newStock);
    if (isNaN(stock) || stock < 0) {
        showNotification('Invalid stock value', 'error');
        await renderCafeInventory();
        return;
    }

    await updateDoc(doc(db, 'cafe_inventory', itemId), {
        stock: stock,
        status: stock > 0 ? 'available' : 'unavailable'
    });
    showNotification('Stock updated!', 'success');
};

window.toggleCafeShowInMenu = async function (itemId, show) {
    await updateDoc(doc(db, 'cafe_inventory', itemId), { showInMenu: show });
    showNotification(show ? 'Added to menu!' : 'Removed from menu!', 'success');
};

window.filterCafeInventoryByCategory = function (categoryId) {
    showSection('cafe-inventory');
    const tbody = document.getElementById('cafeInventoryTableBody');

    const filteredItems = cafeInventoryItems.filter(item => item.category === categoryId);

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

    tbody.innerHTML = filteredItems.map(item => {
        let pricesDisplay = '';
        if (item.sizes && Object.keys(item.sizes).length > 0) {
            pricesDisplay = Object.entries(item.sizes)
                .map(([size, price]) => `<div style="font-size: 0.85rem;">${size}: ₱${parseFloat(price).toFixed(2)}</div>`)
                .join('');
        } else {
            pricesDisplay = `<strong>₱${parseFloat(item.price).toFixed(2)}</strong>`;
        }

        return `
            <tr>
                <td>
                    <img src="${item.image || 'logo2.png'}"
                         alt="${item.name}" class="menu-item-image">
                </td>
                <td><strong>${item.name}</strong></td>
                <td><span style="text-transform: capitalize;">${item.categoryName || item.category}</span></td>
                <td>
                    <input type="number" value="${item.stock || 0}" 
                           onchange="updateCafeStock('${item.id}', this.value)"
                           style="width: 70px; padding: 5px; border: 2px solid #ddd; border-radius: 5px;">
                </td>
                <td>${pricesDisplay}</td>
                <td>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                        <input type="checkbox" ${item.showInMenu ? 'checked' : ''} 
                               onchange="toggleCafeShowInMenu('${item.id}', this.checked)">
                        <span style="font-size: 0.9rem;">${item.showInMenu ? 'Visible' : 'Hidden'}</span>
                    </label>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editCafeInventoryItem('${item.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteCafeInventoryItem('${item.id}')">Archive</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.openCafeInventoryModal = async function (itemId = null) {
    currentEditingCafeInventory = itemId;
    const modal = document.getElementById('cafeInventoryModal');
    const title = document.getElementById('cafeInventoryModalTitle');
    const preview = document.getElementById('cafeItemImagePreview');
    const fileInput = document.getElementById('cafeItemImageFile');

    fileInput.value = '';
    preview.src = '';
    preview.style.display = 'none';

    if (itemId) {
        const docSnap = await getDoc(doc(db, 'cafe_inventory', itemId));
        if (docSnap.exists()) {
            const item = docSnap.data();
            title.textContent = 'Edit Cafe Item';
            document.getElementById('cafeItemName').value = item.name;
            document.getElementById('cafeItemCategory').value = item.category;
            document.getElementById('cafeItemStock').value = item.stock || 0;
            document.getElementById('cafeItemShowInMenu').checked = item.showInMenu || false;

            if (item.image) {
                preview.src = item.image;
                preview.style.display = 'block';
            }

            // Load prices for sizes
            await loadCategorySizes();
            if (item.sizes) {
                Object.entries(item.sizes).forEach(([size, price]) => {
                    const input = document.getElementById(`price_${size}`);
                    if (input) input.value = price;
                });
            } else if (item.price) {
                const priceInput = document.querySelector('#cafePricesContainer input');
                if (priceInput) priceInput.value = item.price;
            }

            fileInput.removeAttribute('required');
        }
    } else {
        title.textContent = 'Add Cafe Item';
        document.getElementById('cafeInventoryForm').reset();
        document.getElementById('cafePricesContainer').innerHTML = '';
        fileInput.setAttribute('required', 'required');
    }

    modal.classList.add('active');
};

window.closeCafeInventoryModal = function () {
    document.getElementById('cafeInventoryModal').classList.remove('active');
    document.getElementById('cafeInventoryForm').reset();
    currentEditingCafeInventory = null;
};

window.loadCategorySizes = function () {
    const categorySelect = document.getElementById('cafeItemCategory');
    const categoryId = categorySelect.value;
    const pricesContainer = document.getElementById('cafePricesContainer');

    if (!categoryId) {
        pricesContainer.innerHTML = '';
        return;
    }

    const category = cafeCategories.find(c => c.id === categoryId);

    if (!category) {
        pricesContainer.innerHTML = '';
        return;
    }

    if (category.sizes && category.sizes.length > 0) {
        // Category has sizes
        pricesContainer.innerHTML = `
            <div class="form-group">
                <label>Prices per Size *</label>
                ${category.sizes.map(size => `
                    <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                        <label style="min-width: 80px; font-weight: bold;">${size}:</label>
                        <input type="number" id="price_${size}" placeholder="0.00" step="0.01" min="0" required
                               style="flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 8px;">
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // No sizes, single price
        pricesContainer.innerHTML = `
            <div class="form-group">
                <label for="cafeItemPrice">Price (₱) *</label>
                <input type="number" id="cafeItemPrice" placeholder="0.00" step="0.01" min="0" required
                       style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px;">
            </div>
        `;
    }
};

document.getElementById('cafeItemImageFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('cafeItemImagePreview');

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

document.getElementById('cafeInventoryForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const itemName = document.getElementById('cafeItemName').value.trim();
    const itemCategory = document.getElementById('cafeItemCategory').value;
    const itemStock = parseInt(document.getElementById('cafeItemStock').value);
    const showInMenu = document.getElementById('cafeItemShowInMenu').checked;
    const imageFile = document.getElementById('cafeItemImageFile').files[0];

    if (!itemName || !itemCategory || isNaN(itemStock)) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    const category = cafeCategories.find(c => c.id === itemCategory);
    let prices = {};
    let singlePrice = null;

    if (category && category.sizes && category.sizes.length > 0) {
        // Has sizes, collect all size prices
        let allPricesFilled = true;
        category.sizes.forEach(size => {
            const priceInput = document.getElementById(`price_${size}`);
            if (priceInput) {
                const price = parseFloat(priceInput.value);
                if (isNaN(price) || price <= 0) {
                    allPricesFilled = false;
                } else {
                    prices[size] = price;
                }
            }
        });

        if (!allPricesFilled) {
            showNotification('Please fill in all size prices', 'error');
            return;
        }
    } else {
        // No sizes, single price
        const priceInput = document.getElementById('cafeItemPrice');
        if (priceInput) {
            singlePrice = parseFloat(priceInput.value);
            if (isNaN(singlePrice) || singlePrice <= 0) {
                showNotification('Please enter a valid price', 'error');
                return;
            }
        }
    }

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await convertImageToBase64(imageFile);
    } else if (currentEditingCafeInventory) {
        const docSnap = await getDoc(doc(db, 'cafe_inventory', currentEditingCafeInventory));
        if (docSnap.exists()) imageBase64 = docSnap.data().image;
    }

    const itemData = {
        name: itemName,
        category: itemCategory,
        categoryName: category ? category.name : itemCategory,
        stock: itemStock,
        image: imageBase64,
        status: itemStock > 0 ? 'available' : 'unavailable',
        showInMenu: showInMenu,
        updatedAt: Timestamp.now()
    };

    // Add prices
    if (Object.keys(prices).length > 0) {
        itemData.sizes = prices;
    } else if (singlePrice !== null) {
        itemData.price = singlePrice;
    }

    if (!currentEditingCafeInventory) itemData.createdAt = Timestamp.now();

    if (currentEditingCafeInventory) {
        // EDITING EXISTING CAFE ITEM
        const oldItem = cafeInventoryItems.find(i => i.id === currentEditingCafeInventory);

        await updateDoc(doc(db, 'cafe_inventory', currentEditingCafeInventory), itemData);

        // Send notification if stock changed
        if (oldItem && oldItem.stock !== itemStock) {
            if (itemStock > oldItem.stock) {
                await sendStockNotificationToStaff('restock', itemName, `Cafe item stock increased from ${oldItem.stock} to ${itemStock}`);
            } else {
                await sendStockNotificationToStaff('stock_update', itemName, `Cafe item stock updated from ${oldItem.stock} to ${itemStock}`);
            }
        }

        showNotification('Cafe item updated!', 'success');
    } else {
        // ADDING NEW CAFE ITEM
        await addDoc(collection(db, 'cafe_inventory'), itemData);
        await sendStockNotificationToStaff('new_item', itemName, `New cafe item added with initial stock: ${itemStock}`);
        showNotification('Cafe item added!', 'success');
    }

    closeCafeInventoryModal();
    await loadCafeInventory();
    renderCafeInventory();
});

window.editCafeInventoryItem = function (itemId) {
    openCafeInventoryModal(itemId);
};

window.deleteCafeInventoryItem = async function (itemId) {
    if (confirm('Archive this cafe item? You can restore it later from Archives.')) {
        const itemDoc = await getDoc(doc(db, 'cafe_inventory', itemId));
        if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            await addDoc(collection(db, 'archived_cafe_inventory'), {
                ...itemData,
                archivedAt: Timestamp.now()
            });
            await deleteDoc(doc(db, 'cafe_inventory', itemId));
            showNotification('Cafe item archived successfully!', 'success');
            await loadArchivedCafeItems();
            await loadCafeInventory();
            renderCafeInventory();
        }
    }
};

window.restoreCafeInventoryItem = async function (itemId) {
    if (confirm('Restore this cafe item to inventory?')) {
        const itemDoc = await getDoc(doc(db, 'archived_cafe_inventory', itemId));
        if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            delete itemData.archivedAt;
            await addDoc(collection(db, 'cafe_inventory'), itemData);
            await deleteDoc(doc(db, 'archived_cafe_inventory', itemId));
            showNotification('Cafe item restored successfully!', 'success');
            await loadArchivedCafeItems();
            await loadCafeInventory();
            renderArchivedCafeInventory();
        }
    }
};

window.permanentDeleteCafeItem = async function (itemId) {
    if (confirm('Permanently delete this cafe item? This action cannot be undone!')) {
        await deleteDoc(doc(db, 'archived_cafe_inventory', itemId));
        showNotification('Cafe item permanently deleted!', 'success');
        await loadArchivedCafeItems();
        renderArchivedCafeInventory();
    }
};

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
            switchInventoryType('meals');
            break;
        case 'menu-items':
            switchMenuType('meals');
            break;
        case 'categories':
            switchCategoryType('meals');
            break;
        case 'tables':
            renderTables();
            break;
        case 'feedbacks':
            renderFeedbacks();
            break;
        case 'reports':
            switchReportsTab('analytics');
            break;
        case 'admin-notifications':
            renderAdminNotifications();
            break;
    }
}

// ============================================
// INITIALIZE CATEGORIES
// ============================================
async function initializeCategories() {
    // Just load existing categories from database
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    categories = [];
    categoriesSnapshot.forEach(doc => {
        categories.push({ id: doc.id, ...doc.data() });
    });
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

        // Don't auto-sort here, let render function handle it
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

    // Cafe listeners
    const cafeInventoryQuery = query(collection(db, 'cafe_inventory'), orderBy('name'));
    onSnapshot(cafeInventoryQuery, (snapshot) => {
        cafeInventoryItems = [];
        snapshot.forEach(doc => {
            const itemData = doc.data();
            const category = cafeCategories.find(c => c.id === itemData.category);
            cafeInventoryItems.push({
                id: doc.id,
                ...itemData,
                categoryName: category ? category.name : itemData.category
            });
        });

        // Don't auto-sort here, let render function handle it
        renderCafeInventory();
        renderCafeMenuItems();
    });

    const cafeCategoriesQuery = query(collection(db, 'cafe_categories'));
    onSnapshot(cafeCategoriesQuery, (snapshot) => {
        cafeCategories = [];
        snapshot.forEach(doc => {
            cafeCategories.push({ id: doc.id, ...doc.data() });
        });
        renderCafeCategories();

        // Update cafe category dropdown
        const categorySelect = document.getElementById('cafeItemCategory');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select category</option>' +
                cafeCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }
    });

    // Listen to staff notifications
    const staffNotifQuery = query(
        collection(db, 'staff_notifications'),
        orderBy('timestamp', 'desc')
    );
    onSnapshot(staffNotifQuery, (snapshot) => {
        const prevCount = adminNotifications.length;
        adminNotifications = [];
        snapshot.forEach(doc => {
            adminNotifications.push({ id: doc.id, ...doc.data() });
        });

        if (adminNotifications.length > prevCount && prevCount > 0) {
            showNotification('New low stock alert from staff!', 'warning');
        }

        renderAdminNotifications();
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

    // Update category dropdown in inventory modal
    const categorySelect = document.getElementById('inventoryCategory');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Select category</option>' +
            categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }

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
    await loadArchivedItems();

    // ADD THESE LINES
    await loadCafeCategories();
    await loadCafeInventory();
    await loadArchivedCafeItems();

    renderInventory();
    renderMenuItems();
    renderCategories();
    renderTables();
    renderCafeCategories();
    renderCafeInventory();
    updateOverviewStats();
}

// ============================================
// OVERVIEW STATS
// ============================================
function updateOverviewStats() {
    // Available menu items
    const availableItems = inventoryItems.filter(item =>
        item.showInMenu && item.status === 'available' && item.stock > 0
    );
    document.getElementById('totalMenuItems').textContent = availableItems.length;

    // Pending orders
    const pending = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
    document.getElementById('pendingOrders').textContent = pending;

    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= today && order.status === 'completed';
    });
    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    document.getElementById('todayRevenue').textContent = `₱${todayRevenue.toFixed(2)}`;

    // Most popular item (WEEKLY - last 7 days)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const itemCounts = {};
    orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return order.status === 'completed' && orderDate >= weekStart;
    }).forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
            });
        }
    });

    const popularItem = Object.keys(itemCounts).length > 0
        ? Object.keys(itemCounts).reduce((a, b) => itemCounts[a] > itemCounts[b] ? a : b)
        : 'No data';

    document.getElementById('popularItem').textContent = popularItem.length > 20
        ? popularItem.substring(0, 20) + '...'
        : popularItem;

    updateRecentActivity();
}

function updateRecentActivity() {
    const activityList = document.getElementById('recentActivity');

    // Filter only completed and cancelled orders
    const recentOrders = orders
        .filter(o => o.status === 'completed' || o.status === 'cancelled')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    if (recentOrders.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-message">No recent activity</div>
            </div>
        `;
        return;
    }

    activityList.innerHTML = recentOrders.map(order => {
        const icon = order.status === 'completed' ? '✅' : '❌';
        const timeAgo = getTimeAgo(new Date(order.timestamp));
        const statusText = order.status === 'completed' ? 'completed' : 'cancelled';

        return `
            <div class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-text">
                        Order ${order.referenceNumber} ${statusText} - Table ${order.tableNumber}
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
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

    // Apply current sort if any
    const sortedItems = applySortIfNeeded(menuItems, 'menu');

    tbody.innerHTML = sortedItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'logo2.png'}"
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

    // Update sort indicators if there's an active sort
    if (currentSort.menu.column) {
        updateSortIndicators('menu', currentSort.menu.column, currentSort.menu.ascending);
    }
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
                <img src="${item.image || 'logo2.png'}"
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
function renderInventory() {
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

    // Apply current sort if any
    const sortedItems = applySortIfNeeded(inventoryItems, 'inventory');

        tbody.innerHTML = sortedItems.map(item => `
            <tr>
                <td>
                    <img src="${item.image || 'logo2.png'}"
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

    // Update sort indicators if there's an active sort
    if (currentSort.inventory.column) {
        updateSortIndicators('inventory', currentSort.inventory.column, currentSort.inventory.ascending);
    }
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
        // EDITING EXISTING ITEM
        const oldItem = inventoryItems.find(i => i.id === currentEditingInventory);

        await updateDoc(doc(db, 'inventory', currentEditingInventory), itemData);

        // Send notification if stock changed
        if (oldItem && oldItem.stock !== itemStock) {
            if (itemStock > oldItem.stock) {
                await sendStockNotificationToStaff('restock', itemName, `Stock increased from ${oldItem.stock} to ${itemStock}`);
            } else {
                await sendStockNotificationToStaff('stock_update', itemName, `Stock updated from ${oldItem.stock} to ${itemStock}`);
            }
        }

        showNotification('Item updated!', 'success');
    } else {
        // ADDING NEW ITEM
        await addDoc(collection(db, 'inventory'), itemData);
        await sendStockNotificationToStaff('new_item', itemName, `Initial stock: ${itemStock}`);
        showNotification('Item added!', 'success');
    }

    closeInventoryModal();
    await renderInventory();
});

window.editInventoryItem = function (itemId) {
    openInventoryModal(itemId);
};

window.deleteInventoryItem = async function (itemId) {
    if (confirm('Archive this item? You can restore it later from Archives.')) {
        const itemDoc = await getDoc(doc(db, 'inventory', itemId));
        if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            await addDoc(collection(db, 'archived_inventory'), {
                ...itemData,
                archivedAt: Timestamp.now()
            });
            await deleteDoc(doc(db, 'inventory', itemId));
            showNotification('Item archived successfully!', 'success');
            await loadArchivedItems();
        }
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
                <button class="btn-qr" onclick="showQRCode(${table.tableNumber})">QR Code</button>
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

// ============================================
// REPORTS TABS & ANALYTICS
// ============================================
window.switchReportsTab = function (tab) {
    document.querySelectorAll('#reports .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#reports .tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'analytics') {
        document.querySelector('#reports .tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('analyticsTab').classList.add('active');
        updateAnalytics();
    } else if (tab === 'sales') {
        document.querySelector('#reports .tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('salesTodayTab').classList.add('active');
        document.getElementById('salesDate').valueAsDate = new Date();
        updateSalesToday();
    } else {
        document.querySelector('#reports .tab-btn:nth-child(3)').classList.add('active');
        document.getElementById('transactionsTab').classList.add('active');
        document.getElementById('transactionDate').valueAsDate = new Date();
        updateTransactions();
    }
};

window.updateAnalytics = async function () {
    const range = document.getElementById('analyticsRange').value;
    let startDate, endDate = new Date();

    if (range === 'custom') {
        startDate = new Date(document.getElementById('startDate').value);
        endDate = new Date(document.getElementById('endDate').value);
    } else {
        startDate = new Date(endDate.getTime() - parseInt(range) * 24 * 60 * 60 * 1000);
    }

    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= startDate && orderDate <= endDate && order.status === 'completed';
    });

    // Calculate stats
    const totalSales = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const avgOrder = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;

    document.getElementById('totalSales').textContent = `₱${totalSales.toFixed(2)}`;
    document.getElementById('avgOrderValue').textContent = `₱${avgOrder.toFixed(2)}`;
    document.getElementById('totalTransactions').textContent = filteredOrders.length;

    // Update charts
    updateDailySalesChart(filteredOrders, startDate, endDate);
    updateWeeklySalesChart(filteredOrders, startDate, endDate);
    updateMonthlySalesChart(filteredOrders, startDate, endDate);
};

function updateDailySalesChart(filteredOrders, startDate, endDate) {
    const ctx = document.getElementById('dailySalesChart');
    if (!ctx) return;

    const dailyData = {};
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyData[dateStr] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    filteredOrders.forEach(order => {
        const dateStr = new Date(order.timestamp).toISOString().split('T')[0];
        if (dailyData.hasOwnProperty(dateStr)) {
            dailyData[dateStr] += order.totalAmount || 0;
        }
    });

    const labels = Object.keys(dailyData).map(date => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const data = Object.values(dailyData);

    if (dailySalesChart) dailySalesChart.destroy();

    dailySalesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Sales (₱)',
                data: data,
                borderColor: '#BA8E4A',
                backgroundColor: 'rgba(186, 142, 74, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateWeeklySalesChart(filteredOrders, startDate, endDate) {
    const ctx = document.getElementById('weeklySalesChart');
    if (!ctx) return;

    const weeklyData = {};

    filteredOrders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        const weekStart = new Date(orderDate);
        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        weeklyData[weekKey] = (weeklyData[weekKey] || 0) + (order.totalAmount || 0);
    });

    const labels = Object.keys(weeklyData).map(date => {
        const d = new Date(date);
        return `Week of ${d.getMonth() + 1}/${d.getDate()}`;
    });
    const data = Object.values(weeklyData);

    if (weeklySalesChart) weeklySalesChart.destroy();

    weeklySalesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weekly Sales (₱)',
                data: data,
                borderColor: '#17a2b8',
                backgroundColor: 'rgba(23, 162, 184, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateMonthlySalesChart(filteredOrders, startDate, endDate) {
    const ctx = document.getElementById('monthlySalesChart');
    if (!ctx) return;

    const monthlyData = {};

    filteredOrders.forEach(order => {
        const orderDate = new Date(order.timestamp);
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (order.totalAmount || 0);
    });

    const labels = Object.keys(monthlyData).map(month => {
        const [year, m] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(m) - 1]} ${year}`;
    });
    const data = Object.values(monthlyData);

    if (monthlySalesChart) monthlySalesChart.destroy();

    monthlySalesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Sales (₱)',
                data: data,
                borderColor: '#6f42c1',
                backgroundColor: 'rgba(111, 66, 193, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

window.updateSalesToday = async function () {
    const selectedDate = new Date(document.getElementById('salesDate').value);
    selectedDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get completed orders for the date
    const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= selectedDate && orderDate < nextDay && order.status === 'completed';
    });

    const salesData = {};

    dayOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (!salesData[item.name]) {
                    salesData[item.name] = {
                        name: item.name,
                        category: item.category || 'N/A',
                        price: item.price || 0,
                        quantity: 0,
                        revenue: 0
                    };
                }
                salesData[item.name].quantity += item.quantity || 1;
                salesData[item.name].revenue += (item.quantity || 1) * (item.price || 0);
            });
        }
    });

    const salesArray = Object.values(salesData).sort((a, b) => b.quantity - a.quantity);

    const tbody = document.getElementById('salesTodayBody');
    if (salesArray.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div>📊</div>
                    <div>No sales recorded for this date</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = salesArray.map((item, index) => `
        <tr>
            <td><strong>#${index + 1}</strong></td>
            <td>${item.name}</td>
            <td style="text-transform: capitalize;">${item.category}</td>
            <td><strong>${item.quantity}</strong></td>
            <td><strong>₱${item.revenue.toFixed(2)}</strong></td>
        </tr>
    `).join('');
};

window.updateTransactions = function () {
    const selectedDate = new Date(document.getElementById('transactionDate').value);
    selectedDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const status = document.getElementById('transactionStatus').value;

    let filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        const dateMatch = orderDate >= selectedDate && orderDate < nextDay;
        const statusMatch = status === 'all' || order.status === status;
        return dateMatch && statusMatch;
    });

    filteredOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const tbody = document.getElementById('transactionsBody');
    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>📋</div>
                    <div>No transactions found</div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
        const itemsCount = order.items ? order.items.length : 0;
        const time = new Date(order.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td><strong>${order.referenceNumber || order.id}</strong></td>
                <td>Table ${order.tableNumber}</td>
                <td>${itemsCount} item${itemsCount !== 1 ? 's' : ''}</td>
                <td><strong>₱${(order.totalAmount || 0).toFixed(2)}</strong></td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td>${time}</td>
            </tr>
        `;
    }).join('');
};

// ============================================
// ADMIN NOTIFICATIONS
// ============================================
async function loadAdminNotifications() {
    const q = query(
        collection(db, 'staff_notifications'),
        orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    adminNotifications = [];

    snapshot.forEach(doc => {
        adminNotifications.push({
            id: doc.id,
            ...doc.data()
        });
    });

    renderAdminNotifications();
}

function renderAdminNotifications() {
    const container = document.getElementById('adminNotificationsContainer');

    if (adminNotifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <div class="empty-message">No notifications</div>
                <div class="empty-description">Low stock alerts from staff will appear here</div>
            </div>
        `;
        return;
    }

    container.innerHTML = adminNotifications.map(notif => {
        const timestamp = notif.timestamp?.toDate ? notif.timestamp.toDate() : new Date(notif.timestamp);
        const timeAgo = getTimeAgo(timestamp);
        const readClass = notif.read ? 'read' : 'unread';

        return `
            <div class="notification-card ${readClass}" style="background: ${notif.read ? '#f8f9fa' : 'white'}; border-left-color: ${notif.read ? '#6c757d' : '#ff9800'};">
                <div class="notification-header">
                    <div class="notification-type">
                        ${notif.read ? '📭' : '📬'} Low Stock Alert
                        ${!notif.read ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 8px;">NEW</span>' : ''}
                    </div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-body">
                    <strong>${notif.staffName}</strong> reported low stock for:
                    <div class="notification-item">
                        <strong>Item:</strong> ${notif.itemName}
                    </div>
                </div>
                ${!notif.read ? `
                    <div style="margin-top: 10px;">
                        <button class="btn-primary" onclick="markNotificationAsRead('${notif.id}')" style="padding: 8px 15px; font-size: 0.85rem;">
                            ✓ Mark as Read
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}
window.markNotificationAsRead = async function (notifId) {
    try {
        await updateDoc(doc(db, 'staff_notifications', notifId), {
            read: true,
            readAt: Timestamp.now()
        });
        showNotification('Notification marked as read', 'success');
    } catch (error) {
        console.error('Error marking as read:', error);
        showNotification('Failed to update notification', 'error');
    }
};
window.markAllAsRead = async function () {
    if (!confirm('Mark all notifications as read?')) return;
    try {
        const unreadNotifs = adminNotifications.filter(n => !n.read);

        for (const notif of unreadNotifs) {
            await updateDoc(doc(db, 'staff_notifications', notif.id), {
                read: true,
                readAt: Timestamp.now()
            });
        }

        showNotification('All notifications marked as read!', 'success');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showNotification('Failed to update notifications', 'error');
    }
};

// ============================================
// SEND NOTIFICATION TO STAFF (when inventory updated)
// ============================================
async function sendStockNotificationToStaff(type, itemName, details) {
    try {
        await addDoc(collection(db, 'admin_notifications'), {
            type: type, // 'new_item', 'restock', or 'stock_update'
            itemName: itemName,
            message: getMessage(type, itemName),
            details: details || '',
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error('Error sending notification to staff:', error);
    }
}

function getMessage(type, itemName) {
    switch (type) {
        case 'new_item':
            return `New item "${itemName}" has been added to inventory`;
        case 'restock':
            return `Item "${itemName}" has been restocked`;
        case 'stock_update':
            return `Stock level updated for "${itemName}"`;
        default:
            return `Update for "${itemName}"`;
    }
}
// Close user menu when clicking outside
document.addEventListener('DOMContentLoaded', function () {
    const sidebarUser = document.querySelector('.sidebar-user');
    const userMenu = document.getElementById('userMenu');

    if (sidebarUser && userMenu) {
        // Toggle on click
        sidebarUser.addEventListener('click', function (e) {
            e.stopPropagation();
            userMenu.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', function (event) {
            if (!sidebarUser.contains(event.target) && !userMenu.contains(event.target)) {
                userMenu.classList.remove('active');
            }
        });
    }
});