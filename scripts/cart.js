document.addEventListener("DOMContentLoaded", () => {
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

    let cart = [];

    // Handle adding items to the cart
    addButtons.forEach(button => {
        button.addEventListener("click", () => {
            const menuItem = button.closest(".menu-item");
            const name = menuItem.querySelector("span").textContent;
            const priceText = menuItem.querySelector("price").textContent;
            const price = parseFloat(priceText.replace("P", ""));

            cart.push({ name, price });
            addCartItem(name, price);
            updateTotal();
        });
    });

    function addCartItem(name, price) {
        const item = document.createElement("div");
        item.className = "cart-item";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = name;

        const priceSpan = document.createElement("span");
        priceSpan.textContent = `P${price.toFixed(2)}`;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
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

    function updateTotal() {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        totalDisplay.textContent = `Total: P${total.toFixed(2)}`;
        paymentTotal.textContent = `P${total.toFixed(2)}`;
    }

    placeOrderBtn.addEventListener("click", () => {
        console.log('Place order button clicked');
        paymentOverlay.classList.add("active");
    });

    closeBtn.addEventListener("click", () => {
        console.log('Close button clicked');
        paymentOverlay.classList.remove("active");
    });

    paymentInput.addEventListener("input", () => {
        const paymentAmount = parseFloat(paymentInput.value);
        const totalAmount = parseFloat(paymentTotal.textContent.replace("P", ""));
        const change = paymentAmount - totalAmount;
        paymentChange.textContent = `P${change.toFixed(2)}`;
    });

    checkoutBtn.addEventListener("click", () => {
        console.log('Checkout button clicked');
        // Show the order status
        orderStatus.classList.remove("hidden");
        orderStatus.style.display = "block";

        if (cart.length > 0) {
            orderSummaryList.innerHTML = `
                <h2>Your Order #: ${Math.floor(100000 + Math.random() * 900000)}</h2>
                <ul>
                    ${cart.map(item => `<li>${item.name}: P${item.price.toFixed(2)}</li>`).join("")}
                </ul>
                <p>Total: P${paymentTotal.textContent.replace("P", "")}</p>
                <p>Payment: P${paymentInput.value}</p>
                <p>Change: P${paymentChange.textContent.replace("P", "")}</p>
                <h4>Status: Preparing...</h4>
            `;
        } else {
            // Placeholder when no items are in the cart
            orderSummaryList.innerHTML = `
                <p class="empty-order">Your order is empty. Please add items to the cart.</p>
            `;
        }

        // Hide the overlay
        paymentOverlay.classList.remove("active");
    });
});