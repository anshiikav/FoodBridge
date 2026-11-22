// FoodBridge — Live Impact Dashboard Script
// Pulls live database metrics, calculates food waste reduction & CO2 equivalents, renders charts

document.addEventListener('DOMContentLoaded', async function() {
  await loadImpactDashboard();
});

async function loadImpactDashboard() {
  try {
    var res = await fetchApi('/api/impact/stats');
    if (!res || !res.success) return;

    var stats = res.stats;

    // 1. Metric Counters
    var mEl = document.getElementById('impactMeals');
    var pEl = document.getElementById('impactPickups');
    var rEl = document.getElementById('impactRestaurants');
    var nEl = document.getElementById('impactNgos');

    if (mEl) { mEl.setAttribute('data-target', stats.totalMealsDonated); mEl.textContent = stats.totalMealsDonated + '+'; }
    if (pEl) { pEl.setAttribute('data-target', stats.totalSuccessfulPickups); pEl.textContent = stats.totalSuccessfulPickups + '+'; }
    if (rEl) { rEl.setAttribute('data-target', stats.totalRestaurants); rEl.textContent = stats.totalRestaurants + '+'; }
    if (nEl) { nEl.setAttribute('data-target', stats.totalNgos); nEl.textContent = stats.totalNgos + '+'; }

    // 2. Food Waste & CO2 Reductions
    var foodKgEl = document.getElementById('foodKgVal');
    var co2KgEl = document.getElementById('co2KgVal');

    if (foodKgEl) foodKgEl.textContent = '~' + stats.estimatedFoodKg.toLocaleString('en-IN') + ' kg';
    if (co2KgEl) co2KgEl.textContent = '~' + stats.estimatedCo2Kg.toLocaleString('en-IN') + ' kg';

    // 3. Monthly Trends Chart
    var chartContainer = document.getElementById('monthlyChartContainer');
    if (chartContainer && stats.monthlyTrends && stats.monthlyTrends.length > 0) {
      var maxMeals = Math.max.apply(Math, stats.monthlyTrends.map(function(t) { return t.meals; })) || 1;
      chartContainer.innerHTML = stats.monthlyTrends.map(function(t) {
        var pct = Math.max(10, Math.round((t.meals / maxMeals) * 100));
        return `
          <div class="chart-bar">
            <div class="bar-value">${t.meals}</div>
            <div class="bar-fill" style="height: ${pct}%"></div>
            <div class="bar-label">${t.month}</div>
          </div>
        `;
      }).join('');
    }

    // 4. Recent Successful Donations
    var recentContainer = document.getElementById('recentDonationsContainer');
    if (recentContainer && stats.recentDonations) {
      if (stats.recentDonations.length === 0) {
        recentContainer.innerHTML = '<p class="text-muted text-center" style="padding:20px;">No completed pickups recorded yet.</p>';
      } else {
        recentContainer.innerHTML = stats.recentDonations.map(function(d) {
          return `
            <div class="recent-item">
              <div class="recent-dot"></div>
              <div class="recent-text">
                <strong>${d.restaurantName}</strong> redistributed <strong>${d.quantity} meals</strong> (${d.foodName}) to <strong>${d.ngoName}</strong>
                ${d.rating ? '<span style="color:#F59E0B;margin-left:8px;">★ ' + d.rating + '/5</span>' : ''}
              </div>
              <div class="recent-date">${formatDate(d.completedDate)}</div>
            </div>
          `;
        }).join('');
      }
    }

    // 5. Category Breakdown
    var catContainer = document.getElementById('categoryBreakdownContainer');
    if (catContainer && stats.categoryBreakdown) {
      catContainer.innerHTML = stats.categoryBreakdown.map(function(c) {
        var nameFormatted = c.category.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
        return `
          <div class="category-bar">
            <span class="category-name">${nameFormatted}</span>
            <div class="category-track"><div class="category-fill" style="width: ${c.percentage}%"></div></div>
            <span class="category-pct">${c.percentage}%</span>
          </div>
        `;
      }).join('');
    }

    if (typeof getLanguage === 'function' && getLanguage() === 'hi' && window.applyTranslations) {
      window.applyTranslations('hi');
    }

  } catch (err) {
    console.error('Failed to load impact stats:', err);
  }
}

window.addEventListener('languageChanged', function() {
  loadImpactDashboard();
});
