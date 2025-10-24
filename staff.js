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
    query,
    where,
    Timestamp,
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let currentCancelOrderId = null;
let orders = [];
let currentFilter = 'all';
let currentStaffId = null;
let autoCancelIntervals = new Map(); // Track auto-cancel timers
let staffInventoryItems = [];
let staffCafeInventoryItems = [];
let staffNotifications = [];
let currentStaffSort = { column: null, ascending: true };
let currentStaffCafeSort = { column: null, ascending: true };

// ============================================
// CHECK SESSION ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', function () {
    const staffSession = sessionStorage.getItem('staffSession');

    if (!staffSession) {
        // No session, redirect to login
        window.location.href = 'login.html';
        return;
    }

    // Valid staff session
    const sessionData = JSON.parse(staffSession);
    currentStaffId = sessionData.staffId;

    // Show dashboard
    document.getElementById('dashboard').classList.add('active');
    initializeDashboard();
});


window.logout = function () {
    sessionStorage.removeItem('staffSession');
    window.location.href = 'login.html';
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
    checkUnpaidOrders(); // Check for unpaid orders on load
    setupStaffNavigation();
    await loadStaffInventory();
    await loadStaffNotifications();
    setupStaffRealtimeListeners();
    await loadStaffInventory();
    await loadStaffCafeInventory();
}

// ============================================
// SETUP FILTERS
// ============================================
// ============================================
// SETUP FILTERS
// ============================================
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const dateFilter = document.getElementById('dateFilter');
    const dateFilterType = document.getElementById('dateFilterType');
    const customDate = document.getElementById('customDate');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;

            // Show date filter only for completed/cancelled
            if (currentFilter === 'completed' || currentFilter === 'cancelled') {
                dateFilter.style.display = 'block';
            } else {
                dateFilter.style.display = 'none';
            }

            renderOrders();
        });
    });

    // Date filter change
    dateFilterType.addEventListener('change', function () {
        if (this.value === 'custom') {
            customDate.style.display = 'block';
            customDate.valueAsDate = new Date();
        } else {
            customDate.style.display = 'none';
        }
        renderOrders();
    });

    customDate.addEventListener('change', function () {
        renderOrders();
    });
}

// ============================================
// UPDATE FILTER COUNTS
// ============================================
function updateFilterCounts() {
    const allCount = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const readyCount = orders.filter(o => o.status === 'ready').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

    document.getElementById('countAll').textContent = allCount;
    document.getElementById('countPending').textContent = pendingCount;
    document.getElementById('countPreparing').textContent = preparingCount;
    document.getElementById('countReady').textContent = readyCount;
    document.getElementById('countCompleted').textContent = completedCount;

    // Update cancelled count if element exists
    const cancelledCountEl = document.getElementById('countCancelled');
    if (cancelledCountEl) {
        cancelledCountEl.textContent = cancelledCount;
    }
}

// ============================================
// CHECK UNPAID ORDERS (30 MIN AUTO-CANCEL)
// ============================================
function checkUnpaidOrders() {
    const unpaidOrders = orders.filter(order =>
        order.paymentStatus === 'pending' &&
        order.status !== 'cancelled' &&
        order.status !== 'completed'
    );

    unpaidOrders.forEach(order => {
        const orderTime = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        const timeDiff = Date.now() - orderTime.getTime();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

        if (timeDiff >= thirtyMinutes) {
            // Auto-cancel immediately if already past 30 minutes
            autoCancelOrder(order.id, 'Payment timeout - 30 minutes exceeded');
        } else {
            // Set timer for remaining time
            const remainingTime = thirtyMinutes - timeDiff;
            setupAutoCancelTimer(order.id, remainingTime);
        }
    });
}

function setupAutoCancelTimer(orderId, delay) {
    // Clear existing timer if any
    if (autoCancelIntervals.has(orderId)) {
        clearTimeout(autoCancelIntervals.get(orderId));
    }

    // Set new timer
    const timerId = setTimeout(() => {
        autoCancelOrder(orderId, 'Payment timeout - 30 minutes exceeded');
        autoCancelIntervals.delete(orderId);
    }, delay);

    autoCancelIntervals.set(orderId, timerId);
}

async function autoCancelOrder(orderId, reason) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) return;

        const orderData = orderSnap.data();

        // Don't cancel if already paid or completed
        if (orderData.paymentStatus === 'paid' || orderData.status === 'completed') {
            return;
        }

        // Restore inventory stock before cancelling
        await restoreInventoryStock(orderData);

        await updateDoc(orderRef, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            cancelReason: 'Unpaid - Payment timeout after 30 minutes',
            cancelledBy: 'system'
        });

        showNotification(`Order ${orderData.referenceNumber} auto-cancelled: Payment timeout`, 'info');
    } catch (error) {
        console.error('Error auto-cancelling order:', error);
    }
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
    } else if (currentFilter === 'cancelled' || currentFilter === 'completed') {
        filteredOrders = orders.filter(order => order.status === currentFilter);

        // Apply date filter for completed/cancelled
        const dateFilterType = document.getElementById('dateFilterType')?.value || 'all';

        if (dateFilterType !== 'all') {
            const now = new Date();
            let startDate;

            switch (dateFilterType) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'custom':
                    const customDateValue = document.getElementById('customDate')?.value;
                    if (customDateValue) {
                        startDate = new Date(customDateValue);
                        startDate.setHours(0, 0, 0, 0);
                    }
                    break;
            }

            if (startDate) {
                const endDate = dateFilterType === 'custom' ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000) : new Date();

                filteredOrders = filteredOrders.filter(order => {
                    const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
                    return orderDate >= startDate && orderDate <= endDate;
                });
            }
        }
    } else {
        filteredOrders = orders.filter(order => order.status === currentFilter);
    }

    filteredOrders.sort((a, b) => {
        // Sort cancelled/completed orders by time, others by queue position
        if (a.status === 'cancelled' || a.status === 'completed') {
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return bTime - aTime; // Most recent first
        }
        return (a.queuePosition || 0) - (b.queuePosition || 0);
    });

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

    const itemsList = order.items
        .filter(item => item && item.name)
        .map(item => `
        <div class="order-item">
            <span class="item-name">${item.name}</span>
            <span class="item-quantity">×${item.quantity || 0}</span>
            <span class="item-price">₱${(item.total || 0).toFixed(2)}</span>
        </div>
    `).join('');

    let paymentBadge = '';

    if (order.paymentMethod === 'gcash') {
        paymentBadge = '<span class="payment-badge payment-gcash">PAID - GCASH</span>';
    } else if (order.paymentMethod === 'cash' && order.paymentStatus === 'paid') {
        paymentBadge = '<span class="payment-badge payment-cash-paid">PAID - CASH</span>';
    } else if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
        paymentBadge = '<span class="payment-badge payment-cash-pending">⏳ UNPAID - Pay at Counter</span>';
    }

    // ADD THIS: Order Type Badge
    const orderTypeBadge = order.orderType === 'take-out'
        ? '<span class="order-type-badge" style="background: #ffc107; color: #000; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">📦 TAKE-OUT</span>'
        : '<span class="order-type-badge" style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">🍽️ DINE-IN</span>';

    // Show cancel reason if cancelled
    let cancelInfo = '';
    if (order.status === 'cancelled') {
        const cancelledBy = order.cancelledBy === 'system' ? 'System' : 'Staff';
        const cancelReason = order.cancelReason || 'No reason provided';
        cancelInfo = `<div style="background: #f8d7da; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.85rem; color: #721c24;">
            <strong>Cancelled by:</strong> ${cancelledBy}<br>
            <strong>Reason:</strong> ${cancelReason}
        </div>`;
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
            ${orderTypeBadge}
        </div>
        
        ${cancelInfo}
        
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
        'pending_payment': 'Waiting for Payment',
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

    // Cancel button for unpaid orders
    if (order.paymentStatus === 'pending' && order.status !== 'cancelled') {
        buttons += `<button class="action-btn btn-cancel" onclick="cancelOrderWithReason('${order.id}')">❌ Cancel Order</button>`;
    }

    if (order.paymentMethod === 'cash' && order.paymentStatus === 'pending') {
        buttons += `<button class="action-btn btn-mark-paid" onclick="markAsPaid('${order.id}')">💵 Mark as Paid</button>`;
    }

    switch (order.status) {
        case 'pending':
        case 'pending_payment':
            if (order.paymentStatus === 'paid') {
                buttons += `<button class="action-btn btn-accept" onclick="updateOrderStatus('${order.id}', 'preparing')">👨‍🍳 Start Preparing</button>`;
            }
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
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data();

    await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paidAt: Timestamp.now(),
        status: orderData.status === 'pending_payment' ? 'pending' : orderData.status
    });

    // Clear auto-cancel timer
    if (autoCancelIntervals.has(orderId)) {
        clearTimeout(autoCancelIntervals.get(orderId));
        autoCancelIntervals.delete(orderId);
    }

    showNotification('Order marked as paid!', 'success');
};

// ============================================
// CANCEL ORDER WITH REASON
// ============================================
window.cancelOrderWithReason = async function (orderId) {
    currentCancelOrderId = orderId;
    const modal = document.getElementById('cancelModal');
    modal.style.display = 'flex';

    // Reset form
    document.querySelectorAll('#cancelModal input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('otherReasonText').style.display = 'none';
    document.getElementById('otherReasonText').value = '';
};

window.closeCancelModal = function () {
    document.getElementById('cancelModal').style.display = 'none';
    currentCancelOrderId = null;
};

window.confirmCancelOrder = async function () {
    if (!currentCancelOrderId) return;

    const checkboxes = document.querySelectorAll('#cancelModal input[type="checkbox"]:checked');
    const reasons = [];

    checkboxes.forEach(cb => {
        if (cb.id === 'otherCheckbox') {
            const otherText = document.getElementById('otherReasonText').value.trim();
            if (otherText) {
                reasons.push(otherText);
            }
        } else {
            reasons.push(cb.value);
        }
    });

    if (reasons.length === 0) {
        alert('Please select at least one reason for cancellation.');
        return;
    }

    const finalReason = reasons.join(', ');

    try {
        const orderRef = doc(db, 'orders', currentCancelOrderId);
        const orderSnap = await getDoc(orderRef);

        if (!orderSnap.exists()) {
            showNotification('Order not found', 'error');
            return;
        }

        const orderData = orderSnap.data();

        // Restore inventory stock
        await restoreInventoryStock(orderData);

        // Cancel the order
        await updateDoc(orderRef, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            cancelledBy: currentStaffId,
            cancelReason: finalReason
        });

        // Clear auto-cancel timer
        if (autoCancelIntervals.has(currentCancelOrderId)) {
            clearTimeout(autoCancelIntervals.get(currentCancelOrderId));
            autoCancelIntervals.delete(currentCancelOrderId);
        }

        showNotification('Order cancelled and stock restored!', 'info');
        closeCancelModal();
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Failed to cancel order', 'error');
    }
};

// Show/hide "Other" textarea
document.addEventListener('DOMContentLoaded', function () {
    const otherCheckbox = document.getElementById('otherCheckbox');
    const otherTextarea = document.getElementById('otherReasonText');

    if (otherCheckbox && otherTextarea) {
        otherCheckbox.addEventListener('change', function () {
            otherTextarea.style.display = this.checked ? 'block' : 'none';
            if (!this.checked) otherTextarea.value = '';
        });
    }
});

// ============================================
// CANCEL ORDER (Legacy function)
// ============================================
window.cancelOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) {
        return;
    }

    const orderRef = doc(db, 'orders', orderId);

    await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: currentStaffId,
        cancelReason: 'Cancelled by staff'
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
        updatedAt: Timestamp.now()
    });

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

    const pendingCount = orders.filter(order => order.status === 'pending' || order.status === 'pending_payment').length;
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
        
        // Add filter to remove undefined items
        const itemsText = order.items
            .filter(item => item && item.name)
            .map(item => `${item.name} (×${item.quantity || 0})`)
            .join(', ');

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
        checkUnpaidOrders(); // Re-check unpaid orders on updates
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

async function restoreInventoryStock(order) {
    try {
        const validItems = order.items.filter(item => item && item.inventoryId && item.quantity);

        for (const item of validItems) {
            const inventoryRef = doc(db, 'inventory', item.inventoryId);
            const inventoryDoc = await getDoc(inventoryRef);

            if (inventoryDoc.exists()) {
                const currentStock = inventoryDoc.data().stock;
                const newStock = currentStock + item.quantity;

                await updateDoc(inventoryRef, {
                    stock: newStock,
                    status: newStock > 0 ? 'available' : 'unavailable'
                });
            }
        }
    } catch (error) {
        console.error('Error restoring inventory:', error);
    }
}

// ============================================
// STAFF NAVIGATION
// ============================================
function setupStaffNavigation() {
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showStaffSection(section);

            document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function showStaffSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    if (sectionId === 'inventory') {
        switchStaffInventoryType('meals');
    } else if (sectionId === 'notifications') {
        renderStaffNotifications();
    }
}

// ============================================
// SWITCH INVENTORY TYPE
// ============================================
window.switchStaffInventoryType = function (type) {
    document.getElementById('staffInventoryTypeMeals').classList.toggle('active', type === 'meals');
    document.getElementById('staffInventoryTypeCafe').classList.toggle('active', type === 'cafe');

    document.getElementById('staffMealsInventorySection').classList.toggle('active', type === 'meals');
    document.getElementById('staffCafeInventorySection').classList.toggle('active', type === 'cafe');

    if (type === 'meals') {
        renderStaffInventory();
    } else {
        renderStaffCafeInventory();
    }
};

// ============================================
// STAFF INVENTORY
// ============================================
async function loadStaffInventory() {
    const snapshot = await getDocs(collection(db, 'inventory'));
    staffInventoryItems = [];

    snapshot.forEach(doc => {
        const itemData = doc.data();
        if (itemData && itemData.name) {
            staffInventoryItems.push({
                id: doc.id,
                ...itemData
            });
        }
    });

    renderStaffInventory();
}

// ============================================
// LOAD CAFE INVENTORY
// ============================================
async function loadStaffCafeInventory() {
    const snapshot = await getDocs(collection(db, 'cafe_inventory'));
    staffCafeInventoryItems = [];

    snapshot.forEach(doc => {
        const itemData = doc.data();
        if (itemData && itemData.name) {
            staffCafeInventoryItems.push({
                id: doc.id,
                ...itemData
            });
        }
    });

    renderStaffCafeInventory();
}

function renderStaffInventory() {
    const tbody = document.getElementById('staffInventoryTableBody');

    // Filter out invalid items
    const validItems = staffInventoryItems.filter(item => item && item.name && item.id);

    if (validItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>📦</div>
                    <div>No inventory items found</div>
                </td>
            </tr>`;
        return;
    }

    const sortedItems = applyStaffSort(validItems);

    tbody.innerHTML = sortedItems.map(item => `
        <tr>
            <td>
                <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}"
                     alt="${item.name || 'Unknown'}">
            </td>
            <td><strong>${item.name || 'Unknown Item'}</strong></td>
            <td><span style="text-transform: capitalize;">${item.categoryName || item.category || 'N/A'}</span></td>
            <td><strong>${item.stock || 0}</strong></td>
            <td><strong>₱${parseFloat(item.price || 0).toFixed(2)}</strong></td>
            <td>
                <button class="btn-alert" onclick="sendLowStockAlert('${item.id}', '${item.name}')">
                    Send Stock Alert
                </button>
            </td>
        </tr>
    `).join('');

    if (currentStaffSort.column) {
        updateStaffSortIndicators(currentStaffSort.column, currentStaffSort.ascending);
    }
}

// ============================================
// RENDER CAFE INVENTORY
// ============================================
function renderStaffCafeInventory() {
    const tbody = document.getElementById('staffCafeInventoryTableBody');

    // Filter out invalid items
    const validItems = staffCafeInventoryItems.filter(item => item && item.name && item.id);

    if (validItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div>☕</div>
                    <div>No cafe items found</div>
                </td>
            </tr>`;
        return;
    }

    const sortedItems = applyStaffCafeSort(validItems);

    tbody.innerHTML = sortedItems.map(item => {
        let pricesDisplay = '';
        if (item.sizes && Object.keys(item.sizes).length > 0) {
            pricesDisplay = Object.entries(item.sizes)
                .map(([size, price]) => `<div style="font-size: 0.85rem;">${size}: ₱${parseFloat(price).toFixed(2)}</div>`)
                .join('');
        } else {
            pricesDisplay = `<strong>₱${parseFloat(item.price || 0).toFixed(2)}</strong>`;
        }

        return `
            <tr>
                <td>
                    <img src="${item.image || 'https://via.placeholder.com/50x50?text=No+Image'}"
                         alt="${item.name || 'Unknown'}">
                </td>
                <td><strong>${item.name || 'Unknown Item'}</strong></td>
                <td><span style="text-transform: capitalize;">${item.categoryName || item.category || 'N/A'}</span></td>
                <td><strong>${item.stock || 0}</strong></td>
                <td>${pricesDisplay}</td>
                <td>
                    <button class="btn-alert" onclick="sendLowStockAlert('${item.id}', '${item.name}', 'cafe')">
                        Send Stock Alert
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (currentStaffCafeSort.column) {
        updateStaffCafeSortIndicators(currentStaffCafeSort.column, currentStaffCafeSort.ascending);
    }
}

function updateStaffCafeSortIndicators(column, ascending) {
    document.querySelectorAll('#staffCafeInventoryTableBody').forEach(tbody => {
        const indicators = tbody.parentElement.querySelectorAll('.sort-indicator');
        indicators.forEach(el => el.remove());
    });

    const thead = document.querySelector('#staffCafeInventoryTableBody').parentElement.querySelector('thead');
    if (!thead) return;

    const ths = thead.querySelectorAll('th');
    ths.forEach(th => {
        if (th.onclick && th.onclick.toString().includes(column)) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent = ascending ? ' ▲' : ' ▼';
            th.appendChild(indicator);
        }
    });
}

window.sortStaffInventory = function (column) {
    if (currentStaffSort.column === column) {
        currentStaffSort.ascending = !currentStaffSort.ascending;
    } else {
        currentStaffSort.column = column;
        currentStaffSort.ascending = true;
    }

    renderStaffInventory();
};

// ============================================
// SORT CAFE INVENTORY
// ============================================
window.sortStaffCafeInventory = function (column) {
    if (currentStaffCafeSort.column === column) {
        currentStaffCafeSort.ascending = !currentStaffCafeSort.ascending;
    } else {
        currentStaffCafeSort.column = column;
        currentStaffCafeSort.ascending = true;
    }

    renderStaffCafeInventory();
};

function applyStaffCafeSort(items) {
    if (!currentStaffCafeSort.column) return items;

    return [...items].sort((a, b) => {
        let valA, valB;

        switch (currentStaffCafeSort.column) {
            case 'name':
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category || '').toLowerCase();
                valB = (b.categoryName || b.category || '').toLowerCase();
                break;
            case 'stock':
                valA = a.stock || 0;
                valB = b.stock || 0;
                break;
            default:
                return 0;
        }

        if (valA < valB) return currentStaffCafeSort.ascending ? -1 : 1;
        if (valA > valB) return currentStaffCafeSort.ascending ? 1 : -1;
        return 0;
    });
}

function applyStaffSort(items) {
    if (!currentStaffSort.column) return items;

    return [...items].sort((a, b) => {
        let valA, valB;

        switch (currentStaffSort.column) {
            case 'name':
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                break;
            case 'category':
                valA = (a.categoryName || a.category || '').toLowerCase();
                valB = (b.categoryName || b.category || '').toLowerCase();
                break;
            case 'stock':
                valA = a.stock || 0;
                valB = b.stock || 0;
                break;
            case 'price':
                valA = parseFloat(a.price || 0);
                valB = parseFloat(b.price || 0);
                break;
            default:
                return 0;
        }

        if (valA < valB) return currentStaffSort.ascending ? -1 : 1;
        if (valA > valB) return currentStaffSort.ascending ? 1 : -1;
        return 0;
    });
}

function updateStaffSortIndicators(column, ascending) {
    document.querySelectorAll('.sort-indicator').forEach(el => el.remove());

    const thead = document.querySelector('#staffInventoryTableBody').parentElement.querySelector('thead');
    if (!thead) return;

    const ths = thead.querySelectorAll('th');
    ths.forEach(th => {
        if (th.onclick && th.onclick.toString().includes(column)) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent = ascending ? ' ▲' : ' ▼';
            th.appendChild(indicator);
        }
    });
}

// ============================================
// SEND LOW STOCK ALERT
// ============================================
window.sendLowStockAlert = async function (itemId, itemName, type = 'meals') {
    const itemType = type === 'cafe' ? 'cafe item' : 'meals item';

    if (!confirm(`Send low stock alert for "${itemName}" (${itemType}) to admin?`)) {
        return;
    }

    try {
        const staffSession = sessionStorage.getItem('staffSession');
        const sessionData = JSON.parse(staffSession);

        await addDoc(collection(db, 'staff_notifications'), {
            type: 'low_stock_alert',
            itemId: itemId,
            itemName: itemName,
            inventoryType: type,
            staffId: sessionData.staffId,
            staffName: sessionData.staffName || sessionData.staffId,
            timestamp: Timestamp.now(),
            read: false
        });

        showNotification(`Low stock alert sent for ${itemName}!`, 'success');
    } catch (error) {
        console.error('Error sending alert:', error);
        showNotification('Failed to send alert', 'error');
    }
};

// ============================================
// STAFF NOTIFICATIONS (from admin)
// ============================================
async function loadStaffNotifications() {
    const q = query(
        collection(db, 'admin_notifications'),
        orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    staffNotifications = [];

    snapshot.forEach(doc => {
        staffNotifications.push({
            id: doc.id,
            ...doc.data()
        });
    });

    renderStaffNotifications();
}

function renderStaffNotifications() {
    const container = document.getElementById('staffNotificationsContainer');

    if (staffNotifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <div class="empty-message">No notifications yet</div>
                <div class="empty-description">Stock updates from admin will appear here</div>
            </div>
        `;
        return;
    }

    container.innerHTML = staffNotifications.map(notif => {
        const timestamp = notif.timestamp?.toDate ? notif.timestamp.toDate() : new Date(notif.timestamp);
        const timeAgo = getTimeAgo(timestamp);

        let typeClass = 'stock-update';
        let typeIcon = '📦';
        let typeText = 'Stock Updated';

        if (notif.type === 'new_item') {
            typeClass = 'new-item';
            typeIcon = '✨';
            typeText = 'New Item Added';
        } else if (notif.type === 'restock') {
            typeClass = 'restock';
            typeIcon = '🔄';
            typeText = 'Restock';
        }

        return `
            <div class="notification-card ${typeClass}">
                <div class="notification-header">
                    <div class="notification-type">${typeIcon} ${typeText}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-body">
                    ${notif.message}
                    ${notif.itemName ? `<div class="notification-item"><strong>Item:</strong> ${notif.itemName}</div>` : ''}
                    ${notif.details ? `<div class="notification-item">${notif.details}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// REALTIME LISTENERS FOR STAFF
// ============================================
function setupStaffRealtimeListeners() {
    // Listen to inventory
    const inventoryQuery = query(collection(db, 'inventory'));
    onSnapshot(inventoryQuery, (snapshot) => {
        staffInventoryItems = [];
        snapshot.forEach(doc => {
            staffInventoryItems.push({ id: doc.id, ...doc.data() });
        });
        renderStaffInventory();
    });

    // Listen to cafe inventory
    const cafeInventoryQuery = query(collection(db, 'cafe_inventory'));
    onSnapshot(cafeInventoryQuery, (snapshot) => {
        staffCafeInventoryItems = [];
        snapshot.forEach(doc => {
            staffCafeInventoryItems.push({ id: doc.id, ...doc.data() });
        });
        renderStaffCafeInventory();
    });

    // Listen to admin notifications
    const notifQuery = query(
        collection(db, 'admin_notifications'),
        orderBy('timestamp', 'desc')
    );
    onSnapshot(notifQuery, (snapshot) => {
        const prevCount = staffNotifications.length;
        staffNotifications = [];
        snapshot.forEach(doc => {
            staffNotifications.push({ id: doc.id, ...doc.data() });
        });

        if (staffNotifications.length > prevCount && prevCount > 0) {
            showNotification('New notification from admin!', 'info');
        }

        renderStaffNotifications();
    });
}

// Toggle user menu
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('active');
}

// Close user menu when clicking outside
document.addEventListener('click', function (event) {
    const userMenu = document.getElementById('userMenu');
    const sidebarUser = document.querySelector('.sidebar-user');

    if (userMenu && sidebarUser && !sidebarUser.contains(event.target)) {
        userMenu.classList.remove('active');
    }
});