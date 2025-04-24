// Site mapping for easier identification
const targetSites = {
    'YouTube': { domain: 'youtube.com', icon: '🎬' },
    'Instagram': { domain: 'instagram.com', icon: '📷' },
    'Reddit': { domain: 'reddit.com', icon: '👽' },
    'Facebook': { domain: 'facebook.com', icon: '👤' },
    'Twitter': { domain: 'twitter.com', icon: '🐦' },
    'TikTok': { domain: 'tiktok.com', icon: '🎵' }
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
    focusModeDuration: 25
  };
  
  // Initialize settings page
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Get settings from storage
      const { settings } = await chrome.storage.local.get(['settings']);
      const currentSettings = settings || defaultSettings;
      
      // Load site limits
      loadSiteLimits(currentSettings);
      
      // Load other settings
      document.getElementById('nudge-frequency').value = currentSettings.nudgeFrequency || defaultSettings.nudgeFrequency;
      document.getElementById('enable-mindfulness').checked = currentSettings.enableMindfulness !== false;
      document.getElementById('enable-focus-mode').checked = currentSettings.enableFocusMode !== false;
      document.getElementById('focus-duration').value = currentSettings.focusModeDuration || defaultSettings.focusModeDuration;
      
      // Set up event listeners
      document.getElementById('save-btn').addEventListener('click', saveSettings);
      document.getElementById('reset-btn').addEventListener('click', resetSettings);
    } catch (error) {
      console.error('Error initializing settings page:', error);
      showStatus('Error loading settings. Please try again.', 'error');
    }
  });
  
  // Load site limits into UI
  function loadSiteLimits(settings) {
    const container = document.getElementById('site-limits');
    container.innerHTML = '';
    
    Object.entries(targetSites).forEach(([site, info]) => {
      const limitValue = settings.dailyLimits?.[site] || defaultSettings.dailyLimits[site];
      
      const siteItem = document.createElement('div');
      siteItem.className = 'site-limit-item';
      siteItem.innerHTML = `
        <span class="site-logo">${info.icon}</span>
        <span class="site-name">${site}</span>
        <input type="number" class="site-limit-input" id="limit-${site}" 
          min="1" max="720" value="${limitValue}" data-site="${site}">
        <span>minutes/day</span>
      `;
      container.appendChild(siteItem);
    });
  }
  
  // Save settings
  async function saveSettings() {
    try {
      // Collect site limits
      const dailyLimits = {};
      Object.keys(targetSites).forEach(site => {
        const inputEl = document.getElementById(`limit-${site}`);
        const value = parseInt(inputEl.value);
        dailyLimits[site] = isNaN(value) || value < 1 ? defaultSettings.dailyLimits[site] : value;
      });
      
      // Collect other settings
      const nudgeFrequency = parseInt(document.getElementById('nudge-frequency').value);
      const enableMindfulness = document.getElementById('enable-mindfulness').checked;
      const enableFocusMode = document.getElementById('enable-focus-mode').checked;
      const focusModeDuration = parseInt(document.getElementById('focus-duration').value);
      
      // Create settings object
      const newSettings = {
        dailyLimits,
        nudgeFrequency: isNaN(nudgeFrequency) || nudgeFrequency < 1 ? defaultSettings.nudgeFrequency : nudgeFrequency,
        enableMindfulness,
        enableFocusMode,
        focusModeDuration: isNaN(focusModeDuration) || focusModeDuration < 5 ? defaultSettings.focusModeDuration : focusModeDuration
      };
      
      // Save to storage
      await chrome.storage.local.set({ settings: newSettings });
      
      // Notify background script of settings change
      chrome.runtime.sendMessage({ action: 'SETTINGS_UPDATED', data: { settings: newSettings } });
      
      showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings. Please try again.', 'error');
    }
  }
  
  // Reset settings to default
  async function resetSettings() {
    try {
      if (confirm('Reset all settings to default values?')) {
        // Save default settings to storage
        await chrome.storage.local.set({ settings: defaultSettings });
        
        // Update UI
        loadSiteLimits(defaultSettings);
        document.getElementById('nudge-frequency').value = defaultSettings.nudgeFrequency;
        document.getElementById('enable-mindfulness').checked = defaultSettings.enableMindfulness;
        document.getElementById('enable-focus-mode').checked = defaultSettings.enableFocusMode;
        document.getElementById('focus-duration').value = defaultSettings.focusModeDuration;
        
        // Notify background script of settings change
        chrome.runtime.sendMessage({ action: 'SETTINGS_UPDATED', data: { settings: defaultSettings } });
        
        showStatus('Settings reset to default values!', 'success');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus('Error resetting settings. Please try again.', 'error');
    }
  }
  
  // Show status message
  function showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }