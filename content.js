// content.js
(async function(){
    'use strict';
  
    // Isolate extension in try-catch to prevent external errors from breaking it
    try {
  
    const LOG_PREFIX = '[VectorLMS Solver]';
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const CLICK_DELAY = 800;
    const MAX_RETRIES = 3;
    const CONTENT_WAIT_TIME = 2000;
    
    // Global error handling to prevent regex and other errors from breaking the extension
    const originalConsoleError = console.error;
    console.error = function(...args) {
      // Filter out external errors that we can't control
      const errorString = args.join(' ').toLowerCase();
      if (errorString.includes('trackjs') && errorString.includes('invalid regular expression')) {
        // Log but don't let it break our extension
        originalConsoleError(LOG_PREFIX, 'Suppressed TrackJS regex error:', ...args);
        return;
      }
      if (errorString.includes('scorm') || errorString.includes('pipwerks') || errorString.includes('cannot read properties of undefined')) {
        // Log but don't let SCORM API errors break our extension
        originalConsoleError(LOG_PREFIX, 'Suppressed SCORM API error:', ...args);
        return;
      }
      originalConsoleError(...args);
    };

    // Global uncaught error handler to prevent external script errors from breaking our extension
    window.addEventListener('error', function(event) {
      const errorMessage = event.message?.toLowerCase() || '';
      const errorSource = event.filename?.toLowerCase() || '';
      
      // Suppress known external script errors
      if (errorSource.includes('scorm') || errorSource.includes('pipwerks') || errorSource.includes('trackjs') ||
          errorMessage.includes('cannot read properties of undefined') || 
          errorMessage.includes('invalid regular expression')) {
        console.log(LOG_PREFIX, 'Suppressed external script error:', event.message, 'from:', event.filename);
        event.preventDefault();
        return false;
      }
    }, true);
    
    // Wrap critical functions in try-catch to prevent extension breaking
    function safeRegexMatch(text, pattern) {
      try {
        return text.match(pattern);
      } catch (e) {
        logError('Regex error prevented:', e);
        return null;
      }
    }
    
    // Check if extension is enabled
    async function isExtensionEnabled() {
      try {
        const result = await chrome.storage.local.get(['extensionEnabled']);
        return result.extensionEnabled !== false; // Default to enabled
      } catch (e) {
        // Fallback for content script context
        return true;
      }
    }
    
    // Add restart function to global scope
    window.vlmsAutoRestart = async function() {
      log('🔄 Restarting extension...');
      if (await isExtensionEnabled()) {
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    };
  
    // Enhanced selectors with more variations
    const TASK_SEL      = 'a[href*="/training/player/"], a[href*="/launch/"], .task-link, .course-item a';
    const CAROUSEL_SEL  = 'button.carousel-control-next.accessibility-enabled, button.carousel-control-next, .carousel-control-next-icon, #next, button[aria-label="Next"], .next-button, .slide-next';
    const VIDEO_SEL     = 'video, .video-player video, #video-element';
    const SLIC_TAB_SEL  = '#my-tab span, [id^="btn_tab"], [id^="tab-0-0-"], [id^="tab-"], .slic-tab, .tab-button';
    const SLIC_LINK_SEL = '[id^="li-"] > a, .slic-link, .lesson-link';
    const COMPLETION_SELECTORS = [
      '.complete-button',
      '.mark-complete',
      '[data-action="complete"]',
      'button:contains("Complete")',
      'input[type="submit"][value*="complete" i]'
    ];
  
    function log(...args){ console.log(LOG_PREFIX, ...args); }
    function logError(...args){ console.error(LOG_PREFIX, ...args); }
  
    // Enhanced element finder with multiple selectors and text-based matching
    function findElement(selectors, root = document) {
      if (typeof selectors === 'string') selectors = [selectors];
      for (const selector of selectors) {
        try {
          // Handle text-based selectors like button:contains("Submit")
          if (selector.includes(':contains(')) {
            try {
              // More robust regex with better escaping
              const match = selector.match(/^(.+?):contains\(['"]?([^'"]+?)['"]?\)$/);
              if (match) {
                const [, elementSelector, text] = match;
                // Ensure we have valid selectors before proceeding
                if (elementSelector && text) {
                  const elements = Array.from(root.querySelectorAll(elementSelector || '*'));
                  const element = elements.find(el => 
                    el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase())
                  );
                  if (element && element.offsetParent !== null) return element;
                }
              }
              continue;
            } catch (regexError) {
              logError('Error in :contains() regex processing:', regexError, 'for selector:', selector);
              continue;
            }
          }
          
          // Regular selector
          const element = root.querySelector(selector);
          if (element && element.offsetParent !== null) return element;
        } catch (e) {
          // For :contains() and other pseudo-selectors that might fail
          if (selector.includes(':contains(')) {
            try {
              // Fallback processing for problematic selectors
              const colonIndex = selector.indexOf(':contains(');
              if (colonIndex > 0) {
                const elementSelector = selector.substring(0, colonIndex);
                const containsText = selector.substring(colonIndex + 10).replace(/['"()]/g, '').trim();
                
                if (elementSelector && containsText) {
                  const elements = Array.from(root.querySelectorAll(elementSelector || '*'));
                  const element = elements.find(el => 
                    el.textContent && el.textContent.toLowerCase().includes(containsText.toLowerCase())
                  );
                  if (element && element.offsetParent !== null) return element;
                }
              }
            } catch (fallbackError) {
              logError('Error in :contains() fallback processing:', fallbackError, 'for selector:', selector);
            }
          } else {
            logError('Invalid selector:', selector, e);
          }
        }
      }
      return null;
    }
  
    // Wait for element to appear
    async function waitForElement(selector, timeout = 5000, root = document) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const element = findElement(selector, root);
        if (element) return element;
        await wait(100);
      }
      return null;
    }
  
    // Enhanced click with retry mechanism
    async function safeClick(element, description = 'element') {
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          if (element && element.offsetParent !== null && !element.disabled) {
            // Scroll element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await wait(200);
            
            // Try different click methods
            if (element.click) {
              element.click();
            } else {
              element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            
            log(`☑ clicked ${description}`);
            return true;
          }
        } catch (e) {
          logError(`Error clicking ${description} (attempt ${i + 1}):`, e);
        }
        await wait(200);
      }
      return false;
    }
  
    // Advance any carousel/Next buttons with enhanced detection
    async function drainCarousel(root = document) {
      let clickCount = 0;
      const maxClicks = 50; // Prevent infinite loops
      
      while (clickCount < maxClicks) {
        const btn = findElement(CAROUSEL_SEL, root);
        if (!btn || btn.disabled) break;
        
        if (await safeClick(btn, 'carousel/next button')) {
          clickCount++;
          await wait(CLICK_DELAY);
        } else {
          break;
        }
      }
      
      if (clickCount > 0) {
        log(`☑ advanced ${clickCount} slides`);
      }
    }
  
    // Enhanced video handling with better detection
    async function playAndWaitVideo(vid) {
      if (!vid) return false;
      
      try {
        // Set video properties
        vid.muted = true;
        vid.controls = false;
        
        // Wait for video to be ready
        if (vid.readyState < 2) {
          await new Promise(resolve => {
            vid.addEventListener('canplay', resolve, { once: true });
            setTimeout(resolve, 3000); // Fallback timeout
          });
        }
        
        // Try to click custom play buttons if present (before attempting API play)
        const playButtonSelectors = [
          // Very specific selectors from your recordings
          'div.slip_left_controls > button > span.slip',              // New interface from latest recording
          '#player-controls div.slip_left_controls button span.slip', // More specific version
          'div.slip_left_controls button',                            // Just the button in slip_left_controls
          '.slip_left_controls > button',                             // Alternative class format
          '#player div[class*="div"]:nth-child(6) span:nth-child(2)', // Based on xpath structure
          '#player span.slip_button_icon[class*="play"]',             // slip_button_icon with play in class
          '#player span.slip_button_icon:not([class*="back"]):not([class*="prev"]):not([class*="submit"])',  // slip_button_icon but not navigation
          
          // Video-specific play buttons only
          '.video-container .play-button',                    // Play button in video container
          '.player-container .play-button',                   // Play button in player container  
          '.video-overlay .play-button',                      // Play button in video overlay
          'button.video-play',                                // Video play button class
          '.video-controls .play',                            // Play button in video controls
          '[data-action="play"][data-video]',                 // Data action play for videos only
          '.player-play-button',                              // Player-specific play button
          '.jwplayer .jw-display-icon-container',             // JWPlayer play button
          '.vjs-big-play-button'                              // Video.js play button
        ];
        
        let playButtonClicked = false;
        const searchRoot = vid.closest('.video-container, .player-container, .video-wrapper, #player, #player-controls') || vid.parentElement || document;
        
        for (const selector of playButtonSelectors) {
          const playBtn = findElement(selector, searchRoot);
          if (playBtn && playBtn.offsetParent !== null && !playBtn.disabled) {
            
            // Additional filtering to avoid back/navigation buttons
            const buttonText = playBtn.textContent?.toLowerCase() || '';
            const buttonClass = playBtn.className?.toLowerCase() || '';
            const buttonAriaLabel = playBtn.getAttribute('aria-label')?.toLowerCase() || '';
            const buttonType = playBtn.type?.toLowerCase() || '';
            
            // Skip if it looks like a navigation/back/submit button
            const isWrongButton = (
              buttonText.includes('back') || 
              buttonText.includes('previous') || 
              buttonText.includes('prev') ||
              buttonText.includes('return') ||
              buttonText.includes('submit') ||
              buttonText.includes('agree') ||
              buttonText.includes('acknowledge') ||
              buttonClass.includes('back') || 
              buttonClass.includes('prev') ||
              buttonClass.includes('return') ||
              buttonClass.includes('nav') ||
              buttonClass.includes('submit') ||
              buttonAriaLabel.includes('back') || 
              buttonAriaLabel.includes('previous') ||
              buttonAriaLabel.includes('return') ||
              buttonAriaLabel.includes('submit') ||
              buttonType === 'submit'
            );
            
            if (isWrongButton) {
              log(`⏭️ Skipping wrong button type: ${selector} (${buttonText || buttonClass || buttonType})`);
              continue;
            }
            
            // Special handling for pause/play toggle buttons (slip_left_controls)
            const isToggleButton = selector.includes('slip_left_controls');
            
            if (isToggleButton) {
              // Check the CSS classes to determine video state
              // slip-play = video is paused (shows play button)
              // slip-pause = video is playing (shows pause button)
              const slipSpan = playBtn.querySelector('span.slip');
              const isPaused = slipSpan && slipSpan.classList.contains('slip-play');
              const isPlaying = slipSpan && slipSpan.classList.contains('slip-pause');
              
              if (isPaused) {
                log(`▶️ Video is paused (slip-play detected), clicking play/unpause button: ${selector}`);
              } else if (isPlaying) {
                log(`⏸️ Video is already playing (slip-pause detected), skipping toggle button: ${selector}`);
                continue; // Skip this button since video is already playing
              } else {
                // Fallback to vid.paused if no clear CSS class indication
                if (vid.paused) {
                  log(`▶️ Video is paused (fallback check), clicking play/unpause button: ${selector}`);
                } else {
                  log(`⏸️ Video is already playing (fallback check), skipping toggle button: ${selector}`);
                  continue;
                }
              }
            }
            
            // Check if the button is actually associated with this video
            const btnRect = playBtn.getBoundingClientRect();
            const vidRect = vid.getBoundingClientRect();
            
            // If button is near the video (overlapping or very close), it's likely the right button
            const isNearVideo = (
              btnRect.left >= vidRect.left - 100 && 
              btnRect.right <= vidRect.right + 100 &&
              btnRect.top >= vidRect.top - 100 && 
              btnRect.bottom <= vidRect.bottom + 100
            ) || searchRoot !== document; // Or if we're searching in a limited container
            
            if (isNearVideo) {
              log(`▶️ Clicking play button: ${selector} (text: "${buttonText}", class: "${buttonClass}")`);
              if (await safeClick(playBtn, `play button (${selector})`)) {
                await wait(800); // Wait for video to become playable after button click
                playButtonClicked = true;
                break;
              }
            } else {
              log(`⏭️ Skipping distant button: ${selector} (not near video)`);
            }
          }
        }
        
        if (playButtonClicked) {
          log('✅ Custom play button clicked, waiting for video to start...');
          // Give more time for the video to initialize after custom button click
          await wait(500);
        }
        
        // Play video (either after custom button or directly)
        await vid.play();
        log('▶ video playing (muted)…');
        
        // Wait for video to end
        await new Promise(resolve => {
          vid.addEventListener('ended', resolve, { once: true });
          // Fallback: if video is very short or already ended
          if (vid.ended || vid.duration - vid.currentTime < 1) {
            resolve();
          }
        });
        
        log('✅ video ended');
        
        // Mark video as played to avoid replaying
        vid.setAttribute('data-played', 'true');
        
        return true;
      } catch (e) {
        log('⚠️ video autoplay blocked or error:', e.message);
        return false;
      }
    }
    
    // Handle multiple videos in sequence with better detection
    async function playAllVideos(root = document) {
      try {
        let totalVideosPlayed = 0;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount < maxRetries) {
          // Find all unplayed videos
          const allVideos = Array.from(root.querySelectorAll(VIDEO_SEL))
            .filter(vid => vid.offsetParent !== null && 
                          !vid.ended && 
                          !vid.getAttribute('data-played'));
        
          if (allVideos.length === 0) {
            if (totalVideosPlayed > 0) {
              log(`✅ Completed playing ${totalVideosPlayed} video(s) total`);
            }
            return totalVideosPlayed > 0;
          }
          
          log(`📽️ Found ${allVideos.length} unplayed video(s) (attempt ${retryCount + 1})`);
          
          let videosPlayedThisRound = 0;
          for (let i = 0; i < allVideos.length; i++) {
            const video = allVideos[i];
            log(`📽️ Playing video ${i + 1}/${allVideos.length}`);
            
            if (await playAndWaitVideo(video)) {
              videosPlayedThisRound++;
              totalVideosPlayed++;
              
              // After each video, wait and check for new content that might have appeared
              await wait(1000);
              
              // Brief pause before checking for more videos
              await wait(500);
            }
          }
          
          if (videosPlayedThisRound === 0) {
            // No videos were played this round, break to avoid infinite loop
            break;
          }
          
          retryCount++;
          
          // Wait a bit longer between retry attempts to allow content to load
          await wait(1500);
        }
        
        if (totalVideosPlayed > 0) {
          log(`✅ Successfully played ${totalVideosPlayed} video(s) total`);
          return true;
        }
        
        return false;
      } catch (e) {
        logError('Error in playAllVideos:', e);
        return false;
      }
    }

    // New function to handle acknowledgment dialogs
    async function handleAcknowledgments(root = document) {
      try {
        log('📋 Checking for acknowledgment dialogs...');
        
        // Look for acknowledgment dialog elements
        const acknowledgmentSelectors = [
          '.acknowledgment-dialog',
          '.acknowledgment-modal',
          '[data-acknowledgment]',
          '.modal:contains("acknowledgment")',
          '.dialog:contains("acknowledgment")',
          '.popup:contains("acknowledgment")',
          'div:contains("requires you to view and acknowledge")',
          'div:contains("I agree")',
          'div:contains("acknowledge this content")',
          '[class*="acknowledge"]',
          '[id*="acknowledge"]'
        ];
        
        let acknowledgmentFound = false;
        
        for (const selector of acknowledgmentSelectors) {
          const dialog = findElement(selector, root);
          if (dialog && dialog.offsetParent !== null) {
            log(`📋 Found acknowledgment dialog: ${selector}`);
            acknowledgmentFound = true;
            
            // Look for "I agree" or similar confirmation buttons
            const confirmSelectors = [
              'button:contains("I agree")',
              'button:contains("I Agree")',
              'button:contains("Agree")',
              'button:contains("Accept")',
              'button:contains("Acknowledge")',
              'button:contains("Continue")',
              'button:contains("Confirm")',
              '.confirm-button',
              '.agree-button',
              '.acknowledge-button',
              '[data-action="agree"]',
              '[data-action="acknowledge"]',
              '[data-action="confirm"]'
            ];
            
            let buttonClicked = false;
            for (const btnSelector of confirmSelectors) {
              const confirmBtn = findElement(btnSelector, dialog);
              if (confirmBtn) {
                log(`📋 Clicking acknowledgment button: "${confirmBtn.textContent?.trim()}"`);
                if (await safeClick(confirmBtn, 'acknowledgment confirm button')) {
                  await wait(1000); // Wait for dialog to close
                  buttonClicked = true;
                  break;
                }
              }
            }
            
            if (!buttonClicked) {
              // Try clicking the dialog itself or any clickable elements
              const clickableElements = dialog.querySelectorAll('button, input[type="submit"], [role="button"]');
              for (const element of clickableElements) {
                if (element.offsetParent !== null) {
                  log(`📋 Clicking acknowledgment element: "${element.textContent?.trim() || element.type}"`);
                  if (await safeClick(element, 'acknowledgment element')) {
                    await wait(1000);
                    buttonClicked = true;
                    break;
                  }
                }
              }
            }
            
            if (buttonClicked) {
              log('✅ Acknowledgment dialog handled');
              return true;
            }
          }
        }
        
        // Also check for any modal/overlay that might be blocking content
        const modalSelectors = [
          '.modal.show',
          '.modal.active',
          '.overlay.active',
          '.popup.active',
          '.dialog.open',
          '[style*="display: block"]',
          '[style*="visibility: visible"]'
        ];
        
        for (const selector of modalSelectors) {
          const modal = findElement(selector, root);
          if (modal && modal.offsetParent !== null) {
            const modalText = modal.textContent?.toLowerCase() || '';
            if (modalText.includes('acknowledge') || modalText.includes('agree') || modalText.includes('view and')) {
              log(`📋 Found potential acknowledgment modal: ${selector}`);
              
              const anyButton = modal.querySelector('button, input[type="submit"], [role="button"]');
              if (anyButton && await safeClick(anyButton, 'modal button')) {
                await wait(1000);
                return true;
              }
            }
          }
        }
        
        return acknowledgmentFound;
        
      } catch (e) {
        logError('Error in acknowledgment handler:', e);
        return false;
      }
    }
  
    // Enhanced completion detection
    async function clickCompletionButtons(root = document) {
      for (const selector of COMPLETION_SELECTORS) {
        const btn = findElement(selector, root);
        if (btn) {
          if (await safeClick(btn, 'completion button')) {
            await wait(CLICK_DELAY);
            return true;
          }
        }
      }
      return false;
    }
    
    // Survey/Completion Flow Handler
    async function handleSurveyAndCompletion(root = document) {
      try {
        log('📝 Checking for survey/completion flow...');
        
        let flowProcessed = false;
        
        // 0) Click "Next" button to enter survey form if present
        const nextBtn = findElement([
          '#sv-nav-next input',                    // From recording
          '#sv-nav-next button',                   // Alternative
          'input[value="Next"]',                   // Value-based
          'button:contains("Next")',               // Text-based
          '.sv-nav-next'                           // Class-based
        ], root);
        
        if (nextBtn) {
          log('📝 Clicking survey Next button to enter form');
          if (await safeClick(nextBtn, 'survey next button')) {
            await wait(1000); // Wait for form to load
            flowProcessed = true;
          }
        }
        
        // 1) Handle table-based survey questions (rating scales with neutral column)
        const surveyTables = root.querySelectorAll('table tbody');
        if (surveyTables.length > 0) {
          log(`📝 Found ${surveyTables.length} survey table(s)`);
          
          for (const table of surveyTables) {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length > 0) {
              log(`📝 Processing ${rows.length} survey rows in table`);
              
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                
                // Look for the neutral column (typically 4th column based on recording)
                const neutralSelectors = [
                  'td:nth-of-type(4) input[type="radio"]',      // Radio input in 4th column
                  'td:nth-of-type(4) label',                    // Label in 4th column  
                  'td:nth-of-type(4) span',                     // Span in 4th column
                  'td:nth-of-type(4) svg',                      // SVG in 4th column
                  'td:nth-of-type(4)',                          // 4th column itself
                  'td:nth-child(4) input[type="radio"]',        // Alternative selector
                  'td:nth-child(4) label'                       // Alternative selector
                ];
                
                const neutralElement = findElement(neutralSelectors, row);
                if (neutralElement) {
                  log(`📝 Clicking neutral option for survey row ${i + 1}`);
                  
                  if (await safeClick(neutralElement, `survey row ${i + 1} neutral option`)) {
                    await wait(300); // Brief delay between row selections
                    flowProcessed = true;
                  }
                }
              }
            }
          }
        }
        
        // 2) Handle different survey sections by ID (#sq_101, #sq_102, #sq_103, etc.)
        for (let sqId = 101; sqId <= 110; sqId++) {
          const surveySection = root.querySelector(`#sq_${sqId}`);
          if (surveySection) {
            log(`📝 Found survey section #sq_${sqId}`);
            
            // Look for table rows within this survey section
            const sectionRows = Array.from(surveySection.querySelectorAll('table tbody tr'));
            if (sectionRows.length > 0) {
              log(`📝 Processing ${sectionRows.length} rows in survey section #sq_${sqId}`);
              
              for (let i = 0; i < sectionRows.length; i++) {
                const row = sectionRows[i];
                
                // Click neutral column (4th column)
                const neutralSelectors = [
                  'td:nth-of-type(4) svg',                      // SVG in 4th column (most common)
                  'td:nth-of-type(4) input[type="radio"]',      // Radio input
                  'td:nth-of-type(4) label',                    // Label
                  'td:nth-of-type(4) span',                     // Span
                  'td:nth-of-type(4)'                           // Column itself
                ];
                
                const neutralElement = findElement(neutralSelectors, row);
                if (neutralElement) {
                  const radioInput = row.querySelector('td:nth-of-type(4) input[type="radio"]');
                  if (!radioInput || !radioInput.checked) {
                    log(`📝 Clicking neutral option for #sq_${sqId} row ${i + 1}`);
                    
                    if (await safeClick(neutralElement, `sq_${sqId} row ${i + 1} neutral`)) {
                      await wait(200);
                      flowProcessed = true;
                    }
                  }
                }
              }
            }
          }
        }
        
        // 3) Handle simple survey questions (click "No" radio buttons)
        const surveyRadios = root.querySelectorAll('div.sv-radio--allowhover');
        if (surveyRadios.length > 0) {
          log(`📝 Found ${surveyRadios.length} survey radio buttons`);
          
          for (let i = 0; i < surveyRadios.length; i++) {
            const radio = surveyRadios[i];
            const radioText = radio.textContent?.trim().toLowerCase() || '';
            
            // Look for "No" answers or second option (typically "No")
            const isNoAnswer = radioText.includes('no') || 
                              radioText.includes('never') ||
                              radioText.includes('none') ||
                              radio.querySelector('input[value*="no" i]') ||
                              radio.querySelector('input[value="0"]') ||
                              radio.querySelector('input[value="false"]');
            
            // If it's clearly a "No" answer or it's the second radio in a group, click it
            const radioInput = radio.querySelector('input[type="radio"]');
            if (radioInput && !radioInput.checked && (isNoAnswer || i % 2 === 1)) {
              log(`📝 Clicking survey radio ${i + 1}: "${radioText || 'No option'}"`);
              
              if (await safeClick(radio, `survey radio ${i + 1}`)) {
                await wait(500);
                flowProcessed = true;
              }
            }
          }
          
          // Also try specific selectors from the recording
          const specificRadio = root.querySelector('#sq_102 div.sv-radio--allowhover');
          if (specificRadio && await safeClick(specificRadio, 'specific survey radio')) {
            await wait(500);
            flowProcessed = true;
          }
        }
        
        // 4) Click "Next" button to navigate between survey sections
        const surveyNextBtn = findElement([
          '#sv-nav-next input',                    // From recording
          '#sv-nav-next button',                   // Alternative
          'input[value="Next"]',                   // Value-based
          'button:contains("Next")',               // Text-based
          '.sv-nav-next'                           // Class-based
        ], root);
        
        if (surveyNextBtn) {
          log('📝 Clicking survey Next button to advance to next section');
          if (await safeClick(surveyNextBtn, 'survey next section button')) {
            await wait(1000); // Wait for next section to load
            flowProcessed = true;
          }
        }
        
        // 5) Click Complete button for survey
        const completeSelectors = [
          '#sv-nav-complete input',           // From recording
          '#sv-nav-complete button',          // Alternative
          'input[value="Complete"]',          // Value-based
          'button:contains("Complete")',      // Text-based
          '.sv-nav-complete',                 // Class-based
          '[aria-label="Complete"]'           // Accessibility
        ];
        
        const completeBtn = findElement(completeSelectors, root);
        if (completeBtn) {
          log('📝 Clicking survey Complete button');
          if (await safeClick(completeBtn, 'survey complete button')) {
            await wait(1000); // Wait for submission
            flowProcessed = true;
          }
        }
        
        // 6) Click Continue button in success dialog
        const continueSelectors = [
          'div.u-text-center span:contains("Continue")',    // From recording
          'button:contains("Continue")',                    // Button version
          '.u-text-center button',                          // Generic centered button
          '[data-action="continue"]',                       // Data attribute
          '.continue-button',                               // Class-based
          '.modal-continue',                                // Modal continue
          '.dialog-continue'                                // Dialog continue
        ];
        
        const continueBtn = findElement(continueSelectors, root);
        if (continueBtn) {
          log('📝 Clicking Continue button');
          if (await safeClick(continueBtn, 'continue button')) {
            await wait(1000); // Wait for dialog to process
            flowProcessed = true;
          }
        }
        
        // 7) Click Return to Course Menu / Exit button
        const exitSelectors = [
          'div.congrats span:nth-of-type(3)',               // From recording
          '.congrats button',                               // Congratulations button
          '.return-to-course',                              // Return to course
          '.back-to-menu',                                  // Back to menu
          '.exit-course',                                   // Exit course
          'button:contains("Return")',                      // Return button
          'button:contains("Exit")',                        // Exit button
          'button:contains("Back to")',                     // Back to course
          'a[href*="course_work"]',                         // Link back to course work
          '.course-complete-exit',                          // Course completion exit
          '.module-complete-return'                         // Module completion return
        ];
        
        // Wait a moment for congratulations screen to appear
        await wait(1500);
        
        const exitBtn = findElement(exitSelectors, root);
        if (exitBtn) {
          log('🎉 Clicking Return to Course Menu button');
          if (await safeClick(exitBtn, 'return to course menu')) {
            await wait(2000); // Wait for navigation
            flowProcessed = true;
            
            // Check if navigation occurred
            if (location.href.includes('course_work') || location.href.includes('launch')) {
              log('✅ Successfully returned to course menu');
            }
          }
        }
        
        // 8) Alternative: Look for any navigation links back to course listing
        if (!flowProcessed) {
          const navBackSelectors = [
            'a[href*="/launch/course_work/"]',               // Direct course work link
            'a[href*="/course/"]',                           // Course listing link
            '.breadcrumb a:last-child',                      // Breadcrumb back
            '.nav-back',                                     // Navigation back
            '.course-nav-back'                               // Course navigation back
          ];
          
          const navBackBtn = findElement(navBackSelectors, root);
          if (navBackBtn) {
            log('🔄 Clicking navigation back to course');
            if (await safeClick(navBackBtn, 'navigation back')) {
              await wait(2000);
              flowProcessed = true;
            }
          }
        }
        
        return flowProcessed;
        
      } catch (e) {
        logError('Error in survey/completion flow handler:', e);
        return false;
      }
    }
    
    // Dropdown/Accordion Handler
    async function handleDropdownAccordion(root = document) {
      try {
        log('📋 Checking for dropdown/accordion content...');
        
        let interactionsProcessed = false;
        
        // Look for accordion container first
        const accordionContainer = root.querySelector('#accordion');
        if (accordionContainer) {
          log('📋 Found #accordion container');
          
          // Click the accordion container itself first if it's clickable
          if (accordionContainer.offsetParent !== null) {
            await safeClick(accordionContainer, 'accordion container');
            await wait(500);
          }
          
          // Look for accordion buttons/sections within
          const accordionSelectors = [
            '#accordion button',                    // Buttons within accordion
            '[id^="id_"] button',                  // #id_1 button, #id_2 button, etc.
            '.accordion-button',                    // Generic accordion buttons
            '.accordion-item button',               // Accordion item buttons
            '.mouse-down button',                   // From recording
            '.accordion-header',                    // Accordion headers
            '[role="button"][aria-expanded]'        // ARIA accordion buttons
          ];
          
          let accordionButtons = [];
          for (const selector of accordionSelectors) {
            const buttons = Array.from(accordionContainer.querySelectorAll(selector));
            if (buttons.length > 0) {
              accordionButtons = buttons;
              log(`📋 Found ${buttons.length} accordion buttons with selector: ${selector}`);
              break;
            }
          }
          
          // Also try numbered ID pattern: id_1, id_2, id_3, etc.
          if (accordionButtons.length === 0) {
            // Dynamic detection - keep looking until we find no more consecutive sections
            for (let i = 1; i <= 50; i++) {
              const sectionButton = root.querySelector(`#id_${i} button`);
              if (sectionButton && sectionButton.offsetParent !== null) {
                accordionButtons.push(sectionButton);
              } else if (i > 10 && accordionButtons.length === 0) {
                break; // Stop looking if we haven't found any by id_10
              } else if (accordionButtons.length > 0 && i > accordionButtons.length + 5) {
                break; // Stop if we've gone 5 numbers past the last found section
              }
            }
            
            if (accordionButtons.length > 0) {
              log(`📋 Found ${accordionButtons.length} accordion buttons by ID enumeration`);
            }
          }
          
          // Click each accordion button
          for (let i = 0; i < accordionButtons.length; i++) {
            const button = accordionButtons[i];
            const buttonText = button.textContent?.trim() || `Section ${i + 1}`;
            
            log(`📋 Clicking accordion section ${i + 1}/${accordionButtons.length}: "${buttonText}"`);
            
            if (await safeClick(button, `accordion section ${i + 1}`)) {
              await wait(800); // Wait for accordion animation
              
              // Check if section expanded
              const isExpanded = button.getAttribute('aria-expanded') === 'true' ||
                               button.classList.contains('expanded') ||
                               button.closest('.accordion-item')?.classList.contains('open');
              
              if (isExpanded) {
                log(`✅ Accordion section ${i + 1} expanded successfully`);
              }
            }
          }
          
          if (accordionButtons.length > 0) {
            interactionsProcessed = true;
          }
        }
        
        return interactionsProcessed;
        
      } catch (e) {
        logError('Error in dropdown/accordion handler:', e);
        return false;
      }
    }
    
    // Link Clicking Handler (without navigation)
    async function handleInteractiveLinks(root = document) {
      try {
        log('🔗 Checking for interactive links...');
        
        // Look for interactive links that shouldn't navigate away
        const linkSelectors = [
          '[id^="li-"] > a',                      // #li-37 > a pattern from recording
          '.interactive-link',                     // Generic interactive links
          'a[href="#"]',                          // Links with # href (no navigation)
          'a[onclick]',                           // Links with onclick handlers
          '.link-interaction',                     // Interactive link class
          'a[data-interaction]'                    // Links with interaction data
        ];
        
        let interactiveLinks = [];
        for (const selector of linkSelectors) {
          const links = Array.from(root.querySelectorAll(selector));
          if (links.length > 0) {
            // Filter for visible links
            const visibleLinks = links.filter(link => link.offsetParent !== null);
            if (visibleLinks.length > 0) {
              interactiveLinks = visibleLinks;
              log(`🔗 Found ${visibleLinks.length} interactive links with selector: ${selector}`);
              break;
            }
          }
        }
        
        // Also try numbered pattern: li-1, li-2, li-3, etc.
        if (interactiveLinks.length === 0) {
          // Dynamic detection - keep looking until we find no more consecutive links
          for (let i = 1; i <= 200; i++) {
            const link = root.querySelector(`#li-${i} > a`);
            if (link && link.offsetParent !== null) {
              interactiveLinks.push(link);
            } else if (i > 20 && interactiveLinks.length === 0) {
              break; // Stop looking if we haven't found any by li-20
            } else if (interactiveLinks.length > 0 && i > interactiveLinks.length + 10) {
              break; // Stop if we've gone 10 numbers past the last found link
            }
          }
          
          if (interactiveLinks.length > 0) {
            log(`🔗 Found ${interactiveLinks.length} interactive links by enumeration`);
          }
        }
        
        if (interactiveLinks.length === 0) {
          return false;
        }
        
        log(`🎯 Starting interactive link clicking for ${interactiveLinks.length} links...`);
        
        // Click each link (preventing navigation)
        for (let i = 0; i < interactiveLinks.length; i++) {
          const link = interactiveLinks[i];
          const linkText = link.textContent?.trim() || link.href || `Link ${i + 1}`;
          
          log(`🔗 Clicking interactive link ${i + 1}/${interactiveLinks.length}: "${linkText}"`);
          
          // Prevent default navigation and click for interaction tracking
          link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          }, { once: true });
          
          if (await safeClick(link, `interactive link ${i + 1}`)) {
            await wait(500); // Brief wait between clicks
            
            // Check if link was marked as visited/clicked
            if (link.classList.contains('visited') || 
                link.classList.contains('clicked') ||
                link.getAttribute('aria-visited') === 'true') {
              log(`✅ Link ${i + 1} marked as visited`);
            }
          }
        }
        
        log(`✅ Interactive link clicking completed (${interactiveLinks.length} links)`);
        return true;
        
      } catch (e) {
        logError('Error in interactive links handler:', e);
        return false;
      }
    }
    
    // Card Flipping Handler
    async function handleCardFlipping(root = document) {
      try {
        log('🃏 Checking for card flipping content...');
        
        // Look for card elements using various selectors
        const cardSelectors = [
          '[id^="card"]',                    // #card1, #card2, etc.
          'li div.front span',               // li > div.front > span structure
          '.card',                           // generic card class
          '.flip-card',                      // flip card class
          '[data-card]',                     // data-card attribute
          '.interactive-card'                // interactive card class
        ];
        
        let allCards = [];
        for (const selector of cardSelectors) {
          const cards = Array.from(root.querySelectorAll(selector));
          if (cards.length > 0) {
            // Filter for clickable cards (visible and not already flipped)
            const clickableCards = cards.filter(card => {
              return card.offsetParent !== null && // visible
                     !card.classList.contains('flipped') && // not already flipped
                     !card.classList.contains('disabled'); // not disabled
            });
            
            if (clickableCards.length > 0) {
              allCards = clickableCards;
              log(`🃏 Found ${clickableCards.length} cards using selector: ${selector}`);
              break;
            }
          }
        }
        
        // Alternative: Look for numbered card IDs specifically
        if (allCards.length === 0) {
          // Dynamic detection - keep looking until we find no more consecutive cards
          for (let i = 1; i <= 50; i++) {
            const cardById = root.querySelector(`#card${i}`);
            if (cardById && cardById.offsetParent !== null) {
              // Look for the clickable element within the card
              const clickTarget = cardById.querySelector('div.front span') || 
                                 cardById.querySelector('.front') || 
                                 cardById;
              if (clickTarget) {
                allCards.push(clickTarget);
              }
            } else if (i > 10 && allCards.length === 0) {
              break; // Stop looking if we haven't found any cards by card10
            } else if (allCards.length > 0 && i > allCards.length + 5) {
              break; // Stop if we've gone 5 numbers past the last found card
            }
          }
          
          if (allCards.length > 0) {
            log(`🃏 Found ${allCards.length} cards by ID enumeration`);
          }
        }
        
        if (allCards.length === 0) {
          return false; // No card content found
        }
        
        log(`🎯 Starting card flipping process for ${allCards.length} cards...`);
        
        // Click each card with a delay
        for (let i = 0; i < allCards.length; i++) {
          const card = allCards[i];
          const cardId = card.id || card.closest('[id]')?.id || `card-${i + 1}`;
          
          log(`🃏 Flipping card ${i + 1}/${allCards.length}: ${cardId}`);
          
          if (await safeClick(card, `card ${i + 1} (${cardId})`)) {
            await wait(800); // Wait for flip animation
            
            // Check if card was successfully flipped
            const cardElement = card.closest('[id^="card"]') || card;
            if (cardElement.classList.contains('flipped') || 
                cardElement.classList.contains('revealed') ||
                cardElement.classList.contains('active')) {
              log(`✅ Card ${i + 1} flipped successfully`);
            }
          } else {
            log(`⚠️ Failed to click card ${i + 1}`);
          }
        }
        
        // Wait a moment for all animations to complete
        await wait(1000);
        
        // Check if all cards are now flipped/revealed
        const remainingCards = allCards.filter(card => {
          const cardElement = card.closest('[id^="card"]') || card;
          return !cardElement.classList.contains('flipped') && 
                 !cardElement.classList.contains('revealed') &&
                 !cardElement.classList.contains('active');
        });
        
        if (remainingCards.length > 0) {
          log(`⚠️ ${remainingCards.length} cards may not have been flipped properly`);
        } else {
          log(`✅ All ${allCards.length} cards appear to be flipped`);
        }
        
        // Look for Next button that should now be enabled
        const nextSelectors = [
          '#next',
          'button:contains("Next")',
          'button:contains("NEXT")',
          '.next-btn',
          '[data-action="next"]',
          'button[aria-label="Next"]',
          'input[value="Next"]'
        ];
        
        for (const selector of nextSelectors) {
          const nextBtn = findElement(selector, root);
          if (nextBtn && !nextBtn.disabled) {
            log('➡️ Found enabled Next button after card flipping');
            if (await safeClick(nextBtn, 'next button (after cards)')) {
              await wait(1000);
              return true; // Successfully completed card flipping activity
            }
          }
        }
        
        // If no Next button found or enabled, still return true since we flipped the cards
        log(`✅ Card flipping completed (${allCards.length} cards), but no Next button found`);
        return true;
        
      } catch (e) {
        logError('Error in card flipping handler:', e);
        return false;
      }
    }
    
    // Q&A Brute Force Handler with systematic option testing
    async function handleQuizBruteForce(root = document) {
      try {
        log('🧠 Checking for Q&A content...');
        
        // Look for multiple choice questions with various selector patterns
        const mcqSelectors = [
          '[id^="answer_content_"] td.u-wrap',     // From your recording: #answer_content_[ID] td.u-wrap
          '[id^="answer_content_"] td',            // Alternative without u-wrap class
          '[id^="answer_content_"]',               // Just the answer content containers
          '[id^="mcq_"]',                          // #mcq_0, #mcq_1, etc.
          '[id^="answer_"]',                       // #answer_0, #answer_1, etc.
          '[id^="option_"]',                       // #option_1, #option_2, etc.
          '.mcq-option',                           // generic MCQ options
          '.quiz-option',                          // quiz options
          'input[type="radio"]',                   // radio button answers
          '.answer-choice',                        // answer choices
          '[data-option]',                         // data-option attributes
          '.option-button'                         // option buttons
        ];
        
        let mcqOptions = [];
        for (const selector of mcqSelectors) {
          const options = Array.from(root.querySelectorAll(selector));
          if (options.length > 0) {
            mcqOptions = options;
            log(`📝 Found ${options.length} MCQ options using selector: ${selector}`);
            break;
          }
        }
        
        if (mcqOptions.length === 0) {
          return false; // No Q&A content found
        }
        
        // Look for submit button
        const submitSelectors = [
          'div.feedback-section span',      // From your recording: "Submit Answer"
          'button[aria-label="Submit Answer"]', // Aria version
          'span:contains("Submit Answer")', // Text-based version
          'div.section-mrq button',         // Specific from previous recording
          'button:contains("SUBMIT")',      // Text-based
          'button:contains("Submit")',
          '[value*="submit" i]',
          '.submit-btn',
          '.quiz-submit',
          'input[type="submit"]',
          'button[type="submit"]',
          '[data-action="submit"]'
        ];
        
        let submitBtn = null;
        for (const selector of submitSelectors) {
          submitBtn = findElement(selector, root);
          if (submitBtn) {
            log(`✅ Found submit button with selector: ${selector}`);
            break;
          }
        }
        
        if (!submitBtn) {
          log('⚠️ No submit button found, cannot proceed with Q&A');
          return false;
        }
        
        log('🎯 Starting systematic Q&A option testing...');
        
        // Get current video state to detect replays
        const videos = Array.from(root.querySelectorAll(VIDEO_SEL));
        const currentVideo = videos.find(vid => vid.offsetParent !== null);
        let initialVideoTime = currentVideo ? currentVideo.currentTime : 0;
        let initialVideoSrc = currentVideo ? currentVideo.currentSrc : '';
        
        // Try each option systematically (1, 2, 3, etc.)
        for (let i = 0; i < mcqOptions.length; i++) {
          const option = mcqOptions[i];
          const optionText = option.textContent?.trim() || '';
          const optionId = option.id || option.closest('[id]')?.id || '';
          
          log(`📋 Trying option ${i + 1}/${mcqOptions.length}: "${optionText}" (${optionId || 'no-id'})`);
          
          // Click the option
          if (await safeClick(option, `MCQ option ${i + 1}: "${optionText}"`)) {
            await wait(500); // Short wait for UI update
            
            // Click submit
            if (await safeClick(submitBtn, 'submit button')) {
              await wait(2000); // Wait for response
              
              // Check if video restarted (wrong answer indicator)
              let videoRestarted = false;
              if (currentVideo) {
                const newTime = currentVideo.currentTime;
                const newSrc = currentVideo.currentSrc;
                
                // Video restarted if time went backwards significantly or src changed
                if (newTime < initialVideoTime - 5 || newSrc !== initialVideoSrc) {
                  videoRestarted = true;
                  log(`🔄 Video restarted (time: ${initialVideoTime} → ${newTime}), answer ${i + 1} was incorrect`);
                  
                  // Update tracking for next attempt
                  initialVideoTime = newTime;
                  initialVideoSrc = newSrc;
                }
              }
              
              // Check for explicit feedback dialogs
              const feedbackSelectors = [
                'button:contains("TRY AGAIN")',
                'button:contains("Try Again")', 
                'button:contains("INCORRECT")',
                'button:contains("Incorrect")',
                '#container000 div.modal-footer > button',
                '.modal button:contains("try")',
                '.incorrect-answer button',
                '[data-action="retry"]',
                '.feedback-incorrect'
              ];
              
              let tryAgainBtn = null;
              for (const selector of feedbackSelectors) {
                tryAgainBtn = findElement(selector, root);
                if (tryAgainBtn) {
                  log(`❌ Found try again dialog: ${selector}`);
                  break;
                }
              }
              
              if (tryAgainBtn) {
                // Wrong answer - click try again and continue loop
                await safeClick(tryAgainBtn, 'try again button');
                await wait(1000);
                
                // If there's a video, let it replay before trying next option
                if (currentVideo && videoRestarted) {
                  log('⏯️ Waiting for video to finish replaying...');
                  await new Promise(resolve => {
                    currentVideo.addEventListener('ended', resolve, { once: true });
                    // Fallback timeout in case video doesn't end
                    setTimeout(resolve, 60000); // 1 minute max wait
                  });
                  await wait(1000); // Brief pause after video ends
                }
                continue;
              }
              
              // Check for specific "Correct answer" modal first
              const correctAnswerModal = root.querySelector('h2#dialog1_label.modal-title');
              if (correctAnswerModal && correctAnswerModal.textContent?.toLowerCase().includes('correct answer')) {
                log('🎉 Found "Correct answer" modal!');
                
                // First try to click the X button
                const closeBtn = root.querySelector('span[aria-hidden="true"]');
                if (closeBtn && closeBtn.textContent?.includes('×')) {
                  log('❌ Clicking X button to close modal');
                  if (await safeClick(closeBtn, 'close (X) button')) {
                    await wait(1000);
                    
                    // Then look for continue button
                    const continueSelectors = [
                      'button:contains("Continue")',
                      'button:contains("CONTINUE")',
                      'button:contains("Next")',
                      'button:contains("NEXT")',
                      '.continue-button',
                      '.next-button'
                    ];
                    
                    let continueBtn = null;
                    for (const selector of continueSelectors) {
                      continueBtn = findElement(selector, root);
                      if (continueBtn) {
                        log(`➡️ Found continue button: ${selector}`);
                        break;
                      }
                    }
                    
                    if (continueBtn) {
                      log('➡️ Clicking continue button');
                      await safeClick(continueBtn, 'continue button');
                      await wait(1000);
                      return true; // Successfully completed Q&A
                    }
                  }
                }
              }
              
              // Check for other success indicators
              const successSelectors = [
                'button:contains("CORRECT")',
                'button:contains("Correct")',
                'button:contains("Close")',
                'button:contains("CONTINUE")',
                'button:contains("Continue")',
                'button:contains("Next")',
                '#dialog1 button',
                '.modal button:contains("close")',
                '.correct-answer button',
                '.success-dialog button',
                '[data-action="close"]',
                '[data-action="continue"]',
                '.feedback-correct'
              ];
              
              let successBtn = null;
              for (const selector of successSelectors) {
                successBtn = findElement(selector, root);
                if (successBtn) {
                  log(`✅ Found success dialog: ${selector}`);
                  break;
                }
              }
              
              if (successBtn) {
                // Correct answer - close dialog and advance
                log(`🎉 Answer ${i + 1} was correct!`);
                await safeClick(successBtn, 'success dialog button');
                await wait(1000);
                return true; // Successfully completed Q&A
              }
              
              // If no clear feedback and no video restart, assume success
              if (!videoRestarted) {
                log(`✅ No video restart detected for answer ${i + 1}, assuming correct`);
                return true;
              }
            }
          }
        }
        
        // If we tried all options and none worked
        log('⚠️ Tried all Q&A options systematically but none seemed to work correctly');
        return false;
        
      } catch (e) {
        logError('Error in Q&A brute force:', e);
        return false;
      }
    }
  
        // Comprehensive content detection to ensure we handle everything
    async function hasRemainingInteractiveContent(root = document) {
      // Check for any remaining interactive elements that might have appeared
      const checks = [
        // Tabs
        () => root.querySelectorAll('[id^="btn_tab"]:not(.visited):not(.active)').length > 0,
        () => root.querySelectorAll('#my-tab span:not(.visited)').length > 0,
        
        // Cards
        () => root.querySelectorAll('[id^="card"]:not(.flipped):not(.revealed)').length > 0,
        
        // Accordions
        () => root.querySelectorAll('#accordion [aria-expanded="false"]').length > 0,
        () => root.querySelectorAll('[id^="id_"] button:not(.expanded)').length > 0,
        
        // Links
        () => root.querySelectorAll('[id^="li-"] > a:not(.visited)').length > 0,
        
        // Videos (unplayed)
        () => root.querySelectorAll('video:not([data-played])').length > 0,
        
        // Q&A
        () => root.querySelectorAll('[id^="mcq_"], .quiz-option').length > 0,
        
        // Generic interactive content
        () => root.querySelectorAll('[role="tab"]:not([aria-selected="true"])').length > 0
      ];
      
      for (const check of checks) {
        try {
          if (check()) return true;
        } catch (e) {
          // Continue checking other types
        }
      }
      
      return false;
    }

    // Enhanced frame handler with better error handling and dynamic content detection
    async function handleFrame() {
      try {
        // Wait for content to load
        await wait(CONTENT_WAIT_TIME);

        // Special handling for trainingcdn.com iframe content
        const isTrainingCDN = location.href.includes('trainingcdn.com');
        if (isTrainingCDN) {
          log('🎓 detected trainingcdn.com iframe - using enhanced Q&A processing');
          // Give extra time for training content to load
          await wait(1000);
        }

        log('🔍 analyzing frame content...');
        
        let maxAttempts = 3;
        let attemptCount = 0;
        let anyContentProcessed = false;
        
        // Keep processing until no more interactive content is found
        while (attemptCount < maxAttempts) {
          attemptCount++;
          log(`🔄 Content processing attempt ${attemptCount}/${maxAttempts}`);
          
          let processedThisRound = false;

          // 1) SLIC-specific tabs (enhanced for Vector LMS)
          let tabsProcessed = false;
          
          // 1.5) Check for "explore another option" questions first (they might block other content)
          if (await handleExploreOptionQuestion()) {
            log('→ handled explore another option question (early check)');
            processedThisRound = true;
          }
          
          // First try the specific Vector LMS tab pattern from recording
          const vectorLMSTabs = [];
          
          // Look for numbered tab buttons: btn_tab1, btn_tab2, btn_tab3, etc.
          // Dynamic detection - keep looking until we find no more consecutive tabs
          for (let i = 1; i <= 50; i++) {
            const tab = document.querySelector(`#btn_tab${i}`);
            if (tab && tab.offsetParent !== null) {
              vectorLMSTabs.push(tab);
            } else if (i > 10 && vectorLMSTabs.length === 0) {
              break; // Stop looking if we haven't found any by tab 10
            } else if (vectorLMSTabs.length > 0 && i > vectorLMSTabs.length + 5) {
              break; // Stop if we've gone 5 numbers past the last found tab
            }
          }
          
          if (vectorLMSTabs.length > 0) {
            log(`→ found ${vectorLMSTabs.length} Vector LMS tabs (#btn_tab pattern)`);
            for (let i = 0; i < vectorLMSTabs.length; i++) {
              const tab = vectorLMSTabs[i];
              const tabText = tab.textContent?.trim() || `Tab ${i + 1}`;
              log(`🔗 Clicking Vector LMS tab ${i + 1}/${vectorLMSTabs.length}: "${tabText}"`);
              
              if (await safeClick(tab, `Vector LMS tab ${i + 1}`)) {
                await wait(CLICK_DELAY);
                
                // Check if tab is now active/visited
                if (tab.classList.contains('active') || 
                    tab.classList.contains('visited') ||
                    tab.getAttribute('aria-selected') === 'true') {
                  log(`✅ Tab ${i + 1} activated successfully`);
                }
              }
            }
            tabsProcessed = true;
            processedThisRound = true;
          }
          
          // Fallback to generic SLIC tab detection if Vector LMS pattern not found
          if (!tabsProcessed) {
            const slicTabs = document.querySelectorAll(SLIC_TAB_SEL);
            if (slicTabs.length) {
              log(`→ found ${slicTabs.length} SLIC tabs (generic pattern)`);
              for (const tab of slicTabs) {
                if (await safeClick(tab, `SLIC tab: ${tab.textContent?.trim()}`)) {
                  await wait(CLICK_DELAY);
                }
              }
              tabsProcessed = true;
              processedThisRound = true;
            }
          }
          
          // Additional check for #my-tab structure
          if (!tabsProcessed) {
            const myTabContainer = document.querySelector('#my-tab');
            if (myTabContainer) {
              const myTabSpans = myTabContainer.querySelectorAll('div span, span');
              if (myTabSpans.length > 0) {
                log(`→ found ${myTabSpans.length} tabs in #my-tab container`);
                for (let i = 0; i < myTabSpans.length; i++) {
                  const span = myTabSpans[i];
                  const tabText = span.textContent?.trim() || `Tab ${i + 1}`;
                  log(`🔗 Clicking #my-tab span ${i + 1}/${myTabSpans.length}: "${tabText}"`);
                  
                  if (await safeClick(span, `my-tab span ${i + 1}`)) {
                    await wait(CLICK_DELAY);
                  }
                }
                tabsProcessed = true;
                processedThisRound = true;
              }
            }
          }

          // 2) SLIC-specific list items
          const slicLinks = document.querySelectorAll(SLIC_LINK_SEL);
          if (slicLinks.length) {
            log('→ found SLIC list items');
            if (await safeClick(slicLinks[0], 'first SLIC list item')) {
              processedThisRound = true;
            }
          }

          // 3) Carousel / Next buttons
          const carouselBtn = findElement(CAROUSEL_SEL);
          if (carouselBtn) {
            log('→ carousel/Next detected, advancing…');
            await drainCarousel();
            processedThisRound = true;
          }

          // 4) JWPlayer API (enhanced)
          if (window.jwplayer) {
            try {
              log('→ JWPlayer API detected');
              const player = jwplayer();
              if (player && typeof player.play === 'function') {
                player.setMute(true);
                player.play();
                await new Promise(resolve => {
                  player.on('complete', resolve);
                  player.on('error', resolve);
                  // Fallback timeout
                  setTimeout(resolve, 30000);
                });
                log('✅ JWPlayer complete');
                processedThisRound = true;
              }
            } catch (e) {
              logError('JWPlayer error:', e);
            }
          }

          // 5) HTML5 videos (handle multiple videos in sequence)
          if (await playAllVideos()) {
            processedThisRound = true;
          }

          // 6) Page-level tabs
          const tabs = document.querySelectorAll('[role="tab"]:not([aria-selected="true"])');
          if (tabs.length) {
            log(`→ found ${tabs.length} unselected tabs`);
            for (const tab of tabs) {
              if (await safeClick(tab, `tab: ${tab.textContent?.trim()}`)) {
                await wait(CLICK_DELAY);
              }
            }
            processedThisRound = true;
          }

          // 7) Dropdown/Accordion interactions
          if (await handleDropdownAccordion()) {
            log('→ completed dropdown/accordion interactions');
            processedThisRound = true;
          }

          // 8) Interactive Links (without navigation)
          if (await handleInteractiveLinks()) {
            log('→ completed interactive link clicking');
            processedThisRound = true;
          }

          // 9) Card Flipping
          if (await handleCardFlipping()) {
            log('→ completed card flipping activity');
            processedThisRound = true;
          }

          // 10) Q&A Brute Force
          if (await handleQuizBruteForce()) {
            log('→ completed Q&A section');
            processedThisRound = true;
          }

          // 10.5) Handle specific "explore another option" question
          if (await handleExploreOptionQuestion()) {
            log('→ handled explore another option question');
            processedThisRound = true;
          }

          // 11) Completion buttons
          if (await clickCompletionButtons()) {
            log('→ clicked completion button');
            processedThisRound = true;
          }

          // 12) Survey and completion flow
          if (await handleSurveyAndCompletion()) {
            log('→ processed survey/completion flow');
            processedThisRound = true;
          }

          // 13) Generic continue/next buttons
          const continueBtn = await waitForElement([
            'button:contains("Continue")',
            'button:contains("Next")',
            '.continue-btn',
            '.next-btn',
            '[data-action="continue"]'
          ], 1000);
          
          if (continueBtn && await safeClick(continueBtn, 'continue button')) {
            processedThisRound = true;
          }

          // 14) Re-check for videos that might have appeared after other interactions
          if (processedThisRound && !hasRemainingInteractiveContent()) {
            log('→ checking for new videos after content processing...');
            if (await playAllVideos()) {
              log('→ found and played additional videos');
              processedThisRound = true;
            }
          }

          // Track if we processed any content
          if (processedThisRound) {
            anyContentProcessed = true;
            log(`✅ Round ${attemptCount}: Processed content, checking for more...`);
            
            // Wait a moment for any dynamic content to load
            await wait(1000);
            
            // Check if there's more interactive content that might have appeared
            if (!hasRemainingInteractiveContent()) {
              log(`✅ No more interactive content detected after ${attemptCount} attempts`);
              break;
            }
          } else {
            log(`ℹ️ Round ${attemptCount}: No content processed`);
            break; // No content found, stop trying
          }
        }

        if (anyContentProcessed) {
          log(`✅ Content processing completed after ${attemptCount} attempts`);
          return true;
        } else {
          log('ℹ️ no actionable content found in this frame');
          return false;
        }
        
      } catch (e) {
        logError('Error in handleFrame:', e);
        return false;
      }
    }
  
    // Enhanced queue management with better error handling
    function getStoredQueue() {
      try {
        return {
          links: JSON.parse(localStorage.vlmsQueue || '[]'),
          index: parseInt(localStorage.vlmsIdx || '0', 10)
        };
      } catch (e) {
        logError('Error parsing stored queue:', e);
        return { links: [], index: 0 };
      }
    }
  
    function setStoredQueue(links, index) {
      try {
        localStorage.vlmsQueue = JSON.stringify(links);
        localStorage.vlmsIdx = String(index);
      } catch (e) {
        logError('Error storing queue:', e);
      }
    }
    
    // Enhanced TOC scraping based on Vector LMS structure
    async function scrapeTOCItems() {
      try {
        log('🔍 Scanning TOC items...');
        
        const tocItems = document.getElementsByClassName("TOC_item");
        const scrapedItems = [];
        
        if (tocItems.length === 0) {
          log('⚠️ No TOC_item elements found, trying alternative selectors...');
          
          // Try alternative selectors for different Vector LMS layouts
          const alternativeItems = document.querySelectorAll(
            '.course-item, .lesson-item, .task-item, ' + TASK_SEL
          );
          
          if (alternativeItems.length === 0) {
            return [];
          }
          
          // Process alternative items with basic data extraction
          for (const item of alternativeItems) {
            if (!item.href) continue;
            
            // Check completion status for alternative items
            const completed = item.querySelector(
              '.completed, .done, [class*="complete"], .checkmark, .fa-check, ' +
              '.progress-100, [data-complete="true"], .status-complete'
            ) !== null;
            
            scrapedItems.push({
              element: item,
              href: item.href,
              title: item.textContent?.trim() || 'Untitled',
              isVideo: item.querySelector('.fa-play, .video-icon, [class*="video"]') !== null,
              timeMin: 0,
              workId: extractIdFromUrl(item.href, -1),
              itemId: extractIdFromUrl(item.href, -2),
              completed: completed
            });
          }
          
          return scrapedItems;
        }
        
        // Process TOC_item elements with detailed extraction
        for (let i = 0; i < tocItems.length; i++) {
          try {
            const tocItem = tocItems[i];
            const dataEntry = {};
            
            dataEntry.element = tocItem;
            dataEntry.href = tocItem.getAttribute("href");
            
            if (!dataEntry.href) {
              continue; // Skip items without href
            }
            
            // Check if it's a video by looking for play icon
            dataEntry.isVideo = tocItem.querySelector(".fa-play") !== null;
            
            // Extract title
            const leadElement = tocItem.querySelector(".lead");
            dataEntry.title = leadElement ? leadElement.innerText.trim() : 'Untitled';
            
            // Extract IDs from URL
            const urlParts = dataEntry.href.split("?")[0].split("/");
            const len = urlParts.length;
            dataEntry.workId = urlParts[len - 1];
            dataEntry.itemId = urlParts[len - 2];
            
            // Extract time for videos
            dataEntry.timeMin = 0;
            if (dataEntry.isVideo) {
              try {
                const spanLink = tocItem.querySelector(".span_link");
                if (spanLink) {
                  const timeText = spanLink.innerText;
                  const timeMatch = timeText.match(/(\d+)\s*min/i);
                  if (timeMatch) {
                    dataEntry.timeMin = parseInt(timeMatch[1]) + 0.5;
                  }
                }
              } catch (e) {
                logError('Error extracting video time:', e);
              }
            }
            
            // Enhanced completion and current task detection
            const completionSelectors = [
              '.completed', '.done', '[class*="complete"]', '.checkmark', '.fa-check',
              '.progress-100', '[data-complete="true"]', '.status-complete',
              '.task-complete', '.lesson-complete', '.module-complete',
              '.fa-check-circle', '.complete-icon', '[data-status="complete"]',
              '.success', '.passed', '[class*="success"]'
            ];
            
            const currentTaskSelectors = [
              '.active', '.current', '.selected', '.in-progress', '.playing',
              '[class*="active"]', '[class*="current"]', '[class*="selected"]',
              '.highlighted', '.focus'
            ];
            
            let completionFound = false;
            let completionReason = '';
            let isCurrentTask = false;
            
            // Check for completion indicators
            for (const selector of completionSelectors) {
              if (tocItem.querySelector(selector)) {
                completionFound = true;
                completionReason = `found ${selector}`;
                break;
              }
            }
            
            // Check if this is the current/active task
            for (const selector of currentTaskSelectors) {
              if (tocItem.matches(selector) || tocItem.querySelector(selector)) {
                isCurrentTask = true;
                break;
              }
            }
            
            // Check parent elements for current/active state
            if (!isCurrentTask) {
              let parent = tocItem.parentElement;
              while (parent && parent !== document.body) {
                for (const selector of currentTaskSelectors) {
                  if (parent.matches(selector)) {
                    isCurrentTask = true;
                    break;
                  }
                }
                if (isCurrentTask) break;
                parent = parent.parentElement;
              }
            }
            
            // Visual indicators of completion
            if (!completionFound) {
              const progressBar = tocItem.querySelector('.progress-bar, .progress, [class*="progress"]');
              if (progressBar) {
                const progressValue = progressBar.getAttribute('aria-valuenow') || 
                                    progressBar.getAttribute('value') ||
                                    progressBar.getAttribute('data-progress') ||
                                    progressBar.style.width;
                if (progressValue === '100' || progressValue === '100%' || progressValue === 100) {
                  completionFound = true;
                  completionReason = `progress bar at ${progressValue}`;
                }
              }
            }
            
            // Text-based completion indicators
            if (!completionFound) {
              const textContent = tocItem.textContent.toLowerCase();
              if (textContent.includes('complete') || textContent.includes('finished') || 
                  textContent.includes('done') || textContent.includes('100%') ||
                  textContent.includes('passed') || textContent.includes('success')) {
                completionFound = true;
                completionReason = 'text indicator';
              }
            }
            
            // Style-based detection (grayed out, different colors, etc.)
            if (!completionFound) {
              const styles = window.getComputedStyle(tocItem);
              const opacity = parseFloat(styles.opacity);
              const color = styles.color;
              
              // If item is grayed out or faded, it might be completed
              if (opacity < 0.7 || color.includes('128') || color.includes('gray')) {
                // Only mark as completed if it's not the current task
                if (!isCurrentTask) {
                  completionFound = true;
                  completionReason = 'visual styling (grayed out)';
                }
              }
            }
            
            dataEntry.completed = completionFound;
            dataEntry.isCurrentTask = isCurrentTask;
            
            // Enhanced logging
            const status = dataEntry.completed ? '✅ COMPLETED' : (isCurrentTask ? '🎯 CURRENT' : '⏳ PENDING');
            log(`📋 Task ${i + 1}: "${dataEntry.title}" - ${status} ${completionReason ? `(${completionReason})` : ''}`);
            
            if (isCurrentTask) {
              log(`   🎯 Current task detected: ${tocItem.className}`);
            }
            
            // Include all items (completed and uncompleted) for better queue management
            scrapedItems.push(dataEntry);
            
          } catch (e) {
            logError(`Error processing TOC item ${i}:`, e);
          }
        }
        
        log(`📊 Found ${scrapedItems.length} TOC items (${scrapedItems.filter(t => t.isVideo).length} videos)`);
        return scrapedItems;
        
      } catch (e) {
        logError('Error in scrapeTOCItems:', e);
        return [];
      }
    }
    
    // Helper function to extract ID from URL
    function extractIdFromUrl(url, position) {
      try {
        const parts = url.split("?")[0].split("/");
        const index = position < 0 ? parts.length + position : position;
        return parts[index] || '';
      } catch (e) {
        return '';
      }
    }
  
    // Handle specific "explore another option" question - always select "No"
    async function handleExploreOptionQuestion(root = document) {
      try {
        log('🔍 Checking for "explore another option" question...');
        
        // Look for the specific question text
        const questionSelectors = [
          'div:contains("Would you like to explore another option?")',
          '.u-color-gray-darkest:contains("explore another option")',
          '.ng-binding:contains("Would you like to explore")',
          'div:contains("Select your answer, then select Submit")'
        ];
        
        let questionFound = false;
        for (const selector of questionSelectors) {
          const questionElement = findElement(selector, root);
          if (questionElement) {
            const questionText = questionElement.textContent || '';
            if (questionText.toLowerCase().includes('explore another option') || 
                questionText.toLowerCase().includes('select your answer, then select submit')) {
              log(`📋 Found "explore another option" question: "${questionText.trim()}"`);
              questionFound = true;
              break;
            }
          }
        }
        
        if (!questionFound) {
          return false;
        }
        
        // Look for "No" answer option
        const noAnswerSelectors = [
          'label.question_btn[aria-label*="No"]:not([aria-label*="Noah"])', // More specific: question_btn with aria-label "No"
          'label.question_btn td:contains("No"):not(:contains("Noah")):not(:contains("now"))', // TD within question_btn containing "No"
          'label.question_btn:contains("No"):not(:contains("Noah")):not(:contains("now"))', // Label with question_btn class containing "No"
          '[id^="answer_content_"] td:contains("No"):not(:contains("Noah"))', // Answer content TD containing "No"
          'label[aria-label*="No"]:not([aria-label*="Noah"])',           // Aria-label containing "No" but not "Noah"
          'td:contains("No"):not(:contains("Noah")):not(:contains("now"))', // TD containing "No" but not "Noah" or "now"
          'label:contains("No"):not(:contains("Noah")):not(:contains("now"))', // Any label containing "No"
          '[id^="answer_content_"]:contains("No"):not(:contains("Noah"))', // Answer content containing "No"
          'input[type="radio"][value*="no" i]',                         // Radio input with "no" value
          '.answercontrol:contains("No")'                               // Answer control containing "No"
        ];
        
        let noOption = null;
        for (const selector of noAnswerSelectors) {
          noOption = findElement(selector, root);
          if (noOption) {
            const optionText = noOption.textContent?.trim().toLowerCase() || '';
            const ariaLabel = noOption.getAttribute('aria-label')?.toLowerCase() || '';
            
            // Make sure it's actually "No" and not something like "Noah" or "now"
            if ((optionText === 'no' || ariaLabel.includes('no')) && 
                !optionText.includes('noah') && !optionText.includes('now') &&
                !ariaLabel.includes('noah')) {
              log(`📋 Found "No" option: ${selector} (text: "${optionText}", aria: "${ariaLabel}")`);
              break;
            } else {
              noOption = null; // Reset if this wasn't actually "No"
            }
          }
        }
        
        if (!noOption) {
          log('⚠️ Could not find "No" option for explore question');
          return false;
        }
        
        // Click the "No" option
        log('📋 Clicking "No" for explore another option question');
        if (await safeClick(noOption, '"No" option')) {
          await wait(500);
          
          // Look for and click submit button
          const submitSelectors = [
            'div.feedback-section span',
            'span:contains("Submit Answer")',
            'button:contains("Submit")',
            'button:contains("SUBMIT")',
            '.submit-btn',
            '[data-action="submit"]'
          ];
          
          for (const selector of submitSelectors) {
            const submitBtn = findElement(selector, root);
            if (submitBtn) {
              log('📋 Clicking submit for explore question');
              if (await safeClick(submitBtn, 'submit button for explore question')) {
                await wait(1000);
                return true;
              }
            }
          }
          
          log('✅ Selected "No" for explore question (no submit button found)');
          return true;
        }
        
        return false;
        
      } catch (e) {
        logError('Error in explore option question handler:', e);
        return false;
      }
    }
  
        // Main logic: enhanced with better error handling
    if (window.top === window) {
      const path = location.pathname;
      log(`🚀 VectorLMS Solver starting on: ${location.href}`);
      
      // Check if extension is enabled
      const enabled = await isExtensionEnabled();
      if (!enabled) {
        log('⏸️ Extension is disabled, skipping automation');
        return;
      }

      try {
        // 1) Course-work listing: build or resume queue using enhanced TOC scraping
        if (path.includes('/launch/course_work/') || path.includes('/course/')) {
          log('📋 on course listing page, building task queue...');
          
          // Always rebuild queue on course listing page to ensure we start from the last task
          log('🔄 Rebuilding queue to start from last task...');
          
          // Wait for page to load completely
          await wait(2000);
          
          // Enhanced TOC-based scraping
          const tocItems = await scrapeTOCItems();
          
          if (tocItems.length > 0) {
            const taskData = tocItems.map(item => ({
              href: item.href,
              title: item.title,
              isVideo: item.isVideo,
              timeMin: item.timeMin,
              workId: item.workId,
              itemId: item.itemId,
              completed: item.completed,
              isCurrentTask: item.isCurrentTask
            }));
            
            // Always start from the last task
            const startIndex = taskData.length - 1;
            log(`🎯 Starting from last task (${startIndex + 1}/${taskData.length}): "${taskData[startIndex].title}"`);
            
            // Queue summary
            const completed = taskData.filter(t => t.completed).length;
            const videoItems = taskData.filter(t => t.isVideo).length;
            
            log(`📊 Queue Summary: ${taskData.length} total tasks, ${completed} completed, ${videoItems} videos`);
            
            // Store both links array and detailed task data
            const taskLinks = tocItems.map(item => item.href);
            setStoredQueue(taskLinks, startIndex);
            
            // Store additional task metadata
            try {
              localStorage.vlmsTaskData = JSON.stringify(taskData);
            } catch (e) {
              logError('Error storing task metadata:', e);
            }
            
            const completedCount = taskData.filter(t => t.completed).length;
            const videoTasks = taskData.filter(t => t.isVideo).length;
            log(`🚀 queued ${taskLinks.length} tasks (${completedCount} completed, ${videoTasks} videos)`);
          } else {
            // Fallback to generic scraping
            const taskElements = Array.from(document.querySelectorAll(TASK_SEL))
              .filter(a => a.href && a.href.includes('http'));
            
            if (taskElements.length > 0) {
              // Always start from the last task
              const taskLinks = taskElements.map(a => a.href);
              const startIndex = taskLinks.length - 1;
              setStoredQueue(taskLinks, startIndex);
              log(`🚀 queued ${taskLinks.length} tasks (starting from last task)`);
            } else {
              log('⚠️ no tasks found on this page');
            }
          }
          
          const { links, index: currentIndex } = getStoredQueue();
          if (currentIndex < links.length && location.href !== links[currentIndex]) {
            log(`→ navigating to task ${currentIndex + 1}/${links.length}`);
            await wait(1000);
            location.href = links[currentIndex];
          }
        }
  
        // 2) Player page: enhanced handling with smart position detection
        else if (path.includes('/training/player/') || path.includes('/player/')) {
          log('🎯 on player page, processing content...');
          
          // Try to determine current task from URL and update queue position
          const { links, index } = getStoredQueue();
          if (links.length > 0) {
            const currentURL = location.href;
            const currentTaskIndex = links.findIndex(link => {
              // Compare URLs more intelligently
              try {
                const linkURL = new URL(link);
                const currentURLObj = new URL(currentURL);
                
                // Compare pathname and relevant query parameters
                return linkURL.pathname === currentURLObj.pathname ||
                       link === currentURL ||
                       linkURL.href === currentURLObj.href;
              } catch (e) {
                return link === currentURL;
              }
            });
            
            if (currentTaskIndex >= 0 && currentTaskIndex !== index) {
              log(`🔄 URL analysis: detected we're actually on task ${currentTaskIndex + 1}, updating queue position from ${index + 1}`);
              setStoredQueue(links, currentTaskIndex);
            }
          }
          
          // Wait for page to stabilize
          await wait(CONTENT_WAIT_TIME);
          
          // Handle iframes first
          const frames = Array.from(window.frames);
          if (frames.length > 0) {
            log(`📺 processing ${frames.length} iframes...`);
            for (let i = 0; i < frames.length; i++) {
              try {
                // Try to execute in frame
                frames[i].eval(`(${handleFrame.toString()})()`);
                await wait(500);
              } catch (e) {
                log(`⚠️ cannot access iframe ${i + 1} (cross-origin):`, e.message);
              }
            }
          }
          
          // Handle main frame
          const contentProcessed = await handleFrame();
          
          // Only advance if we actually processed content
          if (contentProcessed) {
            log('✅ Content processing completed, advancing to next task...');
          } else {
            log('⚠️ No content was processed, advancing anyway...');
          }
          
          // Advance queue
          const { links: currentLinks, index: currentIndex } = getStoredQueue();
          const nextIndex = currentIndex + 1;
          
          if (nextIndex < currentLinks.length) {
            setStoredQueue(currentLinks, nextIndex);
            log(`→ advancing to task ${nextIndex + 1}/${currentLinks.length}`);
            await wait(1000);
            location.href = currentLinks[nextIndex];
          } else if (currentLinks.length > 0) {
            log('🎉 all tasks completed!');
            localStorage.removeItem('vlmsQueue');
            localStorage.removeItem('vlmsIdx');
            localStorage.removeItem('vlmsTaskData');
          }
        }
      } catch (e) {
        logError('Error in main logic:', e);
      }
    }
    // Enhanced iframe handling
    else {
      const enabled = await isExtensionEnabled();
      if (!enabled) {
        log('⏸️ Extension is disabled, skipping iframe automation');
        return;
      }
      
      log('📄 processing iframe content...');
      await handleFrame();
    }
          
    } catch (globalExtensionError) {
      // Global error handler for the entire extension
      console.error('[VectorLMS Solver]', 'Global extension error:', globalExtensionError);
      console.error('[VectorLMS Solver]', 'Extension will attempt to continue...');
    }
    
  })();