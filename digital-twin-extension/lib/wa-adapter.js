/**
 * WhatsApp Web Adapter
 * DOM selectors and automation helpers for web.whatsapp.com
 */

const SEL = {
  // Message areas
  CHAT_CONTAINER: '[role="main"]',
  MESSAGE_INPUT: '[contenteditable="true"][data-tab="6"]',
  SEND_BUTTON: '[aria-label*="Send"]',
  
  // Incoming messages
  INCOMING_MESSAGE: '[data-testid*="msg-container"] [data-testid*="msg"]',
  MESSAGE_TEXT: '[class*="selectable-text"]',
  
  // Chat list
  CHAT_LIST: '[role="navigation"]',
  CHAT_ITEM: '[role="option"]'
};

class MessageWatcher {
  constructor(onMessageCallback) {
    this.onMessage = onMessageCallback;
    this.lastProcessedId = null;
    this.observer = null;
  }

  start() {
    const container = document.querySelector(SEL.CHAT_CONTAINER);
    if (!container) return;

    const config = {
      childList: true,
      subtree: true,
      characterData: true
    };

    this.observer = new MutationObserver((mutations) => {
      const newMessages = this._extractNewMessages();
      for (const msg of newMessages) {
        if (msg.id !== this.lastProcessedId) {
          this.onMessage(msg);
          this.lastProcessedId = msg.id;
        }
      }
    });

    this.observer.observe(container, config);
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  _extractNewMessages() {
    const messages = [];
    const elements = document.querySelectorAll(SEL.INCOMING_MESSAGE);
    
    elements.forEach((el, idx) => {
      const textEl = el.querySelector(SEL.MESSAGE_TEXT);
      if (textEl) {
        messages.push({
          id: `msg_${idx}`,
          text: textEl.innerText,
          timestamp: new Date(),
          element: el
        });
      }
    });

    return messages;
  }
}

class WAAdapter {
  static getCurrentChatId() {
    // Extract from URL or active chat
    const urlMatch = window.location.href.match(/chat\/(\d+)/);
    return urlMatch ? urlMatch[1] : null;
  }

  static getLastIncomingMessage() {
    const elements = document.querySelectorAll(SEL.INCOMING_MESSAGE);
    if (elements.length === 0) return null;
    
    const lastEl = elements[elements.length - 1];
    const textEl = lastEl.querySelector(SEL.MESSAGE_TEXT);
    
    return textEl ? textEl.innerText : null;
  }

  static async sendText(text) {
    const input = document.querySelector(SEL.MESSAGE_INPUT);
    if (!input) {
      console.error('Message input not found');
      return false;
    }

    // Use clipboard for reliable paste
    await navigator.clipboard.writeText(text);
    
    input.focus();
    input.textContent = '';
    
    // Trigger paste
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
      bubbles: true
    });
    input.dispatchEvent(pasteEvent);

    // Type effect
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Send
    const sendBtn = document.querySelector(SEL.SEND_BUTTON);
    if (sendBtn) {
      sendBtn.click();
      return true;
    }
    return false;
  }

  static async simulateTyping(durationMs) {
    const input = document.querySelector(SEL.MESSAGE_INPUT);
    if (!input) return;

    input.focus();
    const startEvent = new Event('focus', { bubbles: true });
    input.dispatchEvent(startEvent);

    await new Promise(resolve => setTimeout(resolve, durationMs));

    const endEvent = new Event('blur', { bubbles: true });
    input.dispatchEvent(endEvent);
  }
}
