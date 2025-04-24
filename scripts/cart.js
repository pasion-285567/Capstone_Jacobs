document.addEventListener("DOMContentLoaded", () => {
    const addButtons = document.querySelectorAll(".add-btn");
    const cartContainer = document.querySelector(".cart-items");
    const totalDisplay = document.querySelector(".total");

    let cart = [];

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
                cart.splice(index, 1); // Remove from array
                cartContainer.removeChild(item); // Remove from UI
                updateTotal(); // Recalculate
            }
        });
        

        item.appendChild(nameSpan);
        item.appendChild(priceSpan);
        item.appendChild(removeBtn);
        item.dataset.cartRef = JSON.stringify({ name, price }); // used for filtering
        cartContainer.appendChild(item);
    }

    function updateTotal() {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        totalDisplay.textContent = `Total: P${total.toFixed(2)}`;
    }
});
