// ============== background.js ==============

console.log('ChatGPT Translator: Background script loaded');

// Store active ChatGPT tabs
let chatGPTTabIds = new Set();
let pendingTranslations = new Map(); // Store pending translation requests

// Track ChatGPT tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
      chatGPTTabIds.add(tabId);
      console.log('ChatGPT tab detected:', tabId);
    }
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  chatGPTTabIds.delete(tabId);
  console.log('Tab removed:', tabId);
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message, 'from tab:', sender.tab?.id);
  
  switch (message.action) {
    case 'translate':
      handleTranslateRequest(message, sender, sendResponse);
      return true; // Keep message channel open
      
    case 'translation_result':
      handleTranslationResult(message, sender);
      break;
      
    case 'chatgpt_ready':
      console.log('ChatGPT content script ready in tab:', sender.tab?.id);
      chatGPTTabIds.add(sender.tab?.id);
      break;
      
    case 'get_chatgpt_tabs':
      sendResponse({ tabs: Array.from(chatGPTTabIds) });
      break;
      
    default:
      console.log('Unknown action:', message.action);
  }
});

async function handleTranslateRequest(message, sender, sendResponse) {
  try {
    console.log('Handling translate request:', message);
    
    // Find active ChatGPT tab
    const activeChatGPTTab = await findActiveChatGPTTab();
    
    if (!activeChatGPTTab) {
      sendResponse({
        success: false,
        error: 'Vui lòng mở ChatGPT trong một tab trước khi dịch'
      });
      return;
    }
    
    // Generate unique request ID
    const requestId = generateRequestId();
    
    // Store the response callback
    pendingTranslations.set(requestId, {
      sendResponse,
      timestamp: Date.now(),
      senderTabId: sender.tab?.id
    });
    
    // Send translation request to ChatGPT tab
    chrome.tabs.sendMessage(activeChatGPTTab.id, {
      action: 'translate',
      requestId: requestId,
      text: message.text,
      targetLanguage: message.targetLanguage,
      senderTabId: sender.tab?.id
    });
    
    // Set timeout for request
    setTimeout(() => {
      if (pendingTranslations.has(requestId)) {
        const pending = pendingTranslations.get(requestId);
        pending.sendResponse({
          success: false,
          error: 'Timeout: ChatGPT không phản hồi trong 60 giây'
        });
        pendingTranslations.delete(requestId);
      }
    }, 60000); // 60 second timeout
    
  } catch (error) {
    console.error('Error handling translate request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function handleTranslationResult(message, sender) {
  const { requestId, success, translation, error } = message;
  
  if (pendingTranslations.has(requestId)) {
    const pending = pendingTranslations.get(requestId);
    
    pending.sendResponse({
      success,
      translation,
      error
    });
    
    pendingTranslations.delete(requestId);
    console.log('Translation result sent back to tab:', pending.senderTabId);
  } else {
    console.warn('No pending translation found for requestId:', requestId);
  }
}

async function findActiveChatGPTTab() {
  try {
    // Get all ChatGPT tabs
    const chatGPTTabs = await chrome.tabs.query({
      url: ['https://chat.openai.com/*', 'https://chatgpt.com/*']
    });
    
    // Filter for tabs that are still in our set (not closed)
    const validTabs = chatGPTTabs.filter(tab => chatGPTTabIds.has(tab.id));
    
    if (validTabs.length === 0) {
      return null;
    }
    
    // Prefer active tab, otherwise use the first available
    const activeTab = validTabs.find(tab => tab.active);
    return activeTab || validTabs[0];
    
  } catch (error) {
    console.error('Error finding ChatGPT tab:', error);
    return null;
  }
}

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Clean up old pending translations periodically
setInterval(() => {
  const now = Date.now();
  for (const [requestId, pending] of pendingTranslations.entries()) {
    if (now - pending.timestamp > 120000) { // 2 minutes
      console.log('Cleaning up old pending translation:', requestId);
      pendingTranslations.delete(requestId);
    }
  }
}, 30000); // Check every 30 seconds
