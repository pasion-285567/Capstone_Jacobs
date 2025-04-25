const inventory = [
    {
        id: 1,
        name: "Adobo",
        price: 79.00,
        stock: 50,
        image: "images/meals/adobo.jpg"
    },
    {
        id: 2,
        name: "Valenciana",
        price: 75.00,
        stock: 30,
        image: "images/meals/valenciana.jpg"
    }
    // Add more menu items here
];

function renderMenuItems() {
    const menuPlaceholder = document.querySelector('.menu-placeholder');
    menuPlaceholder.innerHTML = '';

    inventory.forEach(item => {
        const menuItem = `
            <div class="menu-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}">
                <span>${item.name}</span>
                <div class="quantity-controls">
                    <button class="minus">-</button>
                    <input type="number" class="quantity-input" value="1" min="1" max="${item.stock}">
                    <button class="plus">+</button>
                </div>
                <price>P${item.price.toFixed(2)}</price>
                <button class="add-btn" ${item.stock === 0 ? 'disabled' : ''}>
                    ${item.stock === 0 ? 'Out of Stock' : '+'}
                </button>
            </div>
        `;
        menuPlaceholder.insertAdjacentHTML('beforeend', menuItem);
    });
}

function updateStock(itemId, quantity) {
    const item = inventory.find(item => item.id === itemId);
    if (item) {
        item.stock -= quantity;
        renderMenuItems();
    }
    return item;
}

function getItem(itemId) {
    return inventory.find(item => item.id === itemId);
}

export { inventory, renderMenuItems, updateStock, getItem };