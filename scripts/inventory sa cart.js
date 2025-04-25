import { renderMenuItems, updateStock, getItem } from './inventory.js';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize DOM elements
    const cartContainer = document.querySelector(".cart-items");
    const totalDisplay = document.querySelector(".total");
    let cart = [];

    // Render initial menu
    renderMenuItems();

    // Handle add to cart
    document.addEventListener('click', e => {
        if (e.target.classList.contains('add-btn')) {
            const menuItem = e.target.closest('.menu-item');
            const itemId = parseInt(menuItem.dataset.id);
            const quantity = parseInt(menuItem.querySelector('.quantity-input').value);
            
            const inventoryItem = getItem(itemId);
            
            if (inventoryItem && inventoryItem.stock >= quantity) {
                const updatedItem = updateStock(itemId, quantity);
                if (updatedItem) {
                    addToCart(updatedItem, quantity);
                }
            } else {
                alert('Not enough stock available!');
            }
        }
    });

    // ...rest of your existing cart code...
});
