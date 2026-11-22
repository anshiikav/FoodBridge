// FoodBridge — Auth JavaScript
// Handles login form, registration form, tab switching, and validation

document.addEventListener('DOMContentLoaded', function() {

  // --- Login Page ---
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    // Redirect if already logged in
    if (isLoggedIn()) {
      window.location.href = getDashboardUrl(getUserRole());
      return;
    }

    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearErrors();

      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;

      // Validate
      var valid = true;
      if (!email) { showFieldError('emailError', 'Email is required'); valid = false; }
      else if (!isValidEmail(email)) { showFieldError('emailError', 'Enter a valid email address'); valid = false; }
      if (!password) { showFieldError('passwordError', 'Password is required'); valid = false; }

      if (!valid) return;

      try {
        var data = await fetchApi('/api/auth/login', {
          method: 'POST',
          body: { email: email, password: password }
        });
        setToken(data.token);
        setUser(data.user);
        showAlert('Login successful! Welcome back, ' + (data.user.orgName || data.user.firstName));
        setTimeout(function() {
          window.location.href = getDashboardUrl(data.user.role);
        }, 600);
      } catch (err) {
        showAlert(err.message || 'Login failed. Please check your credentials.', 'error');
      }
    });

    // Demo login buttons with real working credentials
    var demoButtons = document.querySelectorAll('.demo-btn');
    demoButtons.forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var role = this.getAttribute('data-role');
        var demoCreds = {
          restaurant: { email: 'demo.restaurant@foodbridge.org', password: 'demo123456' },
          ngo: { email: 'demo.ngo@foodbridge.org', password: 'demo123456' },
          admin: { email: 'admin@foodbridge.org', password: 'admin123456' }
        };
        var creds = demoCreds[role];
        if (!creds) return;

        // Auto-fill form fields visually for demonstration
        var emailInput = document.getElementById('email');
        var passInput = document.getElementById('password');
        if (emailInput) emailInput.value = creds.email;
        if (passInput) passInput.value = creds.password;

        try {
          var data = await fetchApi('/api/auth/login', {
            method: 'POST',
            body: creds
          });
          setToken(data.token);
          setUser(data.user);
          showAlert('Demo ' + role.toUpperCase() + ' login successful! Redirecting...');
          setTimeout(function() {
            window.location.href = getDashboardUrl(data.user.role);
          }, 600);
        } catch (err) {
          showAlert(err.message || 'Failed to authenticate demo account.', 'error');
        }
      });
    });

    // Password toggle
    setupPasswordToggle();
  }

  // --- Register Page ---
  var registerForm = document.getElementById('registerForm');
  if (registerForm) {
    // Redirect if already logged in
    if (isLoggedIn()) {
      window.location.href = getDashboardUrl(getUserRole());
      return;
    }

    // Tab switching
    var tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        var selectedTab = this.getAttribute('data-tab');
        var restaurantFields = document.getElementById('restaurantFields');
        var ngoFields = document.getElementById('ngoFields');
        var roleInput = document.getElementById('roleInput');

        if (selectedTab === 'restaurant') {
          if (restaurantFields) restaurantFields.style.display = 'block';
          if (ngoFields) ngoFields.style.display = 'none';
          if (roleInput) roleInput.value = 'restaurant';
        } else {
          if (restaurantFields) restaurantFields.style.display = 'none';
          if (ngoFields) ngoFields.style.display = 'block';
          if (roleInput) roleInput.value = 'ngo';
        }
      });
    });

    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      clearErrors();

      // Collect form data with fallbacks to both id and name attributes
      var getFieldVal = function(id, name) {
        var el = document.getElementById(id);
        if (el && el.value) return el.value.trim();
        if (registerForm.elements[name] && registerForm.elements[name].value) {
          return registerForm.elements[name].value.trim();
        }
        return '';
      };

      var formData = {
        firstName: getFieldVal('firstName', 'firstName'),
        lastName: getFieldVal('lastName', 'lastName'),
        orgName: getFieldVal('orgName', 'organizationName') || getFieldVal('orgName', 'orgName'),
        email: getFieldVal('regEmail', 'email').toLowerCase(),
        phone: getFieldVal('phone', 'phone'),
        password: getFieldVal('regPassword', 'password'),
        address: getFieldVal('address', 'address'),
        city: getFieldVal('city', 'city'),
        pincode: getFieldVal('pincode', 'pincode'),
        role: getFieldVal('roleInput', 'role') || 'restaurant'
      };

      // Validate common fields
      var valid = true;
      if (!formData.firstName) { valid = false; showAlert('First name is required', 'error'); return; }
      if (!formData.lastName) { valid = false; showAlert('Last name is required', 'error'); return; }
      if (!formData.orgName) { valid = false; showAlert('Organization name is required', 'error'); return; }
      if (!formData.email || !isValidEmail(formData.email)) {
        showFieldError('regEmailError', 'Enter a valid email');
        showAlert('Enter a valid email address', 'error');
        valid = false;
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        showFieldError('regPasswordError', 'Password must be at least 8 characters');
        showAlert('Password must be at least 8 characters long', 'error');
        valid = false;
        return;
      }
      var confirmPass = getFieldVal('confirmPassword', 'confirmPassword');
      if (formData.password !== confirmPass) {
        showFieldError('confirmPasswordError', 'Passwords do not match');
        showAlert('Passwords do not match', 'error');
        valid = false;
        return;
      }

      // Terms checkbox
      var terms = registerForm.querySelector('input[name="terms"]');
      if (terms && !terms.checked) {
        showAlert('Please agree to the Terms of Service', 'error');
        valid = false;
        return;
      }

      if (!valid) return;

      // Add role-specific fields
      if (formData.role === 'restaurant') {
        formData.restaurantType = getFieldVal('restaurantType', 'restaurantType') || 'casual-dining';
        formData.fssaiLicense = getFieldVal('fssai', 'fssaiLicense') || '11521001000999';
        formData.avgSurplus = getFieldVal('avgSurplus', 'avgDailySurplus') || '25-50';
        formData.supportingDocument = getFieldVal('supportingDocument', 'supportingDocument') || '';
      } else {
        formData.ngoRegNumber = getFieldVal('ngoRegNumber', 'ngoRegistration') || 'NGO-MH-2024-001';
        formData.beneficiaries = Number(getFieldVal('beneficiaries', 'beneficiariesServed')) || 50;
        formData.operatingAreas = getFieldVal('operatingAreas', 'operatingAreas') || 'Mumbai';
        formData.pickupVehicle = getFieldVal('pickupVehicle', 'pickupVehicle') || 'yes';
        formData.supportingDocument = getFieldVal('ngoDoc', 'ngoDoc') || '';
        // Food preferences (checkboxes)
        formData.foodPreferences = [];
        document.querySelectorAll('input[name="foodPreferences"]:checked, input[name="foodPref"]:checked').forEach(function(cb) {
          formData.foodPreferences.push(cb.value);
        });
        if (formData.foodPreferences.length === 0) formData.foodPreferences = ['vegetarian', 'both'];
      }

      try {
        var data = await fetchApi('/api/auth/register', {
          method: 'POST',
          body: formData
        });
        setToken(data.token);
        setUser(data.user);
        showAlert('Registration successful! Your account is pending administrator verification.', 'success');
        setTimeout(function() {
          window.location.href = getDashboardUrl(data.user.role);
        }, 1000);
      } catch (err) {
        showAlert(err.message || 'Registration failed. Please try again.', 'error');
      }
    });

    setupPasswordToggle();
  }

  // --- Helper Functions ---

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    if (el) { el.textContent = message; el.style.display = 'block'; }
  }

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(function(el) {
      el.textContent = '';
      el.style.display = 'none';
    });
  }

  function setupPasswordToggle() {
    document.querySelectorAll('.password-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var wrapper = this.closest('.password-wrapper') || this.parentElement;
        var input = wrapper.querySelector('input');
        if (input.type === 'password') {
          input.type = 'text';
          this.textContent = '🙈';
        } else {
          input.type = 'password';
          this.textContent = '👁';
        }
      });
    });
  }
});
