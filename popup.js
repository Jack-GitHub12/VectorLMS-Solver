// popup.js
document.addEventListener('DOMContentLoaded', async function() {
  const statusEl = document.getElementById('status');
  const toggleBtn = document.getElementById('toggleBtn');
  const clearQueueBtn = document.getElementById('clearQueue');
  const refreshBtn = document.getElementById('refreshStatus');
  const queueInfoEl = document.getElementById('queueInfo');
  const queueProgressEl = document.getElementById('queueProgress');

  // Get current extension state
  async function getExtensionState() {
    const result = await chrome.storage.local.get(['extensionEnabled', 'lastActivity']);
    return {
      enabled: result.extensionEnabled !== false, // Default to enabled
      lastActivity: result.lastActivity || null
    };
  }

  // Set extension state
  async function setExtensionState(enabled) {
    await chrome.storage.local.set({ 
      extensionEnabled: enabled,
      lastActivity: enabled ? Date.now() : null
    });
  }

  // Get queue information from current tab
  async function getQueueInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || (!tab.url.includes('vectorlmsedu.com') && !tab.url.includes('trainingcdn.com'))) {
        return null;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          try {
            const queueData = localStorage.getItem('vlmsQueue');
            const indexData = localStorage.getItem('vlmsIdx');
            const taskMetadata = localStorage.getItem('vlmsTaskData');
            
            if (queueData) {
              const queue = JSON.parse(queueData);
              const index = parseInt(indexData || '0', 10);
              
              let currentTask = null;
              let videoCount = 0;
              let totalVideoDuration = 0;
              
              // Parse enhanced task metadata if available
                              if (taskMetadata) {
                  try {
                    const taskData = JSON.parse(taskMetadata);
                    currentTask = taskData[index] || null;
                    videoCount = taskData.filter(t => t.isVideo).length;
                    totalVideoDuration = taskData
                      .filter(t => t.isVideo)
                      .reduce((sum, t) => sum + (t.timeMin || 0), 0);
                    
                                        // Calculate completion statistics
                    const completedCount = taskData.filter(t => t.completed).length;
                    const remainingTasks = taskData.slice(index).filter(t => !t.completed);
                    
                    // Return enhanced data when metadata is available
                    return {
                      total: queue.length,
                      current: index,
                      remaining: queue.length - index,
                      currentTask: currentTask,
                      videoCount: videoCount,
                      totalVideoDuration: Math.round(totalVideoDuration),
                      completedCount: completedCount,
                      actualRemaining: remainingTasks.length
                    };
                  } catch (e) {
                    console.error('Error parsing task metadata:', e);
                  }
                }
                
                // Return basic data when no metadata available
                return {
                  total: queue.length,
                  current: index,
                  remaining: queue.length - index,
                  currentTask: currentTask,
                  videoCount: videoCount,
                  totalVideoDuration: Math.round(totalVideoDuration),
                  completedCount: 0,
                  actualRemaining: queue.length - index
                };
            }
            return null;
          } catch (e) {
            return null;
          }
        }
      });

      return results[0]?.result || null;
    } catch (e) {
      console.error('Error getting queue info:', e);
      return null;
    }
  }

  // Clear the task queue
  async function clearQueue() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || (!tab.url.includes('vectorlmsedu.com') && !tab.url.includes('trainingcdn.com'))) {
        return false;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          localStorage.removeItem('vlmsQueue');
          localStorage.removeItem('vlmsIdx');
          localStorage.removeItem('vlmsTaskData');
          console.log('[VectorLMS Solver] Queue and metadata cleared by user');
        }
      });

      return true;
    } catch (e) {
      console.error('Error clearing queue:', e);
      return false;
    }
  }

  // Update the UI
  async function updateUI() {
    const state = await getExtensionState();
    const queueInfo = await getQueueInfo();

    // Update status
    if (state.enabled) {
      statusEl.textContent = 'Status: Active';
      statusEl.className = 'status active';
      toggleBtn.textContent = 'Disable Solver';
      toggleBtn.className = 'danger-btn';
    } else {
      statusEl.textContent = 'Status: Disabled';
      statusEl.className = 'status inactive';
      toggleBtn.textContent = 'Enable Solver';
      toggleBtn.className = 'primary-btn';
    }

    // Update queue information
    if (queueInfo && queueInfo.total > 0) {
      queueInfoEl.style.display = 'block';
      
      let progressText = `${queueInfo.current} / ${queueInfo.total} tasks`;
      
      // Add completion information if available
      if (queueInfo.completedCount > 0) {
        progressText += ` (${queueInfo.completedCount} completed)`;
      }
      
      // Add video information if available
      if (queueInfo.videoCount > 0) {
        progressText += ` • ${queueInfo.videoCount} videos`;
      }
      
      queueProgressEl.innerHTML = progressText;
      
      // Add current task info
      if (queueInfo.currentTask && queueInfo.remaining > 0) {
        const taskTitle = queueInfo.currentTask.title || 'Current Task';
        const truncatedTitle = taskTitle.length > 30 ? taskTitle.substring(0, 30) + '...' : taskTitle;
        
        // Add completion indicator
        const completionIcon = queueInfo.currentTask.completed ? '✅' : '📋';
        const completionText = queueInfo.currentTask.completed ? ' (completed)' : '';
        
        queueProgressEl.innerHTML += `<br><small>${completionIcon} ${truncatedTitle}${completionText}</small>`;
        
        if (queueInfo.currentTask.isVideo && queueInfo.currentTask.timeMin > 0) {
          queueProgressEl.innerHTML += `<br><small>⏱️ ~${queueInfo.currentTask.timeMin} min video</small>`;
        }
      }
      
      if (queueInfo.remaining > 0) {
        // Use actual remaining if available, otherwise use queue position remaining
        const actualRemaining = queueInfo.actualRemaining || queueInfo.remaining;
        queueProgressEl.innerHTML += `<br><small>${actualRemaining} remaining`;
        
        // Show queue position vs actual remaining if different
        if (queueInfo.actualRemaining && queueInfo.actualRemaining !== queueInfo.remaining) {
          queueProgressEl.innerHTML += ` (${queueInfo.remaining} in queue)`;
        }
        
        // Add total video duration if available
        if (queueInfo.totalVideoDuration > 0) {
          const hours = Math.floor(queueInfo.totalVideoDuration / 60);
          const mins = queueInfo.totalVideoDuration % 60;
          if (hours > 0) {
            queueProgressEl.innerHTML += ` • ~${hours}h ${mins}m videos`;
          } else {
            queueProgressEl.innerHTML += ` • ~${mins}m videos`;
          }
        }
        
        queueProgressEl.innerHTML += `</small>`;
      } else {
        queueProgressEl.innerHTML += `<br><small>✅ All complete!</small>`;
      }
    } else {
      queueInfoEl.style.display = 'none';
    }
  }

  // Show temporary feedback
  function showFeedback(message, isSuccess = true) {
    const originalText = statusEl.textContent;
    const originalClass = statusEl.className;
    
    statusEl.textContent = message;
    statusEl.className = `status ${isSuccess ? 'active' : 'inactive'}`;
    
    setTimeout(() => {
      statusEl.textContent = originalText;
      statusEl.className = originalClass;
    }, 2000);
  }

  // Event listeners
  toggleBtn.addEventListener('click', async function() {
    const state = await getExtensionState();
    const newState = !state.enabled;
    
    await setExtensionState(newState);
    
    // Inject the state change into content scripts on Vector LMS tabs
    try {
      const tabs = await chrome.tabs.query({
        url: ['https://*.vectorlmsedu.com/*', 'https://*.trainingcdn.com/*']
      });
      
      for (const tab of tabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (enabled) => {
              console.log(`[VectorLMS Solver] Extension ${enabled ? 'enabled' : 'disabled'} by user`);
              if (enabled && window.vlmsAutoRestart) {
                window.vlmsAutoRestart();
              }
            },
            args: [newState]
          });
        } catch (e) {
          // Tab might not be accessible or loaded
        }
      }
    } catch (e) {
      console.error('Error updating tabs:', e);
    }
    
    showFeedback(newState ? 'Solver Enabled!' : 'Solver Disabled!', newState);
    setTimeout(updateUI, 1000);
  });

  clearQueueBtn.addEventListener('click', async function() {
    const success = await clearQueue();
    showFeedback(success ? 'Queue Cleared!' : 'Error clearing queue', success);
    setTimeout(updateUI, 1000);
  });

  refreshBtn.addEventListener('click', function() {
    showFeedback('Refreshing...', true);
    setTimeout(updateUI, 500);
  });

  // Initial UI update
  updateUI();

  // Auto-refresh every 5 seconds when popup is open
  const refreshInterval = setInterval(updateUI, 5000);
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(refreshInterval);
  });
}); 