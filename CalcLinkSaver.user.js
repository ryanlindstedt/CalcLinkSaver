// ==UserScript==
// @name         CalcLinkSaver
// @namespace    https://github.com/ryanlindstedt
// @version      2026.1.07_001
// @description  Save, manage, and download AWS Calculator estimates with a secure, multi-user AWS backend.
// @author       Ryan Lindstedt
// @match        https://calculator.aws/*
// @updateURL    https://raw.githubusercontent.com/ryanlindstedt/calclinkserver/main/CalcLinkSaver.user.js
// @downloadURL  https://raw.githubusercontent.com/ryanlindstedt/calclinkserver/main/CalcLinkSaver.user.js  
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      amazonaws.com
// @license      GPL-3.0-or-later
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // SCRIPT CONFIGURATION
    // =========================================================================
    const CONFIG_URL_KEY = 'cls_api_gateway_url';
    const CONFIG_API_KEY = 'cls_api_key';

    let API_GATEWAY_URL = GM_getValue(CONFIG_URL_KEY, '');
    let API_KEY = GM_getValue(CONFIG_API_KEY, '');

    function configureCredentials() {
        const newUrl = prompt('Enter your AWS API Gateway URL:', API_GATEWAY_URL);
        if (newUrl !== null) {
            GM_setValue(CONFIG_URL_KEY, newUrl);
            API_GATEWAY_URL = newUrl;
            alert('API Gateway URL saved!');
        }

        const newKey = prompt('Enter your AWS API Key:', API_KEY);
        if (newKey !== null) {
            GM_setValue(CONFIG_API_KEY, newKey);
            API_KEY = newKey;
            alert('API Key saved!');
        }
        location.reload();
    }

    GM_registerMenuCommand('Configure CalcLinkSaver Backend', configureCredentials);

    // =========================================================================
    // SCRIPT CONSTANTS & STATE
    // =========================================================================
    const LOGO_DATA_URI = 'data:image/png;base64,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';
    let useAWSBackend = API_GATEWAY_URL !== '' && API_KEY !== '';
    const STORAGE_KEY = 'aws_saved_estimates';
    let sortState = { column: 'timestamp', direction: 'desc' };


    // =========================================================================
    // STYLING (CSS) - Redesigned to mimic AWS UI
    // =========================================================================
    GM_addStyle(`
    :root {
        --cls-border-color: #e0e0e0;
        --cls-header-bg: #f2f2f2;
        --cls-text-color: #16191f;
        --cls-text-secondary: #545b64;
        --cls-button-primary-bg: #ff9900;
        --cls-button-primary-hover-bg: #fa6f00;
        --cls-button-normal-bg: #ffffff;
        --cls-button-normal-border: #545b64;
        --cls-button-normal-hover-bg: #fafafa;
        --cls-focus-ring: #00a1c9;
        --cls-font-family: "Amazon Ember", "Helvetica Neue", Roboto, Arial, sans-serif;
        --cls-danger-hover-bg: #d13212;
        --cls-danger-hover-border: #d13212;
    }

    /* --- General Font Style --- */
    .cls-modal-content, .cls-fab, .cls-popup-notification {
        font-family: var(--cls-font-family);
    }

    /* --- Pop-up Notification --- */
    .cls-popup-notification {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background-color: rgba(35, 47, 62, 0.95); color: #ffffff; padding: 40px 60px; border-radius: 4px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 100001; font-size: 24px; font-weight: bold;
        opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; transform: translate(-50%, -60%);
    }
    .cls-popup-notification.show { opacity: 1; transform: translate(-50%, -50%); }

    /* --- Main Button --- */
    .cls-fab {
        position: fixed; bottom: 4px; right: 95px;
        background-color: var(--cls-button-primary-bg); color: #000;
        width: auto; height: 33px;
        padding: 8px 15px;
        border: none;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        font-size: 14px;
        font-weight: bold;
        display: flex;
		align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 99998;
        transition: background-color 0.2s ease;
    }
    .cls-fab:hover { background-color: var(--cls-button-primary-hover-bg); }

    /* --- Main Modal --- */
    .cls-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.7); z-index: 100000;
        display: none; align-items: center; justify-content: center;
    }
    .cls-modal-overlay.visible { display: flex; }
    .cls-modal-content {
        background-color: #ffffff; color: var(--cls-text-color); border-radius: 4px;
        width: 90%; max-width: 1200px; max-height: 90vh;
        display: flex; flex-direction: column; box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }
     .cls-modal-header {
        display: flex; justify-content: space-between; align-items: center; padding: 20px 24px;
    }
    .cls-header-title-with-logo {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    #cls-logo {
        height: 50px;
    }
    .cls-modal-header h2 { margin: 0; font-size: 43px; font-weight: 700; }
    .cls-modal-close {
        font-size: 28px; font-weight: bold; line-height: 1; cursor: pointer;
        border: none; background: none; color: #545b64;
    }

    .cls-modal-description {
        padding: 0 24px 16px;
        color: var(--cls-text-secondary);
        font-size: 14px;
    }

    .cls-table-container {
        border: 1px solid var(--cls-border-color);
        margin: 0 24px;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-height: 0;
    }
    .cls-table-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px; background-color: var(--cls-header-bg);
        border-bottom: 1px solid var(--cls-border-color);
        border-radius: 4px 4px 0 0;
    }
    .cls-table-title {
        font-size: 18px; font-weight: 700; color: var(--cls-text-color); margin: 0;
    }
    .cls-header-actions { display: flex; gap: 8px; }
    .cls-button {
        font-family: var(--cls-font-family); font-size: 14px; font-weight: 700;
        padding: 6px 16px; border: 1px solid; border-radius: 2px; cursor: pointer;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .cls-button-normal {
        background-color: var(--cls-button-normal-bg); border-color: var(--cls-button-normal-border); color: var(--cls-text-secondary);
    }
    .cls-button-normal:hover { background-color: var(--cls-button-normal-hover-bg); }
    #cls-delete-selected:hover:not(:disabled) {
        background-color: var(--cls-danger-hover-bg);
        border-color: var(--cls-danger-hover-border);
        color: #ffffff;
    }
    .cls-button-primary {
        background-color: var(--cls-button-primary-bg); border-color: var(--cls-button-primary-bg); color: #000;
    }
    .cls-button-primary:hover { background-color: var(--cls-button-primary-hover-bg); }
    .cls-button:disabled {
        background-color: #fafafa; border-color: #d1d5db; color: #9ca3af; cursor: not-allowed;
    }

    .cls-modal-body { overflow-y: auto; flex-grow: 1; }
    .cls-links-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .cls-links-table th, .cls-links-table td {
        padding: 10px 5px; text-align: left; border-bottom: 1px solid var(--cls-border-color);
        word-wrap: break-word; font-size: 14px;
    }
    .cls-links-table tr:last-child td { border-bottom: none; }
    .cls-links-table th {
        font-weight: bold; background-color: var(--cls-header-bg); color: var(--cls-text-secondary);
    }
    .cls-links-table th.cls-sortable { cursor: pointer; position: relative; padding-right: 24px; }

    .cls-sort-indicator {
        position: absolute; top: 50%; right: 8px; transform: translateY(-50%);
        width: 10px; height: 12px;
    }
    .cls-sort-indicator::before, .cls-sort-indicator::after {
        content: ''; position: absolute; width: 0; height: 0;
        border-left: 5px solid transparent; border-right: 5px solid transparent; left: 0; opacity: 0.3;
    }
    .cls-sort-indicator::before { top: 0; border-bottom: 5px solid var(--cls-text-secondary); }
    .cls-sort-indicator::after { bottom: 0; border-top: 5px solid var(--cls-text-secondary); }
    th.cls-sorted-asc .cls-sort-indicator::before, th.cls-sorted-desc .cls-sort-indicator::after { opacity: 1; }
    th.cls-sorted-asc .cls-sort-indicator::before { border-bottom-color: var(--cls-text-color); }
    th.cls-sorted-desc .cls-sort-indicator::after { border-top-color: var(--cls-text-color); }

    .cls-col-select { width: 45px; cursor: pointer; }
    .cls-col-name { width: 250px; }
    .cls-col-owner { width: 80px; }
    .cls-col-cost { width: 115px; }
    .cls-col-timestamp { width: 150px; }
    .cls-col-actions { width: 100px; text-align: right !important; }

    .cls-checkbox-container { display: flex; align-items: center; justify-content: center; }
    .cls-checkbox-container input[type="checkbox"] { display: none; }
    .cls-checkbox-container label {
        cursor: pointer; display: inline-block; width: 16px; height: 16px;
        background-color: #fff; border: 1px solid #879596; border-radius: 3px; position: relative;
    }
    .cls-checkbox-container input[type="checkbox"]:checked + label { background-color: #0073bb; border-color: #0073bb; }
    .cls-checkbox-container input[type="checkbox"]:checked + label:after {
        content: ''; position: absolute; left: 5px; top: 1px; width: 4px; height: 8px;
        border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg);
    }
    .cls-checkbox-container input[type="checkbox"]:focus + label { box-shadow: 0 0 0 2px var(--cls-focus-ring); }

    .cls-actions { display: flex; align-items: center; gap: 15px; justify-content: flex-end; }
    .cls-action-btn { background: none; border: none; cursor: pointer; padding: 0; line-height: 1; color: var(--cls-text-secondary); text-decoration: none; transition: transform 0.2s ease; }
    .cls-action-btn:hover { transform: scale(1.2); }
    .cls-action-btn svg { width: 18px; height: 18px; vertical-align: middle; fill: currentColor; }

    .cls-modal-footer {
        padding: 16px 24px; border-top: 1px solid var(--cls-border-color); text-align: center;
        font-size: 12px; color: var(--cls-text-secondary); flex-shrink: 0;
    }
    `);

    // =========================================================================
    // DATA HANDLING LOGIC
    // =========================================================================
    const dataHandler = {
        getLinks: () => new Promise((resolve, reject) => {
            if (useAWSBackend) {
                GM_xmlhttpRequest({
                    method: 'GET', url: API_GATEWAY_URL, headers: { 'x-api-key': API_KEY },
                    onload: (res) => (res.status >= 200 && res.status < 300) ? resolve(JSON.parse(res.responseText)) : reject(res),
                    onerror: (err) => { console.error('AWS Backend Error (GET):', err); alert('Error: Could not fetch links.'); reject(err); }
                });
            } else { resolve(GM_getValue(STORAGE_KEY, [])); }
        }),
        saveLink: (newLink) => new Promise(async (resolve, reject) => {
            if (useAWSBackend) {
                GM_xmlhttpRequest({
                    method: 'POST', url: API_GATEWAY_URL, headers: { 'Content-Type': 'application/internet-shortcut', 'x-api-key': API_KEY },
                    data: JSON.stringify(newLink),
                    onload: (res) => (res.status >= 200 && res.status < 300) ? resolve() : reject(res),
                    onerror: (err) => { console.error('AWS Backend Error (POST):', err); alert('Error: Could not save link.'); reject(err); }
                });
            } else {
                const links = await GM_getValue(STORAGE_KEY, []);
                links.push(newLink);
                await GM_setValue(STORAGE_KEY, links);
                resolve();
            }
        }),
        deleteLink: (id) => new Promise(async (resolve, reject) => {
            if (useAWSBackend) {
                GM_xmlhttpRequest({
                    method: 'DELETE', url: `${API_GATEWAY_URL}/${id}`, headers: { 'x-api-key': API_KEY },
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) { resolve(); }
                        else {
                            let errorMsg = 'Could not delete link.';
                            try { errorMsg = JSON.parse(res.responseText).error || errorMsg; } catch(e){}
                            alert('Error: ' + errorMsg); reject(res);
                        }
                    },
                    onerror: (err) => { console.error('AWS Backend Error (DELETE):', err); alert('Error: Could not delete link from backend.'); reject(err); }
                });
            } else {
                let links = await GM_getValue(STORAGE_KEY, []);
                links = links.filter(link => link.id !== id);
                await GM_setValue(STORAGE_KEY, links);
                resolve();
            }
        }),
    };

    // =========================================================================
    // UI COMPONENTS & LOGIC
    // =========================================================================
    function showPopupNotification(message) {
        const popup = document.createElement('div');
        popup.className = 'cls-popup-notification';
        popup.textContent = message;
        document.body.appendChild(popup);
        setTimeout(() => popup.classList.add('show'), 10);
        setTimeout(() => {
            popup.classList.remove('show');
            popup.addEventListener('transitionend', () => popup.remove());
        }, 2500);
    }

    function initializeUI() {
        const fab = document.createElement('button');
        fab.className = 'cls-fab';
        fab.textContent = 'CalcLinkSaver';
        fab.title = 'View Saved Estimates';
        document.body.appendChild(fab);

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'cls-modal-overlay';
        modalOverlay.innerHTML = `
        <div class="cls-modal-content">
            <div class="cls-modal-header">
                <div class="cls-header-title-with-logo">
                    <img id="cls-logo" src="${LOGO_DATA_URI}" alt="CalcLinkSaver Logo">
                    <h2>CalcLinkSaver</h2>
                </div>
                <button class="cls-modal-close" title="Close">&times;</button>
            </div>
            <div class="cls-modal-description">
                Manage and export your saved AWS Calculator estimates.
            </div>
            <div class="cls-table-container">
                 <div class="cls-table-header">
                    <h3 class="cls-table-title">Saved Estimates</h3>
                    <div class="cls-header-actions">
                        <button class="cls-button cls-button-normal" id="cls-delete-selected" title="Delete selected estimates" disabled>Delete</button>
                        <button class="cls-button cls-button-primary" id="cls-download-csv" title="Export selected as CSV" disabled>Export CSV</button>
                    </div>
                </div>
                <div class="cls-modal-body">
                    <table class="cls-links-table">
                        <thead>
                            <tr>
                                <th class="cls-col-select">
                                    <div class="cls-checkbox-container">
                                        <input type="checkbox" id="cls-select-all"><label for="cls-select-all" title="Select all"></label>
                                    </div>
                                </th>
                                <th class="cls-col-name cls-sortable" data-sort-key="name">Name<span class="cls-sort-indicator"></span></th>
                                <th class="cls-col-owner cls-sortable" data-sort-key="ownerName">Owner<span class="cls-sort-indicator"></span></th>
                                <th class="cls-col-cost cls-sortable" data-sort-key="annualCost">Annual Cost<span class="cls-sort-indicator"></span></th>
                                <th class="cls-col-timestamp cls-sortable" data-sort-key="timestamp">Timestamp<span class="cls-sort-indicator"></span></th>
                                <th class="cls-col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                    <p class="cls-no-links-msg" style="display:none; text-align:center; padding: 40px 0;">No saved estimates yet.</p>
                </div>
            </div>
            <div class="cls-modal-footer">
                 <span class="cls-backend-status">Mode: ${useAWSBackend ? 'AWS Backend (Multi-User)' : 'Local Storage (Single User)'}</span>
            </div>
        </div>`;
        document.body.appendChild(modalOverlay);

        fab.addEventListener('click', showModal);
        modalOverlay.querySelector('.cls-modal-close').addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });
        modalOverlay.querySelector('#cls-download-csv').addEventListener('click', handleDownloadCsv);
        modalOverlay.querySelector('#cls-delete-selected').addEventListener('click', handleDeleteSelected);
        modalOverlay.querySelector('#cls-select-all').addEventListener('change', handleSelectAll);
        modalOverlay.querySelector('.cls-links-table thead').addEventListener('click', handleSort);
        modalOverlay.querySelector('.cls-links-table tbody').addEventListener('click', handleTableClick);
        modalOverlay.querySelector('.cls-links-table tbody').addEventListener('change', updateButtonStates);

        document.addEventListener('keydown', (e) => {
            if (e.key === "Escape" && modalOverlay.classList.contains('visible')) hideModal();
        });
    }

    async function handleTableClick(e) {
        const actionBtn = e.target.closest('.cls-action-btn');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (action === 'copy') {
                navigator.clipboard.writeText(actionBtn.dataset.url).then(
                    () => showPopupNotification('✅ URL Copied!'),
                    () => showPopupNotification('❌ Copy Failed')
                );
            } else if (action === 'download') {
                const url = actionBtn.dataset.url;
                const name = actionBtn.dataset.name || 'AWS Estimate';
                const timestamp = actionBtn.dataset.timestamp;

                // Sanitize the name for use in a filename
                const sanitizedName = name.replace(/[\\/:*?"<>|]/g, '_');

                // Create date object from the estimate's timestamp
                const date = new Date(timestamp);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');

                // Format the date string as YYYYMMDD_HHMMSS
                const dateTimeString = `${year}-${month}-${day}_${hours}.${minutes}.${seconds}`;

                // Construct the new filename
                const fileName = `${sanitizedName} - ${dateTimeString}.url.txt`;

                const fileContent = `[InternetShortcut]\r\nURL=${url}\r\n`;
                const blob = new Blob([fileContent], { type: 'text/plain' });
                const objectUrl = URL.createObjectURL(blob);

                const linkElement = document.createElement("a");
                linkElement.setAttribute("href", objectUrl);
                linkElement.setAttribute("download", fileName);
                document.body.appendChild(linkElement);

                linkElement.click();

                // Delay the cleanup to ensure the download has time to start
                setTimeout(() => {
                    document.body.removeChild(linkElement);
                    URL.revokeObjectURL(objectUrl);
                }, 100);
            }
            return;
        }

        const checkboxCell = e.target.closest('td.cls-col-select');
        if (checkboxCell) {
             if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
                const checkbox = checkboxCell.querySelector('.cls-row-select');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    async function renderLinksTable() {
        const modal = document.querySelector('.cls-modal-overlay');
        const tableBody = modal.querySelector('.cls-links-table tbody');
        const noLinksMsg = modal.querySelector('.cls-no-links-msg');

        try {
            let links = await dataHandler.getLinks();
            tableBody.innerHTML = '';
            noLinksMsg.style.display = links.length > 0 ? 'none' : 'block';

            if (links.length > 0) {
                links.sort((a, b) => {
                    const key = sortState.column;
                    let valA = a[key] || '';
                    let valB = b[key] || '';

                    if (key === 'annualCost') {
                        valA = parseFloat(valA.replace(/[^\d.-]/g, '')) || 0;
                        valB = parseFloat(valB.replace(/[^\d.-]/g, '')) || 0;
                    } else if (key === 'timestamp') {
                        valA = new Date(valA).getTime() || 0;
                        valB = new Date(valB).getTime() || 0;
                    } else {
                        valA = valA.toLowerCase();
                        valB = valB.toLowerCase();
                    }

                    if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
                    if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
                    return 0;
                });

                links.forEach(linkObj => {
                    const row = tableBody.insertRow();
                    const safeName = (linkObj.name || 'Untitled').replace(/"/g, '&quot;');
                    row.innerHTML = `
                    <td class="cls-col-select">
                        <div class="cls-checkbox-container">
                             <input type="checkbox" id="select-${linkObj.estimateId}" data-id="${linkObj.estimateId}" class="cls-row-select">
                             <label for="select-${linkObj.estimateId}"></label>
                        </div>
                    </td>
                    <td class="cls-col-name">${linkObj.name}</td>
                    <td class="cls-col-owner">${linkObj.ownerName || 'N/A'}</td>
                    <td class="cls-col-cost">${linkObj.annualCost || 'N/A'}</td>
                    <td class="cls-col-timestamp">${new Date(linkObj.timestamp).toLocaleString()}</td>
                    <td class="cls-col-actions">
                        <div class="cls-actions">
                           <button class="cls-action-btn" data-action="copy" data-url="${linkObj.url}" title="Copy URL">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                            </button>
                            <button class="cls-action-btn" data-action="download" data-url="${linkObj.url}" data-name="${safeName}" data-timestamp="${linkObj.timestamp}" title="Download as .url shortcut">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </button>
                            <a href="${linkObj.url}" target="_blank" rel="noopener noreferrer" class="cls-action-btn" title="Open Link">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                            </a>
                        </div>
                    </td>`;
                });
            }
        } catch (error) {
            console.error("Failed to load estimates:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Failed to load estimates. Check API Key/URL.</td></tr>`;
        }
        updateButtonStates();
        updateSortIcons();
    }

    function handleSort(e) {
        const th = e.target.closest('th.cls-sortable');
        if (!th) return;
        const key = th.dataset.sortKey;
        if (sortState.column === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.column = key;
            sortState.direction = key === 'timestamp' ? 'desc' : 'asc';
        }
        renderLinksTable();
    }

    function updateSortIcons() {
        document.querySelectorAll('th.cls-sortable').forEach(th => {
            th.classList.remove('cls-sorted-asc', 'cls-sorted-desc');
            if (th.dataset.sortKey === sortState.column) {
                th.classList.add(sortState.direction === 'asc' ? 'cls-sorted-asc' : 'cls-sorted-desc');
            }
        });
    }

    function showModal() {
        renderLinksTable();
        document.querySelector('.cls-modal-overlay').classList.add('visible');
    }

    function hideModal() {
        document.querySelector('.cls-modal-overlay').classList.remove('visible');
    }

    function getSelectedLinks() {
        const modal = document.querySelector('.cls-modal-overlay');
        return Array.from(modal.querySelectorAll('.cls-row-select:checked')).map(cb => cb.dataset.id);
    }

    function updateButtonStates() {
        const selectedCount = getSelectedLinks().length;
        const deleteBtn = document.getElementById('cls-delete-selected');
        const downloadBtn = document.getElementById('cls-download-csv');
        deleteBtn.disabled = selectedCount === 0;
        downloadBtn.disabled = selectedCount === 0;
    }

    function handleSelectAll(e) {
        document.querySelectorAll('.cls-row-select').forEach(cb => cb.checked = e.target.checked);
        updateButtonStates();
    }

    async function handleDeleteSelected() {
        const selectedIds = getSelectedLinks();
        if (selectedIds.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} estimate(s)?`)) {
            try {
                await Promise.all(selectedIds.map(id => dataHandler.deleteLink(id)));
                showPopupNotification(`✅ ${selectedIds.length} estimate(s) deleted.`);
                await renderLinksTable();
            } catch { showPopupNotification('❌ Delete operation failed.'); }
        }
    }

    async function handleDownloadCsv() {
        const selectedIds = getSelectedLinks();
        if (selectedIds.length === 0) { showPopupNotification('ℹ️ No items selected.'); return; }
        const allLinks = await dataHandler.getLinks();
        const linksToExport = allLinks.filter(link => selectedIds.includes(link.estimateId));
        let csvContent = "Name,Owner,Annual Cost,Timestamp,URL\n";
        linksToExport.forEach(link => {
            const name = `"${(link.name || '').replace(/"/g, '""')}"`;
            const owner = `"${(link.ownerName || 'N/A').replace(/"/g, '""')}"`;
            const annualCost = `"${(link.annualCost || 'N/A').replace(/"/g, '""')}"`;
            const timestamp = `"${new Date(link.timestamp).toLocaleString()}"`;
            csvContent += `${name},${owner},${annualCost},${timestamp},${link.url}\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const linkElement = document.createElement("a");
        const url = URL.createObjectURL(blob);
        linkElement.setAttribute("href", url);
        linkElement.setAttribute("download", "aws_selected_estimates.csv");
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        URL.revokeObjectURL(url);
    }

    // =========================================================================
    // AWS PAGE INTERACTION
    // =========================================================================
    async function handleCopyButtonClick(e) {
        const wrapper = e.target.closest('.save-share-clipboard-wrapper');
        const input = wrapper?.querySelector('input[type="text"][readonly]');
        if (!input || !input.value) return;

        const url = input.value;
        const links = await dataHandler.getLinks();
        if (links.some(link => link.url === url)) { showPopupNotification('ℹ️ Link Already Saved'); return; }

        const nameElement = document.querySelector('h1[class*="awsui_h1-variant"]');
        const name = nameElement ? nameElement.textContent.trim() : "Untitled Estimate";
        const costElement = document.querySelector('div.price-banner-amount-bold[data-annual-cost="true"]');
        const annualCost = costElement ? costElement.textContent.trim() : 'N/A';
        const newLink = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: name, url: url, timestamp: new Date().toISOString(), annualCost: annualCost
        };
        try {
            await dataHandler.saveLink(newLink);
            showPopupNotification('✅ Estimate Saved!');
        } catch (error) { showPopupNotification('❌ Save Failed!'); }
    }

    function attachListenerToCopyButton(targetNode) {
        const copyButton = targetNode.querySelector('.save-share-clipboard-wrapper .clipboard-button');
        if (copyButton && !copyButton.dataset.cls2ListenerAttached) {
            copyButton.addEventListener('click', handleCopyButtonClick);
            copyButton.dataset.cls2ListenerAttached = 'true';
        }
    }

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const button = (node.matches && node.matches('.save-share-clipboard-wrapper')) ?
                            node.querySelector('.clipboard-button') :
                            node.querySelector('.save-share-clipboard-wrapper .clipboard-button');
                        if (button) attachListenerToCopyButton(node);
                    }
                });
            }
        }
    });

    // =========================================================================
    // SCRIPT INITIALIZATION
    // =========================================================================
    function main() {
        if (!API_GATEWAY_URL || !API_KEY) {
            console.log("CalcLinkSaver: No API Gateway URL or Key configured. Running in local-only mode.");
        }
        initializeUI();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    main();

})();