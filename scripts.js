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
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let cart = [];
let activeOrders = [];
let tableNumber = null;
let menuItems = [];

// ============================================
// TABLE NUMBER SETUP
// ============================================
function getTableNumber() {
    const urlParams = new URLSearchParams(window.location.search);
    let table = urlParams.get('table');
    
    if (!table) {
        table = prompt('Please enter your table number:');
        if (table) window.location.href = `${window.location.pathname}?table=${table}`;
    }
    return table;
}

// ============================================
// ACTIVE ORDERS - SAVE/LOAD
// ============================================
function saveActiveOrders() {
    const ordersToSave = activeOrders.filter(o => o.status !== 'completed');
    sessionStorage.setItem('activeOrders', JSON.stringify(ordersToSave));
}

function loadActiveOrders() {
    const saved = sessionStorage.getItem('activeOrders');
    if (saved) {
        activeOrders = JSON.parse(saved).filter(o => o.status !== 'completed');
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
        
        // Update or add order
        index >= 0 ? activeOrders[index] = updatedOrder : activeOrders.push(updatedOrder);
        
        saveActiveOrders();
        updateOrderStatusDisplay();
        
        // Show notification on status change
        if (oldStatus && oldStatus !== updatedOrder.status) showStatusNotification(updatedOrder);
        
        // Auto-remove completed orders after 5 seconds
        if (updatedOrder.status === 'completed') setTimeout(() => removeCompletedOrder(orderId), 5000);
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
// INITIALIZE APP
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    tableNumber = getTableNumber();
    loadActiveOrders();
    await loadCategories();
    await loadMenuItems('all-meals');
    updateCartDisplay();
    setupRealtimeMenuListener();
});

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
document.getElementById('searchInput').addEventListener('input', function(e) {
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
}

// ============================================
// LOAD CATEGORIES
// ============================================
async function loadCategories() {
    const grid = document.getElementById('categoriesGrid');
    const container = document.getElementById('categoriesContainer');
    
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const categories = [];
    categoriesSnapshot.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));

    container.style.display = categories.length === 0 ? 'none' : 'block';
    if (categories.length === 0) return;
    
    grid.innerHTML = '';
    categories.forEach(category => {
        const btn = document.createElement('div');
        btn.className = 'category-btn';
        btn.onclick = () => loadMenuItems(category.id);
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

    // Get category name
    const categoryDoc = await getDocs(collection(db, 'categories'));
    const categories = [];
    categoryDoc.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
    
    const category = categories.find(c => c.id === categoryId);
    title.textContent = category ? category.name : 'Menu Items';

    // Get menu items
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
// CART FUNCTIONS
// ============================================
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
        cartTotal.textContent = 'Total: ₱0.00';
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
}

window.updateCartQuantity = function(index, change) {
    const item = cart[index];
    const menuItem = menuItems.find(m => m.id === item.id);
    const maxStock = menuItem ? menuItem.stock : item.maxStock;
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

window.removeFromCart = function(index) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    updateCartDisplay();
    showNotification(`Removed ${removedItem.name}`, 'info');
};

window.changeQuantity = function(itemId, change) {
    const input = document.getElementById(`qty-${itemId}`);
    if (!input) return;
    
    const currentValue = parseInt(input.value) || 1;
    const max = parseInt(input.max) || 1;
    const newValue = Math.max(1, Math.min(max, currentValue + change));
    input.value = newValue;
};

window.addToCart = function(itemId, itemName, itemPrice, maxStock) {
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
// PAYMENT MODAL
// ============================================
window.openPaymentModal = function() {
    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('paymentTotal').value = `₱${total.toFixed(2)}`;
    document.getElementById('amountPaid').value = '';
    document.getElementById('changeAmount').value = '';
    document.getElementById('paymentModal').classList.add('active');
};

window.closePaymentModal = function() {
    document.getElementById('paymentModal').classList.remove('active');
};

document.getElementById('amountPaid').addEventListener('input', function() {
    const total = parseFloat(document.getElementById('paymentTotal').value.replace('₱', ''));
    const paid = parseFloat(this.value) || 0;
    const change = paid - total;
    const changeField = document.getElementById('changeAmount');

    if (change >= 0) {
        changeField.value = `₱${change.toFixed(2)}`;
        changeField.style.color = '#28a745';
    } else {
        changeField.value = 'Insufficient amount';
        changeField.style.color = '#dc3545';
    }
});

// ============================================
// PROCESS ORDER
// ============================================
window.processOrder = async function() {
    const total = parseFloat(document.getElementById('paymentTotal').value.replace('₱', ''));
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;

    if (paid < total) {
        showNotification('Insufficient payment!', 'error');
        return;
    }

    // Validate stock availability
    for (const cartItem of cart) {
        const menuItem = menuItems.find(m => m.id === cartItem.id);
        if (!menuItem || menuItem.stock < cartItem.quantity) {
            showNotification(`Not enough stock for ${cartItem.name}`, 'error');
            return;
        }
    }

    // Create order
    const order = {
        tableNumber: tableNumber,
        referenceNumber: 'JCR' + Date.now().toString().slice(-6),
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            inventoryId: item.id
        })),
        totalAmount: total,
        amountPaid: paid,
        change: paid - total,
        status: 'pending',
        timestamp: Timestamp.now(),
        queuePosition: await getNextQueuePosition()
    };

    const docRef = await addDoc(collection(db, 'orders'), order);
    const newOrder = { id: docRef.id, ...order };

    // Add to active orders and listen
    activeOrders.push(newOrder);
    saveActiveOrders();
    listenToOrder(docRef.id);

    // Update inventory
    for (const cartItem of cart) {
        const menuItem = menuItems.find(m => m.id === cartItem.id);
        if (menuItem) {
            const newStock = menuItem.stock - cartItem.quantity;
            await updateDoc(doc(db, 'inventory', cartItem.id), {
                stock: newStock,
                status: newStock > 0 ? 'available' : 'unavailable'
            });
        }
    }

    // Reset cart and close modal
    cart = [];
    updateCartDisplay();
    closePaymentModal();
    updateOrderStatusDisplay();
    showNotification('Order placed successfully!', 'success');
};

async function getNextQueuePosition() {
    const ordersSnapshot = await getDocs(query(
        collection(db, 'orders'),
        where('status', 'in', ['pending', 'preparing'])
    ));
    return ordersSnapshot.size + 1;
}

// ============================================
// ORDER STATUS DISPLAY
// ============================================
function updateOrderStatusDisplay() {
    const orderStatus = document.getElementById('orderStatus');
    if (!orderStatus) return;

    const displayOrders = activeOrders.filter(o => o.status !== 'completed');

    if (displayOrders.length === 0) {
        orderStatus.classList.remove('active');
        return;
    }

    let ordersHTML = displayOrders.map(order => {
        const itemsList = order.items.map(item =>
            `<div style="display: flex; justify-content: space-between; margin: 5px 0;">
                <span>${item.name} × ${item.quantity}</span>
                <span>₱${item.total.toFixed(2)}</span>
            </div>`
        ).join('');

        return `
            <div style="background: #fff; border-radius: 10px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 10px; color: #BA8E4A;">
                    Table ${order.tableNumber} - Ref #${order.referenceNumber}
                </div>
                
                <div class="status-badge status-${order.status}" style="margin-bottom: 15px;">
                    ${getStatusText(order.status)}
                </div>
                
                <div style="text-align: left;">
                    ${itemsList}
                    <hr style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Total:</span>
                        <span>₱${order.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    orderStatus.innerHTML = `<div style="max-height: 400px; overflow-y: auto;">${ordersHTML}</div>`;
    orderStatus.classList.add('active');
}

function getStatusText(status) {
    const texts = {
        'pending': '⏳ Pending',
        'preparing': '👨‍🍳 Preparing',
        'ready': '✅ Ready!',
        'completed': '🎉 Completed'
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