document.addEventListener("DOMContentLoaded", () => {
    // Initialize DOM elements
    const addButtons = document.querySelectorAll(".add-btn");
    const cartContainer = document.querySelector(".cart-items");
    const totalDisplay = document.querySelector(".total");
    const placeOrderBtn = document.querySelector(".place-order");
    const paymentOverlay = document.querySelector(".payment-overlay");
    const closeBtn = document.querySelector(".close-btn");
    const paymentInput = document.querySelector(".payment-input");
    const paymentTotal = document.querySelector(".payment-total");
    const paymentChange = document.querySelector(".payment-change");
    const checkoutBtn = document.querySelector(".checkout-btn");
    const orderStatus = document.querySelector(".order-status");
    const orderSummaryList = document.querySelector(".order-summary-list");

    // Initialize cart array
    let cart = [];

    // Add quantity control handlers
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        const minusBtn = item.querySelector(".minus");
        const plusBtn = item.querySelector(".plus");
        const quantityInput = item.querySelector(".quantity-input");

        if (minusBtn && plusBtn && quantityInput) {
            minusBtn.addEventListener("click", () => {
                let value = parseInt(quantityInput.value);
                if (value > 1) {
                    quantityInput.value = value - 1;
                }
            });

            plusBtn.addEventListener("click", () => {
                let value = parseInt(quantityInput.value);
                quantityInput.value = value + 1;
            });

            quantityInput.addEventListener("change", () => {
                if (quantityInput.value < 1) {
                    quantityInput.value = 1;
                }
            });
        }
    });

    // Listen for addToCart events
    document.addEventListener('addToCart', (event) => {
        const { name, price, quantity } = event.detail;

        // Check if item exists in cart
        const existingItemIndex = cart.findIndex(item => item.name === name);

        if (existingItemIndex !== -1) {
            cart[existingItemIndex].quantity += quantity;
            updateCartDisplay();
        } else {
            cart.push({ name, price, quantity });
            addCartItem(name, price, quantity);
        }

        updateTotal();
        console.log("Cart updated:", cart);
    });

    // Handle adding items to cart
    addButtons.forEach(button => {
        button.addEventListener("click", () => {
            console.log("Add button clicked");
            const menuItem = button.closest(".menu-item");
            const name = menuItem.querySelector("span").textContent;
            const priceText = menuItem.querySelector("price").textContent;
            const price = parseFloat(priceText.replace("P", ""));
            const quantityInput = menuItem.querySelector(".quantity-input");
            const quantity = quantityInput ? parseInt(quantityInput.value) : 1;

            // Check if item exists in cart
            const existingItemIndex = cart.findIndex(item => item.name === name);

            if (existingItemIndex !== -1) {
                cart[existingItemIndex].quantity += quantity;
                updateCartDisplay();
            } else {
                cart.push({ name, price, quantity });
                addCartItem(name, price, quantity);
            }

            updateTotal();
            console.log("Cart updated:", cart);
        });
    });

    function addCartItem(name, price, quantity) {
        if (!cartContainer) return;

        const item = document.createElement("div");
        item.className = "cart-item";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${name} x${quantity}`;

        const priceSpan = document.createElement("span");
        const totalPrice = price * quantity;
        priceSpan.textContent = `P${totalPrice.toFixed(2)}`;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.className = "remove-btn";
        removeBtn.addEventListener("click", () => {
            const index = Array.from(cartContainer.children).indexOf(item);
            if (index !== -1) {
                cart.splice(index, 1);
                cartContainer.removeChild(item);
                updateTotal();
            }
        });

        item.appendChild(nameSpan);
        item.appendChild(priceSpan);
        item.appendChild(removeBtn);
        cartContainer.appendChild(item);
    }

    function updateCartDisplay() {
        if (!cartContainer) return;
        cartContainer.innerHTML = '';
        cart.forEach(item => {
            addCartItem(item.name, item.price, item.quantity);
        });
    }

    function updateTotal() {
        if (!totalDisplay || !paymentTotal) return;
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalDisplay.textContent = `Total: P${total.toFixed(2)}`;
        paymentTotal.textContent = `P${total.toFixed(2)}`;
    }

    // Payment and checkout handlers
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener("click", () => {
            console.log('Place order button clicked');
            paymentOverlay.classList.add("active");
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            console.log('Close button clicked');
            paymentOverlay.classList.remove("active");
        });
    }

    if (paymentInput) {
        paymentInput.addEventListener("input", () => {
            const paymentAmount = parseFloat(paymentInput.value) || 0;
            const totalAmount = parseFloat(paymentTotal.textContent.replace("P", ""));
            const change = paymentAmount - totalAmount;
            if (paymentChange) {
                paymentChange.textContent = `P${change.toFixed(2)}`;
            }
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
            console.log('Checkout button clicked');
            if (orderStatus) {
                orderStatus.classList.remove("hidden");
                orderStatus.style.display = "block";
            }

            if (cart.length > 0 && orderSummaryList) {
                const orderNumber = Math.floor(100000 + Math.random() * 900000);
                orderSummaryList.innerHTML = `
                    <h2>Your Order #: ${orderNumber}</h2>
                    <ul>
                        ${cart.map(item => `
                            <li>${item.name} x${item.quantity}: P${(item.price * item.quantity).toFixed(2)}</li>
                        `).join("")}
                    </ul>
                    <p>Total: P${paymentTotal.textContent.replace("P", "")}</p>
                    <p>Payment: P${paymentInput.value}</p>
                    <p>Change: P${paymentChange.textContent.replace("P", "")}</p>
                    <h4>Status: Preparing...</h4>
                `;

                // Clear cart after checkout
                cart = [];
                cartContainer.innerHTML = '';
                updateTotal();

            } else if (orderSummaryList) {
                orderSummaryList.innerHTML = `
                    <p class="empty-order">Your order is empty. Please add items to the cart.</p>
                `;
            }

            if (paymentOverlay) {
                paymentOverlay.classList.remove("active");
            }
        });
    }
});