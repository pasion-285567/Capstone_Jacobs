document.querySelector('.place-order').addEventListener('click', () => {
    const totalPrice = document.querySelector('.total').textContent;
    document.querySelector('.total-price').textContent = totalPrice;
    document.querySelector('.payment-overlay').classList.remove('hidden');
});

document.querySelector('.close-btn').addEventListener('click', () => {
    document.querySelector('.payment-overlay').classList.add('hidden');
});

document.querySelector('#amount-paid').addEventListener('input', (e) => {
    const amountPaid = parseFloat(e.target.value) || 0;
    const total = parseFloat(document.querySelector('.total').textContent.replace('P', '').trim()) || 0;
    const change = amountPaid - total;
    document.querySelector('#change').value = change >= 0 ? `P${change.toFixed(2)}` : 'Insufficient Amount';
});

document.querySelector('.checkout-btn').addEventListener('click', () => {
    // You can add logic for handling order status here
    document.querySelector('.payment-overlay').classList.add('hidden');
    alert('Order has been placed successfully!');
});
