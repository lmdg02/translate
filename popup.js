// ============== popup.js ==============

console.log('ChatGPT Translator: Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const inputText = document.getElementById('inputText');
    const targetLang = document.getElementById('targetLang');
    const translateBtn = document.getElementById('translateBtn');
    const togglePopupBtn = document.getElementById('togglePopup');
    const resultText = document.getElementById('resultText');
    const status = document.getElementById('status');
    const chatGPTStatus = document.getElementById('chatGPTStatus');

    // Initialize popup
    initializePopup();

    // Event listeners
    togglePopupBtn.addEventListener('click', handleTogglePopup);
    translateBtn.addEventListener('click', handleTranslate);
    inputText.addEventListener('input', saveInputText);
    targetLang.addEventListener('change', saveTargetLanguage);

    // Initialize popup state
    async function initializePopup() {
        try {
            // Load saved values
            const result = await chrome.storage.local.get(['inputText', 'targetLang']);
            if (result.inputText) inputText.value = result.inputText;
            if (result.targetLang) targetLang.value = result.targetLang;

            // Check ChatGPT status
            await checkChatGPTStatus();
            
        } catch (error) {
            console.error('Error initializing popup:', error);
        }
    }

    // Check if ChatGPT tabs are available
    async function checkChatGPTStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get_chatgpt_tabs' });
            const chatGPTTabs = response?.tabs || [];
            
            if (chatGPTTabs.length > 0) {
                chatGPTStatus.textContent = `✅ ChatGPT sẵn sàng (${chatGPTTabs.length} tab)`;
                chatGPTStatus.className = 'status-success';
            } else {
                chatGPTStatus.textContent = '❌ Vui lòng mở ChatGPT trước';
                chatGPTStatus.className = 'status-error';
            }
        } catch (error) {
            console.error('Error checking ChatGPT status:', error);
            chatGPTStatus.textContent = '⚠️ Không thể kiểm tra ChatGPT';
            chatGPTStatus.className = 'status-warning';
        }
    }

    // Toggle floating popup on current tab
    async function handleTogglePopup() {
        try {
            togglePopupBtn.disabled = true;
            togglePopupBtn.textContent = '⏳ Đang bật...';

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Don't inject on ChatGPT pages
            if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
                alert('Không thể bật popup trên trang ChatGPT');
                return;
            }

            await chrome.tabs.sendMessage(tab.id, {
                action: 'toggleFloatingPopup'
            });
            
            // Close extension popup
            window.close();
            
        } catch (error) {
            console.error('Error toggling popup:', error);
            alert('Lỗi: ' + error.message);
        } finally {
            togglePopupBtn.disabled = false;
            togglePopupBtn.textContent = '🚀 Bật Popup trên trang';
        }
    }

    // Handle translation
    async function handleTranslate() {
        const text = inputText.value.trim();
        const lang = targetLang.value;
        
        if (!text) {
            showStatus('❌ Vui lòng nhập văn bản cần dịch', 'error');
            return;
        }

        // Update UI
        translateBtn.disabled = true;
        translateBtn.textContent = '⏳ Đang dịch...';
        showStatus('🔄 Đang gửi tới ChatGPT...', 'loading');
        resultText.textContent = 'Đang xử lý...';

        try {
            // Send translation request to background
            const response = await chrome.runtime.sendMessage({
                action: 'translate',
                text: text,
                targetLanguage: lang
            });

            if (response && response.success) {
                resultText.textContent = response.translation;
                showStatus('✅ Dịch thành công', 'success');
                
                // Save successful translation to history
                saveTranslationHistory(text, response.translation, lang);
            } else {
                throw new Error(response?.error || 'Không thể dịch');
            }

        } catch (error) {
            console.error('Translation error:', error);
            resultText.textContent = 'Lỗi: ' + error.message;
            showStatus('❌ Lỗi dịch', 'error');
        } finally {
            translateBtn.disabled = false;
            translateBtn.textContent = '🌐 Dịch với ChatGPT';
        }
    }

    // Show status message
    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status status-${type}`;
    }

    // Save input text
    function saveInputText() {
        chrome.storage.local.set({ inputText: inputText.value });
    }

    // Save target language
    function saveTargetLanguage() {
        chrome.storage.local.set({ targetLang: targetLang.value });
    }

    // Save translation to history
    async function saveTranslationHistory(original, translation, targetLang) {
        try {
            const result = await chrome.storage.local.get(['translationHistory']);
            const history = result.translationHistory || [];
            
            history.unshift({
                original,
                translation,
                targetLang,
                timestamp: Date.now()
            });
            
            // Keep only last 50 translations
            if (history.length > 50) {
                history.splice(50);
            }
            
            await chrome.storage.local.set({ translationHistory: history });
        } catch (error) {
            console.error('Error saving translation history:', error);
        }
    }

    // Refresh ChatGPT status periodically
    setInterval(checkChatGPTStatus, 5000);
});