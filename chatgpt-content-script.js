// ============== chatgpt-content-script.js ==============

console.log('ChatGPT Translator: ChatGPT content script loaded');

// Notify background that ChatGPT is ready
chrome.runtime.sendMessage({ action: 'chatgpt_ready' });

// Listen for translation requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    console.log('Received translation request:', message);
    handleTranslationRequest(message);
  }
});

async function handleTranslationRequest(message) {
  const { requestId, text, targetLanguage, senderTabId } = message;
  
  try {
    console.log('Processing translation:', { text, targetLanguage });
    
    // Wait for ChatGPT to be ready
    await waitForChatGPTReady();
    
    // Send translation prompt
    await sendPromptToChatGPT(text, targetLanguage);
    
    // Wait for and get response
    const translation = await waitForChatGPTResponse();
    
    // Send result back to background
    chrome.runtime.sendMessage({
      action: 'translation_result',
      requestId: requestId,
      success: true,
      translation: translation
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    
    // Send error back to background
    chrome.runtime.sendMessage({
      action: 'translation_result',
      requestId: requestId,
      success: false,
      error: error.message
    });
  }
}

async function waitForChatGPTReady() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkReady = () => {
      attempts++;
      
      // Check if input field exists
      const input = findChatGPTInput();
      
      if (input) {
        resolve();
        return;
      }
      
      if (attempts >= maxAttempts) {
        reject(new Error('ChatGPT interface not ready'));
        return;
      }
      
      setTimeout(checkReady, 500);
    };
    
    checkReady();
  });
}

function findChatGPTInput() {
  // Try multiple selectors for ChatGPT input
  const selectors = [
    'textarea[data-id="root"]',
    '#prompt-textarea', 
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Send a message"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea.m-0',
    'div[contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null) { // Element is visible
      return element;
    }
  }
  
  return null;
}

async function sendPromptToChatGPT(text, targetLanguage) {
  const input = findChatGPTInput();
  if (!input) {
    throw new Error('Không tìm thấy input field của ChatGPT');
  }
  
  // Create translation prompt
  const languageMap = {
    'vietnamese': 'tiếng Việt',
    'english': 'English', 
    'japanese': '日本語',
    'korean': '한국어',
    'chinese': '中文',
    'french': 'Français',
    'german': 'Deutsch',
    'spanish': 'Español'
  };
  
  const targetLang = languageMap[targetLanguage] || targetLanguage;
  const prompt = `Hãy dịch văn bản sau sang ${targetLang}. Chỉ trả lời bản dịch, không giải thích thêm:

"${text}"`;
  
  // Clear input and set new prompt  
  if (input.tagName.toLowerCase() === 'textarea') {
    input.value = '';
    input.focus();
    input.value = prompt;
    
    // Trigger input events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // For contenteditable divs
    input.focus();
    input.textContent = '';
    input.textContent = prompt;
    
    // Trigger input events
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Wait a bit for UI to update
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Find and click send button
  const sendButton = findSendButton();
  if (sendButton && !sendButton.disabled) {
    sendButton.click();
  } else {
    // Try sending with Enter key
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter', 
      keyCode: 13,
      which: 13,
      bubbles: true,
      ctrlKey: false,
      shiftKey: false
    });
    input.dispatchEvent(enterEvent);
  }
  
  console.log('Prompt sent to ChatGPT');
}

function findSendButton() {
  const selectors = [
    '[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'button[type="submit"]',
    'button svg[data-icon="paper-plane"]',
    '.btn-primary',
    'button:has(svg)',
    'button[class*="send"]'
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null && !button.disabled) {
      return button;
    }
  }
  
  return null;
}

async function waitForChatGPTResponse() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    let lastResponseLength = 0;
    
    const checkForResponse = () => {
      attempts++;
      
      try {
        // Find the latest assistant message
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        
        if (messages.length > 0) {
          const latestMessage = messages[messages.length - 1];
          const responseText = latestMessage.textContent || latestMessage.innerText;
          
          // Check if response is still loading
          const isLoading = document.querySelector('.result-streaming') || 
                           document.querySelector('[data-testid*="loading"]') ||
                           document.querySelector('.animate-pulse') ||
                           latestMessage.querySelector('.animate-pulse');
          
          if (responseText && responseText.trim().length > 0) {
            // Check if response has stopped growing (indicating completion)
            if (!isLoading) {
              if (responseText.length === lastResponseLength) {
                // Response hasn't changed and no loading indicator
                resolve(responseText.trim());
                return;
              }
              lastResponseLength = responseText.length;
            }
          }
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error('Timeout: Không nhận được phản hồi từ ChatGPT sau 60 giây'));
          return;
        }
        
        setTimeout(checkForResponse, 1000);
        
      } catch (error) {
        console.error('Error checking for response:', error);
        setTimeout(checkForResponse, 1000);
      }
    };
    
    // Start checking after 3 seconds to allow ChatGPT to start responding
    setTimeout(checkForResponse, 3000);
  });
}

// Utility function to detect when ChatGPT interface changes
const observer = new MutationObserver((mutations) => {
  // Could be used to detect UI changes and adapt selectors
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});