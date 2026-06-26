/* ── Bilingual i18n system (loads from _locales/) ── */
const i18n = {
    currentLang: 'en',
    strings: { fa: {}, en: {} },

    async loadMessages(lang) {
        const url = browser.runtime.getURL(`_locales/${lang}/messages.json`);
        const response = await fetch(url);
        const data = await response.json();
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = value.message;
        }
        return result;
    },

    get(key, ...args) {
        let val = this.strings[this.currentLang][key];
        if (!val) return key;
        if (args.length) {
            args.forEach((arg, i) => {
                val = val.replace(`$${i + 1}`, arg);
            });
        }
        return val;
    },

    translateElement(el) {
        const key = el.dataset.i18n;
        if (key) {
            el.innerText = this.get(key);
        }
        const titleKey = el.dataset.i18nTitle;
        if (titleKey) {
            el.title = this.get(titleKey);
        }
        const placeholderKey = el.dataset.i18nPlaceholder;
        if (placeholderKey && el.tagName === 'INPUT') {
            el.placeholder = this.get(placeholderKey);
        }
    },

    applyLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => this.translateElement(el));
        document.querySelectorAll('[data-i18n-title]').forEach(el => this.translateElement(el));
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => this.translateElement(el));
        const isFa = this.currentLang === 'fa';
        document.documentElement.lang = isFa ? 'fa' : 'en';
        document.body.dir = isFa ? 'rtl' : 'ltr';
        document.getElementById('langToggle').innerText = isFa ? 'EN' : 'FA';
        document.getElementById('langToggle').title = isFa ? this.get('langTitleEn') : this.get('langTitleFa');
        // Fix API key toggle position based on direction
        const apiToggle = document.getElementById('apiToggle');
        if (apiToggle) {
            apiToggle.style.left = isFa ? '8px' : 'auto';
            apiToggle.style.right = isFa ? 'auto' : '8px';
        }
        // Fix save badge position based on direction
        document.querySelectorAll('.save-badge').forEach(badge => {
            badge.style.left = isFa ? '8px' : 'auto';
            badge.style.right = isFa ? 'auto' : '8px';
        });
        // Fix input padding for LTR api key field
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.style.paddingLeft = isFa ? '10px' : '36px';
            apiKeyInput.style.paddingRight = isFa ? '36px' : '10px';
        }
        // Fix baseUrl save badge position
        const baseUrlInput = document.getElementById('baseUrl');
        if (baseUrlInput) {
            baseUrlInput.style.paddingLeft = isFa ? '10px' : '36px';
            baseUrlInput.style.paddingRight = isFa ? '36px' : '10px';
        }
    },

    async toggle() {
        this.currentLang = this.currentLang === 'fa' ? 'en' : 'fa';
        browser.storage.local.set({ lang: this.currentLang });
        this.applyLanguage();
        // Re-translate dynamic elements
        updateTabCount();
    },

    async init() {
        // Load both locale files
        this.strings.fa = await this.loadMessages('fa');
        this.strings.en = await this.loadMessages('en');

        const data = await browser.storage.local.get(['lang']);
        if (data.lang) {
            this.currentLang = data.lang;
        } else {
            // Default: follow browser locale
            const uiLang = browser.i18n.getUILanguage();
            this.currentLang = uiLang.startsWith('fa') ? 'fa' : 'en';
        }
        this.applyLanguage();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const data = await browser.storage.local.get(['baseUrl', 'apiKey', 'modelName', 'tabLimit']);
    if (data.baseUrl) document.getElementById('baseUrl').value = data.baseUrl;
    if (data.apiKey) {
        document.getElementById('apiKey').value = data.apiKey;
    }
    if (data.modelName) {
        setModelPreset(data.modelName);
    }
    if (data.tabLimit) document.getElementById('tabLimit').value = data.tabLimit;

    // Focus API key field on open
    const apiKeyInput = document.getElementById('apiKey');
    if (!apiKeyInput.value) {
        setTimeout(() => apiKeyInput.focus(), 300);
    }

    // Load backup toggle preference
    const backupData = await browser.storage.local.get(['backupEnabled']);
    if (backupData.backupEnabled === false) {
        document.getElementById('backupToggle').checked = false;
    }

    // Init i18n (loads _locales/ files)
    await i18n.init();

    updateTabCount();
    setInterval(updatePopupUI, 1000);
    updatePopupUI();
});

/* ── Language toggle ── */
document.getElementById('langToggle').addEventListener('click', () => i18n.toggle());

/* ── Tab count ── */
async function updateTabCount() {
    try {
        const tabs = await browser.tabs.query({ currentWindow: true });
        const ungrouped = tabs.filter(t => !t.pinned && t.groupId === -1);
        document.getElementById('tabCountBadge').innerText = i18n.get('tabCountLabel', ungrouped.length);
    } catch (_) {
        document.getElementById('tabCountBadge').innerText = '—';
    }
}

/* ── Model preset helpers ── */
function setModelPreset(value) {
    const preset = document.getElementById('modelPreset');
    const customWrap = document.getElementById('modelCustomWrap');
    const customInput = document.getElementById('modelCustom');

    const option = Array.from(preset.options).find(o => o.value === value);
    if (option) {
        preset.value = value;
        customWrap.style.display = 'none';
    } else {
        preset.value = '__custom__';
        customInput.value = value;
        customWrap.style.display = 'block';
    }
}

function getModelName() {
    const preset = document.getElementById('modelPreset');
    const customInput = document.getElementById('modelCustom');
    if (preset.value === '__custom__') {
        return customInput.value.trim() || '';
    }
    return preset.value;
}

document.getElementById('modelPreset').addEventListener('change', () => {
    const customWrap = document.getElementById('modelCustomWrap');
    if (document.getElementById('modelPreset').value === '__custom__') {
        customWrap.style.display = 'block';
        document.getElementById('modelCustom').focus();
    } else {
        customWrap.style.display = 'none';
        saveField('modelName', getModelName());
    }
});

document.getElementById('modelCustom').addEventListener('input', () => {
    saveField('modelName', getModelName());
});

/* ── Auto-save inputs with feedback badge ── */
function saveField(id, value) {
    browser.storage.local.set({ [id]: value });
    const badge = document.getElementById(`badge-${id}`);
    if (badge) {
        badge.classList.add('show');
        clearTimeout(badge._hideTimer);
        badge._hideTimer = setTimeout(() => badge.classList.remove('show'), 1800);
    }
}

['baseUrl', 'apiKey'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
        saveField(id, el.value.trim());
    });
});

/* ── API Key toggle ── */
document.getElementById('apiToggle').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    const toggle = document.getElementById('apiToggle');
    if (input.type === 'password') {
        input.type = 'text';
        toggle.innerText = '🙈';
    } else {
        input.type = 'password';
        toggle.innerText = '👁️';
    }
});

/* ── Settings toggle ── */
document.getElementById('settingsToggle').addEventListener('click', () => {
    const card = document.getElementById('settingsCard');
    const arrow = document.getElementById('settingsToggleArrow');
    const isOpen = card.style.display !== 'none';
    card.style.display = isOpen ? 'none' : 'block';
    arrow.classList.toggle('open', !isOpen);
});

/* ── Backup toggle save ── */
document.getElementById('backupToggle').addEventListener('change', () => {
    browser.storage.local.set({ backupEnabled: document.getElementById('backupToggle').checked });
});

/* ── Tab limit auto-save ── */
document.getElementById('tabLimit').addEventListener('change', () => {
    browser.storage.local.set({ tabLimit: document.getElementById('tabLimit').value });
});

/* ── Clear settings ── */
document.getElementById('clearBtn').addEventListener('click', async () => {
    await browser.storage.local.clear();
    document.getElementById('baseUrl').value = 'https://openrouter.ai/api/v1';
    document.getElementById('apiKey').value = '';
    document.getElementById('apiKey').type = 'password';
    document.getElementById('apiToggle').innerText = '👁️';
    document.getElementById('modelPreset').value = 'google/gemini-2.5-flash';
    document.getElementById('modelCustom').value = '';
    document.getElementById('modelCustomWrap').style.display = 'none';
    document.getElementById('tabLimit').value = 'all';
    showStatus(i18n.get('settingsCleared'), 'warn');
    document.getElementById('testResult').innerHTML = '';
    i18n.applyLanguage();
});

/* ── Test connection ── */
document.getElementById('testBtn').addEventListener('click', async () => {
    const baseUrl = document.getElementById('baseUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!baseUrl || !apiKey) {
        document.getElementById('testResult').innerHTML = i18n.get('testPleaseFill');
        document.getElementById('testResult').className = 'test-result fail';
        return;
    }

    const testEl = document.getElementById('testResult');
    testEl.innerHTML = i18n.get('testProgress');
    testEl.className = 'test-result wait';

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: getModelName() || 'google/gemini-2.5-flash',
                messages: [{ role: 'user', content: 'hello' }],
                max_tokens: 1
            })
        });

        if (response.ok) {
            testEl.innerHTML = i18n.get('testOk');
            testEl.className = 'test-result ok';
        } else if (response.status === 401) {
            testEl.innerHTML = i18n.get('test401');
            testEl.className = 'test-result fail';
        } else if (response.status === 402) {
            testEl.innerHTML = i18n.get('test402');
            testEl.className = 'test-result fail';
        } else {
            testEl.innerHTML = i18n.get('testStatus', response.status);
            testEl.className = 'test-result fail';
        }
    } catch (err) {
        testEl.innerHTML = i18n.get('testNetwork');
        testEl.className = 'test-result fail';
    }
});

/* ── Analyze button ── */
document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const baseUrl = document.getElementById('baseUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const modelName = getModelName();
    const tabLimit = document.getElementById('tabLimit').value;

    if (!apiKey || !baseUrl || !modelName) {
        showStatus(i18n.get('fillSettings'), 'error');
        return;
    }

    await browser.runtime.sendMessage({
        action: "startAnalysis",
        settings: { baseUrl, apiKey, modelName, tabLimit }
    });
});

/* ── Status helpers ── */
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const statusIcon = document.getElementById('statusIcon');
    statusText.innerText = message;
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
    statusIcon.innerText = icons[type] || 'ℹ️';
    statusDiv.className = `status-box ${type}`;
}

function hideStatus() {
    document.getElementById('status').className = 'status-box empty';
}

/* ── Periodic UI sync ── */
async function updatePopupUI() {
    const state = await browser.runtime.sendMessage({ action: "getState" });
    const previewArea = document.getElementById('previewArea');
    const previewCard = document.getElementById('previewCard');
    const applyBtn = document.getElementById('applyBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analyzeBtnText = document.getElementById('analyzeBtnText');

    // Update tab count on each poll
    updateTabCount();

    if (state.isAnalyzing) {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('loading');
        analyzeBtnText.innerHTML = `<span class="spinner"></span> ${i18n.get('analyzing')}`;
        showStatus(state.statusText || i18n.get('analyzingAI'), 'info');
        previewArea.style.display = "none";
        previewCard.style.display = "none";
        applyBtn.style.display = "none";
        return;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('loading');
    analyzeBtnText.innerText = i18n.get('analyzeBtn');

    if (state.statusText) {
        // Check if statusText is a translation key; if so, get translated string
        let displayText = state.statusText;
        const knownKeys = ['noUngrouped', 'analyzingGroups', 'analysisDone', 'aiError'];
        if (knownKeys.includes(state.statusText)) {
            displayText = i18n.get(state.statusText);
        }
        let type = 'info';
        if (displayText.includes('🎉') || displayText.includes('موفقیت') || displayText.includes('success')) type = 'success';
        else if (displayText.includes('خطا') || displayText.includes('Error')) type = 'error';
        else if (displayText.includes('بررسی') || displayText.includes('check')) type = 'warn';

        const statusTextEl = document.getElementById('statusText');
        if (statusTextEl.innerText.includes('🎉')) return;
        showStatus(displayText, type);
    } else {
        hideStatus();
    }

    if (state.computedGroups) {
        previewArea.innerHTML = "";
        const existingNames = (state.existingGroupNames || []).map(n => n.toLowerCase().trim());
        const newGroupLabel = i18n.get('newGroup');
        const existingGroupLabel = i18n.get('existingGroup');
        for (const [groupName, tabIds] of Object.entries(state.computedGroups)) {
            if (!Array.isArray(tabIds) || tabIds.length === 0) continue;
            const isExisting = existingNames.includes(groupName.toLowerCase().trim());

            // Group header
            const groupEl = document.createElement('div');
            groupEl.className = "preview-group";
            if (isExisting) groupEl.classList.add("preview-group-existing");
            groupEl.innerHTML = `<span class="preview-group-icon">${isExisting ? '📁' : '📂'}</span><span class="preview-group-name">${groupName}</span><span class="preview-group-label">${isExisting ? existingGroupLabel : newGroupLabel}</span><span class="preview-group-count">${tabIds.length} ${i18n.get('previewTabs')}</span>`;
            previewArea.appendChild(groupEl);

            // Tab list for this group
            const tabsContainer = document.createElement('div');
            tabsContainer.className = "preview-tabs-container";
            tabIds.forEach(id => {
                const originalTab = state.eligibleTabs.find(t => t.id === Number(id));
                if (originalTab) {
                    const tabEl = document.createElement('div');
                    tabEl.className = "preview-tab";
                    if (isExisting) tabEl.classList.add("preview-tab-existing");
                    tabEl.innerHTML = `<span class="preview-tab-icon">${isExisting ? '➕' : '📄'}</span><span class="preview-tab-title">${originalTab.title}</span>`;
                    tabsContainer.appendChild(tabEl);
                }
            });
            previewArea.appendChild(tabsContainer);
        }
        previewArea.style.display = "block";
        previewCard.style.display = "block";
        applyBtn.style.display = "block";
    } else {
        previewArea.style.display = "none";
        previewCard.style.display = "none";
        applyBtn.style.display = "none";
    }
}

/* ── Apply button ── */
document.getElementById('applyBtn').addEventListener('click', async () => {
    showStatus(i18n.get('applying'), 'info');

    try {
        const backupEnabled = document.getElementById('backupToggle').checked;
        if (backupEnabled) {
            showStatus(i18n.get('backupProgress'), 'info');
            const allTabs = await browser.tabs.query({ currentWindow: true });
            const backupData = allTabs.map(t => ({ title: t.title, url: t.url, pinned: t.pinned }));
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        const response = await browser.runtime.sendMessage({ action: "applyGroups" });

        if (response && response.success) {
            showStatus(i18n.get('success'), 'success');
            document.getElementById('previewArea').style.display = "none";
            document.getElementById('previewCard').style.display = "none";
            document.getElementById('applyBtn').style.display = "none";
            await browser.runtime.sendMessage({ action: "clearState" });
        } else {
            showStatus(i18n.get('applyError'), 'error');
        }
    } catch (err) {
        console.error(err);
        showStatus(i18n.get('backupError'), 'error');
    }
});

/* ── Helper: extract domain from URL ── */
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return '';
    }
}