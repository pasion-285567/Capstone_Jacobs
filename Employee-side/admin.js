document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('form');

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (email === 'admin@admin.com' && password === 'admin') {
            document.querySelector('.login-container').style.display = 'none';
            document.querySelector('.dashboard').style.display = 'block';
        } else {
            alert('Invalid email or password!');
        }
    });
});

function logout() {
    document.querySelector('.dashboard').style.display = 'none';
    document.querySelector('.login-container').style.display = 'block';

    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}
