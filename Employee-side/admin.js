function login() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginForm = document.getElementById('loginForm');
    const dashboard = document.getElementById('dashboard');
    const errorMsg = document.getElementById('errorMessage');
  
    if (email === 'admin@admin.com' && password === 'admin') {
      loginForm.classList.remove('active');
      dashboard.classList.add('active');
      if (errorMsg) errorMsg.textContent = ''; // clear any previous errors
    } else {
      if (errorMsg) {
        errorMsg.textContent = 'Invalid email or password!';
      } else {
        alert('Invalid email or password!');
      }
    }
  }
  