document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    const placeOrderBtn = document.querySelector('.place-order');
    const paymentOverlay = document.querySelector('.payment-overlay');
    const closeBtn = document.querySelector('.close-btn');
    const amountInput = document.querySelector('#amount-paid');
    const totalDisplay = document.querySelector('.total');
    const totalPrice = document.querySelector('.total-price');
    const changeDisplay = document.querySelector('#change');
    const checkoutBtn = document.querySelector('.checkout-btn');

    // Place Order Handler
    if (placeOrderBtn && paymentOverlay && totalDisplay && totalPrice) {
        placeOrderBtn.addEventListener('click', () => {
            totalPrice.textContent = totalDisplay.textContent;
            paymentOverlay.classList.remove('hidden');
        });
    }

    // Close Button Handler
    if (closeBtn && paymentOverlay) {
        closeBtn.addEventListener('click', () => {
            paymentOverlay.classList.add('hidden');
        });
    }

    // Amount Input Handler
    if (amountInput && totalDisplay && changeDisplay) {
        amountInput.addEventListener('input', (e) => {
            const amountPaid = parseFloat(e.target.value) || 0;
            const total = parseFloat(totalDisplay.textContent.replace('P', '').trim()) || 0;
            const change = amountPaid - total;
            changeDisplay.value = change >= 0 ? `P${change.toFixed(2)}` : 'Insufficient Amount';
        });
    }

    // Checkout Button Handler
    if (checkoutBtn && paymentOverlay) {
        checkoutBtn.addEventListener('click', () => {
            paymentOverlay.classList.add('hidden');
            alert('Order has been placed successfully!');
        });
    }
});