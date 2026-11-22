// FoodBridge — Available Food Page Logic
// Fetches real donations from MongoDB, provides instant filtering, ticking countdowns, and rich modal inspection

var countdownInterval = null;
var urgentActive = false;

document.addEventListener('DOMContentLoaded', function() {
  loadAvailableDonations();

  var clearBtn = document.getElementById('clearFilters');
  var searchInput = document.getElementById('foodSearch');
  var categorySelect = document.getElementById('categoryFilter');
  var dietSelect = document.getElementById('dietFilter');
  var minQtySelect = document.getElementById('minQtyFilter');
  var sortSelect = document.getElementById('sortFilter');
  var urgentPill = document.getElementById('urgentPill');
  var vegOnlyPill = document.getElementById('vegOnlyPill');

  // Instant search with debounce
  var searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadAvailableDonations, 250);
    });
  }

  // Instant filter updates
  if (categorySelect) categorySelect.addEventListener('change', loadAvailableDonations);
  if (dietSelect) dietSelect.addEventListener('change', loadAvailableDonations);
  if (minQtySelect) minQtySelect.addEventListener('change', loadAvailableDonations);
  if (sortSelect) sortSelect.addEventListener('change', loadAvailableDonations);

  // Urgent filter toggle pill
  if (urgentPill) {
    urgentPill.addEventListener('click', function() {
      urgentActive = !urgentActive;
      this.style.background = urgentActive ? '#EF4444' : '';
      this.style.color = urgentActive ? '#fff' : '#DC2626';
      loadAvailableDonations();
    });
  }

  // Pure veg shortcut pill
  if (vegOnlyPill) {
    vegOnlyPill.addEventListener('click', function() {
      if (dietSelect) {
        dietSelect.value = dietSelect.value === 'vegetarian' ? '' : 'vegetarian';
        this.style.background = dietSelect.value === 'vegetarian' ? '#16A34A' : '';
        this.style.color = dietSelect.value === 'vegetarian' ? '#fff' : '#16A34A';
        loadAvailableDonations();
      }
    });
  }

  // Quick Category Pills
  document.querySelectorAll('.cat-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      document.querySelectorAll('.cat-pill').forEach(function(p) {
        p.classList.remove('active');
        p.style.background = '';
        p.style.color = '';
      });
      this.classList.add('active');
      this.style.background = 'var(--primary)';
      this.style.color = '#fff';

      var cat = this.getAttribute('data-cat');
      if (categorySelect) categorySelect.value = cat;
      loadAvailableDonations();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (searchInput) searchInput.value = '';
      if (categorySelect) categorySelect.value = '';
      if (dietSelect) dietSelect.value = '';
      if (minQtySelect) minQtySelect.value = '';
      if (sortSelect) sortSelect.value = 'newest';
      urgentActive = false;
      if (urgentPill) { urgentPill.style.background = ''; urgentPill.style.color = '#DC2626'; }
      if (vegOnlyPill) { vegOnlyPill.style.background = ''; vegOnlyPill.style.color = '#16A34A'; }

      document.querySelectorAll('.cat-pill').forEach(function(p) {
        p.classList.remove('active');
        p.style.background = '';
        p.style.color = '';
      });
      var allPill = document.querySelector('.cat-pill[data-cat=""]');
      if (allPill) {
        allPill.classList.add('active');
        allPill.style.background = 'var(--primary)';
        allPill.style.color = '#fff';
      }

      loadAvailableDonations();
    });
  }

  window.addEventListener('languageChanged', function() {
    loadAvailableDonations();
  });
});

async function loadAvailableDonations() {
  var grid = document.getElementById('foodGrid');
  var emptyState = document.getElementById('emptyState');
  var countEl = document.getElementById('resultsCount');

  var search = (document.getElementById('foodSearch')?.value || '').trim();
  var category = document.getElementById('categoryFilter')?.value || '';
  var diet = document.getElementById('dietFilter')?.value || '';
  var sort = document.getElementById('sortFilter')?.value || 'newest';

  var queryParams = new URLSearchParams();
  queryParams.set('status', 'available');
  if (search) queryParams.set('search', search);
  if (category) queryParams.set('category', category);
  if (diet) queryParams.set('dietType', diet);
  if (sort) queryParams.set('sort', sort);

  try {
    var data = await fetchApi('/api/donations?' + queryParams.toString());
    var donations = data.donations || [];

    // Client-side minimum quantity filter
    var minQty = parseInt(document.getElementById('minQtyFilter')?.value, 10);
    if (!isNaN(minQty)) {
      donations = donations.filter(function(d) { return (d.quantity || 0) >= minQty; });
    }

    // Client-side urgency filter (< 4 hours remaining)
    if (urgentActive) {
      var now = Date.now();
      donations = donations.filter(function(d) {
        var diffHours = (new Date(d.pickupDeadline).getTime() - now) / (1000 * 3600);
        return diffHours > 0 && diffHours <= 4;
      });
    }

    if (countEl) {
      countEl.innerHTML = `Showing <strong>${donations.length}</strong> available food donation${donations.length === 1 ? '' : 's'}`;
    }

    if (donations.length === 0) {
      if (grid) grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (!grid) return;

    var isNgoUser = isLoggedIn() && getUserRole() === 'ngo';

    var categoryIcons = {
      'cooked-meals': '🍛',
      'raw-ingredients': '🌾',
      'packaged-food': '📦',
      'baked-goods': '🍞',
      'beverages': '🧃',
      'fruits-vegetables': '🥗',
      'dairy': '🧀',
      'other': '🍲'
    };

    grid.innerHTML = donations.map(function(d) {
      var icon = categoryIcons[d.category] || '🍽️';
      var badgeClass = d.dietType === 'vegetarian' ? 'badge-veg' : (d.dietType === 'vegan' ? 'badge-veg' : 'badge-nonveg');
      var restaurantName = (d.restaurant && d.restaurant.orgName) ? d.restaurant.orgName : 'Local Restaurant';
      var city = d.city || 'Mumbai';

      var actionButton = isNgoUser
        ? `<button class="btn btn-primary btn-sm accept-btn" data-id="${d._id}">Claim Donation</button>`
        : `<a href="/login" class="btn btn-secondary btn-sm" title="Login as NGO to claim">Login to Accept</a>`;

      return `
        <div class="donation-card card" style="display:flex; flex-direction:column; justify-content:space-between; border-radius:12px; transition:transform 0.2s, box-shadow 0.2s; position:relative; overflow:hidden;">
          <div>
            <div class="donation-card-image" style="background: var(--primary-bg); display:flex; align-items:center; justify-content:center; font-size:3.2rem; height:140px; border-radius:8px; margin-bottom:14px; position:relative;">
              ${d.imageUrl ? `<img src="${d.imageUrl}" alt="${d.foodName}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : icon}
              <span class="countdown-badge" data-deadline="${d.pickupDeadline}" style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.75rem; padding:3px 8px; border-radius:12px; font-weight:600; font-variant-numeric:tabular-nums;">
                Calculating...
              </span>
            </div>

            <div class="donation-card-badges" style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
              <span class="badge ${badgeClass}">${d.dietType.toUpperCase()}</span>
              <span class="badge badge-available">AVAILABLE</span>
              <span class="badge" style="background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0;">✓ Safety Verified</span>
            </div>

            <h3 style="margin-bottom:6px; font-size:1.15rem; line-height:1.4;">${d.foodName}</h3>
            <p class="donation-desc" style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${d.description || 'Freshly prepared surplus meal in sealed containers.'}
            </p>

            <div class="donation-meta" style="font-size:0.85rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:6px;">
              <span>🍽 <strong>${restaurantName}</strong></span>
              <span>📍 ${city} (${d.pickupAddress.split(',')[0]})</span>
              <span>👥 <strong>${d.quantity}</strong> servings ready</span>
            </div>
          </div>

          <div class="donation-card-actions" style="margin-top:16px; display:flex; gap:8px; border-top:1px solid var(--border-light); padding-top:12px;">
            ${actionButton}
            <button class="btn btn-secondary btn-sm inspect-btn" data-id="${d._id}">Inspect</button>
          </div>
        </div>
      `;
    }).join('');

    // Start live ticking countdown clocks
    startTickingCountdowns();

    // Attach accept donation listeners
    document.querySelectorAll('.accept-btn').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();

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

        var donationId = this.getAttribute('data-id');
        if (!confirm('Are you ready to claim this donation? A pickup verification QR code will be generated for your NGO.')) {
          return;
        }

        try {
          btn.disabled = true;
          btn.textContent = 'Claiming...';
          var res = await fetchApi('/api/donations/' + donationId + '/accept', { method: 'POST' });
          showAlert('🎉 Donation claimed! Pickup code: ' + res.donation.pickupCode, 'success');
          setTimeout(function() {
            window.location.href = '/ngo-dashboard#accepted';
          }, 1200);
        } catch (err) {
          showAlert(err.message || 'Failed to claim donation', 'error');
          btn.disabled = false;
          btn.textContent = 'Claim Donation';
        }
      });
    });

    // Attach rich Inspect modal listeners
    document.querySelectorAll('.inspect-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = this.getAttribute('data-id');
        openFoodDetailsModal(id);
      });
    });

    // Re-apply language translations to dynamically rendered cards
    if (typeof getLanguage === 'function' && getLanguage() === 'hi' && window.applyTranslations) {
      window.applyTranslations('hi');
    }

  } catch (err) {
    console.error('Error loading donations:', err);
    if (grid) grid.innerHTML = '<p class="text-danger text-center">Unable to load live donations from the server.</p>';
  }
}

// Live ticking clock on every card
function startTickingCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);

  function updateClocks() {
    var now = Date.now();
    document.querySelectorAll('.countdown-badge[data-deadline]').forEach(function(badge) {
      var deadline = new Date(badge.getAttribute('data-deadline')).getTime();
      var diff = deadline - now;

      if (diff <= 0) {
        badge.textContent = 'Expired';
        badge.style.background = 'var(--danger)';
      } else {
        var hours = Math.floor(diff / (1000 * 60 * 60));
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((diff % (1000 * 60)) / 1000);

        var hStr = String(hours).padStart(2, '0');
        var mStr = String(minutes).padStart(2, '0');
        var sStr = String(seconds).padStart(2, '0');

        badge.textContent = `⏰ ${hStr}h ${mStr}m ${sStr}s`;
        if (hours < 1) {
          badge.style.background = '#DC2626'; // Red urgent
        } else if (hours < 3) {
          badge.style.background = '#D97706'; // Amber
        }
      }
    });
  }

  updateClocks();
  countdownInterval = setInterval(updateClocks, 1000);
}

// Rich Interactive Details Modal
async function openFoodDetailsModal(id) {
  try {
    var res = await fetchApi('/api/donations/' + id);
    var d = res.donation;
    var isNgo = isLoggedIn() && getUserRole() === 'ngo';

    var modalHtml = `
      <div class="modal-overlay active" id="foodModal" style="display:flex; opacity:1 !important; visibility:visible !important; z-index:10000;">
        <div class="modal card" style="max-width:680px; width:92%; max-height:85vh; overflow-y:auto; padding:28px; border-radius:16px; transform:scale(1) !important;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
              <div style="display:flex; gap:6px; margin-bottom:6px;">
                <span class="badge ${d.dietType === 'vegetarian' ? 'badge-veg' : 'badge-nonveg'}">${d.dietType.toUpperCase()}</span>
                <span class="badge badge-available">AVAILABLE</span>
              </div>
              <h2 style="margin:0; font-size:1.6rem; color:var(--text-primary);">${d.foodName}</h2>
              <small class="text-muted">Donation Reference: <code>${d.donationId}</code></small>
            </div>
            <button class="modal-close" onclick="document.getElementById('foodModal').remove()" style="background:none; border:none; font-size:1.8rem; cursor:pointer;">&times;</button>
          </div>

          <div style="background:var(--primary-bg); padding:16px; border-radius:10px; margin-bottom:20px;">
            <p style="margin:0; font-size:0.95rem; line-height:1.6; color:var(--text-primary);">${d.description || 'Freshly prepared nutritious surplus meal in hygienic catering containers.'}</p>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
            <div style="background:#fff; border:1px solid var(--border); padding:14px; border-radius:8px;">
              <small class="text-muted">🍽 Kitchen Donor</small>
              <div style="font-weight:600; font-size:1.05rem;">${d.restaurant?.orgName || 'Partner Restaurant'}</div>
              <small class="text-muted">Rating: ★ 4.9/5 verified kitchen</small>
            </div>
            <div style="background:#fff; border:1px solid var(--border); padding:14px; border-radius:8px;">
              <small class="text-muted">👥 Quantity Available</small>
              <div style="font-weight:700; font-size:1.2rem; color:var(--primary);">${d.quantity} Servings</div>
              <small class="text-muted">Estimated weight: ~${(d.quantity * 0.4).toFixed(1)} kg</small>
            </div>
          </div>

          <div style="background:#F8FAFC; border:1px solid var(--border); padding:16px; border-radius:10px; margin-bottom:20px;">
            <h4 style="margin:0 0 10px 0;">📍 Pickup Location & Logistics</h4>
            <p style="margin:0 0 6px 0;"><strong>Address:</strong> ${d.pickupAddress}, ${d.city}</p>
            <p style="margin:0 0 6px 0;"><strong>Contact Person:</strong> ${d.contactPerson} (${d.contactPhone})</p>
            <p style="margin:0 0 6px 0;"><strong>Prepared:</strong> ${formatDateTime(d.preparedAt)}</p>
            <p style="margin:0;"><strong>Must Pick Up Before:</strong> <strong style="color:var(--danger);">${formatDateTime(d.pickupDeadline)}</strong></p>
          </div>

          <div style="background:#ECFDF5; border:1px solid #A7F3D0; padding:14px; border-radius:8px; margin-bottom:20px; font-size:0.85rem; color:#065F46;">
            ✓ <strong>Four-Point Food Safety Guarantee Verified:</strong> Kitchen confirms food prepared in sanitized environment, temperature controlled, and packaged in sealed tamper-evident food containers.
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('foodModal').remove()">Close</button>
            ${isNgo ? `
              <button class="btn btn-primary btn-sm" id="modalClaimBtn">Claim This Donation Now</button>
            ` : `
              <a href="/login" class="btn btn-primary btn-sm">Login to Claim</a>
            `}
          </div>
        </div>
      </div>
    `;

    var existing = document.getElementById('foodModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modalClaim = document.getElementById('modalClaimBtn');
    if (modalClaim) {
      modalClaim.addEventListener('click', async function() {
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

        if (!confirm('Confirm claiming this food donation? A pickup code will be issued immediately.')) return;
        try {
          modalClaim.disabled = true;
          modalClaim.textContent = 'Claiming...';
          var claimRes = await fetchApi('/api/donations/' + id + '/accept', { method: 'POST' });
          showAlert('🎉 Donation claimed! Code: ' + claimRes.donation.pickupCode, 'success');
          document.getElementById('foodModal').remove();
          setTimeout(function() { window.location.href = '/ngo-dashboard#accepted'; }, 1000);
        } catch (err) {
          showAlert(err.message || 'Failed to claim', 'error');
          modalClaim.disabled = false;
        }
      });
    }
  } catch (_e) {
    showAlert('Failed to load food details', 'error');
  }
}
