let appState = {
    isAnalyzing: false,
    computedGroups: null,
    eligibleTabs: [],
    statusText: "",
    existingGroupNames: []
};

const delay = ms => new Promise(res => setTimeout(res, ms));

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getState") {
        sendResponse(appState);
    }
    else if (message.action === "startAnalysis") {
        runAnalysis(message.settings);
        sendResponse({ success: true });
    }
    else if (message.action === "applyGroups") {
        executeGrouping().then(res => sendResponse(res));
        return true;
    }
    else if (message.action === "clearState") {
        appState.computedGroups = null;
        appState.eligibleTabs = [];
        appState.statusText = "";
        appState.existingGroupNames = [];
        sendResponse({ success: true });
    }
    return true;
});

async function runAnalysis(settings) {
    appState.isAnalyzing = true;
    appState.computedGroups = null;
    appState.statusText = "در حال آنالیز گروه‌ها و ارسال به AI...";

    try {
        let tabs = await browser.tabs.query({ currentWindow: true });

        // استخراج گروه های فعلی
        let existingGroupsMap = {};
        appState.existingGroupNames = [];
        try {
            const groups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT });
            for (const g of groups) {
                existingGroupsMap[g.id] = { title: g.title, tabs: [] };
                if (g.title) appState.existingGroupNames.push(g.title);
            }
        } catch (e) { }

        tabs.forEach(t => {
            if (t.groupId !== -1 && existingGroupsMap[t.groupId]) {
                let domain = "";
                try { domain = new URL(t.url).hostname; } catch (e) { }
                existingGroupsMap[t.groupId].tabs.push({ title: t.title, domain: domain });
            }
        });

        let eligibleTabs = tabs.filter(t => !t.pinned && t.groupId === -1);
        if (eligibleTabs.length === 0) {
            appState.statusText = "noUngrouped";
            appState.isAnalyzing = false;
            return;
        }

        if (settings.tabLimit !== "all") {
            const limit = parseInt(settings.tabLimit, 10);
            eligibleTabs = eligibleTabs.slice(0, limit);
        }

        appState.eligibleTabs = eligibleTabs;

        const tabListData = eligibleTabs.map(t => {
            let domain = "";
            try { domain = new URL(t.url).hostname; } catch (e) { }
            return { id: t.id, title: t.title, url: t.url, domain: domain, tabOrderIndex: t.index };
        });

        // پرامپت انگلیسی ساده‌تر و تفکیک شده‌تر برای درک بهتر AI
        const prompt = `You are a professional browser tab manager. Your task is to categorize unassigned tabs.

[CURRENT EXISTING GROUPS IN BROWSER]
${JSON.stringify(Object.values(existingGroupsMap), null, 2)}

[INSTRUCTIONS]
1. Analyze the unassigned tabs below using their 'title', 'domain', and 'tabOrderIndex'.
2. Sequential tabs (close 'tabOrderIndex') usually belong together.
3. If a tab fits the topic of an existing group above, you MUST use that exact group name as the key.
4. If it doesn't fit, create a new meaningful category name (e.g., "Web Development", "Gaming Downloads", "Music & Focus").

[UNASSIGNED TABS TO CATEGORIZE]
${JSON.stringify(tabListData, null, 2)}`;

        // بدنه درخواست به همراه ساختار اجباری JSON Schema
        const requestBody = {
            model: settings.modelName,
            messages: [{ role: "user", content: prompt }],
            response_format: {
                type: "json_object",
                schema: {
                    type: "object",
                    additionalProperties: {
                        type: "array",
                        items: { type: "integer" }
                    }
                }
            }
        };

        const response = await fetch(`${settings.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.apiKey}` },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const result = await response.json();
        let aiTextResponse = result.choices[0].message.content.trim();

        if (aiTextResponse.startsWith("```")) {
            aiTextResponse = aiTextResponse.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
        }

        appState.computedGroups = JSON.parse(aiTextResponse);
        appState.statusText = "analysisDone";
    } catch (error) {
        console.error(error);
        appState.statusText = "aiError";
    } finally {
        appState.isAnalyzing = false;
    }
}

async function executeGrouping() {
    try {
        let existingGroups = [];
        try { existingGroups = await browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT }); } catch (e) { }

        for (const [groupName, tabIds] of Object.entries(appState.computedGroups)) {
            if (!Array.isArray(tabIds) || tabIds.length === 0) continue;
            const numericIds = tabIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
            if (numericIds.length === 0) continue;

            try {
                const matchedGroup = existingGroups.find(g => g.title && g.title.toLowerCase().trim() === groupName.toLowerCase().trim());

                if (matchedGroup) {
                    await browser.tabs.group({ tabIds: numericIds, groupId: matchedGroup.id });
                } else {
                    const newGroupId = await browser.tabs.group({ tabIds: numericIds });
                    await browser.tabGroups.update(newGroupId, { title: groupName });
                    existingGroups.push({ id: newGroupId, title: groupName });
                }
                await delay(150);
            } catch (err) {
                console.error(`Error in group ${groupName}:`, err);
            }
        }
        return { success: true };
    } catch (globalErr) {
        console.error(globalErr);
        return { success: false, error: globalErr.message };
    }
}