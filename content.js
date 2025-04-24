// DopamineShield Content Script with Movable & Minimizable Timer
(function() {
  // State variables
  let activeOverlay = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isDragging = false;
  let isMinimized = false;
  let currentSite = null;
  let todayUsage = 0;
  let userSettings = null;
  
  // Create the timer container with modern styling
  function createTimerElement() {
    const timer = document.createElement('div');
    timer.id = 'dopamine-shield-timer';
    timer.style.position = 'fixed';
    timer.style.top = '20px';
    timer.style.right = '20px';
    timer.style.zIndex = '9999999';
    timer.style.borderRadius = '12px';
    timer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
    timer.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    timer.style.cursor = 'move';
    timer.style.userSelect = 'none';
    timer.style.transition = 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    timer.style.overflow = 'hidden';
    timer.style.minWidth = '180px';
    
    // Beautiful gradient background
    timer.style.background = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
    
    // Save last position in localStorage if available
    try {
      const savedPosition = JSON.parse(localStorage.getItem('dopamineShieldPosition'));
      if (savedPosition) {
        timer.style.top = savedPosition.top;
        timer.style.right = 'auto';
        timer.style.left = savedPosition.left;
      }
    } catch (e) {
      console.error('Error loading saved position:', e);
    }
    
    // Save minimized state if available
    try {
      const savedMinimized = localStorage.getItem('dopamineShieldMinimized') === 'true';
      isMinimized = savedMinimized;
    } catch (e) {
      console.error('Error loading minimized state:', e);
    }
    
    return timer;
  }
  
  // Update the timer content
  function updateTimerContent() {
    const timer = document.getElementById('dopamine-shield-timer');
    if (!timer) return;
    
    const site = currentSite || identifySite(window.location.hostname) || 'This Site';
    const minutes = Math.floor(todayUsage);
    const seconds = Math.floor((todayUsage - minutes) * 60);
    
    // Get usage percentage for progress bar
    let usagePercent = 0;
    let usageColor = '#10B981'; // Default green
    
    if (userSettings && userSettings.dailyLimits && userSettings.dailyLimits[site]) {
      const limit = userSettings.dailyLimits[site];
      usagePercent = Math.min(100, (todayUsage / limit) * 100);
      
      // Change color based on usage
      if (usagePercent > 80) {
        usageColor = '#EF4444'; // Red for high usage
      } else if (usagePercent > 50) {
        usageColor = '#F59E0B'; // Amber for medium usage
      }
    }
    
    if (isMinimized) {
      // Minimized version
      timer.innerHTML = `
        <div style="padding: 10px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${usageColor};"></div>
            <span style="color: white; font-weight: 600; font-size: 14px;">${minutes}m</span>
          </div>
          <div style="width: 20px; display: flex; justify-content: center;">
            <div id="ds-expand-btn" style="color: rgba(255,255,255,0.8); cursor: pointer; font-size: 16px;">↕</div>
          </div>
        </div>
      `;
    } else {
      // Full version
      timer.innerHTML = `
        <div style="padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="color: white; font-weight: 700; font-size: 16px;">${site}</div>
            <div style="display: flex; gap: 8px;">
              <div id="ds-timer-pause" style="color: rgba(255,255,255,0.9); cursor: pointer; font-size: 14px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">⏸️</div>
              <div id="ds-minimize-btn" style="color: rgba(255,255,255,0.9); cursor: pointer; font-size: 16px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">_</div>
            </div>
          </div>
          
          <div style="color: rgba(255,255,255,0.95); font-size: 14px; margin-bottom: 10px;">
            ${minutes}m ${seconds}s today
          </div>
          
          <div style="height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
            <div style="height: 100%; width: ${usagePercent}%; background-color: ${usageColor}; transition: width 0.5s ease;"></div>
          </div>
          
          <div style="display: flex; gap: 8px; font-size: 12px;">
            <div id="ds-focus-now" style="flex: 1; text-align: center; background: rgba(255,255,255,0.2); padding: 6px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s ease;">Focus</div>
            <div id="ds-take-break" style="flex: 1; text-align: center; background: rgba(255,255,255,0.2); padding: 6px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s ease;">Break</div>
            <div id="ds-settings" style="flex: 1; text-align: center; background: rgba(255,255,255,0.2); padding: 6px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s ease;">Settings</div>
          </div>
        </div>
      `;
    }
    
    // Add hover effects to buttons
    setTimeout(() => {
      const actionButtons = document.querySelectorAll('#ds-focus-now, #ds-take-break, #ds-settings');
      actionButtons.forEach(btn => {
        btn.addEventListener('mouseover', () => {
          btn.style.background = 'rgba(255,255,255,0.3)';
        });
        btn.addEventListener('mouseout', () => {
          btn.style.background = 'rgba(255,255,255,0.2)';
        });
      });
      
      // Set up event listeners
      const minimizeBtn = document.getElementById('ds-minimize-btn');
      const expandBtn = document.getElementById('ds-expand-btn');
      const focusBtn = document.getElementById('ds-focus-now');
      const breakBtn = document.getElementById('ds-take-break');
      const settingsBtn = document.getElementById('ds-settings');
      const pauseBtn = document.getElementById('ds-timer-pause');
      
      if (minimizeBtn) minimizeBtn.addEventListener('click', toggleMinimize);
      if (expandBtn) expandBtn.addEventListener('click', toggleMinimize);
      if (focusBtn) focusBtn.addEventListener('click', startFocusMode);
      if (breakBtn) breakBtn.addEventListener('click', showMindfulnessExercise);
      if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
      if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
    }, 10);
  }
  
  // Toggle between minimized and full states
  function toggleMinimize(e) {
    e.stopPropagation(); // Prevent drag start
    isMinimized = !isMinimized;
    
    // Save state to localStorage
    try {
      localStorage.setItem('dopamineShieldMinimized', isMinimized.toString());
    } catch (e) {
      console.error('Error saving minimized state:', e);
    }
    
    updateTimerContent();
  }
  
  // Initialize
  function init() {
    // Create timer element
    const timer = createTimerElement();
    document.body.appendChild(timer);
    
    // Update with initial content
    updateTimerContent();
    
    // Set up drag functionality
    timer.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Load current site and user settings
    currentSite = identifySite(window.location.hostname);
    
    // Try to load settings and usage data
    loadData();
    
    // Set up update interval
    setInterval(loadData, 5000); // Update every 5 seconds
    
    // Listen for messages from background script
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'UPDATE_USAGE_DISPLAY') {
          loadData();
        } else if (message.action === 'TIME_LIMIT_REACHED') {
          showTimeLimitOverlay(message.data);
        } else if (message.action === 'SHOW_NUDGE') {
          showNudge(message.data);
        } else if (message.action === 'APPROACHING_LIMIT') {
          showApproachingLimitWarning(message.data);
        }
        return true;
      });
    } catch (e) {
      console.error('Error setting up message listener:', e);
    }
  }
  
  // Load current usage data and settings
  function loadData() {
    try {
      chrome.storage.local.get(['usageData', 'settings'], result => {
        if (chrome.runtime.lastError) {
          console.log('Error getting data:', chrome.runtime.lastError);
          return;
        }
        
        userSettings = result.settings || {};
        
        if (result.usageData) {
          const today = getDateString();
          const site = currentSite;
          
          if (site && result.usageData.daily && result.usageData.daily[today] && result.usageData.daily[today][site] !== undefined) {
            todayUsage = result.usageData.daily[today][site];
            updateTimerContent();
          }
        }
      });
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }
  
  // Function to start dragging
  function startDrag(e) {
    if (e.target.id === 'ds-minimize-btn' || e.target.id === 'ds-expand-btn' || 
        e.target.id === 'ds-focus-now' || e.target.id === 'ds-take-break' || 
        e.target.id === 'ds-settings' || e.target.id === 'ds-timer-pause') {
      return; // Don't start drag if clicking on a button
    }
    
    e.preventDefault();
    isDragging = true;
    
    // Get the timer element
    const timer = document.getElementById('dopamine-shield-timer');
    
    // Calculate the offset of the mouse cursor from the timer's top-left corner
    const rect = timer.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    // Apply active drag styling
    timer.style.opacity = '0.8';
    timer.style.transform = 'scale(1.02)';
  }
  
  // Function to handle dragging
  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    // Get the timer element
    const timer = document.getElementById('dopamine-shield-timer');
    if (!timer) return;
    
    // Calculate the new position
    const newLeft = e.clientX - dragOffsetX;
    const newTop = e.clientY - dragOffsetY;
    
    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Get timer dimensions
    const rect = timer.getBoundingClientRect();
    
    // Make sure the timer stays within the window bounds
    let posLeft = Math.max(0, Math.min(newLeft, windowWidth - rect.width));
    let posTop = Math.max(0, Math.min(newTop, windowHeight - rect.height));
    
    // Apply the new position
    timer.style.left = posLeft + 'px';
    timer.style.top = posTop + 'px';
    timer.style.right = 'auto';
  }
  
  // Function to end dragging
  function endDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Get the timer element
    const timer = document.getElementById('dopamine-shield-timer');
    if (!timer) return;
    
    // Reset styling
    timer.style.opacity = '1';
    timer.style.transform = 'scale(1)';
    
    // Save position to localStorage
    try {
      const rect = timer.getBoundingClientRect();
      const position = {
        top: timer.style.top,
        left: timer.style.left
      };
      localStorage.setItem('dopamineShieldPosition', JSON.stringify(position));
    } catch (e) {
      console.error('Error saving position:', e);
    }
  }
  
  // Function to start focus mode
  function startFocusMode() {
    try {
      chrome.runtime.sendMessage({ action: 'START_FOCUS_MODE' });
      showNotification('Focus Mode Started', 'Stay productive! Social media sites will be blocked.');
    } catch (e) {
      console.error('Error starting focus mode:', e);
    }
  }
  
  // Function to toggle pause tracking
  function togglePause(e) {
    e.stopPropagation(); // Prevent drag start
    
    try {
      const pauseButton = document.getElementById('ds-timer-pause');
      if (pauseButton.textContent === '⏸️') {
        pauseButton.textContent = '▶️';
        pauseButton.title = 'Resume tracking';
        chrome.runtime.sendMessage({ action: 'PAUSE_TRACKING' });
        showNotification('Tracking Paused', 'Time tracking is paused temporarily.');
      } else {
        pauseButton.textContent = '⏸️';
        pauseButton.title = 'Pause tracking';
        chrome.runtime.sendMessage({ action: 'RESUME_TRACKING' });
        showNotification('Tracking Resumed', 'Time tracking is active again.');
      }
    } catch (e) {
      console.error('Error toggling pause:', e);
    }
  }
  
  // Function to open settings
  function openSettings(e) {
    e.stopPropagation(); // Prevent drag start
    
    try {
      chrome.runtime.sendMessage({ action: 'OPEN_SETTINGS' });
    } catch (e) {
      console.error('Error opening settings:', e);
    }
  }
  
  // Show approaching limit warning
  function showApproachingLimitWarning(data) {
    showNotification(
      'Approaching Time Limit',
      `You've used ${Math.round(data.used)} of your ${data.limit} minute limit on ${data.site}.`,
      'warning'
    );
  }
  
  // Show time limit reached overlay
  function showTimeLimitOverlay(data) {
    // Clear any existing overlay
    clearOverlay();
    
    // Create time limit overlay
    const limitOverlay = document.createElement('div');
    limitOverlay.className = 'dopamine-shield-overlay limit-overlay';
    limitOverlay.style.position = 'fixed';
    limitOverlay.style.top = '0';
    limitOverlay.style.left = '0';
    limitOverlay.style.width = '100%';
    limitOverlay.style.height = '100%';
    limitOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    limitOverlay.style.display = 'flex';
    limitOverlay.style.justifyContent = 'center';
    limitOverlay.style.alignItems = 'center';
    limitOverlay.style.zIndex = '999999';
    limitOverlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    limitOverlay.style.backdropFilter = 'blur(5px)';
    
    limitOverlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); animation: fadeInUp 0.5s ease-out;">
        <div style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg, #EF4444, #F87171); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18"></path><path d="M6 6l12 12"></path>
          </svg>
        </div>
        <h2 style="color: #1E293B; font-size: 24px; margin-bottom: 15px;">Daily Limit Reached</h2>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 10px;">You've spent ${Math.round(data.used)} minutes on ${data.site} today.</p>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 25px;">Your daily limit is ${data.limit} minutes.</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="ds-snooze-limit" style="background: #F1F5F9; color: #475569; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Just 5 More Minutes</button>
          <button id="ds-exit-site" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Exit ${data.site}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(limitOverlay);
    activeOverlay = limitOverlay;
    
    // Add event listeners with hover effects
    const snoozeButton = document.getElementById('ds-snooze-limit');
    const exitButton = document.getElementById('ds-exit-site');
    
    snoozeButton.addEventListener('mouseover', () => {
      snoozeButton.style.background = '#E2E8F0';
    });
    snoozeButton.addEventListener('mouseout', () => {
      snoozeButton.style.background = '#F1F5F9';
    });
    
    exitButton.addEventListener('mouseover', () => {
      exitButton.style.transform = 'translateY(-2px)';
      exitButton.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
    });
    exitButton.addEventListener('mouseout', () => {
      exitButton.style.transform = 'translateY(0)';
      exitButton.style.boxShadow = 'none';
    });
    
    // Add click event listeners
    snoozeButton.addEventListener('click', () => {
      clearOverlay();
      // Allow 5 more minutes before showing another warning
      chrome.runtime.sendMessage({ action: 'SNOOZE_LIMIT', minutes: 5, site: data.site });
    });
    
    exitButton.addEventListener('click', () => {
      window.location.href = 'https://www.google.com';
    });
    
    // Add keydown event listener to close overlay with Escape key
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        clearOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }
  
  // Show nudge overlay
  function showNudge(data) {
    // Clear any existing overlay
    clearOverlay();
    
    // Create nudge overlay
    const nudgeOverlay = document.createElement('div');
    nudgeOverlay.className = 'dopamine-shield-overlay nudge-overlay';
    nudgeOverlay.style.position = 'fixed';
    nudgeOverlay.style.top = '0';
    nudgeOverlay.style.left = '0';
    nudgeOverlay.style.width = '100%';
    nudgeOverlay.style.height = '100%';
    nudgeOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    nudgeOverlay.style.display = 'flex';
    nudgeOverlay.style.justifyContent = 'center';
    nudgeOverlay.style.alignItems = 'center';
    nudgeOverlay.style.zIndex = '999999';
    nudgeOverlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    nudgeOverlay.style.backdropFilter = 'blur(3px)';
    
    nudgeOverlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 12px; max-width: 450px; width: 90%; text-align: center; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); animation: fadeInUp 0.5s ease-out;">
        <div style="width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg, #6366F1, #8B5CF6); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 style="color: #1E293B; font-size: 24px; margin-bottom: 15px;">Time Check</h2>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 10px;">You've been on ${data.site} for a while now.</p>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 25px;">Is this how you wanted to spend your time?</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="ds-nudge-dismiss" style="background: #F1F5F9; color: #475569; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Continue Browsing</button>
          <button id="ds-nudge-exit" style="background: #F1F5F9; color: #475569; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Exit ${data.site}</button>
          <button id="ds-nudge-mindful" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Take a Break</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(nudgeOverlay);
    activeOverlay = nudgeOverlay;
    
    // Add hover effects
    const buttons = nudgeOverlay.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.id === 'ds-nudge-mindful') {
        button.addEventListener('mouseover', () => {
          button.style.transform = 'translateY(-2px)';
          button.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
        });
        button.addEventListener('mouseout', () => {
          button.style.transform = 'translateY(0)';
          button.style.boxShadow = 'none';
        });
      } else {
        button.addEventListener('mouseover', () => {
          button.style.background = '#E2E8F0';
        });
        button.addEventListener('mouseout', () => {
          button.style.background = '#F1F5F9';
        });
      }
    });
    
    // Add event listeners
    document.getElementById('ds-nudge-dismiss').addEventListener('click', () => {
      clearOverlay();
    });
    
    document.getElementById('ds-nudge-exit').addEventListener('click', () => {
      window.location.href = 'https://www.google.com';
    });
    
    document.getElementById('ds-nudge-mindful').addEventListener('click', () => {
      clearOverlay();
      showMindfulnessExercise();
    });
  }
  
  // Show mindfulness exercise overlay
  function showMindfulnessExercise() {
    // Clear any existing overlay
    clearOverlay();
    
    // Create mindfulness overlay with modern styling
    const mindfulnessOverlay = document.createElement('div');
    mindfulnessOverlay.className = 'dopamine-shield-overlay mindfulness-overlay';
    mindfulnessOverlay.style.position = 'fixed';
    mindfulnessOverlay.style.top = '0';
    mindfulnessOverlay.style.left = '0';
    mindfulnessOverlay.style.width = '100%';
    mindfulnessOverlay.style.height = '100%';
    mindfulnessOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    mindfulnessOverlay.style.display = 'flex';
    mindfulnessOverlay.style.justifyContent = 'center';
    mindfulnessOverlay.style.alignItems = 'center';
    mindfulnessOverlay.style.zIndex = '999999';
    mindfulnessOverlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    mindfulnessOverlay.style.backdropFilter = 'blur(8px)';
    
    mindfulnessOverlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 16px; max-width: 450px; width: 90%; text-align: center; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25); animation: fadeInUp 0.5s ease-out;">
        <h2 style="color: #1E293B; font-size: 24px; margin-bottom: 20px;">Mindful Breathing</h2>
        <div id="breathing-circle" style="width: 160px; height: 160px; background: linear-gradient(135deg, #6366F1, #8B5CF6); border-radius: 50%; margin: 0 auto 24px; display: flex; justify-content: center; align-items: center; transition: transform 4s ease, background-color 1s ease; box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);">
          <div id="breathing-text" style="color: white; font-size: 18px; font-weight: 600;">Breathe In</div>
        </div>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 10px;">Follow the circle and take 5 deep breaths</p>
        <div id="breath-counter" style="font-size: 14px; color: #94A3B8; margin-bottom: 30px; font-weight: 500;">Breath: 1 of 5</div>
        <button id="skip-mindfulness" style="background: #F1F5F9; color: #475569; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease;">Skip Exercise</button>
      </div>
    `;
    
    document.body.appendChild(mindfulnessOverlay);
    activeOverlay = mindfulnessOverlay;
    
    // Animation for breathing
    const circle = mindfulnessOverlay.querySelector('#breathing-circle');
    const text = mindfulnessOverlay.querySelector('#breathing-text');
    const counter = mindfulnessOverlay.querySelector('#breath-counter');
    
    let breathCount = 1;
    let phase = 'in';
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
        70% { box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
        100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
      }
    `;
    document.head.appendChild(style);
    
    // Add hover effect to skip button
    const skipButton = document.getElementById('skip-mindfulness');
    skipButton.addEventListener('mouseover', () => {
      skipButton.style.background = '#E2E8F0';
    });
    skipButton.addEventListener('mouseout', () => {
      skipButton.style.background = '#F1F5F9';
    });
    
    const animateBreathing = () => {
      if (phase === 'in') {
        circle.style.transform = 'scale(1.5)';
        circle.style.background = 'linear-gradient(135deg, #10B981, #34D399)';
        circle.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.4)';
        text.textContent = 'Breathe In';
        circle.style.animation = 'pulse 2s infinite';
        
        setTimeout(() => {
          phase = 'hold';
          text.textContent = 'Hold';
          circle.style.animation = 'none';
          setTimeout(() => {
            phase = 'out';
            circle.style.transform = 'scale(1)';
            circle.style.background = 'linear-gradient(135deg, #6366F1, #8B5CF6)';
            circle.style.boxShadow = '0 0 30px rgba(139, 92, 246, 0.4)';
            text.textContent = 'Breathe Out';
            
            setTimeout(() => {
              breathCount++;
              counter.textContent = `Breath: ${breathCount} of 5`;
              
              if (breathCount <= 5) {
                phase = 'in';
                animateBreathing();
              } else {
                // Exercise complete
                clearOverlay();
                showExerciseComplete();
              }
            }, 4000); // Breathe out for 4 seconds
          }, 1500); // Hold for 1.5 seconds
        }, 4000); // Breathe in for 4 seconds
      }
    };
    
    // Start animation
    setTimeout(animateBreathing, 1000);
    
    // Add event listener for skip button
    skipButton.addEventListener('click', () => {
      clearOverlay();
    });
  }
  
  // Show exercise complete message
  function showExerciseComplete() {
    // Create completion overlay
    const completeOverlay = document.createElement('div');
    completeOverlay.className = 'dopamine-shield-overlay complete-overlay';
    completeOverlay.style.position = 'fixed';
    completeOverlay.style.top = '0';
    completeOverlay.style.left = '0';
    completeOverlay.style.width = '100%';
    completeOverlay.style.height = '100%';
    completeOverlay.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    completeOverlay.style.display = 'flex';
    completeOverlay.style.justifyContent = 'center';
    completeOverlay.style.alignItems = 'center';
    completeOverlay.style.zIndex = '999999';
    completeOverlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    completeOverlay.style.backdropFilter = 'blur(8px)';
    
    completeOverlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 16px; max-width: 450px; width: 90%; text-align: center; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25); animation: fadeInUp 0.5s ease-out;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #34D399); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2 style="color: #1E293B; font-size: 24px; margin-bottom: 15px;">Well Done!</h2>
        <p style="color: #64748B; font-size: 16px; margin-bottom: 25px;">Taking mindful breaks helps reduce stress and improve focus.</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="ds-complete-productive" style="background: linear-gradient(135deg, #10B981, #34D399); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Go to a Productive Site</button>
          <button id="ds-complete-continue" style="background: #F1F5F9; color: #475569; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s ease;">Continue Browsing</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(completeOverlay);
    activeOverlay = completeOverlay;
    
    // Add hover effects
    const productiveBtn = document.getElementById('ds-complete-productive');
    const continueBtn = document.getElementById('ds-complete-continue');
    
    productiveBtn.addEventListener('mouseover', () => {
      productiveBtn.style.transform = 'translateY(-2px)';
      productiveBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
    });
    
    productiveBtn.addEventListener('mouseout', () => {
      productiveBtn.style.transform = 'translateY(0)';
      productiveBtn.style.boxShadow = 'none';
    });
    
    continueBtn.addEventListener('mouseover', () => {
      continueBtn.style.background = '#E2E8F0';
    });
    
    continueBtn.addEventListener('mouseout', () => {
      continueBtn.style.background = '#F1F5F9';
    });
    
    // Add event listeners
    continueBtn.addEventListener('click', () => {
      clearOverlay();
    });
    
    productiveBtn.addEventListener('click', () => {
      window.location.href = 'https://www.notion.so';
    });
    
    // Auto dismiss after 15 seconds
    setTimeout(() => {
      if (activeOverlay === completeOverlay) {
        clearOverlay();
      }
    }, 15000);
  }
  
  // Show notification toast
  function showNotification(title, message, type = 'info') {
    // Colors based on type
    let bgColor, iconColor, iconSvg;
    
    switch (type) {
      case 'success':
        bgColor = 'linear-gradient(135deg, #10B981, #34D399)';
        iconColor = '#10B981';
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        break;
      case 'warning':
        bgColor = 'linear-gradient(135deg, #F59E0B, #FBBF24)';
        iconColor = '#F59E0B';
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        break;
      case 'error':
        bgColor = 'linear-gradient(135deg, #EF4444, #F87171)';
        iconColor = '#EF4444';
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        break;
      default: // info
        bgColor = 'linear-gradient(135deg, #6366F1, #8B5CF6)';
        iconColor = '#6366F1';
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '30px';
    notification.style.right = '30px';
    notification.style.background = 'white';
    notification.style.borderRadius = '12px';
    notification.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
    notification.style.width = '320px';
    notification.style.overflow = 'hidden';
    notification.style.zIndex = '999999';
    notification.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    notification.style.transform = 'translateY(20px)';
    notification.style.opacity = '0';
    notification.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    notification.innerHTML = `
      <div style="height: 4px; background: ${bgColor};"></div>
      <div style="display: flex; padding: 16px;">
        <div style="margin-right: 12px; width: 40px; height: 40px; border-radius: 8px; background: ${bgColor}; display: flex; align-items: center; justify-content: center;">
          ${iconSvg}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #1E293B; margin-bottom: 4px; font-size: 16px;">${title}</div>
          <div style="color: #64748B; font-size: 14px;">${message}</div>
        </div>
        <div style="margin-left: 8px; cursor: pointer; color: #94A3B8; display: flex; align-items: flex-start; padding: 4px;" id="close-notification">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add event listener to close button
    const closeBtn = document.getElementById('close-notification');
    closeBtn.addEventListener('click', () => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    });
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Auto hide after 4 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }
  
  // Clear any active overlay
  function clearOverlay() {
    if (activeOverlay && document.body.contains(activeOverlay)) {
      document.body.removeChild(activeOverlay);
      activeOverlay = null;
    }
  }
  
  // Identify which site we're on
  function identifySite(hostname) {
    const sites = {
      'youtube.com': 'YouTube',
      'instagram.com': 'Instagram',
      'reddit.com': 'Reddit',
      'facebook.com': 'Facebook',
      'twitter.com': 'Twitter',
      'tiktok.com': 'TikTok'
    };
    
    for (const site in sites) {
      if (hostname.includes(site)) {
        return sites[site];
      }
    }
    return null;
  }
  
  // Get date string
  function getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  // Initialize when the document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();