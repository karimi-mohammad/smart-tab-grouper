document.addEventListener('DOMContentLoaded', async () => {
    const data = await browser.storage.local.get(['baseUrl', 'apiKey', 'modelName', 'tabLimit']);
    if (data.baseUrl) document.getElementById('baseUrl').value = data.baseUrl;
    if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
    if (data.modelName) document.getElementById('modelName').value = data.modelName;
    if (data.tabLimit) document.getElementById('tabLimit').value = data.tabLimit;

    setInterval(updatePopupUI, 1000);
    updatePopupUI();
});

['baseUrl', 'apiKey', 'modelName', 'tabLimit'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        browser.storage.local.set({ [id]: document.getElementById(id).value.trim() });
    });
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const baseUrl = document.getElementById('baseUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const modelName = document.getElementById('modelName').value.trim();
    const tabLimit = document.getElementById('tabLimit').value;

    if (!apiKey || !baseUrl || !modelName) {
        document.getElementById('status').innerText = "لطفاً تمام فیلدهای تنظیمات را پر کنید.";
        return;
    }

    await browser.runtime.sendMessage({
        action: "startAnalysis",
        settings: { baseUrl, apiKey, modelName, tabLimit }
    });
});

async function updatePopupUI() {
    const state = await browser.runtime.sendMessage({ action: "getState" });
    const statusDiv = document.getElementById('status');
    const previewArea = document.getElementById('previewArea');
    const applyBtn = document.getElementById('applyBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (state.isAnalyzing) {
        statusDiv.innerText = state.statusText;
        analyzeBtn.disabled = true;
        previewArea.style.display = "none";
        applyBtn.style.display = "none";
        return;
    }

    analyzeBtn.disabled = false;
    if (state.statusText) statusDiv.innerText = state.statusText;

    if (state.computedGroups) {
        previewArea.innerHTML = "";
        for (const [groupName, tabIds] of Object.entries(state.computedGroups)) {
            if (!Array.isArray(tabIds) || tabIds.length === 0) continue;

            const groupEl = document.createElement('div');
            groupEl.className = "preview-group";
            groupEl.innerText = `📂 ${groupName}`;
            previewArea.appendChild(groupEl);

            tabIds.forEach(id => {
                const originalTab = state.eligibleTabs.find(t => t.id === Number(id));
                if (originalTab) {
                    const tabEl = document.createElement('div');
                    tabEl.className = "preview-tab";
                    tabEl.innerText = `📄 ${originalTab.title}`;
                    previewArea.appendChild(tabEl);
                }
            });
        }
        previewArea.style.display = "block";
        applyBtn.style.display = "block";
    } else {
        previewArea.style.display = "none";
        applyBtn.style.display = "none";
    }
}

// دکمه تایید نهایی
document.getElementById('applyBtn').addEventListener('click', async () => {
    document.getElementById('status').innerText = "در حال ایجاد نسخه پشتیبان و اعمال تغییرات...";

    try {
        // ایجاد بک‌آپ مستقیم در اسکریپت زنده پاپ‌آپ قبل از تغییرات
        const allTabs = await browser.tabs.query({ currentWindow: true });
        const backupData = allTabs.map(t => ({ title: t.title, url: t.url, pinned: t.pinned }));
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // ارسال سیگنال اجرای نهایی به بک‌گراند
        const response = await browser.runtime.sendMessage({ action: "applyGroups" });

        if (response && response.success) {
            document.getElementById('status').innerText = "تمام تب‌ها با موفقیت در بک‌گراند مرتب شدند! 🎉";
            document.getElementById('previewArea').style.display = "none";
            document.getElementById('applyBtn').style.display = "none";
            await browser.runtime.sendMessage({ action: "clearState" });
        } else {
            document.getElementById('status').innerText = "خطا در اعمال تغییرات بک‌گراند.";
        }
    } catch (err) {
        console.error(err);
        document.getElementById('status').innerText = "خطا در زمان بک‌آپ یا شروع عملیات.";
    }
});