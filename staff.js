import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    orderBy,
    query
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let orders = [];
let currentFilter = 'all';
let currentStaffId = null;

// ============================================
// CHECK SESSION ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', function () {
    const staffSession = sessionStorage.getItem('staffSession');

    if (staffSession) {
        const sessionData = JSON.parse(staffSession);
        currentStaffId = sessionData.staffId;

        // Auto-login if session exists
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
    const staffId = document.getElementById('staffId').value.trim();
    const password = document.getElementById('password').value.trim();

    const usersSnapshot = await getDocs(collection(db, 'users'));
    let authenticated = false;
    let staffName = '';

    usersSnapshot.forEach(doc => {
        const user = doc.data();
        if (user.username === staffId && user.password === password && user.role === 'staff') {
            authenticated = true;
            staffName = user.name || staffId;
        }
    });

    if (authenticated) {
        const sessionData = {
            staffId: staffId,
            staffName: staffName,
            loginTime: new Date().toISOString(),
            role: 'staff'
        };
        sessionStorage.setItem('staffSession', JSON.stringify(sessionData));
        currentStaffId = staffId;

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        await initializeDashboard();

        showNotification(`Welcome back, ${staffName}!`, 'success');
    } else {
        showError('Invalid staff ID or password!');
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

window.logout = function () {
    sessionStorage.removeItem('staffSession');
    currentStaffId = null;

    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('staffId').value = '';
    document.getElementById('password').value = '';

    showNotification('Logged out successfully!', 'info');
};

// ============================================
// INITIALIZE DASHBOARD
// ============================================
async function initializeDashboard() {
    const staffSession = sessionStorage.getItem('staffSession');
    if (staffSession) {
        const sessionData = JSON.parse(staffSession);
        const welcomeMsg = document.getElementById('staffWelcome');
        if (welcomeMsg) {
            welcomeMsg.textContent = `Welcome, ${sessionData.staffName || sessionData.staffId}`;
        }
    }

    await loadOrders();
    updateStats();
    setupFilters();
    setupRealtimeListeners();
}

// ============================================
// SETUP FILTERS
// ============================================
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => b.classList.remove('active'));

            this.classList.add('active');

            currentFilter = this.dataset.status;

            renderOrders();
        });
    });
}

// ============================================
// UPDATE FILTER COUNTS
// ============================================
function updateFilterCounts() {
    const allCount = orders.filter(o => o.status !== 'completed').length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const readyCount = orders.filter(o => o.status === 'ready').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    document.getElementById('countAll').textContent = allCount;
    document.getElementById('countPending').textContent = pendingCount;
    document.getElementById('countPreparing').textContent = preparingCount;
    document.getElementById('countReady').textContent = readyCount;
    document.getElementById('countCompleted').textContent = completedCount;
}

// ============================================
// LOAD & RENDER ORDERS
// ============================================
async function loadOrders() {
    const ordersQuery = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(ordersQuery);

    orders = [];
    snapshot.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        orders.push(order);
    });

    renderOrders();
    updateStats();
    updatePrepQueue();
    updateFilterCounts();
}

function renderOrders() {
    const container = document.getElementById('ordersContainer');
    let filteredOrders;

    if (currentFilter === 'all') {
        filteredOrders = orders.filter(order => order.status !== 'completed' && order.status !== 'cancelled');
    } else {
        filteredOrders = orders.filter(order => order.status === currentFilter);
    }

    filteredOrders.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <div class="empty-message">No ${currentFilter === 'all' ? '' : currentFilter} orders</div>
                <div class="empty-description">${currentFilter === 'all' ? 'New orders will appear here automatically' : 'No orders with this status'}</div>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    filteredOrders.forEach(order => {
        container.appendChild(createOrderElement(order));
    });
}

function createOrderElement(order) {
    const div = document.createElement('div');
    div.className = `order-card ${order.status}`;

    const orderTime = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
    const timeAgo = getTimeAgo(orderTime);

    const itemsList = order.items.map(item => `
        <div class="order-item">
            <span class="item-name">${item.name}</span>
            <span class="item-quantity">×${item.quantity}</span>
            <span class="item-price">₱${item.total.toFixed(2)}</span>
        </div>
    `).join('');

    let paymentBadge = '';
    if (order.paymentMethod === 'gcash') {
        paymentBadge = '<span class="payment-badge payment-gcash">💙 PAID - GCASH</span>';
    } else if (order.paymentMethod === 'cash' && order.paymentStatus === 'paid') {
        paymentBadge = '<span class="payment-badge payment-cash-paid">💵 PAID - CASH</span>';
    } else if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
        paymentBadge = '<span class="payment-badge payment-cash-pending">⏳ UNPAID - Pay at Counter</span>';
    }

    div.innerHTML = `
        <div class="order-header">
            <div class="order-number">Table ${order.tableNumber}</div>
            <div class="order-time">${timeAgo}</div>
        </div>
        
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">
            Ref: ${order.referenceNumber} | Queue: #${order.queuePosition || '-'}
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
            <div class="status-badge status-${order.status}">
                ${getStatusText(order.status)}
            </div>
            ${paymentBadge}
        </div>
        
        <div class="order-items">
            ${itemsList}
        </div>
        
        <div class="order-total">
            <span>Total:</span>
            <span>₱${order.totalAmount.toFixed(2)}</span>
        </div>
        
        <div class="order-actions">
            ${getActionButtons(order)}
        </div>
    `;

    return div;
}

function getStatusText(status) {
    const statusTexts = {
        'pending': 'Pending Confirmation',
        'preparing': 'Preparing',
        'ready': 'Ready for Pickup',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusTexts[status] || status;
}

function getActionButtons(order) {
    let buttons = '';

    if (order.status === 'completed' || order.status === 'cancelled') {
        return '';
    }

    if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
        buttons += `<button class="action-btn btn-mark-paid" onclick="markAsPaid('${order.id}')">💵 Mark as Paid</button>`;
    }

    switch (order.status) {
        case 'pending':
            buttons += `<button class="action-btn btn-accept" onclick="updateOrderStatus('${order.id}', 'preparing')">👨‍🍳 Start Preparing</button>`;
            buttons += `<button class="action-btn btn-cancel" onclick="cancelOrder('${order.id}')">❌ Cancel Order</button>`;
            break;
        case 'preparing':
            buttons += `<button class="action-btn btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')">✅ Mark as Ready</button>`;
            break;
        case 'ready':
            buttons += `<button class="action-btn btn-complete" onclick="updateOrderStatus('${order.id}', 'completed')">🎉 Complete Order</button>`;
            break;
    }

    return buttons;
}

// ============================================
// MARK AS PAID (for cash orders)
// ============================================
window.markAsPaid = async function (orderId) {
    const orderRef = doc(db, 'orders', orderId);

    await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paidAt: new Date()
    });

    showNotification('Order marked as paid!', 'success');
};

// ============================================
// CANCEL ORDER
// ============================================
window.cancelOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) {
        return;
    }

    const orderRef = doc(db, 'orders', orderId);

    await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: currentStaffId
    });

    showNotification('Order cancelled successfully!', 'info');
};

// ============================================
// UPDATE ORDER STATUS
// ============================================
window.updateOrderStatus = async function (orderId, newStatus) {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
        showNotification('Order not found', 'error');
        return;
    }

    const orderData = orderSnap.data();

    await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date()
    });

    if (newStatus === 'completed' && orderData && orderData.items) {
        for (const item of orderData.items) {
            if (item.inventoryId) {
                const inventoryRef = doc(db, 'inventory', item.inventoryId);
                const inventorySnap = await getDoc(inventoryRef);

                if (inventorySnap.exists()) {
                    const currentStock = inventorySnap.data().stock || 0;
                    const newStock = Math.max(0, currentStock - item.quantity);
                    await updateDoc(inventoryRef, { stock: newStock });
                }
            }
        }
    }

    showNotification(`Order updated to ${getStatusText(newStatus)}!`, 'success');
};

// ============================================
// STATS & PREP QUEUE
// ============================================
function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(order => {
        const orderDate = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        return orderDate >= today;
    });

    const pendingCount = orders.filter(order => order.status === 'pending').length;
    const preparingCount = orders.filter(order => order.status === 'preparing').length;
    const readyCount = orders.filter(order => order.status === 'ready').length;

    document.getElementById('totalOrdersToday').textContent = todayOrders.length;
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('preparingCount').textContent = preparingCount;
    document.getElementById('readyCount').textContent = readyCount;
}

function updatePrepQueue() {
    const prepQueue = document.getElementById('prepQueue');
    const preparingOrders = orders.filter(order => order.status === 'preparing');

    if (preparingOrders.length === 0) {
        prepQueue.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👨‍🍳</div>
                <div class="empty-message">Kitchen is clear!</div>
                <div class="empty-description">All orders are up to date</div>
            </div>
        `;
        return;
    }

    prepQueue.innerHTML = '';
    preparingOrders.forEach(order => {
        const orderTime = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        const prepTime = getTimeAgo(orderTime);
        const itemsText = order.items.map(item => `${item.name} (×${item.quantity})`).join(', ');

        const paymentIcon = order.paymentMethod === 'gcash' ? '💙' : '💵';
        const paymentStatus = order.paymentStatus === 'paid' ? '✅' : '⏳';

        const prepItem = document.createElement('div');
        prepItem.className = 'prep-item';
        prepItem.innerHTML = `
            <div class="prep-info">
                <div class="prep-order-number">
                    Table ${order.tableNumber} - Ref: ${order.referenceNumber} 
                    <span style="font-size: 0.9rem;">${paymentIcon} ${paymentStatus}</span>
                </div>
                <div class="prep-items-list">${itemsText}</div>
            </div>
            <div class="prep-time">${prepTime}</div>
        `;
        prepQueue.appendChild(prepItem);
    });
}

// ============================================
// REALTIME LISTENERS
// ============================================
function setupRealtimeListeners() {
    const ordersQuery = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    onSnapshot(ordersQuery, (snapshot) => {
        const newOrders = [];
        snapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            newOrders.push(order);
        });

        const previousOrderIds = orders.map(order => order.id);
        const newOrderIds = newOrders.map(order => order.id);
        const hasNewOrders = newOrderIds.some(id => !previousOrderIds.includes(id));

        if (hasNewOrders && orders.length > 0) {
            showNotification('New order received!', 'info');
        }

        orders = newOrders;
        updateFilterCounts();
        renderOrders();
        updateStats();
        updatePrepQueue();
    });
}

// ============================================
// UTILITIES
// ============================================
function getTimeAgo(date) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
}

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
    }, 4000);
}