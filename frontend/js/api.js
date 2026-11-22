// FoodBridge — API Helper
// Shared utility used by all pages for API calls, auth, and UI helpers

var API_BASE = '';

// --- Auth Token & User ---
function getToken() { return localStorage.getItem('foodbridge_token'); }
function setToken(token) { localStorage.setItem('foodbridge_token', token); }
function removeToken() { localStorage.removeItem('foodbridge_token'); }

function getUser() {
  try { return JSON.parse(localStorage.getItem('foodbridge_user')); }
  catch { return null; }
}
function setUser(user) { localStorage.setItem('foodbridge_user', JSON.stringify(user)); }
function removeUser() { localStorage.removeItem('foodbridge_user'); }

function isLoggedIn() { return !!getToken(); }
function getUserRole() { var u = getUser(); return u ? u.role : null; }

// --- API Fetch Wrapper ---
async function fetchApi(endpoint, options) {
  options = options || {};
  var headers = options.headers || {};

  var isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var fetchOpts = {
    method: options.method || 'GET',
    headers: headers
  };

  if (options.body) {
    fetchOpts.body = isFormData ? options.body : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
  }

  var response = await fetch(API_BASE + endpoint, fetchOpts);

  if (response.status === 401) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }

  var data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

// --- Logout ---
function logout() {
  removeToken();
  removeUser();
  window.location.href = '/login';
}

// --- Alert Messages ---
function showAlert(message, type) {
  type = type || 'success';
  var existing = document.querySelector('.alert');
  if (existing) existing.remove();

  var alert = document.createElement('div');
  alert.className = 'alert alert-' + type;
  alert.textContent = message;

  // Add close button
  var close = document.createElement('span');
  close.textContent = '×';
  close.style.cssText = 'float:right;cursor:pointer;font-size:1.2rem;margin-left:12px;';
  close.onclick = function() { alert.remove(); };
  alert.prepend(close);

  document.body.prepend(alert);
  setTimeout(function() { if (alert.parentNode) alert.remove(); }, 4000);
}

// --- Date Formatting ---
function formatDate(dateString) {
  var d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateString) {
  var d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateString) {
  var seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
  var days = Math.floor(hours / 24);
  if (days < 30) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
  return formatDate(dateString);
}

function getTimeRemaining(deadline) {
  var now = Date.now();
  var end = new Date(deadline).getTime();
  var diff = end - now;
  var isExpired = diff <= 0;
  var totalMinutes = Math.max(0, Math.floor(diff / 60000));
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  var urgency = isExpired ? 'expired' : hours < 1 ? 'critical' : hours < 3 ? 'warning' : 'normal';
  return { hours: hours, minutes: minutes, isExpired: isExpired, urgency: urgency };
}

// --- Dashboard redirect by role ---
function getDashboardUrl(role) {
  if (role === 'restaurant') return '/restaurant-dashboard';
  if (role === 'ngo') return '/ngo-dashboard';
  if (role === 'admin') return '/admin';
  return '/login';
}

// --- Navbar Auth State Update ---
document.addEventListener('DOMContentLoaded', function() {
  var navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  if (isLoggedIn()) {
    var user = getUser();
    var role = user ? user.role : 'restaurant';
    var dashUrl = getDashboardUrl(role);
    var orgName = user ? (user.orgName || user.firstName || 'Dashboard') : 'Dashboard';

    // Replace Login/Register with Dashboard + Logout
    var loginLink = navLinks.querySelector('a[href="/login"]');
    var registerLink = navLinks.querySelector('a[href="/register"]');
    if (loginLink) loginLink.parentElement.remove();
    if (registerLink) registerLink.parentElement.remove();

    var dashLi = document.createElement('li');
    dashLi.innerHTML = '<a href="' + dashUrl + '" class="btn btn-primary btn-sm">' + orgName + '</a>';
    navLinks.appendChild(dashLi);

    var logoutLi = document.createElement('li');
    logoutLi.innerHTML = '<a href="#" class="btn btn-secondary btn-sm" id="navLogout">Logout</a>';
    navLinks.appendChild(logoutLi);
    document.getElementById('navLogout').addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });
    // Close on link click
    navLinks.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navLinks.classList.remove('active');
      });
    });
  }
});
