/**
 * Oracle Chat — Reusable AI Chat Component
 *
 * Usage:
 *   OracleChat.init({
 *     endpoint: '/api/chat',
 *     title: 'The Oracle',
 *     greeting: 'Greetings...',
 *     placeholder: 'Ask the Oracle...',
 *     orbEmoji: '\uD83D\uDD2E',
 *     tooltip: 'Consult the Oracle',
 *     historySize: 10,
 *   });
 */
(function () {
  'use strict';

  var config = {
    endpoint: '/api/chat',
    title: 'The Oracle',
    greeting: 'Greetings, traveller. How may I assist you?',
    placeholder: 'Ask the Oracle...',
    orbEmoji: '\uD83D\uDD2E',
    tooltip: 'Consult the Oracle',
    historySize: 10,
  };

  var els = {};
  var chatHistory = [];
  var chatBusy = false;

  // ── Markdown Renderer (DOM-safe) ──

  function renderMarkdown(text, container) {
    var regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((https?:\/\/[^\s)]+)\))/g;
    var lastIndex = 0;
    var match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      if (match[2]) {
        var strong = document.createElement('strong');
        strong.textContent = match[2];
        container.appendChild(strong);
      } else if (match[3]) {
        var em = document.createElement('em');
        em.textContent = match[3];
        container.appendChild(em);
      } else if (match[4]) {
        var code = document.createElement('code');
        code.textContent = match[4];
        code.style.cssText = 'background:rgba(180,140,255,0.15);padding:1px 5px;border-radius:3px;font-size:13px;';
        container.appendChild(code);
      } else if (match[5] && match[6]) {
        var a = document.createElement('a');
        a.href = match[6];
        a.textContent = match[5];
        a.target = '_blank';
        a.rel = 'noopener';
        container.appendChild(a);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  function setMarkdownContent(el, text) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var lines = text.split('\n');
    lines.forEach(function (line, idx) {
      if (idx > 0) el.appendChild(document.createElement('br'));
      renderMarkdown(line, el);
    });
  }

  // ── DOM Creation ──

  function createDOM() {
    var scope = document.createElement('div');
    scope.className = 'oracle-scope';

    var orb = document.createElement('div');
    orb.className = 'oracle-orb';
    orb.textContent = config.orbEmoji;
    var tooltip = document.createElement('div');
    tooltip.className = 'oracle-orb-tooltip';
    tooltip.textContent = config.tooltip;
    orb.appendChild(tooltip);

    var panel = document.createElement('div');
    panel.className = 'oracle-panel';

    var header = document.createElement('div');
    header.className = 'oracle-header';
    var titleEl = document.createElement('span');
    titleEl.className = 'oracle-header-title';
    titleEl.textContent = config.title;
    var closeBtn = document.createElement('button');
    closeBtn.className = 'oracle-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.setAttribute('aria-label', 'Close');
    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    var messages = document.createElement('div');
    messages.className = 'oracle-messages';
    var greeting = document.createElement('div');
    greeting.className = 'oracle-msg oracle';
    setMarkdownContent(greeting, config.greeting);
    messages.appendChild(greeting);

    var inputWrap = document.createElement('div');
    inputWrap.className = 'oracle-input-wrap';
    var input = document.createElement('input');
    input.className = 'oracle-input';
    input.type = 'text';
    input.placeholder = config.placeholder;
    input.autocomplete = 'off';
    var sendBtn = document.createElement('button');
    sendBtn.className = 'oracle-send';
    sendBtn.textContent = '\u2794';
    inputWrap.appendChild(input);
    inputWrap.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputWrap);
    scope.appendChild(orb);
    scope.appendChild(panel);
    document.body.appendChild(scope);

    els = { scope: scope, orb: orb, panel: panel, close: closeBtn, messages: messages, input: input, send: sendBtn };
  }

  // ── Handlers ──

  function open() { els.orb.classList.add('chat-open'); els.panel.classList.add('open'); els.input.focus(); }
  function close() { els.panel.classList.remove('open'); els.orb.classList.remove('chat-open'); }

  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'oracle-msg ' + role;
    if (role === 'oracle') { setMarkdownContent(div, text); } else { div.textContent = text; }
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
    return div;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'oracle-msg oracle';
    div.id = 'oracle-typing';
    var dots = document.createElement('div');
    dots.className = 'oracle-typing';
    for (var i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
    div.appendChild(dots);
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('oracle-typing');
    if (el) el.remove();
  }

  function sendChat() {
    var text = els.input.value.trim();
    if (!text || chatBusy) return;
    chatBusy = true;
    els.send.disabled = true;
    els.input.value = '';
    addMessage('user', text);
    chatHistory.push({ role: 'user', content: text });
    showTyping();

    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-(config.historySize)) }),
    }).then(function (resp) {
      var ct = resp.headers.get('content-type') || '';
      if (ct.indexOf('text/event-stream') !== -1) {
        removeTyping();
        var msgEl = addMessage('oracle', '');
        var fullText = '';
        var reader = resp.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';
        function pump() {
          reader.read().then(function (r) {
            if (r.done) { if (fullText) chatHistory.push({ role: 'assistant', content: fullText }); chatBusy = false; els.send.disabled = false; els.input.focus(); return; }
            buf += decoder.decode(r.value, { stream: true });
            var lines = buf.split('\n'); buf = lines.pop() || '';
            lines.forEach(function (l) {
              l = l.trim(); if (!l.startsWith('data: ')) return;
              var d = l.slice(6); if (d === '[DONE]') return;
              try { var p = JSON.parse(d); if (p.text) { fullText += p.text; setMarkdownContent(msgEl, fullText); els.messages.scrollTop = els.messages.scrollHeight; } } catch (e) {}
            });
            pump();
          });
        }
        pump();
        return;
      }
      return resp.json().then(function (data) {
        removeTyping();
        var reply = data.reply || data.error || 'The Oracle is silent.';
        addMessage('oracle', reply);
        chatHistory.push({ role: 'assistant', content: reply });
        chatBusy = false; els.send.disabled = false; els.input.focus();
      });
    }).catch(function (err) {
      removeTyping();
      addMessage('oracle', 'The Oracle\'s vision is clouded. (' + err.message + ')');
      chatBusy = false; els.send.disabled = false;
    });
  }

  function bindEvents() {
    els.orb.addEventListener('click', open);
    els.close.addEventListener('click', close);
    els.send.addEventListener('click', sendChat);
    els.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.panel.classList.contains('open')) close(); });
  }

  window.OracleChat = {
    init: function (opts) {
      if (opts) Object.keys(opts).forEach(function (k) { if (opts[k] !== undefined) config[k] = opts[k]; });
      createDOM();
      bindEvents();
    },
    open: open,
    close: close,
    addMessage: addMessage,
    clearHistory: function () { chatHistory = []; },
  };
})();
