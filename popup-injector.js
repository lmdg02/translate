// ============== popup-injector.js ==============

console.log('ChatGPT Translator: Popup injector loaded');

let floatingPopup = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let isMinimized = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFloatingPopup') {
    toggleFloatingPopup();
    sendResponse({ success: true });
  }
});

// Auto-create floating popup after page load (optional)
document.addEventListener('DOMContentLoaded', () => {
  // Check if user wants auto-show popup
  chrome.storage.local.get(['autoShowPopup'], (result) => {
    if (result.autoShowPopup) {
      setTimeout(createFloatingPopup, 1000);
    }
  });
});

function toggleFloatingPopup() {
  if (floatingPopup) {
    removeFloatingPopup();
  } else {
    createFloatingPopup();
  }
}

function createFloatingPopup() {
  if (floatingPopup) return; // Already exists
  
  // Create popup container
  floatingPopup = document.createElement('div');
  floatingPopup.id = 'chatgpt-translator-floating';
  floatingPopup.className = 'chatgpt-translator-popup';
  
  floatingPopup.innerHTML = `
    <div class="popup-header" id="popup-header">
      <div class="popup-title">
        <span class="popup-icon">🌐</span>
        <span>AI Translator</span>
      </div>
      <div class="popup-controls">
        <button class="control-btn minimize-btn" id="minimizeBtn" title="Thu gọn">
          <span class="minimize-icon">−</span>
        </button>
        <button class="control-btn close-btn" id="closeBtn" title="Đóng">
          <span class="close-icon">×</span>
        </button>
      </div>
    </div>
    <div class="popup-body" id="popup-body">
      <div class="input-section">
        <div class="input-group">
          <label class="input-label">Văn bản cần dịch:</label>
          <textarea 
            id="floatingInputText" 
            class="text-input" 
            placeholder="Nhập hoặc dán văn bản cần dịch..."
            rows="3"
          ></textarea>
        </div>
        
        <div class="lang-section">
          <div class="input-group lang-group">
            <label class="input-label">Dịch sang:</label>
            <select id="floatingTargetLang" class="lang-select">
              <option value="vietnamese">🇻🇳 Tiếng Việt</option>
              <option value="english">🇺🇸 English</option>
              <option value="japanese">🇯🇵 日本語</option>
              <option value="korean">🇰🇷 한국어</option>
              <option value="chinese">🇨🇳 中文</option>
              <option value="french">🇫🇷 Français</option>
              <option value="german">🇩🇪 Deutsch</option>
              <option value="spanish">🇪🇸 Español</option>
            </select>
          </div>
          <button id="swapLangs" class="swap-btn" title="Đảo ngôn ngữ">⇄</button>
        </div>
        
        <button id="floatingTranslateBtn" class="translate-btn">
          <span class="btn-icon">🚀</span>
          <span class="btn-text">Dịch ngay</span>
        </button>
      </div>
      
      <div id="floatingResult" class="result-section">
        <div class="result-header">
          <span class="result-label">Kết quả:</span>
          <button id="copyBtn" class="copy-btn" title="Copy kết quả" style="display: none;">
            <span class="copy-icon">📋</span>
          </button>
        </div>
        <div id="floatingResultText" class="result-text">
          Kết quả dịch sẽ hiển thị ở đây...
        </div>
        <div id="floatingStatus" class="status-text">
          Sẵn sàng dịch
        </div>
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(floatingPopup);
  
  // Setup event listeners
  setupFloatingPopupEvents();
  
  // Load saved position and settings
  loadPopupSettings();
  
  console.log('Floating popup created');
}

function setupFloatingPopupEvents() {
  if (!floatingPopup) return;
  
  // Get elements
  const header = floatingPopup.querySelector('#popup-header');
  const minimizeBtn = floatingPopup.querySelector('#minimizeBtn');
  const closeBtn = floatingPopup.querySelector('#closeBtn');
  const translateBtn = floatingPopup.querySelector('#floatingTranslateBtn');
  const copyBtn = floatingPopup.querySelector('#copyBtn');
  const swapBtn = floatingPopup.querySelector('#swapLangs');
  const inputText = floatingPopup.querySelector('#floatingInputText');
  const targetLang = floatingPopup.querySelector('#floatingTargetLang');
  
  // Dragging
  header.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDragging);
  
  // Control buttons
  minimizeBtn.addEventListener('click', toggleMinimize);
  closeBtn.addEventListener('click', removeFloatingPopup);
  
  // Translation
  translateBtn.addEventListener('click', handleTranslation);
  
  // Copy result
  copyBtn.addEventListener('click', copyResult);
  
  // Swap languages (future feature)
  swapBtn.addEventListener('click', swapLanguages);
  
  // Auto-save input
  inputText.addEventListener('input', debounce(saveInputText, 500));
  targetLang.addEventListener('change', saveTargetLang);
  
  // Enter key to translate
  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleTranslation();
    }
  });
}

function startDragging(e) {
  if (e.target.closest('.popup-controls')) return; // Don't drag when clicking controls
  
  isDragging = true;
  const rect = floatingPopup.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  floatingPopup.classList.add('dragging');
  e.preventDefault();
}

function handleDrag(e) {
  if (!isDragging || !floatingPopup) return;
  
  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;
  
  // Keep popup within viewport
  const maxX = window.innerWidth - floatingPopup.offsetWidth;
  const maxY = window.innerHeight - floatingPopup.offsetHeight;
  
  const constrainedX = Math.max(0, Math.min(x, maxX));
  const constrainedY = Math.max(0, Math.min(y, maxY));
  
  floatingPopup.style.left = constrainedX + 'px';
  floatingPopup.style.top = constrainedY + 'px';
  floatingPopup.style.right = 'auto';
  floatingPopup.style.bottom = 'auto';
}

function stopDragging() {
  if (isDragging) {
    isDragging = false;
    floatingPopup?.classList.remove('dragging');
    savePopupPosition();
  }
}

function toggleMinimize() {
  const popupBody = floatingPopup.querySelector('#popup-body');
  const minimizeBtn = floatingPopup.querySelector('#minimizeBtn');
  const minimizeIcon = minimizeBtn.querySelector('.minimize-icon');
  
  isMinimized = !isMinimized;
  
  if (isMinimized) {
    popupBody.style.display = 'none';
    minimizeIcon.textContent = '+';
    floatingPopup.classList.add('minimized');
  } else {
    popupBody.style.display = 'block';
    minimizeIcon.textContent = '−';
    floatingPopup.classList.remove('minimized');
  }
  
  chrome.storage.local.set({ popupMinimized: isMinimized });
}

function removeFloatingPopup() {
  if (floatingPopup) {
    floatingPopup.remove();
    floatingPopup = null;
    console.log('Floating popup removed');
  }
}

async function handleTranslation() {
  const inputText = floatingPopup.querySelector('#floatingInputText');
  const targetLang = floatingPopup.querySelector('#floatingTargetLang');
  const translateBtn = floatingPopup.querySelector('#floatingTranslateBtn');
  const resultText = floatingPopup.querySelector('#floatingResultText');
  const statusText = floatingPopup.querySelector('#floatingStatus');
  const copyBtn = floatingPopup.querySelector('#copyBtn');
  
  const text = inputText.value.trim();
  const lang = targetLang.value;
  
  if (!text) {
    showStatus('❌ Vui lòng nhập văn bản cần dịch', 'error');
    inputText.focus();
    return;
  }
  
  // Update UI for loading state
  translateBtn.disabled = true;
  translateBtn.innerHTML = `
    <span class="btn-icon spinner">⏳</span>
    <span class="btn-text">Đang dịch...</span>
  `;
  showStatus('🔄 Đang kết nối ChatGPT...', 'loading');
  resultText.textContent = 'Đang xử lý...';
  copyBtn.style.display = 'none';
  
  try {
    // Send translation request to background script
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      targetLanguage: lang
    });
    
    if (response.success) {
      resultText.textContent = response.translation;
      showStatus('✅ Dịch thành công', 'success');
      copyBtn.style.display = 'inline-block';
      
      // Save to history (optional feature)
      saveTranslationHistory(text, response.translation, lang);
      
    } else {
      throw new Error(response.error || 'Không thể dịch văn bản');
    }
    
  } catch (error) {
    console.error('Translation error:', error);
    resultText.textContent = 'Lỗi: ' + error.message;
    showStatus('❌ ' + error.message, 'error');
    
    // Show helpful hints
    if (error.message.includes('ChatGPT')) {
      showStatus('💡 Hãy mở ChatGPT trong tab khác và thử lại', 'hint');
    }
  } finally {
    // Reset button
    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <span class="btn-icon">🚀</span>
      <span class="btn-text">Dịch ngay</span>
    `;
  }
}

function showStatus(message, type = 'info') {
  const statusText = floatingPopup.querySelector('#floatingStatus');
  statusText.textContent = message;
  statusText.className = `status-text status-${type}`;
  
  // Auto-hide after 5 seconds for non-error messages
  if (type !== 'error') {
    setTimeout(() => {
      if (statusText.textContent === message) {
        statusText.textContent = 'Sẵn sàng dịch';
        statusText.className = 'status-text';
      }
    }, 1000);
  }
}

async function copyResult() {
  const resultText = floatingPopup.querySelector('#floatingResultText');
  const copyBtn = floatingPopup.querySelector('#copyBtn');
  
  try {
    await navigator.clipboard.writeText(resultText.textContent);
    copyBtn.innerHTML = '<span class="copy-icon">✅</span>';
    showStatus('📋 Đã copy vào clipboard', 'success');
    
    setTimeout(() => {
      copyBtn.innerHTML = '<span class="copy-icon">📋</span>';
    }, 1000);
  } catch (error) {
    console.error('Copy failed:', error);
    showStatus('❌ Không thể copy', 'error');
  }
}

function swapLanguages() {
  // Future feature: swap source and target languages
  showStatus('🔄 Tính năng đang phát triển...', 'info');
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function saveInputText() {
  const inputText = floatingPopup.querySelector('#floatingInputText');
  chrome.storage.local.set({ floatingInputText: inputText.value });
}

function saveTargetLang() {
  const targetLang = floatingPopup.querySelector('#floatingTargetLang');
  chrome.storage.local.set({ floatingTargetLang: targetLang.value });
}

function savePopupPosition() {
  if (!floatingPopup) return;
  
  const rect = floatingPopup.getBoundingClientRect();
  chrome.storage.local.set({
    popupPosition: {
      left: rect.left,
      top: rect.top
    }
  });
}

function loadPopupSettings() {
  chrome.storage.local.get([
    'floatingInputText',
    'floatingTargetLang', 
    'popupPosition',
    'popupMinimized'
  ], (result) => {
    // Restore input text
    if (result.floatingInputText) {
      const inputText = floatingPopup.querySelector('#floatingInputText');
      inputText.value = result.floatingInputText;
    }
    
    // Restore target language
    if (result.floatingTargetLang) {
      const targetLang = floatingPopup.querySelector('#floatingTargetLang');
      targetLang.value = result.floatingTargetLang;
    }
    
    // Restore position
    if (result.popupPosition) {
      const pos = result.popupPosition;
      floatingPopup.style.left = pos.left + 'px';
      floatingPopup.style.top = pos.top + 'px';
      floatingPopup.style.right = 'auto';
      floatingPopup.style.bottom = 'auto';
    }
    
    // Restore minimized state
    if (result.popupMinimized) {
      toggleMinimize();
    }
  });
}

function saveTranslationHistory(original, translation, targetLang) {
  chrome.storage.local.get(['translationHistory'], (result) => {
    const history = result.translationHistory || [];
    
    history.unshift({
      original,
      translation,
      targetLang,
      timestamp: Date.now(),
      url: window.location.href
    });
    
    // Keep only last 50 translations
    const trimmedHistory = history.slice(0, 50);
    
    chrome.storage.local.set({ translationHistory: trimmedHistory });
  });
}