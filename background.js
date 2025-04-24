// Enhanced background.js with proper site blocking
const targetSites = {
  'youtube.com': 'YouTube',
  'instagram.com': 'Instagram',
  'reddit.com': 'Reddit',
  'facebook.com': 'Facebook',
  'twitter.com': 'Twitter',
  'tiktok.com': 'TikTok'
};

// Default user settings
const defaultSettings = {
  dailyLimits: {
    'YouTube': 30,
    'Instagram': 20,
    'Reddit': 20,
    'Facebook': 20,
    'Twitter': 20,
    'TikTok': 20
  },
  nudgeFrequency: 5,
  enableMindfulness: true,
  enableFocusMode: true,
  focusModeDuration: 25,
  pausedSites: [],
  isPaused: false,
  focusModeActive: false,
  focusModeEnd: null
};

// Heartbeat to keep service worker alive
setInterval(() => { 
  console.log('DopamineShield alive');
}, 15000);

// Initialize when installed
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
  setupTracking();
  setupTabMonitoring(); // Set up tab monitoring for blocking
});

// Initialize when browser starts
chrome.runtime.onStartup.addListener(() => {
  initializeStorage();
  setupTracking();
  setupTabMonitoring(); // Set up tab monitoring for blocking
});

// Initialize storage with defaults
function initializeStorage() {
  chrome.storage.local.get(['settings', 'usageData'], (result) => {
    // Initialize settings if not exist
    if (!result.settings) {
      chrome.storage.local.set({ settings: defaultSettings });
    }
    
    // Initialize usage data if not exist
    if (!result.usageData) {
      const today = getDateString();
      const thisWeek = getWeekString();
      
      const initialUsageData = {
        daily: { [today]: {} },
        weekly: { [thisWeek]: {} },
        currentSession: { site: null, startTime: null },
        blockedSites: {} // Track which sites are blocked
      };
      
      // Initialize all sites to 0
      Object.values(targetSites).forEach(site => {
        initialUsageData.daily[today][site] = 0;
        initialUsageData.weekly[thisWeek][site] = 0;
        initialUsageData.blockedSites[site] = false; // Not blocked initially
      });
      
      chrome.storage.local.set({ usageData: initialUsageData });
    }
  });
}

// Set up tracking
function setupTracking() {
  // Check active tab every 10 seconds
  setInterval(checkCurrentSite, 10000);
  
  // Set up time limit check every 30 seconds
  setInterval(checkTimeLimits, 30000);
}

// Set up tab monitoring for blocking
function setupTabMonitoring() {
  // Listen for new tabs and tab updates
  chrome.tabs.onCreated.addListener(checkBlockedStatus);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      checkBlockedStatus(tab);
    }
  });
}

// Check if a site should be blocked
function checkBlockedStatus(tab) {
  if (!tab || !tab.url) return;
  
  const site = identifySite(tab.url);
  if (!site) return; // Not a tracked site
  
  chrome.storage.local.get(['usageData', 'settings'], (result) => {
    if (!result.usageData || !result.settings) return;
    
    const today = getDateString();
    if (!result.usageData.daily[today]) return;
    
    // Get current usage and limit
    const usage = result.usageData.daily[today][site] || 0;
    const limit = result.settings.dailyLimits[site] || 30;
    
    // Check if usage exceeds limit
    if (usage >= limit) {
      // Block this site
      blockSite(tab.id, site, usage, limit);
    }
  });
}

// Track current site
function checkCurrentSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].url) return;
    
    const currentSite = identifySite(tabs[0].url);
    if (!currentSite) return;
    
    // Update time for this site
    chrome.storage.local.get(['usageData', 'settings'], (result) => {
      if (!result.usageData || !result.settings) return;
      
      // Skip if tracking is paused
      if (result.settings.isPaused) return;
      
      const usageData = result.usageData;
      const today = getDateString();
      const thisWeek = getWeekString();
      
      // Make sure data structures exist
      if (!usageData.daily[today]) usageData.daily[today] = {};
      if (!usageData.weekly[thisWeek]) usageData.weekly[thisWeek] = {};
      if (!usageData.daily[today][currentSite] === undefined) usageData.daily[today][currentSite] = 0;
      if (!usageData.weekly[thisWeek][currentSite] === undefined) usageData.weekly[thisWeek][currentSite] = 0;
      
      // Track if this site is already blocked
      const isBlocked = usageData.blockedSites && usageData.blockedSites[currentSite];
      
      // Get the limit
      const limit = result.settings.dailyLimits[currentSite] || 30;
      
      // Check if we're over the limit
      if (usageData.daily[today][currentSite] >= limit) {
        // Block this site
        blockSite(tabs[0].id, currentSite, usageData.daily[today][currentSite], limit);
        return;
      }
      
      // Add 10 seconds (0.167 minutes)
      usageData.daily[today][currentSite] += 0.167;
      usageData.weekly[thisWeek][currentSite] += 0.167;
      
      // Save the updated usage data
      chrome.storage.local.set({ usageData });
      
      // Send message to update timer display
      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'UPDATE_USAGE_DISPLAY' });
      } catch (e) {
        console.error('Error sending update message:', e);
      }
      
      // Check if we've now hit the limit
      if (usageData.daily[today][currentSite] >= limit) {
        // Block this site
        blockSite(tabs[0].id, currentSite, usageData.daily[today][currentSite], limit);
      }
    });
  });
}

// Check all tabs for time limits
function checkTimeLimits() {
  chrome.storage.local.get(['usageData', 'settings'], (result) => {
    if (!result.usageData || !result.settings) return;
    
    const today = getDateString();
    if (!result.usageData.daily[today]) return;
    
    // Get all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (!tab.url) return;
        
        const site = identifySite(tab.url);
        if (!site) return; // Not a tracked site
        
        const usage = result.usageData.daily[today][site] || 0;
        const limit = result.settings.dailyLimits[site] || 30;
        
        // Check if usage exceeds limit
        if (usage >= limit) {
          // Block this site
          blockSite(tab.id, site, usage, limit);
        }
      });
    });
  });
}

// Block a site
function blockSite(tabId, site, usage, limit) {
  // Update the blockedSites tracking
  chrome.storage.local.get(['usageData'], (result) => {
    if (!result.usageData) return;
    
    // Make sure blockedSites exists
    if (!result.usageData.blockedSites) {
      result.usageData.blockedSites = {};
    }
    
    // Mark this site as blocked
    result.usageData.blockedSites[site] = true;
    
    // Save the updated data
    chrome.storage.local.set({ usageData: result.usageData });
    
    // Create a Google redirect URL with a query parameter explaining why
    const redirectUrl = `https://www.google.com/search?q=find+something+productive&dopamineshield=blocked`;
    
    // Redirect the tab
    chrome.tabs.update(tabId, { url: redirectUrl });
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'DopamineShield - Site Blocked',
      message: `You've exceeded your ${limit} minute limit on ${site}. Come back tomorrow!`
    });
  });
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'START_FOCUS_MODE') {
      startFocusMode();
    } else if (message.action === 'END_FOCUS_MODE') {
      endFocusMode();
    } else if (message.action === 'PAUSE_TRACKING') {
      pauseTracking();
    } else if (message.action === 'RESUME_TRACKING') {
      resumeTracking();
    } else if (message.action === 'OPEN_SETTINGS') {
      chrome.runtime.openOptionsPage();
    } else if (message.action === 'SNOOZE_LIMIT') {
      snoozeLimitFor(message.minutes || 5, message.site);
    } else if (message.action === 'GET_USAGE_DATA') {
      getUsageData(sendResponse);
      return true; // Keep channel open for async response
    }
  } catch (e) {
    console.error('Error handling message:', e);
  }
  
  return true; // Keep the message channel open for async responses
});

// Get usage data for popup
function getUsageData(sendResponse) {
  chrome.storage.local.get(['usageData', 'settings'], (result) => {
    sendResponse({
      usageData: result.usageData,
      settings: result.settings
    });
  });
}

// Start focus mode
function startFocusMode() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || defaultSettings;
    
    // Set focus mode duration
    const duration = settings.focusModeDuration || 25;
    
    // Update settings
    settings.focusModeActive = true;
    settings.focusModeEnd = Date.now() + (duration * 60 * 1000);
    
    chrome.storage.local.set({ settings });
    
    // Send notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'DopamineShield',
      message: `Focus mode activated for ${duration} minutes. Stay productive!`
    });
    
    // Check all tabs and redirect social media
    redirectSocialMediaTabs();
  });
}

// End focus mode
function endFocusMode() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || defaultSettings;
    
    // Update settings
    settings.focusModeActive = false;
    settings.focusModeEnd = null;
    
    chrome.storage.local.set({ settings });
    
    // Send notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'DopamineShield',
      message: 'Focus mode ended. You can now access social media again.'
    });
  });
}

// Pause tracking
function pauseTracking() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || defaultSettings;
    
    // Update settings
    settings.isPaused = true;
    
    chrome.storage.local.set({ settings });
  });
}

// Resume tracking
function resumeTracking() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || defaultSettings;
    
    // Update settings
    settings.isPaused = false;
    
    chrome.storage.local.set({ settings });
  });
}

// Snooze limit for X minutes for a specific site
function snoozeLimitFor(minutes, site) {
  chrome.storage.local.get(['usageData'], (result) => {
    if (!result.usageData || !result.usageData.blockedSites) return;
    
    // If site is provided, only unblock that site
    if (site && result.usageData.blockedSites[site]) {
      result.usageData.blockedSites[site] = false;
    } else {
      // Otherwise unblock all sites
      Object.keys(result.usageData.blockedSites).forEach(s => {
        result.usageData.blockedSites[s] = false;
      });
    }
    
    chrome.storage.local.set({ usageData: result.usageData });
    
    // Send notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'DopamineShield',
      message: `Limit snoozed for ${minutes} minutes. Use your time wisely!`
    });
    
    // Set a timer to re-check limits after the snooze period
    setTimeout(() => {
      checkTimeLimits();
    }, minutes * 60 * 1000);
  });
}

// Redirect all social media tabs when focus mode starts
function redirectSocialMediaTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && identifySite(tab.url)) {
        chrome.tabs.update(tab.id, { url: "https://www.google.com" });
      }
    });
  });
}

// Helper functions
function identifySite(url) {
  if (!url) return null;
  
  try {
    const hostname = new URL(url).hostname;
    
    for (const site in targetSites) {
      if (hostname.includes(site)) {
        return targetSites[site];
      }
    }
  } catch (e) {}
  
  return null;
}

function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getWeekString() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-${String(week).padStart(2, '0')}`;
}