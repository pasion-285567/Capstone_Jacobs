const categories = [
    { name: 'All Meals', image: 'images/categories/meal.webp' },
    { name: 'Meal w/ Rice', image: 'images/categories/meals.jpg' },
    { name: 'Sizzling', image: 'images/categories/meal.webp' },
    { name: 'Breaded Fillet', image: 'images/categories/meal.webp' },
    { name: 'Silog', image: 'images/categories/silog.jpg' },
    { name: 'Ala Carte', image: 'images/categories/alacarte.jpg' },
    { name: 'Sinigang', image: 'images/categories/meal.webp' },
    { name: 'Nilaga', image: 'images/categories/meal.webp' },
    { name: 'Veggies', image: 'images/categories/veggies.jpg' },
    { name: 'Soup', image: 'images/categories/soup.jpg' },
    { name: 'For Sharing', image: 'images/categories/forsharing.jpg' },
    { name: 'Pasta', image: 'images/categories/pasta.jpg' },
    { name: 'Appetizers', image: 'images/categories/appetizer.jpg' },
    { name: 'Drinks', image: 'images/categories/drinks.jpg' },
    { name: 'Extra', image: 'images/categories/meal.webp' }
];

const menuCategories = {
    'All Meals': [], // This will be populated with all items
    'Meal w/ Rice': [
        { name: 'Pares (Best Seller)', price: 120.00, image: '' },
        { name: 'Fried Chicken', price: 115.00, image: '' },
        { name: 'Chicken Steak', price: 115.00, image: '' },
        { name: 'Valenciana', price: 120.00, image: '' },
        { name: 'Pork Humba', price: 150.00, image: '' },
        { name: 'Pusit Express', price: 120.00, image: '' },
        { name: 'Pork Binagoongan', price: 130.00, image: '' },
        { name: 'Fried Porkchop', price: 130.00, image: '' },
        { name: 'Chicken Teriyaki', price: 130.00, image: '' },
        { name: 'Fish Teriyaki', price: 130.00, image: '' },
    ],

    'Sizzling': [
        { name: 'T-Bone', price: 170.00, image: '' },
        { name: 'Sisig', price: 115.00, image: '' },
        { name: 'Burger', price: 100.00, image: '' },
        { name: 'Porkchop', price: 120.00, image: '' },
        { name: 'Liempo', price: 115.00, image: '' },
        { name: 'Bangus Sisig', price: 170.00, image: '' },
        { name: 'Chicken Sisig', price: 100.00, image: '' },
        { name: 'Tofu w/ Rice', price: 140.00, image: '' },
    ],

    'Breaded Fillet': [
        { name: 'Pork', price: 125.00, image: '' },
        { name: 'Chicken', price: 120.00, image: '' },
        { name: 'Fish', price: 120.00, image: '' },
    ],

    'Silog': [
        { name: 'Tapsilog', price: 120.00, image: '' },
        { name: 'Liemposilog', price: 115.00, image: '' },
        { name: 'Tocilog', price: 110.00, image: '' },
        { name: 'Longsilog', price: 110.00, image: '' },
        { name: 'Bangsilog', price: 120.00, image: '' },
        { name: 'Hotsilog', price: 100.00, image: '' },
    ],

    'Ala Carte': [
        { name: 'Spicy Bangus', price: 160.00, image: '' },
        { name: 'Dinakdakan', price: 120.00, image: '' },
        { name: 'Sisig', price: 160.00, image: '' },
        { name: 'Chicken Wings', price: 180.00, image: '' },
        { name: 'Chicken Lollipop', price: 180.00, image: '' },
    ],

    'Sinigang': [
        { name: 'Sinigang na Baka', price: 160.00, image: '' },
        { name: 'Sinigang na Baboy', price: 160.00, image: '' },
        { name: 'Sinigang na Salmon', price: 170.00, image: '' },
        { name: 'Sinigang na Hipon', price: 150.00, image: '' },
    ],

    'Nilaga': [
        { name: 'Nilagang Baka', price: 160.00, image: '' },
        { name: 'Nilagang Baboy', price: 160.00, image: '' },
    ],

    'Veggies': [
        { name: 'Laing', price: 160.00, image: '' },
        { name: 'Langka', price: 160.00, image: '' },
        { name: 'Pinakbet', price: 160.00, image: '' },
        { name: 'Kare-Kare', price: 170.00, image: '' },
        { name: 'Chopsuey', price: 140.00, image: '' },
    ],

    'Soup': [
        { name: 'Camto', price: 130.00, image: '' },
        { name: 'Papaitan', price: 130.00, image: '' },
    ],

    'For Sharing': [
        { name: 'Buttered Chicken', price: 300.00, image: '' },
        { name: 'Bulalo (Small)', price: 399.00, image: '' },
        { name: 'Bulalo (Large)', price: 499.00, image: '' },
        { name: 'Pata', price: 200.00, image: '' },
    ],

    'Pasta': [
        { name: 'Carbonara', price: 85.00, image: '' },
        { name: 'Spaghetti', price: 85.00, image: '' },
        { name: 'Canton (Small)', price: 85.00, image: '' },
        { name: 'Canton (Large)', price: 160.00, image: '' },
        { name: 'Bihon (Small)', price: 85.00, image: '' },
        { name: 'Bihon (Large)', price: 160.00, image: '' },
        { name: 'Pansit Mix', price: 190.00, image: '' },
        { name: 'Lomi', price: 190.00, image: '' },
        { name: 'Beef Mami', price: 90.00, image: '' },
    ],

    'Appetizers': [
        { name: 'Calamares', price: 160.00, image: '' },
        { name: 'Pork Stuff Tofu', price: 70.00, image: '' },
        { name: 'Nachos', price: 115.00, image: '' },
        { name: 'Fries', price: 115.00, image: '' },
        { name: 'Clubhouse', price: 115.00, image: '' },
        { name: 'Garden Salad', price: 95.00, image: '' },
        { name: 'Dynapares', price: 95.00, image: '' },
        { name: 'Shanghai', price: 70.00, image: '' },
        { name: 'Siopao', price: 50.00, image: '' },
        { name: 'Siomai', price: 30.00, image: '' },
        { name: 'Toasted Bread', price: 15.00, image: '' },
    ],

    'Drinks': [
        { name: 'Pepsi (1.5L)', price: 60.00, image: '' },
        { name: 'Pepsi (Kasalo)', price: 30.00, image: '' },
        { name: 'Mountain Dew (1.5L)', price: 60.00, image: '' },
        { name: 'Mountain Dew (Kasalo)', price: 30.00, image: '' },
    ],

    'Extra': [
        { name: 'Gravy', price: 10.00, image: '' },
        { name: 'Eggs', price: 15.00, image: '' },
        { name: 'Hotdog', price: 25.00, image: '' },
        { name: 'Plain Rice', price: 20.00, image: '' },
        { name: 'Java Rice', price: 25.00, image: '' },
        { name: 'Garlic Rice', price: 25.00, image: '' },
    ]
    // Add other categories as needed
};

// Populate All Meals category
menuCategories['All Meals'] = Object.values(menuCategories)
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name));

document.addEventListener('DOMContentLoaded', () => {
    const categoryPlaceholder = document.querySelector('.category-placeholder');
    const mealsSection = document.querySelector('.meals span');
    const menuPlaceholder = document.querySelector('.menu-placeholder');

    // Clear existing category buttons
    categoryPlaceholder.innerHTML = '';

    // Generate category buttons
    categories.forEach(category => {
        const categoryBtn = document.createElement('button');
        categoryBtn.className = 'ctgry-btn';
        categoryBtn.innerHTML = `
            <img src="${category.image}" alt="${category.name}">
            <span>${category.name}</span>
        `;
        categoryPlaceholder.appendChild(categoryBtn);
    });

    // Category click handler
    document.querySelectorAll('.ctgry-btn').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.querySelector('span').textContent;
            
            // Update section title
            mealsSection.textContent = category;
            
            // Get items for the category
            const items = menuCategories[category] || [];
            
            // Update menu items
            menuPlaceholder.innerHTML = items.map(item => `
                <div class="menu-item">
                    <img src="images/Menu/meal.avif" alt="${item.name}">
                    <span>${item.name}</span>
                    <div class="quantity-controls">
                        <button class="minus">-</button>
                        <input type="number" class="quantity-input" value="1" min="1">
                        <button class="plus">+</button>
                    </div>
                    <price>₱${item.price.toFixed(2)}</price>
                    <button class="add-btn">+</button>
                </div>
            `).join('');

            // Attach cart handlers to new menu items
            attachCartHandlers();
        });
    });
});

// Function to attach cart handlers
function attachCartHandlers() {
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        const minusBtn = item.querySelector(".minus");
        const plusBtn = item.querySelector(".plus");
        const quantityInput = item.querySelector(".quantity-input");
        const addBtn = item.querySelector(".add-btn");

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

        addBtn.addEventListener("click", () => {
            const name = item.querySelector("span").textContent;
            const priceText = item.querySelector("price").textContent;
            const price = parseFloat(priceText.replace("₱", ""));
            const quantity = parseInt(quantityInput.value);

            const addToCartEvent = new CustomEvent('addToCart', {
                detail: { name, price, quantity }
            });
            document.dispatchEvent(addToCartEvent);
        });
    });
}