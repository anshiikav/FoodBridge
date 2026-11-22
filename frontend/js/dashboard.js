// FoodBridge — Dynamic Dashboard Controller
// Powers Restaurant Dashboard, NGO Dashboard, and Admin Dashboard with live MongoDB data

document.addEventListener('DOMContentLoaded', async function() {
  // 1. Role-based Route Protection
  var user = getUser();
  var currentPath = window.location.pathname;

  if (currentPath.includes('dashboard') || currentPath.includes('admin')) {
    if (!isLoggedIn() || !user) {
      showAlert('Please log in to access your dashboard.', 'error');
      setTimeout(function() { window.location.href = '/login'; }, 1000);
      return;
    }

    if (currentPath.includes('restaurant-dashboard') && user.role !== 'restaurant') {
      showAlert('Access restricted to Restaurant accounts.', 'error');
      setTimeout(function() { window.location.href = getDashboardUrl(user.role); }, 1200);
      return;
    }

    if (currentPath.includes('ngo-dashboard') && user.role !== 'ngo') {
      showAlert('Access restricted to NGO accounts.', 'error');
      setTimeout(function() { window.location.href = getDashboardUrl(user.role); }, 1200);
      return;
    }

    if (currentPath.includes('admin') && user.role !== 'admin') {
      showAlert('Access restricted to Administrators.', 'error');
      setTimeout(function() { window.location.href = getDashboardUrl(user.role); }, 1200);
      return;
    }
  }

  // 2. Set Header Information
  var userNameEl = document.getElementById('userName');
  if (userNameEl && user) {
    userNameEl.textContent = user.orgName || (user.firstName + ' ' + user.lastName);
  }

  // 3. Sidebar Navigation & URL Hash Management
  setupSidebarNavigation();

  // 4. Logout handling
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }

  // 5. Initialize Specific Dashboard
  if (currentPath.includes('restaurant-dashboard')) {
    await initRestaurantDashboard();
  } else if (currentPath.includes('ngo-dashboard')) {
    await initNgoDashboard();
  } else if (currentPath.includes('admin')) {
    await initAdminDashboard();
  }

  // 6. CSV Export Listeners
  function triggerCsvDownload() {
    var token = getToken();
    var downloadUrl = '/api/donations/export/csv';
    fetch(downloadUrl, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Failed to generate CSV export');
      return res.blob();
    })
    .then(function(blob) {
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'foodbridge-donations-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showAlert('📥 CSV report downloaded successfully!', 'success');
    })
    .catch(function(err) {
      showAlert(err.message || 'Could not export CSV', 'error');
    });
  }

  document.getElementById('exportRestaurantCsvBtn')?.addEventListener('click', triggerCsvDownload);
  document.getElementById('exportNgoCsvBtn')?.addEventListener('click', triggerCsvDownload);

  // 7. Notifications Bell & Panel
  setupNotifications();

  // 8. Re-apply Hindi translations if active
  if (typeof getLanguage === 'function' && getLanguage() === 'hi' && window.applyTranslations) {
    setTimeout(function() { window.applyTranslations('hi'); }, 100);
  }
});

// ============================================================================
// SIDEBAR NAVIGATION & ROUTING
// ============================================================================
function setupSidebarNavigation() {
  var sidebarLinks = document.querySelectorAll('.sidebar-link');
  var pageTitle = document.getElementById('pageTitle');

  function activateSection(sectionId) {
    sidebarLinks.forEach(function(l) {
      l.classList.toggle('active', l.getAttribute('data-section') === sectionId);
    });

    document.querySelectorAll('.dashboard-section').forEach(function(sec) {
      var id = sec.id.replace('Section', '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      sec.classList.toggle('active', id === sectionId);
    });

    var activeLink = document.querySelector('.sidebar-link[data-section="' + sectionId + '"]');
    if (activeLink && pageTitle) {
      pageTitle.textContent = activeLink.textContent.replace(/^[\s\S]?\s/, '').trim();
    }

    history.replaceState(null, '', '#' + sectionId);

    var layout = document.querySelector('.dashboard-layout');
    if (layout) layout.classList.remove('sidebar-open');
  }

  sidebarLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var target = this.getAttribute('data-section');
      activateSection(target);
    });
  });

  document.querySelectorAll('a[data-section], button[data-section]').forEach(function(el) {
    if (el.classList.contains('sidebar-link')) return;
    el.addEventListener('click', function(e) {
      e.preventDefault();
      activateSection(this.getAttribute('data-section'));
    });
  });

  var initialHash = window.location.hash.replace('#', '') || 'overview';
  activateSection(initialHash);

  var sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      var layout = document.querySelector('.dashboard-layout');
      if (layout) layout.classList.toggle('sidebar-open');
    });
  }
}

// ============================================================================
// RESTAURANT DASHBOARD LOGIC
// ============================================================================
async function initRestaurantDashboard() {
  var user = getUser();
  try {
    var meRes = await fetchApi('/api/auth/me');
    if (meRes && meRes.user) {
      setUser(meRes.user);
      user = meRes.user;
    }
  } catch (_e) {}

  renderOrganizationVerificationStatus(user, 'restaurant');
  await loadRestaurantOverview();
  setupDonationCreationForm();
  setupEditDonationModal();
  setupRestaurantProfileForm();

  // Refresh on section switches
  document.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.addEventListener('click', function() {
      var sec = this.getAttribute('data-section');
      if (sec === 'overview' || sec === 'my-donations' || sec === 'accepted' || sec === 'history') {
        loadRestaurantOverview();
      }
    });
  });
}

function renderOrganizationVerificationStatus(user, role) {
  if (!user) return;
  var vStatus = user.verificationStatus || (user.status === 'verified' ? 'verified' : (user.status === 'rejected' ? 'rejected' : 'pending'));
  var isSuspended = user.status === 'suspended';

  // 1. Header verification badge
  var badgeEl = document.getElementById('userVerificationBadge');
  if (badgeEl) {
    if (isSuspended) {
      badgeEl.innerHTML = '<span class="badge badge-danger" style="margin-left:8px; font-weight:700;">⛔ Account Suspended</span>';
    } else if (vStatus === 'verified') {
      badgeEl.innerHTML = `<span class="badge badge-veg" style="margin-left:8px; font-weight:700;">✓ Verified ${role === 'restaurant' ? 'Restaurant' : 'NGO'}</span>`;
    } else if (vStatus === 'rejected') {
      badgeEl.innerHTML = '<span class="badge badge-danger" style="margin-left:8px; font-weight:700;">✗ Verification Rejected</span>';
    } else {
      badgeEl.innerHTML = '<span class="badge" style="margin-left:8px; background:#FEF3C7; color:#D97706; font-weight:700; border:1px solid #FDE68A;">⏳ Verification Pending</span>';
    }
  }

  // 2. Alert Banner in main dashboard overview
  var bannerContainer = document.getElementById('verificationBannerContainer');
  if (bannerContainer) {
    if (isSuspended) {
      bannerContainer.innerHTML = `
        <div class="card mb-3" style="background:#FEF2F2; border-left:4px solid #DC2626; padding:16px 20px; display:flex; align-items:center; gap:14px; border-radius:8px;">
          <span style="font-size:1.8rem;">⛔</span>
          <div style="flex:1;">
            <h4 style="margin:0 0 4px 0; color:#991B1B; font-size:1.05rem;">Organization Account Suspended</h4>
            <p style="margin:0; font-size:0.95rem; color:#7F1D1D; line-height:1.5;">
              Your organization account has been suspended by an administrator. You cannot participate in food donations. Please contact administrator at <strong>hello@foodbridge.org</strong>.
            </p>
          </div>
          <span class="badge badge-danger">SUSPENDED</span>
        </div>
      `;
    } else if (vStatus === 'pending') {
      bannerContainer.innerHTML = `
        <div class="card mb-3" style="background:#FFFBEB; border-left:4px solid #F59E0B; padding:16px 20px; display:flex; align-items:center; gap:14px; border-radius:8px;">
          <span style="font-size:1.8rem;">⏳</span>
          <div style="flex:1;">
            <h4 style="margin:0 0 4px 0; color:#B45309; font-size:1.05rem;">Organization Awaiting Verification</h4>
            <p style="margin:0; font-size:0.95rem; color:#92400E; line-height:1.5;">
              Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.
            </p>
          </div>
          <span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:700; border:1px solid #FDE68A;">PENDING APPROVAL</span>
        </div>
      `;
    } else if (vStatus === 'rejected') {
      bannerContainer.innerHTML = `
        <div class="card mb-3" style="background:#FEF2F2; border-left:4px solid #EF4444; padding:16px 20px; display:flex; align-items:center; gap:14px; border-radius:8px;">
          <span style="font-size:1.8rem;">❌</span>
          <div style="flex:1;">
            <h4 style="margin:0 0 4px 0; color:#B91C1C; font-size:1.05rem;">Organization Verification Not Approved</h4>
            <p style="margin:0; font-size:0.95rem; color:#991B1B; line-height:1.5;">
              Administrator Rejection Reason: <strong>${user.rejectionReason || 'Submitted business credentials could not be verified.'}</strong>
            </p>
            <small style="color:#7F1D1D; display:block; margin-top:4px;">Please update your organization credentials in your profile or contact administrator at <strong>hello@foodbridge.org</strong>.</small>
          </div>
          <span class="badge badge-danger">REJECTED</span>
        </div>
      `;
    } else {
      bannerContainer.innerHTML = '';
    }
  }

  // 3. For Restaurant: restrict New Donation section if unverified
  if (role === 'restaurant') {
    var newDonBanner = document.getElementById('newDonationBannerContainer');
    var donForm = document.getElementById('donationForm');
    var submitBtn = donForm ? donForm.querySelector('button[type="submit"]') : null;

    if (vStatus !== 'verified' || isSuspended) {
      if (newDonBanner) {
        newDonBanner.innerHTML = `
          <div class="card mb-3" style="background:#FFFBEB; border-left:4px solid #F59E0B; padding:14px 18px; margin-bottom:16px; border-radius:8px;">
            <strong style="color:#B45309;">⚠️ Verification Required:</strong>
            <span style="color:#92400E; font-size:0.95rem;">
              Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.
            </span>
          </div>
        `;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.65';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.title = 'Account must be verified by an administrator to publish donations.';
        submitBtn.textContent = 'Verification Required to Publish';
      }
    } else {
      if (newDonBanner) newDonBanner.innerHTML = '';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.title = '';
        submitBtn.textContent = 'Publish Donation';
      }
    }
  }

  // 4. For NGO: restrict Available Food section if unverified
  if (role === 'ngo') {
    var ngoFoodBanner = document.getElementById('ngoAvailableFoodBanner');
    if (vStatus !== 'verified' || isSuspended) {
      if (ngoFoodBanner) {
        ngoFoodBanner.innerHTML = `
          <div class="card mb-3" style="background:#FFFBEB; border-left:4px solid #F59E0B; padding:14px 18px; margin-bottom:16px; border-radius:8px;">
            <strong style="color:#B45309;">⚠️ Verification Required:</strong>
            <span style="color:#92400E; font-size:0.95rem;">
              Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.
            </span>
          </div>
        `;
      }
    } else {
      if (ngoFoodBanner) ngoFoodBanner.innerHTML = '';
    }
  }
}

async function loadRestaurantOverview() {
  try {
    var res = await fetchApi('/api/donations/my/created');
    var donations = res.donations || [];

    var active = donations.filter(function(d) { return d.status === 'available'; });
    var accepted = donations.filter(function(d) { return d.status === 'accepted' || d.status === 'pickup-scheduled'; });
    var completed = donations.filter(function(d) { return d.status === 'completed'; });

    // 1. Update Overview Metric Counters
    var totalEl = document.getElementById('totalDonations');
    var activeEl = document.getElementById('activeDonations');
    var acceptedEl = document.getElementById('acceptedDonations');
    var completedEl = document.getElementById('completedDonations');

    if (totalEl) totalEl.textContent = donations.length;
    if (activeEl) activeEl.textContent = active.length;
    if (acceptedEl) acceptedEl.textContent = accepted.length;
    if (completedEl) completedEl.textContent = completed.length;

    // Update restaurant-specific environmental contribution
    var completedMeals = completed.reduce(function(sum, d) { return sum + (d.quantity || 0); }, 0);
    var foodRescuedKg = (completedMeals * 0.4).toFixed(1);
    var co2SavedKg = (foodRescuedKg * 2.5).toFixed(1);

    var restFoodEl = document.getElementById('restFoodRescued');
    var restCo2El = document.getElementById('restCo2Diverted');
    var restMealsEl = document.getElementById('restMealsCount');

    if (restFoodEl) restFoodEl.textContent = foodRescuedKg + ' kg';
    if (restCo2El) restCo2El.textContent = co2SavedKg + ' kg';
    if (restMealsEl) restMealsEl.textContent = completedMeals;

    // 2. Render Overview Recent Donations
    var recentEl = document.getElementById('recentDonations');
    if (recentEl) {
      if (donations.length === 0) {
        recentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>No donations yet</h3>
            <p>Create your first food donation to start bridging surplus with those in need!</p>
            <a href="#new-donation" class="btn btn-primary btn-sm" data-section="new-donation">Create Donation</a>
          </div>
        `;
      } else {
        recentEl.innerHTML = donations.slice(0, 4).map(function(d) {
          return renderRestaurantDonationCard(d);
        }).join('');
      }
    }

    // 3. Render "My Donations" Section with Real-Time Status & Category Categorization Filter
    var myListEl = document.getElementById('myDonationsList');
    var statusFilterSelect = document.getElementById('donationStatusFilter');
    var catFilterSelect = document.getElementById('donationCategoryFilter');
    var searchInput = document.getElementById('donationSearch');
    var resetDonBtn = document.getElementById('resetDonationFiltersBtn');

    // Update Counter Badges
    var countAll = donations.filter(function(d) { return d.status === 'available' || d.status === 'accepted' || d.status === 'pickup-scheduled'; }).length;
    var countAva = donations.filter(function(d) { return d.status === 'available'; }).length;
    var countAcc = donations.filter(function(d) { return d.status === 'accepted'; }).length;
    var countSched = donations.filter(function(d) { return d.status === 'pickup-scheduled'; }).length;

    var elAll = document.getElementById('countAllDon');
    var elAva = document.getElementById('countAvaDon');
    var elAcc = document.getElementById('countAccDon');
    var elSched = document.getElementById('countSchedDon');
    if (elAll) elAll.textContent = countAll;
    if (elAva) elAva.textContent = countAva;
    if (elAcc) elAcc.textContent = countAcc;
    if (elSched) elSched.textContent = countSched;

    function renderMyDonationsList() {
      if (!myListEl) return;
      var selectedStatus = statusFilterSelect ? statusFilterSelect.value : 'all';
      var selectedCat = catFilterSelect ? catFilterSelect.value : '';
      var query = searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '';

      var filtered = donations.filter(function(d) {
        // Status filter
        if (selectedStatus === 'all') {
          if (d.status !== 'available' && d.status !== 'accepted' && d.status !== 'pickup-scheduled') return false;
        } else if (selectedStatus === 'available') {
          if (d.status !== 'available') return false;
        } else if (selectedStatus === 'accepted') {
          if (d.status !== 'accepted' && d.status !== 'pickup-scheduled') return false;
        } else if (selectedStatus === 'pickup-scheduled') {
          if (d.status !== 'pickup-scheduled') return false;
        } else {
          if (d.status !== selectedStatus) return false;
        }

        // Category filter
        if (selectedCat && d.category !== selectedCat) return false;

        // Search text
        if (query) {
          var nameMatch = (d.foodName || '').toLowerCase().includes(query);
          var descMatch = (d.description || '').toLowerCase().includes(query);
          if (!nameMatch && !descMatch) return false;
        }

        return true;
      });

      if (filtered.length === 0) {
        myListEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No donations found</h3><p>No donations match your selected status and category filters.</p></div>`;
      } else {
        myListEl.innerHTML = filtered.map(function(d) { return renderRestaurantDonationCard(d); }).join('');
      }
    }

    renderMyDonationsList();

    // Wire status tabs
    document.querySelectorAll('.status-tab-btn').forEach(function(btn) {
      if (btn.getAttribute('data-wired')) return;
      btn.setAttribute('data-wired', 'true');
      btn.addEventListener('click', function() {
        document.querySelectorAll('.status-tab-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        var targetStatus = this.getAttribute('data-status');
        if (statusFilterSelect) statusFilterSelect.value = targetStatus;
        renderMyDonationsList();
      });
    });

    if (statusFilterSelect && !statusFilterSelect.getAttribute('data-wired')) {
      statusFilterSelect.setAttribute('data-wired', 'true');
      statusFilterSelect.addEventListener('change', function() {
        var val = this.value;
        document.querySelectorAll('.status-tab-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-status') === val);
        });
        renderMyDonationsList();
      });
    }

    if (catFilterSelect && !catFilterSelect.getAttribute('data-wired')) {
      catFilterSelect.setAttribute('data-wired', 'true');
      catFilterSelect.addEventListener('change', renderMyDonationsList);
    }

    if (searchInput && !searchInput.getAttribute('data-wired')) {
      searchInput.setAttribute('data-wired', 'true');
      searchInput.addEventListener('input', renderMyDonationsList);
    }

    if (resetDonBtn && !resetDonBtn.getAttribute('data-wired')) {
      resetDonBtn.setAttribute('data-wired', 'true');
      resetDonBtn.addEventListener('click', function() {
        if (statusFilterSelect) statusFilterSelect.value = 'all';
        if (catFilterSelect) catFilterSelect.value = '';
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.status-tab-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-status') === 'all');
        });
        renderMyDonationsList();
      });
    }

    // 4. Render "Accepted Donations" Section (with QR code to present at pickup!)
    var acceptedListEl = document.getElementById('acceptedList');
    if (acceptedListEl) {
      if (accepted.length === 0) {
        acceptedListEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><h3>No accepted donations right now</h3><p>When an NGO claims a donation, it will show up here with pickup details and QR code verification.</p></div>';
      } else {
        acceptedListEl.innerHTML = accepted.map(function(d) {
          var ngoName = d.acceptedBy ? (d.acceptedBy.orgName || 'Partner NGO') : 'Assigned NGO';
          var ngoPhone = d.acceptedBy ? (d.acceptedBy.phone || '') : '';
          return `
            <div class="card mb-3" style="border-left: 4px solid var(--accent); display:flex; gap:20px; flex-wrap:wrap; align-items:center;">
              <div style="flex:1; min-width:260px;">
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                  <span class="badge badge-accepted">ACCEPTED BY NGO</span>
                  <span class="badge badge-veg">${d.dietType.toUpperCase()}</span>
                </div>
                <h3>${d.foodName}</h3>
                <p class="text-muted">Quantity: <strong>${d.quantity} servings</strong></p>
                <p>🤝 Claimed by: <strong>${ngoName}</strong> ${ngoPhone ? '(' + ngoPhone + ')' : ''}</p>
                <p>⏰ Pickup Deadline: <strong>${formatDateTime(d.pickupDeadline)}</strong></p>
                <div style="margin-top:12px; background:var(--primary-bg); padding:10px 14px; border-radius:var(--radius-sm); display:inline-block;">
                  Verification Pickup Code: <strong style="font-size:1.15rem; letter-spacing:1px; color:var(--primary);">${d.pickupCode || 'N/A'}</strong>
                </div>
              </div>
              ${d.qrCodeDataUrl ? `
                <div style="text-align:center;">
                  <img src="${d.qrCodeDataUrl}" alt="Pickup QR Code" style="width:130px; height:130px; border-radius:8px; border:1px solid var(--border);">
                  <small class="text-muted" style="display:block;margin-top:4px;">Show to NGO at pickup</small>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    // 5. Render History Section with Date and Status Categorization Filtering
    var historyTableBody = document.getElementById('historyTableBody');
    var historyEmpty = document.getElementById('historyEmpty');
    var histStatusSelect = document.getElementById('historyStatusFilter');
    var histFromInput = document.getElementById('historyFrom');
    var histToInput = document.getElementById('historyTo');

    function renderRestaurantHistory() {
      if (!historyTableBody) return;
      var statusVal = histStatusSelect ? histStatusSelect.value : 'all';
      var fromVal = histFromInput && histFromInput.value ? new Date(histFromInput.value + 'T00:00:00').getTime() : null;
      var toVal = histToInput && histToInput.value ? new Date(histToInput.value + 'T23:59:59.999').getTime() : null;

      var pastDonations = donations.filter(function(d) {
        var isHistorical = d.status === 'completed' || d.status === 'cancelled' || d.status === 'expired';
        if (!isHistorical) return false;

        if (statusVal !== 'all' && d.status !== statusVal) return false;

        var dTime = new Date(d.updatedAt || d.createdAt).getTime();
        if (fromVal && dTime < fromVal) return false;
        if (toVal && dTime > toVal) return false;

        return true;
      });

      if (pastDonations.length === 0) {
        historyTableBody.innerHTML = '';
        if (historyEmpty) historyEmpty.style.display = 'block';
      } else {
        if (historyEmpty) historyEmpty.style.display = 'none';
        historyTableBody.innerHTML = pastDonations.map(function(d) {
          var ngoName = d.acceptedBy ? (d.acceptedBy.orgName || 'NGO Partner') : '—';
          var statusBadge = d.status === 'completed'
            ? '<span class="badge badge-completed">Completed</span>'
            : (d.status === 'cancelled' ? '<span class="badge badge-danger" style="background:#FEE2E2; color:#DC2626;">Cancelled</span>' : '<span class="badge badge-danger">Expired</span>');

          var certAction = d.status === 'completed'
            ? `<button class="btn btn-secondary btn-sm cert-btn" data-id="${d._id}">📜 Certificate</button>`
            : '—';

          return `
            <tr>
              <td>${formatDate(d.updatedAt || d.createdAt)}</td>
              <td><strong>${d.foodName}</strong></td>
              <td>${ngoName}</td>
              <td>${d.quantity} servings</td>
              <td>${statusBadge}</td>
              <td>${certAction}</td>
            </tr>
          `;
        }).join('');

        // Attach certificate click listeners
        historyTableBody.querySelectorAll('.cert-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var dId = this.getAttribute('data-id');
            showDonationCertificate(dId);
          });
        });
      }
    }

    renderRestaurantHistory();

    // Wire quick date pills for Restaurant History
    document.querySelectorAll('.rest-date-pill').forEach(function(pill) {
      if (pill.getAttribute('data-wired')) return;
      pill.setAttribute('data-wired', 'true');
      pill.addEventListener('click', function() {
        document.querySelectorAll('.rest-date-pill').forEach(function(p) { p.classList.remove('active'); });
        this.classList.add('active');
        var range = this.getAttribute('data-range');
        var now = new Date();
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        var toDateStr = function(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

        if (range === 'today') {
          if (histFromInput) histFromInput.value = toDateStr(now);
          if (histToInput) histToInput.value = toDateStr(now);
        } else if (range === 'week') {
          var weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
          if (histFromInput) histFromInput.value = toDateStr(weekAgo);
          if (histToInput) histToInput.value = toDateStr(now);
        } else if (range === 'month') {
          var monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
          if (histFromInput) histFromInput.value = toDateStr(monthAgo);
          if (histToInput) histToInput.value = toDateStr(now);
        } else {
          if (histFromInput) histFromInput.value = '';
          if (histToInput) histToInput.value = '';
        }
        renderRestaurantHistory();
      });
    });

    // Wire reset button
    var resetHistBtn = document.getElementById('resetHistoryBtn');
    if (resetHistBtn && !resetHistBtn.getAttribute('data-wired')) {
      resetHistBtn.setAttribute('data-wired', 'true');
      resetHistBtn.addEventListener('click', function() {
        if (histStatusSelect) histStatusSelect.value = 'all';
        if (histFromInput) histFromInput.value = '';
        if (histToInput) histToInput.value = '';
        document.querySelectorAll('.rest-date-pill').forEach(function(p) {
          p.classList.toggle('active', p.getAttribute('data-range') === 'all');
        });
        renderRestaurantHistory();
      });
    }

    if (histStatusSelect && !histStatusSelect.getAttribute('data-wired')) {
      histStatusSelect.setAttribute('data-wired', 'true');
      histStatusSelect.addEventListener('change', renderRestaurantHistory);
    }
    if (histFromInput && !histFromInput.getAttribute('data-wired')) {
      histFromInput.setAttribute('data-wired', 'true');
      histFromInput.addEventListener('change', renderRestaurantHistory);
      histFromInput.addEventListener('input', renderRestaurantHistory);
    }
    if (histToInput && !histToInput.getAttribute('data-wired')) {
      histToInput.setAttribute('data-wired', 'true');
      histToInput.addEventListener('change', renderRestaurantHistory);
      histToInput.addEventListener('input', renderRestaurantHistory);
    }

  } catch (err) {
    console.error('Restaurant dashboard error:', err);
  }
}

function renderRestaurantDonationCard(d) {
  var timeRemaining = getTimeRemaining(d.pickupDeadline);
  var deadlineBadge = timeRemaining.isExpired
    ? '<span class="badge badge-danger">Expired</span>'
    : '<span class="badge" style="background:#E3F2FD;color:#1565C0;">⏰ ' + timeRemaining.hours + 'h ' + timeRemaining.minutes + 'm left</span>';

  var statusBadge = d.status === 'available'
    ? '<span class="badge badge-available">Available</span>'
    : (d.status === 'accepted' ? '<span class="badge badge-accepted">Accepted</span>' : '<span class="badge badge-completed">Completed</span>');

  var editAction = d.status === 'available'
    ? `<button class="btn btn-secondary btn-sm edit-donation-btn" data-id="${d._id}">✏️ Edit</button>`
    : '';

  var cancelAction = d.status === 'available'
    ? `<button class="btn btn-danger btn-sm cancel-donation-btn" data-id="${d._id}">Cancel Listing</button>`
    : '';

  return `
    <div class="card mb-3 donation-card" style="display:flex;gap:16px;">
      <div style="flex:1;">
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <span class="badge badge-veg">${d.dietType.toUpperCase()}</span>
          ${statusBadge}
          ${deadlineBadge}
        </div>
        <h3>${d.foodName}</h3>
        <p class="donation-desc">${d.description || 'No description provided.'}</p>
        <div class="donation-meta">
          <span>👥 <strong>${d.quantity}</strong> servings</span>
          <span>📦 Category: ${d.category}</span>
          <span>⏰ Pickup: ${formatDateTime(d.pickupDeadline)}</span>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          ${editAction}
          ${cancelAction}
        </div>
      </div>
    </div>
  `;
}

function setupDonationCreationForm() {
  var donationForm = document.getElementById('donationForm');
  if (!donationForm) return;

  var user = getUser();
  if (user) {
    var addrInput = document.getElementById('pickupAddress');
    var contactInput = document.getElementById('contactPerson');
    var phoneInput = document.getElementById('contactPhone');
    if (addrInput && !addrInput.value) addrInput.value = user.address || '';
    if (contactInput && !contactInput.value) contactInput.value = (user.firstName + ' ' + user.lastName).trim();
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
  }

  // Quick fill templates
  document.querySelectorAll('.template-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = this.getAttribute('data-type');
      var now = new Date();
      var oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      var fourHoursLater = new Date(now.getTime() + 5 * 60 * 60 * 1000);

      function toLocalIso(d) {
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      }

      var templates = {
        lunch: {
          name: 'Lunch Buffet Surplus: Paneer Makhani & Pulao',
          desc: 'Freshly prepared executive lunch buffet including rich paneer makhani, jeera basmati rice, dal tadka, and whole wheat rotis in insulated hot containers.',
          cat: 'cooked-meals',
          diet: 'vegetarian',
          qty: 35
        },
        dinner: {
          name: 'North Indian Curry & Steamed Rice Feast',
          desc: 'Slow-simmered vegetable curry with fragrant steamed basmati rice and roasted papad. Packed in hygienic sealed food catering boxes.',
          cat: 'cooked-meals',
          diet: 'vegetarian',
          qty: 50
        },
        bakery: {
          name: 'Assorted Artisan Dinner Rolls & Multigrain Buns',
          desc: 'Fresh morning bake of soft multigrain dinner rolls, burger buns, and garlic focaccia loaves. Uncut, room-temperature shelf life.',
          cat: 'baked-goods',
          diet: 'vegetarian',
          qty: 40
        },
        produce: {
          name: 'Farm Fresh Organic Vegetable Crates',
          desc: 'Uncooked washed carrots, capsicum, tomatoes, and cabbage delivered this morning from local Maharashtra farms.',
          cat: 'fruits-vegetables',
          diet: 'vegan',
          qty: 25
        },
        khichdi: {
          name: 'Gujarati Moong Dal Khichdi & Spiced Kadhi',
          desc: 'Comforting turmeric moong dal khichdi paired with warm yogurt kadhi and pickled carrots. Packed in thermal containers.',
          cat: 'cooked-meals',
          diet: 'vegetarian',
          qty: 45
        }
      };

      var tpl = templates[type];
      if (tpl) {
        var fn = document.getElementById('foodName');
        var fd = document.getElementById('foodDesc');
        var fc = document.getElementById('foodCategory');
        var dt = document.getElementById('dietType');
        var qt = document.getElementById('quantity');
        var pt = document.getElementById('prepTime');
        var pd = document.getElementById('pickupDeadline');

        if (fn) fn.value = tpl.name;
        if (fd) fd.value = tpl.desc;
        if (fc) fc.value = tpl.cat;
        if (dt) dt.value = tpl.diet;
        if (qt) qt.value = tpl.qty;
        if (pt) pt.value = toLocalIso(oneHourAgo);
        if (pd) pd.value = toLocalIso(fourHoursLater);

        donationForm.querySelectorAll('.food-safety-checklist input[type="checkbox"]').forEach(function(cb) {
          cb.checked = true;
        });

        showAlert('⚡ Applied template: ' + tpl.name + '. Review and click Publish!', 'success');
      }
    });
  });

  donationForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Check organization verification status
    var currentUser = getUser();
    var currentVStatus = currentUser ? (currentUser.verificationStatus || (currentUser.status === 'verified' ? 'verified' : (currentUser.status === 'rejected' ? 'rejected' : 'pending'))) : 'pending';
    if (currentVStatus !== 'verified' || currentUser?.status === 'suspended') {
      if (currentVStatus === 'rejected') {
        showAlert('Your organization verification was rejected. Reason: ' + (currentUser.rejectionReason || 'Documentation could not be verified') + '. You cannot publish donations.', 'error');
      } else if (currentUser?.status === 'suspended') {
        showAlert('Your organization account is suspended. You cannot publish donations.', 'error');
      } else {
        showAlert('Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.', 'error');
      }
      return;
    }

    var foodName = document.getElementById('foodName')?.value.trim();
    var category = document.getElementById('foodCategory')?.value;
    var dietType = document.getElementById('dietType')?.value;
    var quantity = document.getElementById('quantity')?.value;
    var prepTime = document.getElementById('prepTime')?.value;
    var deadline = document.getElementById('pickupDeadline')?.value;
    var address = document.getElementById('pickupAddress')?.value.trim();
    var contactPerson = document.getElementById('contactPerson')?.value.trim();
    var contactPhone = document.getElementById('contactPhone')?.value.trim();

    if (!foodName || !category || !dietType || !quantity || !prepTime || !deadline || !address) {
      showAlert('Please fill in all required donation fields.', 'error');
      return;
    }

    if (new Date(deadline) <= new Date()) {
      showAlert('Pickup deadline must be in the future.', 'error');
      return;
    }

    if (new Date(prepTime) >= new Date(deadline)) {
      showAlert('Preparation time must be earlier than the pickup deadline.', 'error');
      return;
    }

    var checkboxes = donationForm.querySelectorAll('.food-safety-checklist input[type="checkbox"]');
    var allChecked = true;
    checkboxes.forEach(function(cb) { if (!cb.checked) allChecked = false; });
    if (!allChecked) {
      showAlert('Please complete all food safety confirmations.', 'error');
      return;
    }

    var formData = new FormData();
    formData.append('foodName', foodName);
    formData.append('description', document.getElementById('foodDesc')?.value.trim() || '');
    formData.append('category', category);
    formData.append('dietType', dietType);
    formData.append('quantity', quantity);
    formData.append('preparedAt', prepTime);
    formData.append('pickupDeadline', deadline);
    formData.append('pickupAddress', address);
    formData.append('contactPerson', contactPerson);
    formData.append('contactPhone', contactPhone);
    formData.append('foodSafetyConfirmed', 'true');

    var fileInput = document.getElementById('foodImage');
    if (fileInput && fileInput.files[0]) {
      formData.append('foodImage', fileInput.files[0]);
    }

    try {
      var submitBtn = donationForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Publishing...'; }

      var res = await fetchApi('/api/donations', {
        method: 'POST',
        body: formData,
      });

      showAlert('🎉 ' + res.message, 'success');
      donationForm.reset();

      // Refresh overview and switch to my donations tab
      await loadRestaurantOverview();
      var myDonationsLink = document.querySelector('.sidebar-link[data-section="my-donations"]');
      if (myDonationsLink) myDonationsLink.click();
    } catch (err) {
      showAlert(err.message || 'Failed to publish donation.', 'error');
    } finally {
      var btn = donationForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = 'Publish Donation'; }
    }
  });

  // Attach cancel donation delegation
  document.addEventListener('click', async function(e) {
    if (e.target && e.target.classList.contains('cancel-donation-btn')) {
      var dId = e.target.getAttribute('data-id');
      if (!confirm('Are you sure you want to cancel this donation listing?')) return;
      try {
        await fetchApi('/api/donations/' + dId, { method: 'DELETE' });
        showAlert('Donation listing cancelled.', 'success');
        await loadRestaurantOverview();
      } catch (err) {
        showAlert(err.message || 'Failed to cancel donation.', 'error');
      }
    }
  });
}

function setupEditDonationModal() {
  var modal = document.getElementById('editDonationModal');
  var form = document.getElementById('editDonationForm');
  var closeBtn = document.getElementById('closeEditDonationModal');
  var cancelBtn = document.getElementById('cancelEditDonation');

  if (!modal || !form) return;

  var hideModal = function() { modal.style.display = 'none'; form.reset(); };
  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

  // Edit button delegation
  document.addEventListener('click', async function(e) {
    if (e.target && e.target.classList.contains('edit-donation-btn')) {
      var dId = e.target.getAttribute('data-id');
      try {
        var res = await fetchApi('/api/donations/' + dId);
        var d = res.donation;
        if (!d) return;

        document.getElementById('editDonationId').value = d._id;
        document.getElementById('editFoodName').value = d.foodName || '';
        document.getElementById('editFoodDesc').value = d.description || '';
        document.getElementById('editQuantity').value = d.quantity || '';
        document.getElementById('editContactPhone').value = d.contactPhone || '';

        if (d.pickupDeadline) {
          var pad = function(n) { return (n < 10 ? '0' : '') + n; };
          var dl = new Date(d.pickupDeadline);
          document.getElementById('editPickupDeadline').value = dl.getFullYear() + '-' + pad(dl.getMonth() + 1) + '-' + pad(dl.getDate()) + 'T' + pad(dl.getHours()) + ':' + pad(dl.getMinutes());
        }

        modal.style.display = 'flex';
      } catch (err) {
        showAlert(err.message || 'Could not load donation for editing.', 'error');
      }
    }
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var dId = document.getElementById('editDonationId').value;
    var updates = {
      foodName: document.getElementById('editFoodName').value.trim(),
      description: document.getElementById('editFoodDesc').value.trim(),
      quantity: Number(document.getElementById('editQuantity').value),
      pickupDeadline: document.getElementById('editPickupDeadline').value,
      contactPhone: document.getElementById('editContactPhone').value.trim()
    };

    try {
      await fetchApi('/api/donations/' + dId, {
        method: 'PUT',
        body: updates
      });
      showAlert('Donation updated successfully!', 'success');
      hideModal();
      await loadRestaurantOverview();
    } catch (err) {
      showAlert(err.message || 'Failed to update donation.', 'error');
    }
  });
}

function setupRestaurantProfileForm() {
  var profForm = document.getElementById('profileForm');
  if (!profForm) return;

  var user = getUser();
  if (user) {
    setValue('profOrgName', user.orgName);
    setValue('profContact', (user.firstName + ' ' + user.lastName).trim());
    setValue('profEmail', user.email);
    setValue('profPhone', user.phone);
    setValue('profAddress', user.address);
    setValue('profCity', user.city);
    setValue('profPincode', user.pincode);
    setValue('profType', user.restaurantType || 'casual-dining');
    setValue('profFssai', user.fssaiLicense || '');
  }

  profForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
      var updates = {
        orgName: getValue('profOrgName'),
        phone: getValue('profPhone'),
        address: getValue('profAddress'),
        city: getValue('profCity'),
        pincode: getValue('profPincode'),
        restaurantType: getValue('profType'),
        fssaiLicense: getValue('profFssai'),
      };
      var res = await fetchApi('/api/auth/profile', { method: 'PUT', body: updates });
      setUser(res.user);
      showAlert('Profile updated successfully!', 'success');
    } catch (err) {
      showAlert(err.message || 'Failed to update profile.', 'error');
    }
  });
}

// ============================================================================
// NGO DASHBOARD LOGIC
// ============================================================================
async function initNgoDashboard() {
  var user = getUser();
  try {
    var meRes = await fetchApi('/api/auth/me');
    if (meRes && meRes.user) {
      setUser(meRes.user);
      user = meRes.user;
    }
  } catch (_e) {}

  renderOrganizationVerificationStatus(user, 'ngo');
  await loadNgoOverview();
  await loadNgoSmartMatches();
  await loadNgoAvailableFood();
  setupVolunteerManagement();
  setupNgoProfileForm();

  document.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.addEventListener('click', function() {
      var sec = this.getAttribute('data-section');
      if (sec === 'overview' || sec === 'accepted' || sec === 'history') {
        loadNgoOverview();
      } else if (sec === 'smart-matches') {
        loadNgoSmartMatches();
      } else if (sec === 'available-food') {
        loadNgoAvailableFood();
      } else if (sec === 'volunteers') {
        loadVolunteersList();
      }
    });
  });
}

async function loadNgoOverview() {
  try {
    var acceptedRes = await fetchApi('/api/donations/my/accepted');
    var acceptedDonations = acceptedRes.donations || [];

    var activeAccepted = acceptedDonations.filter(function(d) {
      return d.status === 'accepted' || d.status === 'pickup-scheduled';
    });
    var completedPickups = acceptedDonations.filter(function(d) {
      return d.status === 'completed';
    });
    var historicalPickups = acceptedDonations.filter(function(d) {
      return d.status === 'completed' || d.status === 'cancelled' || d.status === 'expired';
    });

    var availableRes = await fetchApi('/api/donations?status=available');
    var availableCount = (availableRes.donations || []).length;

    var totalPeopleServed = completedPickups.reduce(function(sum, d) { return sum + (d.quantity || 0); }, 0);

    // Fetch volunteers list for interactive volunteer assignment
    var volunteersRes = await fetchApi('/api/volunteers').catch(function() { return { volunteers: [] }; });
    var volunteersList = volunteersRes.volunteers || [];

    // Update Overview Metric Cards
    var aNear = document.getElementById('availableNearby');
    var mAcc = document.getElementById('myAccepted');
    var mComp = document.getElementById('myCompleted');
    var pServ = document.getElementById('peopleServed');

    if (aNear) aNear.textContent = availableCount;
    if (mAcc) mAcc.textContent = activeAccepted.length;
    if (mComp) mComp.textContent = completedPickups.length;
    if (pServ) pServ.textContent = totalPeopleServed > 0 ? totalPeopleServed : (completedPickups.length * 40);

    // Render "My Accepted" section with Pickup Code and Interactive Pickup Confirmation
    var acceptedListEl = document.getElementById('acceptedDonationsList');
    if (acceptedListEl) {
      if (activeAccepted.length === 0) {
        acceptedListEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <h3>No pending pickups</h3>
            <p>You have collected all accepted donations! Browse available food or check smart matches to claim more surplus meals.</p>
            <a href="#available-food" class="btn btn-primary btn-sm" data-section="available-food">Find Food</a>
          </div>
        `;
      } else {
        acceptedListEl.innerHTML = activeAccepted.map(function(d) {
          var restName = d.restaurant ? (d.restaurant.orgName || 'Donor Restaurant') : 'Restaurant';
          var restPhone = d.restaurant ? (d.restaurant.phone || '') : '';
          var restAddr = d.pickupAddress || (d.restaurant ? d.restaurant.address : '');

          return `
            <div class="card mb-3" style="border-left: 4px solid var(--accent); display:flex; gap:20px; flex-wrap:wrap;">
              <div style="flex:1; min-width:260px;">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                  <span class="badge badge-accepted">READY FOR PICKUP</span>
                  <span class="badge badge-veg">${d.dietType.toUpperCase()}</span>
                </div>
                <h3>${d.foodName}</h3>
                <p>🍽 Restaurant: <strong>${restName}</strong></p>
                <p>📍 Address: <strong>${restAddr}</strong></p>
                <p>📞 Contact: <strong>${d.contactPerson} (${d.contactPhone || restPhone})</strong></p>
                <p>👥 Quantity: <strong>${d.quantity} servings</strong></p>
                <p>⏰ Pickup Deadline: <strong>${formatDateTime(d.pickupDeadline)}</strong></p>

                <div style="margin:14px 0; background:var(--primary-bg); padding:12px; border-radius:var(--radius-sm); display:inline-block;">
                  Pickup Verification Code: <strong style="font-size:1.2rem; letter-spacing:1px; color:var(--primary);">${d.pickupCode}</strong>
                </div>

                <div style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                  <button class="btn btn-primary btn-sm confirm-pickup-btn" data-id="${d._id}" data-code="${d.pickupCode}">
                    ✓ Confirm Pickup & Delivery
                  </button>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <label style="font-size:0.85rem; margin:0; font-weight:600;">Assign Volunteer:</label>
                    <select class="assign-vol-select" data-donation-id="${d._id}" style="padding:4px 8px; font-size:0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                      <option value="">-- Choose Volunteer --</option>
                      ${volunteersList.map(function(v) {
                        var isAssigned = v.assignedDonation && (v.assignedDonation._id === d._id || v.assignedDonation === d._id);
                        return `<option value="${v._id}" ${isAssigned ? 'selected' : ''}>${v.name} (${v.phone})</option>`;
                      }).join('')}
                    </select>
                  </div>
                </div>
              </div>

              ${d.qrCodeDataUrl ? `
                <div style="text-align:center;">
                  <img src="${d.qrCodeDataUrl}" alt="Pickup QR Code" style="width:130px; height:130px; border-radius:8px; border:1px solid var(--border);">
                  <small class="text-muted" style="display:block;margin-top:4px;">QR Code for verification</small>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        // Attach confirm pickup button listeners
        document.querySelectorAll('.confirm-pickup-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var dId = this.getAttribute('data-id');
            var code = this.getAttribute('data-code');
            var inputCode = prompt('Please enter the pickup code to confirm food collection at the kitchen:', code);
            if (!inputCode) return;

            try {
              btn.disabled = true;
              btn.textContent = 'Verifying...';
              var res = await fetchApi('/api/donations/' + dId + '/confirm-pickup', {
                method: 'POST',
                body: { pickupCode: inputCode.trim() }
              });
              showAlert('✅ Pickup confirmed successfully! Donation marked as completed.', 'success');
              await loadNgoOverview();
            } catch (err) {
              showAlert(err.message || 'Pickup code verification failed.', 'error');
              btn.disabled = false;
              btn.textContent = '✓ Confirm Pickup & Delivery';
            }
          });
        });

        // Attach volunteer assignment listener
        document.querySelectorAll('.assign-vol-select').forEach(function(sel) {
          sel.addEventListener('change', async function() {
            var vId = this.value;
            var dId = this.getAttribute('data-donation-id');
            if (!vId) return;
            try {
              await fetchApi('/api/volunteers/' + vId + '/assign', {
                method: 'PUT',
                body: { donationId: dId }
              });
              showAlert('Volunteer assigned to this pickup successfully!', 'success');
              await loadVolunteersList();
            } catch (err) {
              showAlert(err.message || 'Failed to assign volunteer.', 'error');
            }
          });
        });
      }
    }

    // Render NGO Pickup History with Real-Time Filtering
    var histBody = document.getElementById('historyTableBody');
    var histEmpty = document.getElementById('historyEmpty');
    var ngoHistStatus = document.getElementById('ngoHistoryStatusFilter');
    var ngoHistFrom = document.getElementById('ngoHistoryFrom');
    var ngoHistTo = document.getElementById('ngoHistoryTo');

    function renderNgoHistory() {
      if (!histBody) return;
      var statusVal = ngoHistStatus ? ngoHistStatus.value : 'all';
      var fromVal = ngoHistFrom && ngoHistFrom.value ? new Date(ngoHistFrom.value + 'T00:00:00').getTime() : null;
      var toVal = ngoHistTo && ngoHistTo.value ? new Date(ngoHistTo.value + 'T23:59:59.999').getTime() : null;

      var filtered = historicalPickups.filter(function(d) {
        if (statusVal !== 'all' && d.status !== statusVal) return false;
        var dTime = new Date(d.updatedAt || d.createdAt).getTime();
        if (fromVal && dTime < fromVal) return false;
        if (toVal && dTime > toVal) return false;
        return true;
      });

      if (filtered.length === 0) {
        histBody.innerHTML = '';
        if (histEmpty) histEmpty.style.display = 'block';
      } else {
        if (histEmpty) histEmpty.style.display = 'none';
        histBody.innerHTML = filtered.map(function(d) {
          var restName = d.restaurant ? (d.restaurant.orgName || 'Restaurant') : 'Restaurant';
          var statusBadge = d.status === 'completed'
            ? '<span class="badge badge-completed">Completed</span>'
            : (d.status === 'cancelled' ? '<span class="badge badge-danger" style="background:#FEE2E2; color:#DC2626;">Cancelled</span>' : '<span class="badge badge-danger">Expired</span>');

          var ratingDisplay = d.status === 'completed'
            ? (d.rating ? '★ ' + d.rating + '/5' : '<button class="btn btn-secondary btn-sm rate-btn" data-id="' + d._id + '">Rate</button>')
            : '—';

          var certAction = d.status === 'completed'
            ? `<button class="btn btn-secondary btn-sm cert-btn" data-id="${d._id}">📜 Certificate</button>`
            : '—';

          return `
            <tr>
              <td>${formatDate(d.updatedAt || d.createdAt)}</td>
              <td><strong>${d.foodName}</strong></td>
              <td>${restName}</td>
              <td>${d.quantity} servings</td>
              <td>${statusBadge}</td>
              <td>${ratingDisplay}</td>
              <td>${certAction}</td>
            </tr>
          `;
        }).join('');

        histBody.querySelectorAll('.rate-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            var id = this.getAttribute('data-id');
            var rating = prompt('Rate your experience (1 to 5 stars):', '5');
            if (!rating) return;
            var feedback = prompt('Share a short comment on food quality and coordination:');
            try {
              await fetchApi('/api/donations/' + id + '/feedback', {
                method: 'POST',
                body: { rating: parseInt(rating), feedback: feedback || '' }
              });
              showAlert('Thank you for rating this donation!', 'success');
              await loadNgoOverview();
            } catch (err) {
              showAlert(err.message || 'Failed to submit rating.', 'error');
            }
          });
        });

        histBody.querySelectorAll('.cert-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            showDonationCertificate(this.getAttribute('data-id'));
          });
        });
      }
    }

    renderNgoHistory();

    // Wire quick date pills for NGO History
    document.querySelectorAll('.ngo-date-pill').forEach(function(pill) {
      if (pill.getAttribute('data-wired')) return;
      pill.setAttribute('data-wired', 'true');
      pill.addEventListener('click', function() {
        document.querySelectorAll('.ngo-date-pill').forEach(function(p) { p.classList.remove('active'); });
        this.classList.add('active');
        var range = this.getAttribute('data-range');
        var now = new Date();
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        var toDateStr = function(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

        if (range === 'today') {
          if (ngoHistFrom) ngoHistFrom.value = toDateStr(now);
          if (ngoHistTo) ngoHistTo.value = toDateStr(now);
        } else if (range === 'week') {
          var weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
          if (ngoHistFrom) ngoHistFrom.value = toDateStr(weekAgo);
          if (ngoHistTo) ngoHistTo.value = toDateStr(now);
        } else if (range === 'month') {
          var monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
          if (ngoHistFrom) ngoHistFrom.value = toDateStr(monthAgo);
          if (ngoHistTo) ngoHistTo.value = toDateStr(now);
        } else {
          if (ngoHistFrom) ngoHistFrom.value = '';
          if (ngoHistTo) ngoHistTo.value = '';
        }
        renderNgoHistory();
      });
    });

    // Wire reset button
    var resetNgoBtn = document.getElementById('resetNgoHistoryBtn');
    if (resetNgoBtn && !resetNgoBtn.getAttribute('data-wired')) {
      resetNgoBtn.setAttribute('data-wired', 'true');
      resetNgoBtn.addEventListener('click', function() {
        if (ngoHistStatus) ngoHistStatus.value = 'all';
        if (ngoHistFrom) ngoHistFrom.value = '';
        if (ngoHistTo) ngoHistTo.value = '';
        document.querySelectorAll('.ngo-date-pill').forEach(function(p) {
          p.classList.toggle('active', p.getAttribute('data-range') === 'all');
        });
        renderNgoHistory();
      });
    }

    if (ngoHistStatus && !ngoHistStatus.getAttribute('data-wired')) {
      ngoHistStatus.setAttribute('data-wired', 'true');
      ngoHistStatus.addEventListener('change', renderNgoHistory);
    }
    if (ngoHistFrom && !ngoHistFrom.getAttribute('data-wired')) {
      ngoHistFrom.setAttribute('data-wired', 'true');
      ngoHistFrom.addEventListener('change', renderNgoHistory);
      ngoHistFrom.addEventListener('input', renderNgoHistory);
    }
    if (ngoHistTo && !ngoHistTo.getAttribute('data-wired')) {
      ngoHistTo.setAttribute('data-wired', 'true');
      ngoHistTo.addEventListener('change', renderNgoHistory);
      ngoHistTo.addEventListener('input', renderNgoHistory);
    }

  } catch (err) {
    console.error('NGO dashboard error:', err);
  }
}

// ============================================================================
// NGO SMART MATCHING SYSTEM (Rule-based transparent engine)
// ============================================================================
async function loadNgoSmartMatches() {
  var matchesListEl = document.getElementById('matchesList');
  var recommendedEl = document.getElementById('recommendedDonations');
  if (!matchesListEl && !recommendedEl) return;

  try {
    var res = await fetchApi('/api/matching/recommendations');
    var recommendations = res.recommendations || [];

    if (recommendations.length === 0) {
      var emptyHtml = '<div class="empty-state"><div class="empty-icon">🤝</div><h3>No compatible matches right now</h3><p>As restaurants list new food, our algorithm will score and recommend them here.</p></div>';
      if (matchesListEl) matchesListEl.innerHTML = emptyHtml;
      if (recommendedEl) recommendedEl.innerHTML = emptyHtml;
      return;
    }

    var renderMatchCard = function(item) {
      var d = item.donation;
      var scoreColor = item.matchScore >= 80 ? '#2E7D32' : (item.matchScore >= 60 ? '#F59E0B' : '#6B7280');
      var timeRemaining = getTimeRemaining(d.pickupDeadline);

      return `
        <div class="card mb-3" style="border-left: 5px solid ${scoreColor}; padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; gap:8px; margin-bottom:6px; align-items:center;">
                <span class="badge" style="background:${scoreColor}; color:#fff; font-size:0.85rem; padding:4px 10px;">
                  ★ ${item.matchScore}% Match
                </span>
                <span class="badge badge-veg">${d.dietType.toUpperCase()}</span>
                <span class="badge" style="background:#E3F2FD; color:#1565C0;">📍 ${item.distanceKm} km away</span>
              </div>
              <h3 style="margin-bottom:4px;">${d.foodName}</h3>
              <p class="text-muted">Offered by: <strong>${d.restaurant?.orgName || 'Local Restaurant'}</strong> &bull; <strong>${d.quantity} servings</strong></p>
            </div>
            <div>
              <button class="btn btn-primary btn-sm accept-btn" data-id="${d._id}">Accept Match</button>
            </div>
          </div>

          <div style="background:var(--primary-bg); padding:10px 14px; border-radius:var(--radius-sm); margin-top:12px; font-size:0.9rem;">
            💡 <strong>Why this was recommended:</strong> ${item.explanation}
          </div>

          <div style="display:flex; gap:16px; margin-top:10px; font-size:0.8rem; color:var(--text-secondary); flex-wrap:wrap;">
            <span>📍 Distance Score: <strong>${item.breakdown.distanceScore}/100</strong> (40% weight)</span>
            <span>🍽 Compatibility: <strong>${item.breakdown.foodCompatibilityScore}/100</strong> (35% weight)</span>
            <span>⏰ Pickup Timing: <strong>${item.breakdown.pickupAvailabilityScore}/100</strong> (25% weight)</span>
          </div>
        </div>
      `;
    };

    if (matchesListEl) matchesListEl.innerHTML = recommendations.map(renderMatchCard).join('');
    if (recommendedEl) recommendedEl.innerHTML = recommendations.slice(0, 3).map(renderMatchCard).join('');

    // Attach accept donation triggers
    document.querySelectorAll('.accept-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var currentUser = getUser();
        var currentVStatus = currentUser ? (currentUser.verificationStatus || (currentUser.status === 'verified' ? 'verified' : (currentUser.status === 'rejected' ? 'rejected' : 'pending'))) : 'pending';
        if (currentVStatus !== 'verified' || currentUser?.status === 'suspended') {
          if (currentVStatus === 'rejected') {
            showAlert('Your organization verification was rejected. Reason: ' + (currentUser.rejectionReason || 'Documentation could not be verified') + '. You cannot accept donations.', 'error');
          } else if (currentUser?.status === 'suspended') {
            showAlert('Your organization account is suspended. You cannot accept donations.', 'error');
          } else {
            showAlert('Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.', 'error');
          }
          return;
        }

        var dId = this.getAttribute('data-id');
        if (!confirm('Accept this recommended donation? A pickup code will be generated.')) return;
        try {
          btn.disabled = true;
          var acceptRes = await fetchApi('/api/donations/' + dId + '/accept', { method: 'POST' });
          showAlert('🎉 Donation claimed! Pickup code: ' + acceptRes.donation.pickupCode, 'success');
          await loadNgoOverview();
          await loadNgoSmartMatches();
          var acceptedLink = document.querySelector('.sidebar-link[data-section="accepted"]');
          if (acceptedLink) acceptedLink.click();
        } catch (err) {
          showAlert(err.message || 'Failed to accept donation.', 'error');
          btn.disabled = false;
        }
      });
    });

  } catch (err) {
    console.error('Smart matches error:', err);
  }
}

async function loadNgoAvailableFood() {
  var grid = document.getElementById('availableFoodGrid');
  if (!grid) return;

  var search = (document.getElementById('foodSearch')?.value || '').trim();
  var category = document.getElementById('categoryFilter')?.value || '';
  var diet = document.getElementById('dietFilter')?.value || '';
  var sort = document.getElementById('sortFilter')?.value || 'nearest';

  var queryParams = new URLSearchParams();
  queryParams.set('status', 'available');
  if (search) queryParams.set('search', search);
  if (category) queryParams.set('category', category);
  if (diet) queryParams.set('dietType', diet);
  if (sort) queryParams.set('sort', sort);

  try {
    var res = await fetchApi('/api/donations?' + queryParams.toString());
    var donations = res.donations || [];

    if (donations.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽</div><h3>No donations currently match your search</h3><p>Adjust your search query or check back shortly as restaurants post fresh surplus food.</p></div>';
      return;
    }

    grid.innerHTML = donations.map(function(d) {
      var timeRemaining = getTimeRemaining(d.pickupDeadline);
      return `
        <div class="donation-card card">
          <div class="donation-card-badges" style="display:flex;gap:6px;margin-bottom:8px;">
            <span class="badge badge-veg">${d.dietType.toUpperCase()}</span>
            <span class="badge badge-available">AVAILABLE</span>
            <span class="badge" style="background:#E3F2FD;color:#1565C0;">⏰ ${timeRemaining.hours}h left</span>
          </div>
          <h3>${d.foodName}</h3>
          <p class="donation-desc">${d.description || 'Freshly prepared surplus food.'}</p>
          <div class="donation-meta">
            <span>🍽 <strong>${d.restaurant?.orgName || 'Restaurant'}</strong></span>
            <span>📍 ${d.city}</span>
            <span>👥 <strong>${d.quantity}</strong> servings</span>
          </div>
          <div style="margin-top:14px;">
            <button class="btn btn-primary btn-sm accept-btn" data-id="${d._id}">Accept Donation</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.accept-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var currentUser = getUser();
        var currentVStatus = currentUser ? (currentUser.verificationStatus || (currentUser.status === 'verified' ? 'verified' : (currentUser.status === 'rejected' ? 'rejected' : 'pending'))) : 'pending';
        if (currentVStatus !== 'verified' || currentUser?.status === 'suspended') {
          if (currentVStatus === 'rejected') {
            showAlert('Your organization verification was rejected. Reason: ' + (currentUser.rejectionReason || 'Documentation could not be verified') + '. You cannot claim donations.', 'error');
          } else if (currentUser?.status === 'suspended') {
            showAlert('Your organization account is suspended. You cannot claim donations.', 'error');
          } else {
            showAlert('Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.', 'error');
          }
          return;
        }

        var dId = this.getAttribute('data-id');
        if (!confirm('Accept this donation?')) return;
        try {
          var res = await fetchApi('/api/donations/' + dId + '/accept', { method: 'POST' });
          showAlert('🎉 Donation claimed! Code: ' + res.donation.pickupCode, 'success');
          await loadNgoOverview();
          await loadNgoAvailableFood();
          var acceptedLink = document.querySelector('.sidebar-link[data-section="accepted"]');
          if (acceptedLink) acceptedLink.click();
        } catch (err) {
          showAlert(err.message || 'Failed to claim donation.', 'error');
        }
      });
    });

    // Wire up filter controls once
    var applyBtn = document.getElementById('applyFilters');
    var foodSearchInput = document.getElementById('foodSearch');
    var catFilterSelect = document.getElementById('categoryFilter');
    var dietFilterSelect = document.getElementById('dietFilter');
    var sortFilterSelect = document.getElementById('sortFilter');

    if (applyBtn && !applyBtn.getAttribute('data-wired')) {
      applyBtn.setAttribute('data-wired', 'true');
      applyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadNgoAvailableFood();
      });
    }
    if (foodSearchInput && !foodSearchInput.getAttribute('data-wired')) {
      foodSearchInput.setAttribute('data-wired', 'true');
      var ngoSearchTimer = null;
      foodSearchInput.addEventListener('input', function() {
        clearTimeout(ngoSearchTimer);
        ngoSearchTimer = setTimeout(loadNgoAvailableFood, 300);
      });
      foodSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadNgoAvailableFood();
        }
      });
    }
    if (catFilterSelect && !catFilterSelect.getAttribute('data-wired')) {
      catFilterSelect.setAttribute('data-wired', 'true');
      catFilterSelect.addEventListener('change', loadNgoAvailableFood);
    }
    if (dietFilterSelect && !dietFilterSelect.getAttribute('data-wired')) {
      dietFilterSelect.setAttribute('data-wired', 'true');
      dietFilterSelect.addEventListener('change', loadNgoAvailableFood);
    }
    if (sortFilterSelect && !sortFilterSelect.getAttribute('data-wired')) {
      sortFilterSelect.setAttribute('data-wired', 'true');
      sortFilterSelect.addEventListener('change', loadNgoAvailableFood);
    }

  } catch (err) {
    console.error('Available food error:', err);
  }
}

function setupVolunteerManagement() {
  var addBtn = document.getElementById('addVolunteerBtn');
  var modal = document.getElementById('volunteerModal');
  var closeBtn = document.getElementById('closeVolunteerModal');
  var cancelBtn = document.getElementById('cancelVolunteer');
  var form = document.getElementById('volunteerForm');

  loadVolunteersList();

  if (addBtn && modal) {
    addBtn.addEventListener('click', function(e) {
      e.preventDefault();
      modal.classList.add('active');
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.visibility = 'visible';
    });
    var hideModal = function() {
      modal.classList.remove('active');
      modal.style.display = 'none';
      if (form) form.reset();
    };
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', function(e) {
      if (e.target === this) hideModal();
    });

    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var name = getValue('volName');
        var phone = getValue('volPhone');
        var email = getValue('volEmail');

        if (!name || !phone) {
          showAlert('Please enter volunteer name and phone number.', 'error');
          return;
        }

        try {
          await fetchApi('/api/volunteers', {
            method: 'POST',
            body: { name: name, phone: phone, email: email }
          });
          showAlert('Volunteer added successfully!', 'success');
          hideModal();
          await loadVolunteersList();
          await loadNgoOverview();
        } catch (err) {
          showAlert(err.message || 'Failed to add volunteer.', 'error');
        }
      });
    }
  }
}

async function loadVolunteersList() {
  var tbody = document.getElementById('volunteersTableBody');
  var emptyEl = document.getElementById('volunteersEmpty');
  if (!tbody || !emptyEl) return;

  try {
    var res = await fetchApi('/api/volunteers');
    var list = res.volunteers || [];

    if (list.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      tbody.innerHTML = list.map(function(v) {
        var statusBadge = v.status === 'assigned'
          ? '<span class="badge badge-accepted">On Route / Assigned</span>'
          : '<span class="badge badge-veg">Available</span>';
        var assignedText = v.assignedDonation
          ? (v.assignedDonation.foodName || 'Assigned Pickup')
          : '<span class="text-muted">Ready for pickup assignment</span>';

        return `
          <tr>
            <td><strong>${v.name}</strong></td>
            <td>${v.phone}</td>
            <td>${statusBadge}</td>
            <td>${assignedText}</td>
            <td><button class="btn btn-danger btn-sm del-vol-btn" data-id="${v._id}">Remove</button></td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.del-vol-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = this.getAttribute('data-id');
          if (!confirm('Remove this volunteer?')) return;
          try {
            await fetchApi('/api/volunteers/' + id, { method: 'DELETE' });
            showAlert('Volunteer removed.', 'success');
            await loadVolunteersList();
          } catch (err) {
            showAlert(err.message || 'Failed to remove volunteer.', 'error');
          }
        });
      });
    }
  } catch (_e) {}
}

function setupNgoProfileForm() {
  var form = document.getElementById('profileForm');
  if (!form) return;

  var user = getUser();
  if (user) {
    setValue('profOrgName', user.orgName);
    setValue('profRegNo', user.ngoRegNumber || '');
    setValue('profEmail', user.email);
    setValue('profPhone', user.phone);
    setValue('profAddress', user.address);
    setValue('profCity', user.city);
    setValue('profPincode', user.pincode);
    setValue('profBeneficiaries', user.beneficiaries || 0);
    setValue('profAreas', user.operatingAreas || '');
    setValue('profVehicle', user.pickupVehicle || 'yes');
    setValue('profPickupTimes', user.preferredPickupTimes || '');
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
      var updates = {
        orgName: getValue('profOrgName'),
        ngoRegNumber: getValue('profRegNo'),
        phone: getValue('profPhone'),
        address: getValue('profAddress'),
        city: getValue('profCity'),
        pincode: getValue('profPincode'),
        beneficiaries: Number(getValue('profBeneficiaries')) || 0,
        operatingAreas: getValue('profAreas'),
        pickupVehicle: getValue('profVehicle'),
        preferredPickupTimes: getValue('profPickupTimes'),
      };
      var res = await fetchApi('/api/auth/profile', { method: 'PUT', body: updates });
      setUser(res.user);
      showAlert('NGO profile updated successfully!', 'success');
    } catch (err) {
      showAlert(err.message || 'Failed to update profile.', 'error');
    }
  });
}

// ============================================================================
// ADMIN DASHBOARD & VERIFICATION MANAGEMENT LOGIC
// ============================================================================
var adminCachedOrgs = [];
var activeAdminVerifyTab = 'pending';

async function initAdminDashboard() {
  try {
    await updateAdminStats();
    await loadAdminVerifications();
    await loadAdminUsers();
    await loadAdminDonations();
    setupAdminVerificationModal();

    // Wire refresh button
    document.getElementById('refreshVerificationsBtn')?.addEventListener('click', async function() {
      await updateAdminStats();
      await loadAdminVerifications();
      showAlert('Verification requests refreshed.', 'info');
    });

    // Refresh when switching sections
    document.querySelectorAll('.sidebar-link').forEach(function(link) {
      link.addEventListener('click', function() {
        var sec = this.getAttribute('data-section');
        if (sec === 'verifications') {
          loadAdminVerifications();
        } else if (sec === 'overview') {
          updateAdminStats();
        } else if (sec === 'restaurants' || sec === 'ngos') {
          loadAdminUsers();
        } else if (sec === 'donations') {
          loadAdminDonations();
        }
      });
    });
  } catch (err) {
    console.error('Admin init error:', err);
  }
}

async function updateAdminStats() {
  try {
    var statsRes = await fetchApi('/api/admin/stats');
    var s = statsRes.stats;

    setValueText('totalUsers', s.totalUsers);
    setValueText('totalRestaurants', s.totalRestaurants);
    setValueText('totalNgos', s.totalNgos);
    setValueText('totalDonations', s.totalDonations);
    setValueText('pendingVerification', s.pendingVerification);
    setValueText('completedDonations', s.completedDonations);

    var sidebarBadge = document.getElementById('pendingVerifyBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = s.pendingVerification;
      sidebarBadge.style.display = s.pendingVerification > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error('Admin stats error:', err);
  }
}

async function loadAdminVerifications() {
  var tbody = document.getElementById('verificationsTableBody');
  var emptyEl = document.getElementById('verificationsEmpty');
  if (!tbody) return;

  try {
    var res = await fetchApi('/api/admin/users');
    adminCachedOrgs = res.users || [];

    // Calculate live counts
    var countPending = 0;
    var countVerified = 0;
    var countRejected = 0;
    var countSuspended = 0;

    adminCachedOrgs.forEach(function(u) {
      var v = u.verificationStatus || (u.status === 'verified' ? 'verified' : (u.status === 'rejected' ? 'rejected' : 'pending'));
      if (u.status === 'suspended') {
        countSuspended++;
      }
      if (v === 'pending') countPending++;
      else if (v === 'verified' && u.status !== 'suspended') countVerified++;
      else if (v === 'rejected') countRejected++;
    });

    setValueText('adminPendingCount', countPending);
    setValueText('adminAllCount', adminCachedOrgs.length);
    setValueText('adminVerifiedCount', countVerified);
    setValueText('adminRejectedCount', countRejected);
    setValueText('adminSuspendedCount', countSuspended);
    setValueText('pendingVerification', countPending);

    var sidebarBadge = document.getElementById('pendingVerifyBadge');
    if (sidebarBadge) {
      sidebarBadge.textContent = countPending;
      sidebarBadge.style.display = countPending > 0 ? 'inline-block' : 'none';
    }

    renderVerificationsTable();
    setupAdminFilterListeners();
  } catch (err) {
    console.error('Error loading verifications:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="text-danger text-center">Failed to load organizations from server.</td></tr>';
  }
}

function renderVerificationsTable() {
  var tbody = document.getElementById('verificationsTableBody');
  var emptyEl = document.getElementById('verificationsEmpty');
  if (!tbody) return;

  var searchVal = (document.getElementById('adminOrgSearch')?.value || '').toLowerCase().trim();
  var roleVal = document.getElementById('adminRoleFilter')?.value || 'all';

  var filtered = adminCachedOrgs.filter(function(u) {
    var vStatus = u.verificationStatus || (u.status === 'verified' ? 'verified' : (u.status === 'rejected' ? 'rejected' : 'pending'));
    var isSuspended = u.status === 'suspended';

    // 1. Tab Filter
    if (activeAdminVerifyTab === 'pending' && vStatus !== 'pending') return false;
    if (activeAdminVerifyTab === 'verified' && (vStatus !== 'verified' || isSuspended)) return false;
    if (activeAdminVerifyTab === 'rejected' && vStatus !== 'rejected') return false;
    if (activeAdminVerifyTab === 'suspended' && !isSuspended) return false;

    // 2. Role Filter
    if (roleVal !== 'all' && u.role !== roleVal) return false;

    // 3. Search Filter
    if (searchVal) {
      var matchOrg = (u.orgName || '').toLowerCase().includes(searchVal);
      var matchEmail = (u.email || '').toLowerCase().includes(searchVal);
      var matchCity = (u.city || '').toLowerCase().includes(searchVal);
      var matchFssai = (u.fssaiLicense || '').toLowerCase().includes(searchVal);
      var matchReg = (u.ngoRegNumber || '').toLowerCase().includes(searchVal);
      var matchPerson = ((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase().includes(searchVal);
      if (!matchOrg && !matchEmail && !matchCity && !matchFssai && !matchReg && !matchPerson) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = filtered.map(function(u) {
    var vStatus = u.verificationStatus || (u.status === 'verified' ? 'verified' : (u.status === 'rejected' ? 'rejected' : 'pending'));
    var isSuspended = u.status === 'suspended';

    var roleBadge = u.role === 'restaurant'
      ? '<span class="badge badge-veg">🍽 RESTAURANT</span>'
      : '<span class="badge badge-accepted">🤝 NGO</span>';

    var licenseNumber = u.role === 'restaurant'
      ? (u.fssaiLicense ? `<code>${u.fssaiLicense}</code>` : '<span class="text-muted">Not provided</span>')
      : (u.ngoRegNumber ? `<code>${u.ngoRegNumber}</code>` : '<span class="text-muted">Not provided</span>');

    var docDisplay = u.supportingDocument
      ? `<span title="${u.supportingDocument}" style="display:inline-flex; align-items:center; gap:4px; color:var(--primary); font-weight:600; font-size:0.85rem;">📄 ${u.supportingDocument}</span>`
      : '<span class="text-muted" style="font-size:0.85rem;">—</span>';

    var vBadge = '';
    if (vStatus === 'verified') {
      vBadge = '<span class="badge badge-veg">✓ Verified</span>';
    } else if (vStatus === 'rejected') {
      vBadge = '<span class="badge badge-danger">✗ Rejected</span>';
    } else {
      vBadge = '<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:700; border:1px solid #FDE68A;">⏳ Pending</span>';
    }

    var accBadge = isSuspended
      ? '<span class="badge badge-danger">⛔ Suspended</span>'
      : '<span class="badge badge-veg">Active</span>';

    // Action buttons
    var approveBtn = vStatus !== 'verified'
      ? `<button class="btn btn-primary btn-sm admin-approve-btn" data-id="${u._id}" data-name="${u.orgName}">✓ Approve</button>`
      : '';

    var rejectBtn = vStatus !== 'rejected'
      ? `<button class="btn btn-danger btn-sm admin-reject-btn" data-id="${u._id}" data-name="${u.orgName}">✗ Reject</button>`
      : '';

    var suspendBtn = isSuspended
      ? `<button class="btn btn-secondary btn-sm admin-suspend-btn" data-id="${u._id}" data-suspend="false">Reactivate</button>`
      : `<button class="btn btn-outline btn-sm admin-suspend-btn" data-id="${u._id}" data-suspend="true" style="color:#DC2626; border-color:#DC2626;">Suspend</button>`;

    return `
      <tr>
        <td>
          <strong>${u.orgName}</strong>
          <small class="text-muted" style="display:block;">${u.email} • ${u.city}</small>
        </td>
        <td>${roleBadge}</td>
        <td>
          ${u.firstName} ${u.lastName}
          <small class="text-muted" style="display:block;">${u.phone}</small>
        </td>
        <td>${licenseNumber}</td>
        <td>${docDisplay}</td>
        <td>${vBadge}</td>
        <td>${accBadge}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm admin-review-btn" data-id="${u._id}">Review</button>
            ${approveBtn}
            ${rejectBtn}
            ${suspendBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachVerificationRowActions();
}

function setupAdminFilterListeners() {
  // Tabs
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
    if (btn.getAttribute('data-wired')) return;
    btn.setAttribute('data-wired', 'true');
    btn.addEventListener('click', function() {
      document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      activeAdminVerifyTab = this.getAttribute('data-tab');
      renderVerificationsTable();
    });
  });

  // Search input
  var searchInput = document.getElementById('adminOrgSearch');
  if (searchInput && !searchInput.getAttribute('data-wired')) {
    searchInput.setAttribute('data-wired', 'true');
    searchInput.addEventListener('input', renderVerificationsTable);
  }

  // Role filter
  var roleSelect = document.getElementById('adminRoleFilter');
  if (roleSelect && !roleSelect.getAttribute('data-wired')) {
    roleSelect.setAttribute('data-wired', 'true');
    roleSelect.addEventListener('change', renderVerificationsTable);
  }

  // Reset filter
  var resetBtn = document.getElementById('resetAdminOrgFilters');
  if (resetBtn && !resetBtn.getAttribute('data-wired')) {
    resetBtn.setAttribute('data-wired', 'true');
    resetBtn.addEventListener('click', function() {
      if (searchInput) searchInput.value = '';
      if (roleSelect) roleSelect.value = 'all';
      activeAdminVerifyTab = 'pending';
      document.querySelectorAll('.admin-tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-tab') === 'pending');
      });
      renderVerificationsTable();
    });
  }
}

function attachVerificationRowActions() {
  // 1. Review Details Button
  document.querySelectorAll('.admin-review-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      var org = adminCachedOrgs.find(function(o) { return o._id === id; });
      if (org) openVerificationReviewModal(org);
    });
  });

  // 2. Direct Approve Button
  document.querySelectorAll('.admin-approve-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = this.getAttribute('data-id');
      var name = this.getAttribute('data-name');
      if (!confirm(`Are you sure you want to approve and verify "${name}"? They will immediately be authorized to participate in food donations.`)) {
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = 'Approving...';
        await fetchApi('/api/admin/users/' + id + '/verify', {
          method: 'PUT',
          body: { action: 'approve' }
        });
        showAlert(`✓ ${name} has been verified successfully!`, 'success');
        await loadAdminVerifications();
        await loadAdminUsers();
      } catch (err) {
        showAlert(err.message || 'Failed to approve organization.', 'error');
        btn.disabled = false;
        btn.textContent = '✓ Approve';
      }
    });
  });

  // 3. Direct Reject Button
  document.querySelectorAll('.admin-reject-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = this.getAttribute('data-id');
      var name = this.getAttribute('data-name');
      var reason = prompt(`Enter rejection reason for "${name}":`, 'Submitted license or registration proof could not be validated.');
      if (!reason) return;

      try {
        btn.disabled = true;
        btn.textContent = 'Rejecting...';
        await fetchApi('/api/admin/users/' + id + '/verify', {
          method: 'PUT',
          body: { action: 'reject', rejectionReason: reason }
        });
        showAlert(`✗ ${name} has been marked as rejected.`, 'info');
        await loadAdminVerifications();
        await loadAdminUsers();
      } catch (err) {
        showAlert(err.message || 'Failed to reject organization.', 'error');
        btn.disabled = false;
        btn.textContent = '✗ Reject';
      }
    });
  });

  // 4. Suspend / Reactivate Button
  document.querySelectorAll('.admin-suspend-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = this.getAttribute('data-id');
      var shouldSuspend = this.getAttribute('data-suspend') === 'true';
      var confirmMsg = shouldSuspend
        ? 'Are you sure you want to suspend this organization? They will be blocked from participating in food donations.'
        : 'Reactivate this organization account?';

      if (!confirm(confirmMsg)) return;

      try {
        btn.disabled = true;
        await fetchApi('/api/admin/users/' + id + '/suspend', {
          method: 'PUT',
          body: { suspend: shouldSuspend }
        });
        showAlert(shouldSuspend ? 'Organization has been suspended.' : 'Organization reactivated.', 'success');
        await loadAdminVerifications();
        await loadAdminUsers();
      } catch (err) {
        showAlert(err.message || 'Failed to update suspension status.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// Interactive Review Modal
var currentReviewOrg = null;

function setupAdminVerificationModal() {
  var modal = document.getElementById('verifyModal');
  var closeBtn = document.getElementById('closeVerifyModal');
  var dismissBtn = document.getElementById('dismissVerifyModal');
  var approveBtn = document.getElementById('modalApproveBtn');
  var rejectBtn = document.getElementById('modalRejectBtn');
  var cancelRejectBtn = document.getElementById('cancelRejectBtn');
  var confirmRejectBtn = document.getElementById('confirmRejectBtn');
  var rejectionSection = document.getElementById('rejectionSection');

  if (!modal) return;

  var hideModal = function() {
    modal.classList.remove('active');
    modal.style.display = 'none';
    if (rejectionSection) rejectionSection.style.display = 'none';
    currentReviewOrg = null;
  };

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (dismissBtn) dismissBtn.addEventListener('click', hideModal);
  modal.addEventListener('click', function(e) {
    if (e.target === this) hideModal();
  });

  if (approveBtn) {
    approveBtn.addEventListener('click', async function() {
      if (!currentReviewOrg) return;
      if (!confirm(`Confirm approval for ${currentReviewOrg.orgName}?`)) return;
      try {
        await fetchApi('/api/admin/users/' + currentReviewOrg._id + '/verify', {
          method: 'PUT',
          body: { action: 'approve' }
        });
        showAlert(`✓ ${currentReviewOrg.orgName} verified successfully!`, 'success');
        hideModal();
        await loadAdminVerifications();
        await loadAdminUsers();
      } catch (err) {
        showAlert(err.message || 'Approval failed.', 'error');
      }
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', function() {
      if (rejectionSection) rejectionSection.style.display = 'block';
      document.getElementById('adminRejectionReason')?.focus();
    });
  }

  if (cancelRejectBtn) {
    cancelRejectBtn.addEventListener('click', function() {
      if (rejectionSection) rejectionSection.style.display = 'none';
    });
  }

  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener('click', async function() {
      if (!currentReviewOrg) return;
      var reason = (document.getElementById('adminRejectionReason')?.value || '').trim();
      if (!reason) {
        showAlert('Please enter a rejection reason for the organization.', 'error');
        return;
      }
      try {
        await fetchApi('/api/admin/users/' + currentReviewOrg._id + '/verify', {
          method: 'PUT',
          body: { action: 'reject', rejectionReason: reason }
        });
        showAlert(`✗ ${currentReviewOrg.orgName} has been marked as rejected.`, 'info');
        hideModal();
        await loadAdminVerifications();
        await loadAdminUsers();
      } catch (err) {
        showAlert(err.message || 'Rejection failed.', 'error');
      }
    });
  }
}

function openVerificationReviewModal(org) {
  currentReviewOrg = org;
  var modal = document.getElementById('verifyModal');
  if (!modal) return;

  var vStatus = org.verificationStatus || (org.status === 'verified' ? 'verified' : (org.status === 'rejected' ? 'rejected' : 'pending'));
  var isSuspended = org.status === 'suspended';

  setValueText('modalOrgName', org.orgName);
  setValueText('modalOrgEmail', org.email);

  var roleBadge = document.getElementById('modalOrgRoleBadge');
  if (roleBadge) {
    roleBadge.className = org.role === 'restaurant' ? 'badge badge-veg' : 'badge badge-accepted';
    roleBadge.textContent = org.role.toUpperCase();
  }

  var detailsBody = document.getElementById('modalDetailsBody');
  if (detailsBody) {
    var licenseLabel = org.role === 'restaurant' ? 'FSSAI Food License Number' : 'NGO Registration Number';
    var licenseVal = org.role === 'restaurant' ? (org.fssaiLicense || 'Not provided') : (org.ngoRegNumber || 'Not provided');

    var extraRow = org.role === 'restaurant'
      ? `<p style="margin:0 0 6px 0;"><strong>Restaurant Type:</strong> ${org.restaurantType || 'General'} | <strong>Average Daily Surplus:</strong> ${org.avgSurplus || 'N/A'}</p>`
      : `<p style="margin:0 0 6px 0;"><strong>Beneficiaries Served:</strong> ${org.beneficiaries || 'N/A'} | <strong>Operating Areas:</strong> ${org.operatingAreas || 'Mumbai'} | <strong>Pickup Vehicle:</strong> ${org.pickupVehicle === 'yes' ? 'Available' : 'None'}</p>`;

    var docSection = org.supportingDocument
      ? `
        <div style="background:#F1F5F9; border:1px solid var(--border); padding:14px; border-radius:8px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.8rem;">📄</span>
          <div>
            <strong>Submitted Supporting Document:</strong>
            <div style="color:var(--primary); font-family:monospace; font-size:0.95rem; margin-top:2px;">${org.supportingDocument}</div>
            <small class="text-muted">Uploaded organization registration certificate</small>
          </div>
        </div>
      `
      : `<div style="background:#F8FAFC; border:1px solid var(--border); padding:12px; border-radius:8px; color:var(--text-secondary);">No supporting document file reference submitted.</div>`;

    var rejectionNotice = (vStatus === 'rejected' && org.rejectionReason)
      ? `
        <div style="background:#FEF2F2; border-left:4px solid #EF4444; padding:12px 16px; border-radius:6px; color:#991B1B;">
          <strong>Previous Rejection Reason:</strong> ${org.rejectionReason}
        </div>
      `
      : '';

    detailsBody.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px;">
        <div style="background:#F8FAFC; padding:12px 16px; border-radius:8px; border:1px solid var(--border-light);">
          <small class="text-muted" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">👤 Contact Person</small>
          <div style="font-weight:600; font-size:1.05rem; margin-top:4px;">${org.firstName} ${org.lastName}</div>
          <div style="color:var(--text-secondary); font-size:0.9rem;">📞 ${org.phone}</div>
          <div style="color:var(--text-secondary); font-size:0.9rem;">✉️ ${org.email}</div>
        </div>
        <div style="background:#F8FAFC; padding:12px 16px; border-radius:8px; border:1px solid var(--border-light);">
          <small class="text-muted" style="text-transform:uppercase; font-size:0.75rem; font-weight:700;">📍 Physical Address</small>
          <div style="font-weight:600; font-size:0.95rem; margin-top:4px;">${org.address}</div>
          <div style="color:var(--text-secondary); font-size:0.9rem;">${org.city} — ${org.pincode}</div>
        </div>
      </div>

      <div style="background:#F8FAFC; padding:14px 16px; border-radius:8px; border:1px solid var(--border-light);">
        <h4 style="margin:0 0 8px 0; color:var(--text-primary);">Organization Credentials & Registration</h4>
        <p style="margin:0 0 6px 0;"><strong>${licenseLabel}:</strong> <code style="font-size:1.05rem; color:var(--primary);">${licenseVal}</code></p>
        ${extraRow}
      </div>

      ${docSection}
      ${rejectionNotice}
    `;
  }

  // Set footer status badge
  var statusBadgeContainer = document.getElementById('modalStatusBadge');
  if (statusBadgeContainer) {
    if (isSuspended) {
      statusBadgeContainer.innerHTML = '<span class="badge badge-danger">⛔ Account Suspended</span>';
    } else if (vStatus === 'verified') {
      statusBadgeContainer.innerHTML = '<span class="badge badge-veg">✓ Currently Verified</span>';
    } else if (vStatus === 'rejected') {
      statusBadgeContainer.innerHTML = '<span class="badge badge-danger">✗ Currently Rejected</span>';
    } else {
      statusBadgeContainer.innerHTML = '<span class="badge" style="background:#FEF3C7; color:#D97706; font-weight:700;">⏳ Awaiting Verification</span>';
    }
  }

  var rejectionSection = document.getElementById('rejectionSection');
  if (rejectionSection) rejectionSection.style.display = 'none';

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
}

async function loadAdminUsers() {
  var restTbody = document.getElementById('restaurantsTableBody');
  var ngoTbody = document.getElementById('ngosTableBody');

  try {
    var res = await fetchApi('/api/admin/users');
    var users = res.users || [];

    var restaurants = users.filter(function(u) { return u.role === 'restaurant'; });
    var ngos = users.filter(function(u) { return u.role === 'ngo'; });

    if (restTbody) {
      restTbody.innerHTML = restaurants.map(function(r) {
        var vStatus = r.verificationStatus || (r.status === 'verified' ? 'verified' : (r.status === 'rejected' ? 'rejected' : 'pending'));
        var isSuspended = r.status === 'suspended';

        var statusBadge = isSuspended
          ? '<span class="badge badge-danger">Suspended</span>'
          : (vStatus === 'verified' ? '<span class="badge badge-veg">Verified</span>' : (vStatus === 'rejected' ? '<span class="badge badge-danger">Rejected</span>' : '<span class="badge" style="background:#FEF3C7; color:#D97706;">Pending</span>'));

        return `
          <tr>
            <td><strong>${r.orgName}</strong></td>
            <td>${r.email}</td>
            <td>${r.city}</td>
            <td>${r.fssaiLicense || '—'}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-secondary btn-sm admin-review-btn" data-id="${r._id}">Review & Verify</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (ngoTbody) {
      ngoTbody.innerHTML = ngos.map(function(n) {
        var vStatus = n.verificationStatus || (n.status === 'verified' ? 'verified' : (n.status === 'rejected' ? 'rejected' : 'pending'));
        var isSuspended = n.status === 'suspended';

        var statusBadge = isSuspended
          ? '<span class="badge badge-danger">Suspended</span>'
          : (vStatus === 'verified' ? '<span class="badge badge-veg">Verified</span>' : (vStatus === 'rejected' ? '<span class="badge badge-danger">Rejected</span>' : '<span class="badge" style="background:#FEF3C7; color:#D97706;">Pending</span>'));

        return `
          <tr>
            <td><strong>${n.orgName}</strong></td>
            <td>${n.email}</td>
            <td>${n.city}</td>
            <td>${n.ngoRegNumber || '—'}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-secondary btn-sm admin-review-btn" data-id="${n._id}">Review & Verify</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Attach review triggers
    document.querySelectorAll('#restaurantsTableBody .admin-review-btn, #ngosTableBody .admin-review-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        var org = adminCachedOrgs.find(function(o) { return o._id === id; }) || users.find(function(u) { return u._id === id; });
        if (org) openVerificationReviewModal(org);
      });
    });

  } catch (err) {
    console.error('Error loading admin users:', err);
  }
}

async function loadAdminDonations() {
  var tbody = document.getElementById('donationsTableBody');
  var emptyEl = document.getElementById('donationsEmpty');
  if (!tbody) return;

  try {
    var res = await fetchApi('/api/donations?status=all');
    var list = res.donations || [];

    if (list.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      tbody.innerHTML = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      tbody.innerHTML = list.map(function(d) {
        return `
          <tr>
            <td><code>${d.donationId}</code></td>
            <td><strong>${d.restaurant?.orgName || 'Restaurant'}</strong></td>
            <td>${d.foodName}</td>
            <td>${d.quantity}</td>
            <td><span class="badge badge-veg">${d.status.toUpperCase()}</span></td>
            <td>${d.acceptedBy?.orgName || '—'}</td>
            <td>${formatDate(d.createdAt)}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="alert('Donation Code: ${d.pickupCode || 'None'}')">Inspect</button></td>
          </tr>
        `;
      }).join('');
    }
  } catch (_e) {}
}

// ============================================================================
// NOTIFICATIONS CONTROLLER
// ============================================================================
async function setupNotifications() {
  var bell = document.getElementById('notifBell');
  var listEl = document.getElementById('notificationsList');

  try {
    var res = await fetchApi('/api/notifications');
    var notifs = res.notifications || [];
    var countEl = document.querySelector('.notif-count');
    if (countEl) countEl.textContent = res.unreadCount || 0;

    if (listEl) {
      if (notifs.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><h3>No notifications</h3><p>Updates about claimed donations and pickups will appear here.</p></div>';
      } else {
        listEl.innerHTML = notifs.map(function(n) {
          return `
            <div class="card mb-2" style="border-left: 3px solid ${n.isRead ? 'var(--border)' : 'var(--primary)'}; padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0 0 4px 0;">${n.title}</h4>
                <small class="text-muted">${timeAgo(n.createdAt)}</small>
              </div>
              <p style="margin:0; font-size:0.9rem; color:var(--text-secondary);">${n.message}</p>
            </div>
          `;
        }).join('');
      }
    }
  } catch (_e) {}
}

// ============================================================================
// DONATION CERTIFICATE MODAL
// ============================================================================
async function showDonationCertificate(donationId) {
  try {
    var res = await fetchApi('/api/donations/' + donationId + '/certificate');
    var c = res.certificate;

    var modalHtml = `
      <div class="modal-overlay active" id="certModal" style="display:flex; opacity:1 !important; visibility:visible !important; z-index:100000;">
        <div class="modal card" style="max-width:650px; text-align:center; padding:36px; border:3px double var(--primary); background:#FCFDFD; transform:scale(1) !important;">
          <div style="font-size:2.8rem; margin-bottom:8px;">🌿</div>
          <h2 style="color:var(--primary); margin-bottom:4px; font-size:1.8rem;">FoodBridge Impact Certificate</h2>
          <p style="color:var(--text-secondary); margin-bottom:20px; font-size:0.95rem;">Certificate of Food Redistribution & Waste Prevention</p>

          <p style="font-size:1.05rem; line-height:1.7; margin:20px 0;">
            This certifies that <strong>${c.restaurantName}</strong> successfully partnered with <strong>${c.ngoName}</strong>
            to redistribute <strong>${c.quantityServings} nutritious meals</strong> (${c.foodName}) on ${formatDate(c.completedAt)}.
          </p>

          <div style="display:flex; justify-content:center; gap:24px; margin:24px 0; background:var(--primary-bg); padding:16px; border-radius:8px;">
            <div>
              <div style="font-size:1.4rem; font-weight:700; color:var(--primary);">${c.estimatedKg} kg</div>
              <small class="text-muted">Food Rescued</small>
            </div>
            <div>
              <div style="font-size:1.4rem; font-weight:700; color:var(--primary);">${c.co2SavedKg} kg</div>
              <small class="text-muted">CO₂ Prevented</small>
            </div>
          </div>

          <p style="font-size:0.75rem; color:var(--text-light); margin-bottom:24px;">${c.disclaimer}</p>

          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-primary btn-sm" onclick="window.print()">🖨 Print Certificate</button>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('certModal').remove()">Close</button>
          </div>
        </div>
      </div>
    `;

    var existing = document.getElementById('certModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('certModal')?.addEventListener('click', function(e) {
      if (e.target === this) this.remove();
    });
  } catch (err) {
    showAlert(err.message || 'Unable to generate certificate.', 'error');
  }
}

// Helper utilities
function getValue(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setValue(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function setValueText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
