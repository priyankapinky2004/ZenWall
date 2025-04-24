// Variables to store data
let usageData = null;
let settings = null;
let currentTab = 'today';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get data from storage
    const result = await chrome.storage.local.get(['usageData', 'settings']);
    usageData = result.usageData || { daily: {}, weekly: {} };
    settings = result.settings || {};
    
    // Set up tab navigation
    setupTabs();
    
    // Load initial data
    updateDateDisplay();
    loadUsageData();
    
    // Set up button listeners
    document.getElementById('focus-mode-btn').addEventListener('click', toggleFocusMode);
    document.getElementById('settings-btn').addEventListener('click', openSettings);
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to load data. Please try again.');
  }
});

// Set up tab navigation
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      const tabName = tab.getAttribute('data-tab');
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // Update current tab
      currentTab = tabName;
      
      // Reload data for the tab
      loadUsageData();
    });
  });
}

// Update date display
function updateDateDisplay() {
  const today = new Date();
  const dateOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  document.getElementById('today-date').textContent = today.toLocaleDateString(undefined, dateOptions);
  
  // Calculate week range
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const monthOptions = { month: 'short', day: 'numeric' };
  const weekRangeText = `${weekStart.toLocaleDateString(undefined, monthOptions)} - ${weekEnd.toLocaleDateString(undefined, monthOptions)}`;
  document.getElementById('week-range').textContent = weekRangeText;
}

// Load usage data based on current tab
function loadUsageData() {
  if (currentTab === 'today') {
    loadTodayData();
  } else if (currentTab === 'week') {
    loadWeekData();
  } else if (currentTab === 'insights') {
    loadInsightsData();
  }
}

// Load today's usage data
function loadTodayData() {
  try {
    const todayStr = getDateString();
    const todayData = usageData.daily[todayStr] || {};
    
    // Calculate total time
    let totalMinutes = 0;
    Object.values(todayData).forEach(minutes => {
      totalMinutes += minutes;
    });
    
    // Update total time display
    document.getElementById('today-total-time').textContent = `${Math.round(totalMinutes)} minutes`;
    
    // Calculate daily limit (sum of all site limits)
    let dailyLimit = 120; // Default
    if (settings && settings.dailyLimits) {
      dailyLimit = Object.values(settings.dailyLimits).reduce((sum, limit) => sum + limit, 0);
    }
    document.getElementById('today-limit').textContent = `/ ${dailyLimit} minutes`;
    
    // Update progress bar
    const percentage = Math.min(100, (totalMinutes / dailyLimit) * 100);
    document.getElementById('today-usage-bar').style.width = `${percentage}%`;
    
    // Show site breakdown
    const siteListEl = document.getElementById('today-sites');
    siteListEl.innerHTML = '';
    
    if (Object.keys(todayData).length === 0) {
      siteListEl.innerHTML = '<div class="loading">No usage data for today yet.</div>';
      return;
    }
    
    // Sort sites by usage (highest first)
    const sortedSites = Object.entries(todayData)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, time]) => time > 0);
    
    sortedSites.forEach(([site, minutes]) => {
      const siteLimit = settings.dailyLimits?.[site] || 30;
      const percentage = Math.min(100, (minutes / siteLimit) * 100);
      
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <div class="site-name">${site}</div>
        <div class="site-usage">${Math.round(minutes)} / ${siteLimit} min</div>
      `;
      siteListEl.appendChild(siteItem);
      
      // Add style based on usage percentage
      if (percentage > 90) {
        siteItem.style.borderLeft = '4px solid #F44336';
      } else if (percentage > 75) {
        siteItem.style.borderLeft = '4px solid #FF9800';
      } else {
        siteItem.style.borderLeft = '4px solid #4CAF50';
      }
    });
  } catch (error) {
    console.error('Error loading today data:', error);
    showError('Failed to load today\'s data.');
  }
}

// Load weekly usage data
function loadWeekData() {
  try {
    const weekStr = getWeekString();
    const weekData = usageData.weekly[weekStr] || {};
    
    // Calculate total time
    let totalMinutes = 0;
    Object.values(weekData).forEach(minutes => {
      totalMinutes += minutes;
    });
    
    // Update total time display
    document.getElementById('week-total-time').textContent = `${Math.round(totalMinutes)} minutes`;
    
    // Weekly limit is 7x daily limit
    let weeklyLimit = 840; // Default
    if (settings && settings.dailyLimits) {
      const dailyLimit = Object.values(settings.dailyLimits).reduce((sum, limit) => sum + limit, 0);
      weeklyLimit = dailyLimit * 7;
    }
    document.getElementById('week-limit').textContent = `/ ${weeklyLimit} minutes`;
    
    // Update progress bar
    const percentage = Math.min(100, (totalMinutes / weeklyLimit) * 100);
    document.getElementById('week-usage-bar').style.width = `${percentage}%`;
    
    // Show site breakdown
    const siteListEl = document.getElementById('week-sites');
    siteListEl.innerHTML = '';
    
    if (Object.keys(weekData).length === 0) {
      siteListEl.innerHTML = '<div class="loading">No usage data for this week yet.</div>';
      return;
    }
    
    // Sort sites by usage (highest first)
    const sortedSites = Object.entries(weekData)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, time]) => time > 0);
    
    sortedSites.forEach(([site, minutes]) => {
      const siteLimit = (settings.dailyLimits?.[site] || 30) * 7;
      const percentage = Math.min(100, (minutes / siteLimit) * 100);
      
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <div class="site-name">${site}</div>
        <div class="site-usage">${Math.round(minutes)} / ${siteLimit} min</div>
      `;
      siteListEl.appendChild(siteItem);
      
      // Add style based on usage percentage
      if (percentage > 90) {
        siteItem.style.borderLeft = '4px solid #F44336';
      } else if (percentage > 75) {
        siteItem.style.borderLeft = '4px solid #FF9800';
      } else {
        siteItem.style.borderLeft = '4px solid #4CAF50';
      }
    });
  } catch (error) {
    console.error('Error loading week data:', error);
    showError('Failed to load weekly data.');
  }
}

// Load insights data
function loadInsightsData() {
  try {
    // Calculate productivity score based on usage patterns
    let productivityScore = calculateProductivityScore();
    
    // Update productivity score display
    const scoreEl = document.getElementById('productivity-score');
    scoreEl.innerHTML = `
      <div style="font-size: 36px; font-weight: bold; text-align: center; margin: 15px 0;">
        ${productivityScore}/100
      </div>
    `;
    
    // Color based on score
    if (productivityScore >= 80) {
      scoreEl.style.color = '#4CAF50';
    } else if (productivityScore >= 60) {
      scoreEl.style.color = '#FF9800';
    } else {
      scoreEl.style.color = '#F44336';
    }
    
    // Generate personalized tips
    const tips = generateProductivityTips(productivityScore);
    
    // Update tips display
    const tipsEl = document.getElementById('productivity-tips');
    tipsEl.innerHTML = '';
    
    tips.forEach(tip => {
      const tipEl = document.createElement('p');
      tipEl.textContent = tip;
      tipsEl.appendChild(tipEl);
    });
  } catch (error) {
    console.error('Error loading insights data:', error);
    showError('Failed to load insights.');
  }
}

// Calculate productivity score based on usage patterns
function calculateProductivityScore() {
  try {
    const todayStr = getDateString();
    const todayData = usageData.daily[todayStr] || {};
    
    // If no data, return neutral score
    if (Object.keys(todayData).length === 0) {
      return 70;
    }
    
    // Calculate total minutes spent today
    let totalMinutes = 0;
    Object.values(todayData).forEach(minutes => {
      totalMinutes += minutes;
    });
    
    // Calculate daily limit
    let dailyLimit = 120; // Default
    if (settings && settings.dailyLimits) {
      dailyLimit = Object.values(settings.dailyLimits).reduce((sum, limit) => sum + limit, 0);
    }
    
    // Base score on percentage of limit used
    let score = 100 - (totalMinutes / dailyLimit) * 100;
    
    // Cap score between 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Adjust score based on distribution across sites
    // (Penalty for spending too much time on a single site)
    const siteCount = Object.keys(todayData).length;
    if (siteCount > 0) {
      const maxSiteUsage = Math.max(...Object.values(todayData));
      const siteConcentration = maxSiteUsage / totalMinutes;
      
      if (siteConcentration > 0.7) {
        score -= 10; // Penalty for focusing too much on one site
      }
    }
    
    // Adjust score based on time of day patterns
    // (This would require more historical data in a real implementation)
    
    return Math.round(Math.max(0, Math.min(100, score)));
  } catch (error) {
    console.error('Error calculating productivity score:', error);
    return 50; // Default fallback score
  }
}

// Generate personalized productivity tips
function generateProductivityTips(score) {
  const tips = [];
  
  // Get current site data
  const todayStr = getDateString();
  const todayData = usageData.daily[todayStr] || {};
  
  // Check if we have any data
  if (Object.keys(todayData).length === 0) {
    tips.push('Start tracking your social media usage to get personalized tips.');
    tips.push('Set up daily limits for each site to manage your time better.');
    return tips;
  }
  
  // Find most used site
  let mostUsedSite = '';
  let maxTime = 0;
  Object.entries(todayData).forEach(([site, time]) => {
    if (time > maxTime) {
      mostUsedSite = site;
      maxTime = time;
    }
  });
  
  // Generate tips based on score
  if (score < 30) {
    tips.push(`You're spending a lot of time on ${mostUsedSite}. Try setting a stricter limit.`);
    tips.push('Consider using Focus Mode to block distractions for 25-minute intervals.');
    tips.push('Try the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds.');
  } else if (score < 60) {
    tips.push(`Try to reduce time on ${mostUsedSite} to improve your productivity.`);
    tips.push('Consider scheduling specific times for social media rather than checking throughout the day.');
    tips.push('Use mindfulness exercises when you feel the urge to check social media.');
  } else if (score < 80) {
    tips.push('You\'re managing your time well! Consider setting slightly lower limits to improve further.');
    tips.push('Try starting your day with focused work before checking social media.');
  } else {
    tips.push('Great job maintaining healthy social media habits!');
    tips.push('Consider sharing your experience with friends who might benefit from similar tools.');
  }
  
  return tips;
}

// Toggle focus mode
function toggleFocusMode() {
  try {
    const focusBtn = document.getElementById('focus-mode-btn');
    const isActive = focusBtn.textContent === 'End Focus Mode';
    
    if (isActive) {
      // End focus mode
      chrome.runtime.sendMessage({ action: 'END_FOCUS_MODE' });
      focusBtn.textContent = 'Start Focus Mode';
    } else {
      // Start focus mode
      chrome.runtime.sendMessage({ action: 'START_FOCUS_MODE' });
      focusBtn.textContent = 'End Focus Mode';
    }
  } catch (error) {
    console.error('Error toggling focus mode:', error);
    showError('Failed to toggle focus mode.');
  }
}

// Open settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Show error message
function showError(message) {
  // Create error element
  const errorElement = document.createElement('div');
  errorElement.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #f44336;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 9999;
    font-size: 14px;
  `;
  errorElement.textContent = message;
  
  // Add to body
  document.body.appendChild(errorElement);
  
  // Remove after 3 seconds
  setTimeout(() => {
    document.body.removeChild(errorElement);
  }, 3000);
}

// Get string representation of today's date (YYYY-MM-DD)
function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get string representation of current week (YYYY-WW)
function getWeekString() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-${String(week).padStart(2, '0')}`;
}