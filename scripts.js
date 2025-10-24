import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    Timestamp,
    updateDoc,
    setDoc,
    getDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let cart = [];
let selectedOrderType = 'dine-in';
let activeOrders = [];
let tableNumber = null;
let menuItems = [];
let cafeCategories = [];
let cafeItems = [];
let selectedSizes = {}; // Track selected size per item: { itemId: sizeKey }

window.selectOrderType = function (type) {
    selectedOrderType = type;

    document.getElementById('dineInBtn').classList.toggle('active', type === 'dine-in');
    document.getElementById('takeOutBtn').classList.toggle('active', type === 'take-out');
};

// ============================================
// TABLE NUMBER SETUP WITH VALIDATION
// ============================================
async function getTableNumber() {
    const urlParams = new URLSearchParams(window.location.search);
    let table = urlParams.get('table');

    if (!table) {
        table = prompt('Please enter your table number:');
        if (table) {
            const isValid = await validateTable(table);
            if (isValid) {
                window.location.href = `${window.location.pathname}?table=${table}`;
                return table;
            } else {
                alert('❌ Invalid table number! Please contact staff or scan a valid QR code.');
                showInvalidTablePage();
                return null;
            }
        } else {
            showInvalidTablePage();
            return null;
        }
    } else {
        const isValid = await validateTable(table);
        if (!isValid) {
            alert('❌ Invalid table number! Please scan a valid QR code or contact staff.');
            showInvalidTablePage();
            return null;
        }
        return table;
    }
}

async function validateTable(tableNumber) {
    try {
        const tablesSnapshot = await getDocs(collection(db, 'tables'));
        let isValid = false;

        tablesSnapshot.forEach(doc => {
            const table = doc.data();
            if (table.tableNumber == tableNumber) {
                isValid = true;
            }
        });

        return isValid;
    } catch (error) {
        console.error('Error validating table:', error);
        return false;
    }
}

function showInvalidTablePage() {
    document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            text-align: center;
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                max-width: 500px;
            ">
                <div style="font-size: 5rem; margin-bottom: 20px;">❌</div>
                <h1 style="color: #BA8E4A; margin-bottom: 15px; font-size: 2rem;">Invalid Table Number</h1>
                <p style="color: #666; margin-bottom: 25px; line-height: 1.6;">
                    The table number you entered or scanned is not valid. 
                    Please scan a valid QR code from your table or contact our staff for assistance.
                </p>
                <button onclick="location.reload()" style="
                    background: linear-gradient(135deg, #BA8E4A, #d4a562);
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 50px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(186, 142, 74, 0.3);
                ">
                    Try Again
                </button>
            </div>
        </div>
    `;
}

// ============================================
// ACTIVE ORDERS - SAVE/LOAD
// ============================================
function saveActiveOrders() {
    sessionStorage.setItem('activeOrders', JSON.stringify(activeOrders));
}

function loadActiveOrders() {
    const saved = sessionStorage.getItem('activeOrders');
    if (saved) {
        activeOrders = JSON.parse(saved); // Load all orders
        activeOrders.forEach(order => listenToOrder(order.id));
        updateOrderStatusDisplay();
    }
}

// ============================================
// REALTIME ORDER LISTENER
// ============================================
function listenToOrder(orderId) {
    const orderRef = doc(db, 'orders', orderId);

    onSnapshot(orderRef, (docSnapshot) => {
        if (!docSnapshot.exists()) return;

        const updatedOrder = { id: docSnapshot.id, ...docSnapshot.data() };
        const index = activeOrders.findIndex(o => o.id === orderId);
        const oldStatus = index >= 0 ? activeOrders[index].status : null;

        index >= 0 ? activeOrders[index] = updatedOrder : activeOrders.push(updatedOrder);

        saveActiveOrders();
        updateOrderStatusDisplay();

        if (oldStatus && oldStatus !== updatedOrder.status) showStatusNotification(updatedOrder);

    });
}

function showStatusNotification(order) {
    if (order.status === 'preparing') {
        showNotification(`Order ${order.referenceNumber} is being prepared!`, 'info');
    } else if (order.status === 'ready') {
        showNotification(`Order ${order.referenceNumber} is ready!`, 'success');
    } else if (order.status === 'completed') {
        showNotification(`Order ${order.referenceNumber} completed!`, 'success');
    }
}

function removeCompletedOrder(orderId) {
    activeOrders = activeOrders.filter(o => o.id !== orderId);
    saveActiveOrders();
    updateOrderStatusDisplay();
}

// ============================================
// CAFE MENU FUNCTIONS
// ============================================
async function loadCafeCategories() {
    try {
        const snapshot = await getDocs(collection(db, 'cafe_categories'));
        cafeCategories = [];
        snapshot.forEach(doc => {
            cafeCategories.push({ id: doc.id, ...doc.data() });
        });
        
        // Populate cafe category filter
        const cafeFilter = document.getElementById('cafeCategoryFilter');
        if (cafeFilter) {
            cafeFilter.innerHTML = '<option value="all">All Cafe Items</option>';
            cafeCategories.forEach(cat => {
                cafeFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading cafe categories:', error);
    }
}

async function loadCafeItems() {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'cafe_inventory'),
            where('showInMenu', '==', true),
            where('status', '==', 'available')
        ));
        
        cafeItems = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.stock > 0) {
                cafeItems.push({ id: doc.id, ...data });
            }
        });
        
        displayCafeItems('all');
    } catch (error) {
        console.error('Error loading cafe items:', error);
        document.getElementById('cafeMenuContainer').innerHTML = 
            '<div class="empty-state"><p>Error loading cafe menu</p></div>';
    }
}

function displayCafeItems(categoryFilter) {
    const container = document.getElementById('cafeMenuContainer');
    
    let filteredItems = categoryFilter === 'all' 
        ? cafeItems 
        : cafeItems.filter(item => item.category === categoryFilter);
    
    if (filteredItems.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No cafe items available</p></div>';
        return;
    }
    
    // Group items by category
    const groupedItems = {};
    filteredItems.forEach(item => {
        const category = item.categoryName || item.category || 'Other';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });
    
    // Build HTML with category headers
    let html = '';
    Object.keys(groupedItems).forEach(categoryName => {
        html += `<div class="cafe-category-header">${categoryName}</div>`;
        html += '<div class="menu-grid">';
        
        groupedItems[categoryName].forEach(item => {
            html += createCafeItemElement(item);
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

function createCafeItemElement(item) {
    const hasSizes = item.sizes && Object.keys(item.sizes).length > 0;
    const defaultSize = hasSizes ? Object.keys(item.sizes)[0] : null;
    const defaultPrice = hasSizes ? item.sizes[defaultSize] : item.price;
    
    // Initialize selected size if not set
    if (hasSizes && !selectedSizes[item.id]) {
        selectedSizes[item.id] = defaultSize;
    }
    
    let sizesHTML = '';
    if (hasSizes) {
        sizesHTML = '<div class="size-selector">';
        Object.keys(item.sizes).forEach(sizeKey => {
            const isActive = selectedSizes[item.id] === sizeKey;
            sizesHTML += `
                <button class="size-btn ${isActive ? 'active' : ''}" 
                        onclick="selectCafeSize('${item.id}', '${sizeKey}')">
                    ${sizeKey.toUpperCase()}
                    <span class="size-price-label">₱${parseFloat(item.sizes[sizeKey]).toFixed(2)}</span>
                </button>
            `;
        });
        sizesHTML += '</div>';
    }
    
    return `
        <div class="menu-item">
            <img src="${item.image || 'https://via.placeholder.com/300x150?text=' + encodeURIComponent(item.name)}"
                 alt="${item.name}">
            <h4>${item.name}</h4>
            <div class="price" id="cafe-price-${item.id}">₱${parseFloat(defaultPrice).toFixed(2)}</div>
            <div style="font-size: 0.85rem; color: ${item.stock < 10 ? '#dc3545' : '#666'}; margin-bottom: 10px;">
                ${item.stock} available
            </div>
            ${sizesHTML}
            <div class="quantity-controls">
                <button class="qty-btn" onclick="changeCafeQuantity('${item.id}', -1)">−</button>
                <input type="number" class="qty-input" id="cafe-qty-${item.id}" value="1" min="1" max="${item.stock}">
                <button class="qty-btn" onclick="changeCafeQuantity('${item.id}', 1)">+</button>
            </div>
            <button class="add-to-cart-btn" onclick="addCafeToCart('${item.id}')">
                Add to Cart
            </button>
        </div>
    `;
}

window.selectCafeSize = function(itemId, sizeKey) {
    selectedSizes[itemId] = sizeKey;
    
    // Update UI
    const item = cafeItems.find(i => i.id === itemId);
    if (!item) return;
    
    // Update price display
    const priceEl = document.getElementById(`cafe-price-${itemId}`);
    if (priceEl) {
        priceEl.textContent = `₱${parseFloat(item.sizes[sizeKey]).toFixed(2)}`;
    }
    
    // Update active button
    const container = priceEl.closest('.menu-item');
    if (container) {
        container.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        container.querySelector(`.size-btn[onclick*="${sizeKey}"]`).classList.add('active');
    }
};

window.changeCafeQuantity = function(itemId, change) {
    const input = document.getElementById(`cafe-qty-${itemId}`);
    if (!input) return;
    
    const currentValue = parseInt(input.value) || 1;
    const max = parseInt(input.max) || 1;
    const newValue = Math.max(1, Math.min(max, currentValue + change));
    input.value = newValue;
};

window.addCafeToCart = function(itemId) {
    const item = cafeItems.find(i => i.id === itemId);
    if (!item) return;
    
    const quantityInput = document.getElementById(`cafe-qty-${itemId}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    if (quantity > item.stock) {
        showNotification(`Only ${item.stock} available`, 'error');
        return;
    }
    
    const hasSizes = item.sizes && Object.keys(item.sizes).length > 0;
    const selectedSize = hasSizes ? selectedSizes[itemId] : null;
    const price = hasSizes ? item.sizes[selectedSize] : item.price;
    const itemName = hasSizes ? `${item.name} (${selectedSize.toUpperCase()})` : item.name;
    
    // Create unique cart ID for items with sizes
    const cartId = hasSizes ? `${itemId}_${selectedSize}` : itemId;
    
    const existingItem = cart.find(cartItem => cartItem.cartId === cartId);
    if (existingItem) {
        const newTotal = existingItem.quantity + quantity;
        if (newTotal <= item.stock) {
            existingItem.quantity = newTotal;
        } else {
            showNotification(`Only ${item.stock} available`, 'error');
            return;
        }
    } else {
        cart.push({
            cartId: cartId,
            id: itemId,
            name: itemName,
            price: price,
            quantity: quantity,
            maxStock: item.stock,
            size: selectedSize,
            isCafe: true
        });
    }
    
    quantityInput.value = 1;
    updateCartDisplay();
    showNotification('Added to cart!', 'success');
};

window.filterCafeByCategory = function(categoryId) {
    displayCafeItems(categoryId);
};

// Cafe Search
document.addEventListener('DOMContentLoaded', function() {
    const cafeSearch = document.getElementById('cafeSearchInput');
    if (cafeSearch) {
        cafeSearch.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (!searchTerm) {
                const currentCategory = document.getElementById('cafeCategoryFilter').value;
                displayCafeItems(currentCategory);
                return;
            }
            
            const filteredItems = cafeItems.filter(item =>
                item.name.toLowerCase().includes(searchTerm) ||
                (item.category && item.category.toLowerCase().includes(searchTerm))
            );
            
            const container = document.getElementById('cafeMenuContainer');
            if (filteredItems.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No items found</p></div>';
                return;
            }
            
            let html = '<div class="menu-grid">';
            filteredItems.forEach(item => {
                html += createCafeItemElement(item);
            });
            html += '</div>';
            
            container.innerHTML = html;
        });
    }
});

// ============================================
// UPDATE MEALS CATEGORY FILTER
// ============================================
async function loadMealsCategories() {
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const mealsCategories = [];
    categoriesSnapshot.forEach(doc => {
        mealsCategories.push({ id: doc.id, ...doc.data() });
    });
    
    const filter = document.getElementById('mealsCategoryFilter');
    if (filter) {
        filter.innerHTML = '<option value="all-meals">All Meals</option>';
        mealsCategories.forEach(cat => {
            if (cat.id !== 'all-meals') {
                filter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
            }
        });
    }
}

window.filterMealsByCategory = function(categoryId) {
    loadMenuItems(categoryId);
};

// ============================================
// INITIALIZE APP
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    tableNumber = await getTableNumber();

    if (!tableNumber) {
        return;
    }

    loadActiveOrders();
    await loadCategories();
    await loadMealsCategories(); // ADD THIS
    await loadCafeCategories(); // ADD THIS
    await loadMenuItems('all-meals');
    await loadCafeItems(); // ADD THIS
    updateCartDisplay();
    setupRealtimeMenuListener();

    await checkGCashPaymentStatus();
    
    const shouldSwitchToOrders = sessionStorage.getItem('switchToOrdersTab');
    if (shouldSwitchToOrders === 'true') {
        sessionStorage.removeItem('switchToOrdersTab');
        setTimeout(() => {
            switchTab('orders');
        }, 1000);
    }
});



// ============================================
// SEARCH FUNCTIONALITY
// ============================================
document.getElementById('searchInput').addEventListener('input', function (e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const grid = document.getElementById('menuGrid');

    if (!searchTerm) {
        const currentCategory = document.getElementById('menuSectionTitle').dataset.currentCategory || 'all-meals';
        displayMenuItems(currentCategory);
        return;
    }

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        (item.category && item.category.toLowerCase().includes(searchTerm))
    );

    if (filteredItems.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No items found</p></div>';
        document.getElementById('menuSectionTitle').textContent = 'Search Results (0)';
        return;
    }

    grid.innerHTML = '';
    filteredItems.forEach(item => grid.appendChild(createMenuItemElement(item)));
    document.getElementById('menuSectionTitle').textContent = `Search Results (${filteredItems.length})`;
});

// ============================================
// REALTIME MENU LISTENER
// ============================================
function setupRealtimeMenuListener() {
    const inventoryQuery = query(
        collection(db, 'inventory'),
        where('showInMenu', '==', true)
    );

    onSnapshot(inventoryQuery, (snapshot) => {
        menuItems = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'available' && data.stock > 0) {
                menuItems.push({ id: doc.id, ...data });
            }
        });

        const currentCategory = document.getElementById('menuSectionTitle').dataset.currentCategory || 'all-meals';
        displayMenuItems(currentCategory);
    });
    
    // ADD CAFE REALTIME LISTENER
    const cafeInventoryQuery = query(
        collection(db, 'cafe_inventory'),
        where('showInMenu', '==', true)
    );
    
    onSnapshot(cafeInventoryQuery, (snapshot) => {
        cafeItems = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'available' && data.stock > 0) {
                cafeItems.push({ id: doc.id, ...data });
            }
        });
        
        // Refresh cafe menu if currently viewing it
        const cafePane = document.getElementById('pane-cafe-menu');
        if (cafePane && cafePane.classList.contains('active')) {
            const currentFilter = document.getElementById('cafeCategoryFilter').value;
            displayCafeItems(currentFilter);
        }
    });
}

// ============================================
// LOAD CATEGORIES
// ============================================
async function loadCategories() {
    const grid = document.getElementById('categoriesGrid');
    
    // If grid doesn't exist, skip (it's optional in customer UI)
    if (!grid) {
        return;
    }

    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const categories = [];
    categoriesSnapshot.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));

    if (categories.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No categories available</p></div>';
        return;
    }

    grid.innerHTML = '';
    categories.forEach(category => {
        const btn = document.createElement('div');
        btn.className = 'category-btn';
        btn.onclick = () => {
            loadMenuItems(category.id);
            switchTab('all-meals');
        };
        btn.innerHTML = `
            <img src="${category.image}" alt="${category.name}">
            <div style="font-weight: bold;">${category.name}</div>
        `;
        grid.appendChild(btn);
    });
}

// ============================================
// LOAD MENU ITEMS
// ============================================
async function loadMenuItems(categoryId) {
    const grid = document.getElementById('menuGrid');
    const title = document.getElementById('menuSectionTitle');

    grid.innerHTML = '<div class="loading">Loading menu...</div>';
    title.dataset.currentCategory = categoryId;

    const categoryDoc = await getDocs(collection(db, 'categories'));
    const categories = [];
    categoryDoc.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));

    const category = categories.find(c => c.id === categoryId);
    title.textContent = category ? category.name : 'Menu Items';

    const inventoryQuery = query(
        collection(db, 'inventory'),
        where('showInMenu', '==', true)
    );

    const snapshot = await getDocs(inventoryQuery);
    menuItems = [];

    snapshot.forEach(menuDoc => {
        const item = { id: menuDoc.id, ...menuDoc.data() };
        if (item.status === 'available' && item.stock > 0) {
            menuItems.push(item);
        }
    });

    displayMenuItems(categoryId);
}

// ============================================
// DISPLAY MENU ITEMS
// ============================================
function displayMenuItems(categoryId) {
    const grid = document.getElementById('menuGrid');

    let filteredItems = categoryId === 'all-meals'
        ? menuItems
        : menuItems.filter(item => {
            const itemCat = (item.category || '').toLowerCase().trim();
            const catId = categoryId.toLowerCase().trim();
            return itemCat === catId;
        });

    if (filteredItems.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No items available</p></div>';
        return;
    }

    grid.innerHTML = '';
    filteredItems.forEach(item => {
        grid.appendChild(createMenuItemElement(item));
    });
}

// ============================================
// CREATE MENU ITEM ELEMENT
// ============================================
function createMenuItemElement(item) {
    const div = document.createElement('div');
    div.className = 'menu-item';
    div.innerHTML = `
        <img src="${item.image || 'https://via.placeholder.com/300x150?text=' + encodeURIComponent(item.name)}"
             alt="${item.name}">
        <h4>${item.name}</h4>
        <div class="price">₱${parseFloat(item.price).toFixed(2)}</div>
        <div style="font-size: 0.85rem; color: ${item.stock < 10 ? '#dc3545' : '#666'}; margin-bottom: 10px;">
            ${item.stock} available
        </div>
        <div class="quantity-controls">
            <button class="qty-btn" onclick="changeQuantity('${item.id}', -1)">−</button>
            <input type="number" class="qty-input" id="qty-${item.id}" value="1" min="1" max="${item.stock}">
            <button class="qty-btn" onclick="changeQuantity('${item.id}', 1)">+</button>
        </div>
        <button class="add-to-cart-btn" onclick="addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price}, ${item.stock})">
            Add to Cart
        </button>
    `;
    return div;
}

// ============================================
// TAB SWITCHING (FIXED WITH NULL CHECKS)
// ============================================
window.switchTab = function (tabName) {
    const tabBtn = document.getElementById(`tab-${tabName}`);
    const tabPane = document.getElementById(`pane-${tabName}`);
    
    if (!tabBtn || !tabPane) {
        console.warn(`Tab elements not found for: ${tabName}`);
        return;
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    tabPane.classList.add('active');

    if (tabName === 'cafe-menu') {
        loadCafeItems();
    }
};

// ============================================
// UPDATE CART BADGE
// ============================================
function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

// ============================================
// CART FUNCTIONS
// ============================================
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
        cartTotal.textContent = 'Total: ₱0.00';
        updateCartBadge();
        return;
    }

    let total = 0;
    cartItems.innerHTML = '';

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">₱${item.price.toFixed(2)} each</div>
                <div class="cart-quantity-controls">
                    <button class="cart-qty-btn" onclick="updateCartQuantity(${index}, -1)">−</button>
                    <span class="cart-quantity">${item.quantity}</span>
                    <button class="cart-qty-btn" onclick="updateCartQuantity(${index}, 1)">+</button>
                </div>
                <div class="cart-item-total">Total: ₱${itemTotal.toFixed(2)}</div>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${index})">×</button>
        `;
        cartItems.appendChild(cartItem);
    });

    cartTotal.textContent = `Total: ₱${total.toFixed(2)}`;
    updateCartBadge();
}

window.updateCartQuantity = function (index, change) {
    const item = cart[index];
    
    // Find max stock based on item type
    let maxStock = item.maxStock;
    
    if (item.isCafe) {
        const cafeItem = cafeItems.find(c => c.id === item.id);
        maxStock = cafeItem ? cafeItem.stock : item.maxStock;
    } else {
        const menuItem = menuItems.find(m => m.id === item.id);
        maxStock = menuItem ? menuItem.stock : item.maxStock;
    }
    
    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
        removeFromCart(index);
    } else if (newQuantity <= maxStock) {
        cart[index].quantity = newQuantity;
        updateCartDisplay();
    } else {
        showNotification(`Only ${maxStock} available`, 'error');
    }
};

window.removeFromCart = function (index) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    updateCartDisplay();
    showNotification(`Removed ${removedItem.name}`, 'info');
};

window.changeQuantity = function (itemId, change) {
    const input = document.getElementById(`qty-${itemId}`);
    if (!input) return;

    const currentValue = parseInt(input.value) || 1;
    const max = parseInt(input.max) || 1;
    const newValue = Math.max(1, Math.min(max, currentValue + change));
    input.value = newValue;
};

window.addToCart = function (itemId, itemName, itemPrice, maxStock) {
    const quantityInput = document.getElementById(`qty-${itemId}`);
    const quantity = parseInt(quantityInput.value) || 1;

    if (quantity > maxStock) {
        showNotification(`Only ${maxStock} available`, 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === itemId);
    if (existingItem) {
        const newTotal = existingItem.quantity + quantity;
        if (newTotal <= maxStock) {
            existingItem.quantity = newTotal;
        } else {
            showNotification(`Only ${maxStock} available`, 'error');
            return;
        }
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: itemPrice,
            quantity: quantity,
            maxStock: maxStock
        });
    }

    quantityInput.value = 1;
    updateCartDisplay();
    showNotification('Added to cart!', 'success');
};



// ============================================
// ORDER STATUS DISPLAY
// ============================================
function updateOrderStatusDisplay() {
    const orderStatus = document.getElementById('orderStatus');
    if (!orderStatus) return;

    // Show all orders now (no filtering)
    const displayOrders = activeOrders;

    if (displayOrders.length === 0) {
        orderStatus.innerHTML = '<div class="empty-state"><p>No orders yet</p></div>';
        return;
    }

    let ordersHTML = displayOrders.map(order => {
        const itemsList = order.items.map(item =>
            `<div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>${item.name} × ${item.quantity}</span>
                <span>₱${item.total.toFixed(2)}</span>
            </div>`
        ).join('');

        let paymentBadge = '';
        if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
            paymentBadge = '<span class="payment-status-badge payment-pending">⏳ Waiting for Payment</span>';
        } else if (order.paymentStatus === 'paid') {
            paymentBadge = '<span class="payment-status-badge payment-paid">✅ Paid</span>';
        }

        // Show cancel reason if cancelled
        let cancelInfo = '';
        if (order.status === 'cancelled' && order.cancelReason) {
            cancelInfo = `<div style="background: #f8d7da; padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 0.9rem; color: #721c24;">
                <strong>❌ Cancelled</strong><br>
                <span style="font-size: 0.85rem;">Reason: ${order.cancelReason}</span>
            </div>`;
        }

        return `
            <div style="background: #f8f9fa; border: 2px solid #e0e0e0; border-radius: 20px; padding: 20px; margin-bottom: 15px;">
                <div style="font-weight: bold; font-size: 1.2rem; margin-bottom: 10px; color: #BA8E4A;">
                    Table ${order.tableNumber} - Ref #${order.referenceNumber}
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;">
                    <div class="status-badge status-${order.status}">
                        ${getStatusText(order.status)}
                    </div>
                    ${paymentBadge}
                </div>
                
                ${cancelInfo}
                
                <div style="text-align: left;">
                    ${itemsList}
                    <hr style="margin: 15px 0; border: none; border-top: 2px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                        <span>Total:</span>
                        <span style="color: #BA8E4A;">₱${order.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    orderStatus.innerHTML = ordersHTML;
}

function getStatusText(status) {
    const texts = {
        'pending': 'Pending',
        'preparing': 'Preparing',
        'ready': 'Ready!',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'pending_payment': 'Waiting for Payment'
    };
    return texts[status] || status;
}

// ============================================
// NOTIFICATION
// ============================================
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: bold;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
// ============================================
// PAYMONGO CONFIGURATION
// ============================================
const PAYMONGO_PUBLIC_KEY = 'pk_test_EUwUco4SbCdTki5To8xLyuVv';

// ============================================
// PAYMENT METHOD SELECTION
// ============================================
let selectedPaymentMethod = 'cash';

window.selectPaymentMethod = function (method) {
    selectedPaymentMethod = method;

    document.getElementById('cashBtn').classList.toggle('active', method === 'cash');
    document.getElementById('gcashBtn').classList.toggle('active', method === 'gcash');

    document.getElementById('cashPaymentFields').style.display = method === 'cash' ? 'block' : 'none';
    document.getElementById('gcashPaymentFields').style.display = method === 'gcash' ? 'block' : 'none';

    const btn = document.getElementById('processOrderBtn');
    btn.textContent = method === 'cash' ? 'Confirm Order' : 'Pay with GCash';
};

// ============================================
// PAYMENT MODAL
// ============================================
window.openPaymentModal = function () {
    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('paymentTotal').value = `₱${total.toFixed(2)}`;
    document.getElementById('paymentModal').classList.add('active');

    // Reset to defaults
    selectPaymentMethod('cash');
    selectOrderType('dine-in');
};

window.closePaymentModal = function () {
    document.getElementById('paymentModal').classList.remove('active');
};

// ============================================
// PAYMONGO GCASH INTEGRATION
// ============================================
async function createGCashPayment(orderData) {
    try {
        showNotification('Setting up GCash payment...', 'info');

        const amount = Math.round(orderData.totalAmount * 100);

        const response = await fetch('https://api.paymongo.com/v1/sources', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(PAYMONGO_PUBLIC_KEY + ':')
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        type: 'gcash',
                        amount: amount,
                        currency: 'PHP',
                        redirect: {
                            success: window.location.href.split('&payment')[0] + '&payment=success&order=' + orderData.referenceNumber,
                            failed: window.location.href.split('&payment')[0] + '&payment=failed'
                        }
                    }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.errors?.[0]?.detail || 'GCash payment setup failed');
        }

        const sourceId = data.data.id;
        const checkoutUrl = data.data.attributes.redirect.checkout_url;

        await savePendingGCashOrder(orderData, sourceId);
        closePaymentModal();

        // Simply redirect to GCash checkout
        showNotification('Redirecting to GCash...', 'info');
        setTimeout(() => {
            window.location.href = checkoutUrl;
        }, 1000);

        return null;

    } catch (error) {
        console.error('GCash Payment Error:', error);
        showNotification('GCash payment setup failed: ' + error.message, 'error');
        return { success: false };
    }
}

async function savePendingGCashOrder(orderData, sourceId) {
    const order = {
        tableNumber: orderData.tableNumber,
        referenceNumber: orderData.referenceNumber,
        items: orderData.items.map(item => ({
            ...item,
            isCafe: item.isCafe || false,
            size: item.size || null
        })),
        totalAmount: orderData.totalAmount,
        paymentMethod: 'gcash',
        paymentSourceId: sourceId,
        paymentStatus: 'pending',
        orderType: selectedOrderType,
        status: 'pending_payment',
        timestamp: Timestamp.now(),
        queuePosition: await getNextQueuePosition()
    };

    await addDoc(collection(db, 'orders'), order);

    sessionStorage.setItem('pendingGCashOrder', JSON.stringify({
        referenceNumber: orderData.referenceNumber,
        sourceId: sourceId,
        items: orderData.items
    }));
}

// ============================================
// CHECK GCASH PAYMENT STATUS ON PAGE LOAD
// ============================================

// ============================================
// CHECK GCASH PAYMENT STATUS ON PAGE LOAD
// ============================================
async function checkGCashPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderRef = urlParams.get('order');

    if (!paymentStatus) return;

    const pendingOrderStr = sessionStorage.getItem('pendingGCashOrder');
    if (!pendingOrderStr) return;

    const pendingOrder = JSON.parse(pendingOrderStr);

    if (paymentStatus === 'success' && orderRef === pendingOrder.referenceNumber) {
        try {
            const response = await fetch(`https://api.paymongo.com/v1/sources/${pendingOrder.sourceId}`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(PAYMONGO_PUBLIC_KEY + ':')
                }
            });

            const data = await response.json();
            const status = data.data.attributes.status;

            if (status === 'chargeable' || status === 'paid') {
                const ordersQuery = query(
                    collection(db, 'orders'),
                    where('referenceNumber', '==', pendingOrder.referenceNumber)
                );
                const ordersSnapshot = await getDocs(ordersQuery);

                if (!ordersSnapshot.empty) {
                    const orderDoc = ordersSnapshot.docs[0];
                    const orderDocRef = doc(db, 'orders', orderDoc.id);
                    const orderData = orderDoc.data();

                    await updateDoc(orderDocRef, {
                        paymentStatus: 'paid',
                        status: 'pending',
                        paidAt: Timestamp.now()
                    });

                    // Handle both regular and cafe items
                    for (const item of orderData.items) {
                        const collectionName = item.isCafe ? 'cafe_inventory' : 'inventory';
                        const inventoryRef = doc(db, collectionName, item.inventoryId);
                        const inventoryDoc = await getDoc(inventoryRef);

                        if (inventoryDoc.exists()) {
                            const currentStock = inventoryDoc.data().stock;
                            const newStock = currentStock - item.quantity;
                            await updateDoc(inventoryRef, {
                                stock: newStock,
                                status: newStock > 0 ? 'available' : 'unavailable'
                            });
                        }
                    }

                    const updatedOrder = { id: orderDoc.id, ...orderData, paymentStatus: 'paid', status: 'pending' };
                    activeOrders.push(updatedOrder);
                    saveActiveOrders();
                    listenToOrder(orderDoc.id);
                    updateOrderStatusDisplay();

                    showNotification('✅ GCash payment successful! Order #' + pendingOrder.referenceNumber, 'success');
                    
                    sessionStorage.removeItem('pendingGCashOrder');
                    window.history.replaceState({}, document.title, window.location.pathname + '?table=' + tableNumber);
                    sessionStorage.setItem('switchToOrdersTab', 'true');
                }
            } else if (status === 'failed' || status === 'expired') {
                showNotification('❌ GCash payment failed or expired', 'error');
                sessionStorage.removeItem('pendingGCashOrder');
                window.history.replaceState({}, document.title, window.location.pathname + '?table=' + tableNumber);
            }

        } catch (error) {
            console.error('Error verifying GCash payment:', error);
            showNotification('Error verifying payment status', 'error');
        }

    } else if (paymentStatus === 'failed') {
        showNotification('❌ GCash payment was cancelled or failed', 'error');
        sessionStorage.removeItem('pendingGCashOrder');
        window.history.replaceState({}, document.title, window.location.pathname + '?table=' + tableNumber);
    }
}
// Find this section in checkGCashPaymentStatus and update the stock deduction part:

if (status === 'chargeable' || status === 'paid') {
    const ordersQuery = query(
        collection(db, 'orders'),
        where('referenceNumber', '==', pendingOrder.referenceNumber)
    );
    const ordersSnapshot = await getDocs(ordersQuery);

    if (!ordersSnapshot.empty) {
        const orderDoc = ordersSnapshot.docs[0];
        const orderDocRef = doc(db, 'orders', orderDoc.id);
        const orderData = orderDoc.data();

        await updateDoc(orderDocRef, {
            paymentStatus: 'paid',
            status: 'pending',
            paidAt: Timestamp.now()
        });

        // UPDATE THIS PART - Handle both regular and cafe items
        for (const item of orderData.items) {
            const collectionName = item.isCafe ? 'cafe_inventory' : 'inventory';
            const inventoryRef = doc(db, collectionName, item.inventoryId);
            const inventoryDoc = await getDoc(inventoryRef);

            if (inventoryDoc.exists()) {
                const currentStock = inventoryDoc.data().stock;
                const newStock = currentStock - item.quantity;
                await updateDoc(inventoryRef, {
                    stock: newStock,
                    status: newStock > 0 ? 'available' : 'unavailable'
                });
            }
        }

        const updatedOrder = { id: orderDoc.id, ...orderData, paymentStatus: 'paid', status: 'pending' };
        activeOrders.push(updatedOrder);
        saveActiveOrders();
        listenToOrder(orderDoc.id);
        updateOrderStatusDisplay();

        showNotification('✅ GCash payment successful! Order #' + pendingOrder.referenceNumber, 'success');
        
        window.history.replaceState({}, document.title, window.location.pathname + '?table=' + tableNumber);
        sessionStorage.setItem('switchToOrdersTab', 'true');
    }
}

// ============================================
// PROCESS ORDER (UPDATED)
// ============================================
window.processOrder = async function () {
    const total = parseFloat(document.getElementById('paymentTotal').value.replace('₱', ''));

    if (selectedPaymentMethod === 'cash') {
        await createOrder({
            paymentMethod: 'cash',
            amountPaid: 0,
            change: 0,
            paymentStatus: 'pending'
        });

    } else if (selectedPaymentMethod === 'gcash') {
        const orderData = {
            totalAmount: total,
            referenceNumber: 'JCR' + Date.now().toString().slice(-6),
            tableNumber: tableNumber,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity,
                inventoryId: item.id,
                isCafe: item.isCafe || false,
                size: item.size || null
            }))
        };

        await createGCashPayment(orderData);
    }
};

// ============================================
// CREATE ORDER
// ============================================
async function createOrder(paymentData) {
    // Validate stock for both regular and cafe items
    for (const cartItem of cart) {
        if (cartItem.isCafe) {
            const cafeItem = cafeItems.find(c => c.id === cartItem.id);
            if (!cafeItem || cafeItem.stock < cartItem.quantity) {
                showNotification(`Not enough stock for ${cartItem.name}`, 'error');
                return;
            }
        } else {
            const menuItem = menuItems.find(m => m.id === cartItem.id);
            if (!menuItem || menuItem.stock < cartItem.quantity) {
                showNotification(`Not enough stock for ${cartItem.name}`, 'error');
                return;
            }
        }
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const order = {
        tableNumber: tableNumber,
        referenceNumber: 'JCR' + Date.now().toString().slice(-6),
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            inventoryId: item.id,
            isCafe: item.isCafe || false,
            size: item.size || null
        })),
        totalAmount: total,
        paymentMethod: paymentData.paymentMethod,
        paymentStatus: paymentData.paymentStatus || 'completed',
        amountPaid: paymentData.amountPaid,
        change: paymentData.change,
        orderType: selectedOrderType,
        status: 'pending',
        timestamp: Timestamp.now(),
        queuePosition: await getNextQueuePosition()
    };

    const docRef = await addDoc(collection(db, 'orders'), order);
    const newOrder = { id: docRef.id, ...order };

    // Update stock for both regular and cafe items
    if (paymentData.paymentMethod === 'cash') {
        for (const item of order.items) {
            const collectionName = item.isCafe ? 'cafe_inventory' : 'inventory';
            const inventoryRef = doc(db, collectionName, item.inventoryId);
            const inventoryDoc = await getDoc(inventoryRef);

            if (inventoryDoc.exists()) {
                const currentStock = inventoryDoc.data().stock;
                const newStock = currentStock - item.quantity;
                await updateDoc(inventoryRef, {
                    stock: newStock,
                    status: newStock > 0 ? 'available' : 'unavailable'
                });
            }
        }
    }

    activeOrders.push(newOrder);
    saveActiveOrders();
    listenToOrder(docRef.id);

    cart = [];
    updateCartDisplay();
    closePaymentModal();
    updateOrderStatusDisplay();

    showNotification('Order placed successfully!', 'success');
    
    setTimeout(() => {
        switchTab('orders');
    }, 1500);
}

// ============================================
// GET NEXT QUEUE POSITION
// ============================================
async function getNextQueuePosition() {
    try {
        const ordersSnapshot = await getDocs(query(
            collection(db, 'orders'),
            where('status', 'in', ['pending', 'preparing', 'pending_payment'])
        ));
        return ordersSnapshot.size + 1;
    } catch (error) {
        console.error('Error getting queue position:', error);
        return 1;
    }
}

// ============================================
// FEEDBACK SYSTEM
// ============================================
let selectedRating = 0;

window.openFeedbackModal = function () {
    document.getElementById('feedbackModal').classList.add('active');
    setupStarRating();
};

window.closeFeedbackModal = function () {
    document.getElementById('feedbackModal').classList.remove('active');
    resetFeedback();
};

function setupStarRating() {
    const stars = document.querySelectorAll('.star');
    const ratingText = document.getElementById('ratingText');

    const ratingTexts = {
        1: '⭐ Poor',
        2: '⭐⭐ Fair',
        3: '⭐⭐⭐ Good',
        4: '⭐⭐⭐⭐ Very Good',
        5: '⭐⭐⭐⭐⭐ Excellent!'
    };

    stars.forEach(star => {
        star.addEventListener('click', function () {
            selectedRating = parseInt(this.dataset.rating);

            stars.forEach(s => {
                const starRating = parseInt(s.dataset.rating);
                if (starRating <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });

            ratingText.textContent = ratingTexts[selectedRating];
            ratingText.style.color = selectedRating >= 4 ? '#28a745' : selectedRating >= 3 ? '#ffc107' : '#dc3545';
        });

        star.addEventListener('mouseenter', function () {
            const hoverRating = parseInt(this.dataset.rating);
            stars.forEach(s => {
                const starRating = parseInt(s.dataset.rating);
                if (starRating <= hoverRating) {
                    s.style.opacity = '1';
                    s.style.filter = 'grayscale(0%)';
                }
            });
        });

        star.addEventListener('mouseleave', function () {
            stars.forEach(s => {
                const starRating = parseInt(s.dataset.rating);
                if (starRating <= selectedRating) {
                    s.style.opacity = '1';
                    s.style.filter = 'grayscale(0%)';
                } else {
                    s.style.opacity = '0.3';
                    s.style.filter = 'grayscale(100%)';
                }
            });
        });
    });
}

window.submitFeedback = async function () {
    if (selectedRating === 0) {
        showNotification('Please select a rating', 'error');
        return;
    }

    const comment = document.getElementById('feedbackComment').value.trim();

    try {
        const feedback = {
            tableNumber: tableNumber,
            rating: selectedRating,
            comment: comment || '',
            timestamp: Timestamp.now(),
            date: new Date().toISOString()
        };

        await addDoc(collection(db, 'feedback'), feedback);

        showNotification('Thank you for your feedback! 🙏', 'success');
        closeFeedbackModal();

    } catch (error) {
        console.error('Error submitting feedback:', error);
        showNotification('Failed to submit feedback', 'error');
    }
};

function resetFeedback() {
    selectedRating = 0;
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
        star.style.opacity = '0.3';
        star.style.filter = 'grayscale(100%)';
    });
    document.getElementById('ratingText').textContent = '';
    document.getElementById('feedbackComment').value = '';
}