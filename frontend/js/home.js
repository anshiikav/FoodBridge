// FoodBridge — Home Page JavaScript
// Handles navbar scroll, live database stat counter animation, and scroll effects

document.addEventListener('DOMContentLoaded', async function() {

  // --- Fetch live database stats for homepage counters ---
  try {
    var response = await fetch('/api/impact/stats');
    if (response.ok) {
      var data = await response.json();
      if (data && data.stats) {
        var mealsEl = document.querySelector('.stat-number[data-stat="meals"]') || document.querySelectorAll('.stat-number')[0];
        var pickupsEl = document.querySelector('.stat-number[data-stat="pickups"]') || document.querySelectorAll('.stat-number')[1];
        var restsEl = document.querySelector('.stat-number[data-stat="restaurants"]') || document.querySelectorAll('.stat-number')[2];
        var ngosEl = document.querySelector('.stat-number[data-stat="ngos"]') || document.querySelectorAll('.stat-number')[3];

        if (mealsEl) mealsEl.setAttribute('data-target', data.stats.totalMealsDonated);
        if (pickupsEl) pickupsEl.setAttribute('data-target', data.stats.totalSuccessfulPickups);
        if (restsEl) restsEl.setAttribute('data-target', data.stats.totalRestaurants);
        if (ngosEl) ngosEl.setAttribute('data-target', data.stats.totalNgos);
      }
    }
  } catch (_e) {
    // Keep default targets if offline
  }

  // --- Navbar scroll effect ---
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // --- Stat counter animation ---
  var statNumbers = document.querySelectorAll('.stat-number[data-target]');
  var animated = new Set();

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10) || 0;
    var duration = 1500; // 1.5 seconds
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      el.textContent = current.toLocaleString('en-IN');
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString('en-IN') + '+';
      }
    }
    requestAnimationFrame(step);
  }

  if (statNumbers.length > 0) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !animated.has(entry.target)) {
          animated.add(entry.target);
          animateCounter(entry.target);
        }
      });
    }, { threshold: 0.2 });

    statNumbers.forEach(function(el) { observer.observe(el); });
  }

  // --- Fade-in on scroll ---
  var sections = document.querySelectorAll('.section');
  if (sections.length > 0) {
    var sectionObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    sections.forEach(function(section) {
      section.classList.add('fade-in');
      sectionObserver.observe(section);
    });
  }

  // --- Interactive Impact Calculator ---
  var mealSlider = document.getElementById('mealSlider');
  if (mealSlider) {
    function updateCalculator() {
      var meals = parseInt(mealSlider.value, 10);
      var foodKg = (meals * 0.4).toFixed(1);
      var co2Kg = (foodKg * 2.5).toFixed(1);
      var waterL = (foodKg * 1500).toLocaleString('en-IN');

      var sliderVal = document.getElementById('sliderValue');
      var cMeals = document.getElementById('calcMeals');
      var cFood = document.getElementById('calcFoodKg');
      var cCo2 = document.getElementById('calcCo2');
      var cWater = document.getElementById('calcWater');

      var isHi = typeof getLanguage === 'function' && getLanguage() === 'hi';
      if (sliderVal) sliderVal.textContent = meals + (isHi ? ' थाली' : ' meals');
      if (cMeals) cMeals.textContent = meals;
      if (cFood) cFood.textContent = foodKg + ' kg';
      if (cCo2) cCo2.textContent = co2Kg + ' kg';
      if (cWater) cWater.textContent = waterL + ' L';
    }
    mealSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // --- Interactive Smart Match Simulator ---
  var simDist = document.getElementById('simDistSlider');
  var simDiet = document.getElementById('simDietSelect');
  var simTime = document.getElementById('simTimeSelect');

  if (simDist && simDiet && simTime) {
    function updateMatchSimulator() {
      var distKm = parseFloat(simDist.value);
      var dietVal = simDiet.value;
      var timeVal = simTime.value;
      var isHi = typeof getLanguage === 'function' && getLanguage() === 'hi';

      document.getElementById('simDistVal').textContent = distKm + ' km';

      // 1. Distance Score (40% weight)
      var distScore = distKm <= 2 ? 100 : (distKm <= 5 ? 85 : (distKm <= 10 ? 70 : (distKm <= 15 ? 50 : 25)));

      // 2. Food Compatibility (35% weight)
      var foodScore = dietVal === 'perfect' ? 100 : (dietVal === 'both' ? 90 : 15);

      // 3. Pickup Availability (25% weight)
      var timeScore = timeVal === 'optimal' ? 100 : (timeVal === 'moderate' ? 75 : 35);

      var total = Math.round(distScore * 0.4 + foodScore * 0.35 + timeScore * 0.25);

      var gauge = document.getElementById('simScoreGauge');
      var label = document.getElementById('simRatingLabel');
      var exp = document.getElementById('simExplanation');

      if (gauge) {
        gauge.textContent = total + '%';
        gauge.style.color = total >= 80 ? 'var(--primary)' : (total >= 60 ? '#F59E0B' : 'var(--danger)');
      }

      if (label) {
        if (total >= 80) {
          label.textContent = isHi ? 'उत्कृष्ट मिलान (91%)' : 'EXCELLENT MATCH';
          label.className = 'badge badge-veg';
        } else if (total >= 60) {
          label.textContent = isHi ? 'मध्यम मिलान (65%)' : 'MODERATE MATCH';
          label.className = 'badge badge-accepted';
        } else {
          label.textContent = isHi ? 'कम अनुकूलता' : 'LOW COMPATIBILITY';
          label.className = 'badge badge-danger';
        }
      }

      if (exp) {
        exp.textContent = isHi
          ? `नियम-आधारित स्कोरिंग: दूरी ${distKm} किमी (${distScore}/100 × 40%), आहार अनुकूलता (${foodScore}/100 × 35%), और वाहन उपलब्धता (${timeScore}/100 × 25%)।`
          : `Calculated with rule-based weights: Distance ${distKm}km (${distScore}/100 × 40%), Food Compatibility (${foodScore}/100 × 35%), and Transport Readiness (${timeScore}/100 × 25%).`;
      }
    }

    simDist.addEventListener('input', updateMatchSimulator);
    simDiet.addEventListener('change', updateMatchSimulator);
    simTime.addEventListener('change', updateMatchSimulator);
    updateMatchSimulator();

    window.addEventListener('languageChanged', function() {
      if (typeof updateCalculator === 'function') updateCalculator();
      updateMatchSimulator();
    });
  }

  // --- Interactive FAQ Accordion ---
  document.querySelectorAll('.faq-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var ans = this.querySelector('.faq-answer');
      var icon = this.querySelector('.faq-icon');
      var isVisible = ans.style.display === 'block';

      // Close all other items
      document.querySelectorAll('.faq-answer').forEach(function(a) { a.style.display = 'none'; });
      document.querySelectorAll('.faq-icon').forEach(function(i) { i.textContent = '+'; });

      if (!isVisible) {
        ans.style.display = 'block';
        icon.textContent = '−';
      }
    });
  });

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Privacy Policy & Terms Modal ---
  var legalModal = document.getElementById('legalModal');
  var legalTitle = document.getElementById('legalModalTitle');
  var legalContent = document.getElementById('legalModalContent');
  var closeLegalBtn = document.getElementById('closeLegalModal');

  if (legalModal) {
    var hideLegal = function() { legalModal.style.display = 'none'; };
    if (closeLegalBtn) closeLegalBtn.addEventListener('click', hideLegal);
    legalModal.addEventListener('click', function(e) { if (e.target === legalModal) hideLegal(); });

    document.getElementById('openPrivacyLink')?.addEventListener('click', function(e) {
      e.preventDefault();
      if (legalTitle) legalTitle.textContent = 'Privacy Policy';
      if (legalContent) {
        legalContent.innerHTML = `
          <p><strong>Last Updated: November 2026</strong></p>
          <p>FoodBridge operates as a social-impact community platform connecting food donor establishments with non-profit charitable organizations.</p>
          <h4>Information Collection &amp; Use</h4>
          <p>We collect organization contact details, food donation quantities, pickup schedules, and delivery logs solely to coordinate timely food distribution and record food waste diversion metrics.</p>
          <h4>Data Security</h4>
          <p>Passwords are securely hashed with salted bcrypt algorithms, and administrative sessions utilize signed JSON Web Tokens. Organization coordinates are used solely for calculating distance matching scores.</p>
          <h4>Non-Commercial Purpose</h4>
          <p>FoodBridge is a non-profit college initiative and does not sell or distribute user contact data to third parties.</p>
        `;
      }
      legalModal.style.display = 'flex';
    });

    document.getElementById('openTermsLink')?.addEventListener('click', function(e) {
      e.preventDefault();
      if (legalTitle) legalTitle.textContent = 'Terms of Service';
      if (legalContent) {
        legalContent.innerHTML = `
          <p><strong>Last Updated: November 2026</strong></p>
          <h4>1. Non-Profit Nature</h4>
          <p>FoodBridge provides software coordination between registered donors and charitable organizations free of charge to reduce food waste.</p>
          <h4>2. Food Safety Obligations</h4>
          <p>Donors must verify that surplus food complies with the 4-point hygiene checklist, appropriate holding temperatures, and safe consumption windows. Recipients agree to transport and distribute food promptly using clean, food-grade containers.</p>
          <h4>3. Good Faith Redistribution</h4>
          <p>All redistributions must be provided to end beneficiaries free of charge. Reselling donated food items is strictly prohibited and results in immediate account revocation.</p>
        `;
      }
      legalModal.style.display = 'flex';
    });
  }
});
