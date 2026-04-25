import { pipeline, env, cos_sim } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// Configure transformers
env.allowLocalModels = false;

// --- IndexedDB Wrapper ---
const DB_NAME = 'LinkBrainDB';
const DB_VERSION = 1;
const STORE_NAME = 'links';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function getAllLinksDB() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function saveLinkToDB(link) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(link);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteLinkFromDB(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const splashScreen = document.getElementById('splashScreen');
    const searchInput = document.getElementById('searchInput');
    const btnVoiceSearch = document.getElementById('btnVoiceSearch');
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const importFile = document.getElementById('importFile');
    const linksContainer = document.getElementById('linksContainer');
    const emptyState = document.getElementById('emptyState');
    const fabAdd = document.getElementById('fabAdd');
    const aiStatus = document.getElementById('aiStatus');
    const domainChipsContainer = document.getElementById('domainChips');
    
    // Modal Elements
    const addModalOverlay = document.getElementById('addModalOverlay');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const addLinkForm = document.getElementById('addLinkForm');
    const linkUrlInput = document.getElementById('linkUrl');
    const linkNoteInput = document.getElementById('linkNote');
    const btnVoiceNote = document.getElementById('btnVoiceNote');
    const metadataPreview = document.getElementById('metadataPreview');
    const btnSave = document.getElementById('btnSave');
    
    // Snackbar Elements
    const snackbar = document.getElementById('snackbar');
    const snackbarText = document.getElementById('snackbarText');
    const btnUndo = document.getElementById('btnUndo');
    
    // --- Splash Screen Logic ---
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add('hidden');
                setTimeout(() => splashScreen.remove(), 500); // Cleanup DOM
            }
        }, 1500); // 1.5 second artificial delay for the premium native feel
    });
    
    // Voice Feedback
    const voiceFeedback = document.getElementById('voiceFeedback');
    const voiceFeedbackText = document.getElementById('voiceFeedbackText');

    let links = [];
    let activeChip = '';
    let currentEditId = null;
    let lastDeletedLink = null;
    let undoTimeout = null;

    // --- Data Initialization & Migration ---
    try {
        links = await getAllLinksDB();

        // Migrate from LocalStorage if IndexedDB is empty
        const oldLinksJson = localStorage.getItem('linkBrain_data');
        if (links.length === 0 && oldLinksJson) {
            const oldLinks = JSON.parse(oldLinksJson);
            for (const l of oldLinks) {
                await saveLinkToDB(l);
                links.push(l);
            }
            localStorage.removeItem('linkBrain_data');
        }

        // --- Inject 20 New Seed Links from User ---
        const extraSeeds = [
            { url: "https://github.com/enescingoz/awesome-n8n-templates", title: "Awesome n8n Templates", description: "Curated list of awesome n8n templates.", note: "Automation workflows" },
            { url: "https://github.com/ethanplusai/jarvis", title: "Jarvis AI", description: "Personal AI assistant inspired by Iron Man.", note: "Jarvis assistant" },
            { url: "https://github.com/ethanplusai/govspending", title: "Gov Spending", description: "Track government spending data.", note: "Government spending tracker" },
            { url: "https://github.com/ethanplusai/manifestapp", title: "Manifest App", description: "Manifestation and goal tracking.", note: "Goal tracking app" },
            { url: "https://github.com/ethanplusai/samantha-cli", title: "Samantha CLI", description: "CLI AI Assistant.", note: "Samantha AI CLI" },
            { url: "https://snsct-mba-batch-2024-26.vercel.app/", title: "SNSCT MBA Batch", description: "MBA Batch 2024-26 Website.", note: "College batch website" },
            { url: "https://lnkd.in/eqisiW-j", title: "LinkedIn Carousel", description: "LinkedIn post or carousel.", note: "LinkedIn Carousel post" },
            { url: "https://github.com/0xramm/Indian-Stock-Market-API", title: "Indian Stock Market API", description: "API for Indian Stock Market.", note: "Stock market API" },
            { url: "https://iptv-org.github.io/iptv/index.m3u", title: "IPTV Playlist", description: "Free IPTV M3U playlist.", note: "Live TV M3U playlist" },
            { url: "https://github.com/MohamedxFawzi?tab=repositories", title: "Mohamed Fawzi GitHub", description: "MohamedxFawzi Repositories.", note: "GitHub profile and repos" },
            { url: "https://69a4383876b3d9095015a2e3--cozy-cheesecake-b9cd1f.netlify.app/", title: "Cozy Cheesecake App", description: "Netlify deployed application.", note: "Web app preview" },
            { url: "https://www.notion.so/How-I-created-a-Nike-style-commercial-website-for-free-Step-by-Step-Guide-30c0d2ba3ca0805a9932e5a445014957", title: "Nike Style Website Guide", description: "Notion guide to creating a Nike style site.", note: "Web dev tutorial Notion" },
            { url: "https://www.mathintlprotfolio.dev/#about", title: "Mathintl Portfolio", description: "Developer portfolio.", note: "Portfolio reference" },
            { url: "https://github.com/AbdulMoqueet/abdulmoqueet.github.io", title: "Abdul Moqueet Portfolio", description: "GitHub Pages portfolio.", note: "Portfolio reference" },
            { url: "https://github.com/toukoum/portfolio", title: "Toukoum Portfolio", description: "Portfolio repository.", note: "Portfolio reference" },
            { url: "https://github.com/codebucks27/Next.js-Creative-Portfolio-Website", title: "Next.js Creative Portfolio", description: "Next.js portfolio template.", note: "NextJS template reference" },
            { url: "https://www.wallofportfolios.in/portfolios/rushabh-gouda/", title: "Rushabh Gouda Portfolio", description: "Wall of Portfolios entry.", note: "Portfolio reference" },
            { url: "https://github.com/Lucas98Fernando", title: "Lucas Fernando GitHub", description: "GitHub Profile.", note: "GitHub profile" },
            { url: "https://youtu.be/NCXYlZ-oAY0", title: "YouTube Video 1", description: "YouTube tutorial or showcase.", note: "YouTube reference" },
            { url: "https://youtu.be/TWzMV5brRkE", title: "YouTube Video 2", description: "YouTube tutorial or showcase.", note: "YouTube reference" }
        ];

        for (let i = 0; i < extraSeeds.length; i++) {
            const seed = extraSeeds[i];
            if (!links.some(l => l.url === seed.url)) {
                const newLink = {
                    id: 'seed_' + Date.now().toString() + i,
                    url: seed.url,
                    note: seed.note,
                    title: seed.title,
                    description: seed.description,
                    timestamp: Date.now() - (i * 1000)
                };
                await saveLinkToDB(newLink);
                links.push(newLink);
            }
        }
    } catch (e) {
        console.error("Failed to load IndexedDB", e);
    }
    
    // --- Theme Toggle Logic ---
    let isDarkMode = localStorage.getItem('theme') === 'dark';
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if(btnThemeToggle) btnThemeToggle.querySelector('span').textContent = 'light_mode';
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            if (isDarkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
                btnThemeToggle.querySelector('span').textContent = 'light_mode';
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                btnThemeToggle.querySelector('span').textContent = 'dark_mode';
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // --- Export Backup Logic ---
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            let yPos = 20;
            
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("Link Brain - Data Backup", 20, yPos);
            yPos += 15;
            
            links.forEach((link, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                const title = doc.splitTextToSize(`${index + 1}. ${link.title || link.url}`, 170);
                doc.text(title, 20, yPos);
                yPos += (6 * title.length);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(26, 115, 232); // Link Blue
                const urlStr = doc.splitTextToSize(`URL: ${link.url}`, 165);
                doc.text(urlStr, 25, yPos);
                yPos += (5 * urlStr.length);
                
                doc.setTextColor(100, 100, 100); // Gray
                if (link.description) {
                    const descStr = doc.splitTextToSize(`Desc: ${link.description}`, 165);
                    doc.text(descStr, 25, yPos);
                    yPos += (5 * descStr.length);
                }
                
                if (link.note) {
                    doc.setTextColor(0, 0, 0); // Black
                    doc.setFont("helvetica", "bold");
                    const noteStr = doc.splitTextToSize(`My Note: ${link.note}`, 165);
                    doc.text(noteStr, 25, yPos);
                    yPos += (5 * noteStr.length);
                }
                
                doc.setTextColor(0, 0, 0);
                yPos += 6; // Spacing between links
            });
            
            doc.save(`LinkBrain_Backup_${new Date().toISOString().split('T')[0]}.pdf`);
            
            // Generate JSON Data File for Importing
            setTimeout(() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(links, null, 2));
                const dlAnchorElem = document.createElement('a');
                dlAnchorElem.setAttribute("href", dataStr);
                dlAnchorElem.setAttribute("download", `LinkBrain_Data_${new Date().toISOString().split('T')[0]}.json`);
                document.body.appendChild(dlAnchorElem);
                dlAnchorElem.click();
                document.body.removeChild(dlAnchorElem);
            }, 500);
        });
    }

    // --- Import Backup Logic ---
    if (btnImport && importFile) {
        btnImport.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedLinks = JSON.parse(event.target.result);
                    if (!Array.isArray(importedLinks)) throw new Error("Invalid format");
                    
                    let count = 0;
                    for (const link of importedLinks) {
                        // Prevent duplicates by checking ID or URL
                        if (!links.some(l => l.id === link.id || l.url === link.url)) {
                            await saveLinkToDB(link);
                            links.push(link);
                            count++;
                        }
                    }
                    if (count > 0) {
                        renderChips();
                        renderLinks(searchInput.value);
                        alert(`Success! Imported ${count} new links.`);
                    } else {
                        alert("No new links found to import. They are already in your database.");
                    }
                } catch (err) {
                    alert("Error importing data. Please make sure you selected a valid LinkBrain .json file.");
                    console.error(err);
                }
                importFile.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    // --- AI Engine Initialization ---
    let extractor = null;
    let isAiReady = false;

    aiStatus.style.display = 'block';
    
    setTimeout(async () => {
        try {
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            aiStatus.style.background = '#e6f4ea';
            aiStatus.style.color = '#137333';
            aiStatus.textContent = 'AI Brain Ready!';
            
            let updated = false;
            for (let i = 0; i < links.length; i++) {
                if (!links[i].embedding) {
                    aiStatus.textContent = `Analyzing link ${i+1}/${links.length}...`;
                    const textToEmbed = `${links[i].title || ''} ${links[i].description || ''} ${links[i].note || ''}`;
                    const out = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
                    links[i].embedding = Array.from(out.data);
                    await saveLinkToDB(links[i]);
                    updated = true;
                }
            }
            if (updated) renderChips();
            
            isAiReady = true;
            setTimeout(() => { aiStatus.style.display = 'none'; }, 2000);
        } catch (e) {
            console.error("AI Model failed to load:", e);
            aiStatus.style.background = '#fce8e6';
            aiStatus.style.color = '#c5221f';
            aiStatus.textContent = 'AI Offline. Using normal search.';
        }
    }, 100);

    // --- UI Render Functions ---
    function renderChips() {
        const domainCounts = {};
        links.forEach(l => {
            const d = getDomain(l.url);
            domainCounts[d] = (domainCounts[d] || 0) + 1;
        });

        const uniqueDomains = Object.keys(domainCounts).sort((a,b) => domainCounts[b] - domainCounts[a]);

        domainChipsContainer.innerHTML = '';
        if (uniqueDomains.length <= 1) {
            domainChipsContainer.style.display = 'none';
            return;
        }
        
        domainChipsContainer.style.display = 'flex';
        
        uniqueDomains.forEach(domain => {
            const btn = document.createElement('button');
            btn.className = `chip ${activeChip === domain ? 'active' : ''}`;
            btn.textContent = domain;
            btn.addEventListener('click', () => {
                if (activeChip === domain) activeChip = ''; 
                else activeChip = domain;
                renderChips(); 
                renderLinks(searchInput.value);
            });
            domainChipsContainer.appendChild(btn);
        });
    }

    async function renderLinks(filterQuery = '') {
        linksContainer.innerHTML = '';
        let displayLinks = [...links];

        if (activeChip) {
            displayLinks = displayLinks.filter(l => getDomain(l.url) === activeChip);
        }

        if (filterQuery) {
            if (isAiReady && extractor) {
                aiStatus.style.display = 'block';
                aiStatus.style.background = '#e8f0fe';
                aiStatus.style.color = '#1a73e8';
                aiStatus.textContent = 'Thinking...';

                const queryOut = await extractor(filterQuery, { pooling: 'mean', normalize: true });
                const queryVector = Array.from(queryOut.data);

                displayLinks.forEach(link => {
                    if (link.embedding) link.score = cos_sim(queryVector, link.embedding);
                    else link.score = 0;
                });

                displayLinks = displayLinks.filter(l => l.score > 0.2).sort((a, b) => b.score - a.score);
                aiStatus.style.display = 'none';
            } else {
                const q = filterQuery.toLowerCase();
                displayLinks = displayLinks.filter(link => {
                    return (
                        (link.title && link.title.toLowerCase().includes(q)) ||
                        (link.description && link.description.toLowerCase().includes(q)) ||
                        (link.note && link.note.toLowerCase().includes(q))
                    );
                });
            }
        } else {
            displayLinks.sort((a, b) => b.timestamp - a.timestamp);
        }

        if (displayLinks.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = filterQuery ? 'No semantic matches found' : 'No links found';
            emptyState.querySelector('p').textContent = filterQuery ? 'Try asking in a different way.' : 'Tap the + button to save your first link.';
        } else {
            emptyState.classList.add('hidden');
            
            displayLinks.forEach((link, index) => {
                const date = new Date(link.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const domain = getDomain(link.url);
                const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
                
                const card = document.createElement('div');
                card.className = 'link-card';
                card.style.animationDelay = `${index * 0.05}s`; // Staggered animation
                card.innerHTML = `
                    <div class="card-title-wrapper">
                        <div style="display:flex; align-items:center; gap:8px; overflow:hidden; flex:1;">
                            <img src="${faviconUrl}" class="card-favicon" loading="lazy" onerror="this.style.display='none'">
                            <div class="card-title">${highlightText(link.title || domain, filterQuery)}</div>
                        </div>
                        ${link.score ? `<div class="match-score">${Math.round(link.score * 100)}% Match</div>` : ''}
                    </div>
                    ${link.description ? `<div class="card-desc">${highlightText(link.description, filterQuery)}</div>` : ''}
                    ${link.note ? `<div class="card-note">${highlightText(link.note, filterQuery)}</div>` : ''}
                    <div class="card-footer">
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card-url">${escapeHTML(link.url)}</a>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button class="copy-btn" data-url="${link.url}" title="Copy Link">
                                <span class="material-icons-round" style="font-size:16px;">content_copy</span>
                            </button>
                            
                            <button class="edit-btn" data-id="${link.id}" title="Edit Note">
                                <span class="material-icons-round" style="font-size:18px;">edit</span>
                            </button>

                            <button class="delete-btn" data-id="${link.id}" title="Delete">
                                <span class="material-icons-round" style="font-size:18px;">delete_outline</span>
                            </button>
                        </div>
                    </div>
                `;
                linksContainer.appendChild(card);
            });
            
            // Delete Logic
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    const index = links.findIndex(l => l.id === id);
                    if (index > -1) {
                        lastDeletedLink = links[index];
                        await deleteLinkFromDB(id);
                        links.splice(index, 1);
                        renderChips();
                        renderLinks(searchInput.value);
                        showSnackbar("Link deleted");
                    }
                });
            });

            // Edit Logic
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const link = links.find(l => l.id === id);
                    if (link) {
                        currentEditId = id;
                        document.querySelector('.sheet-header h3').textContent = 'Edit Link';
                        openModal(link.url);
                        linkNoteInput.value = link.note || '';
                    }
                });
            });

            // Copy Logic
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const url = e.currentTarget.dataset.url;
                    const icon = e.currentTarget.querySelector('.material-icons-round');
                    try {
                        await navigator.clipboard.writeText(url);
                        e.currentTarget.classList.add('copied');
                        icon.textContent = 'check';
                        setTimeout(() => {
                            e.currentTarget.classList.remove('copied');
                            icon.textContent = 'content_copy';
                        }, 2000);
                    } catch (err) {
                        console.error("Failed to copy:", err);
                    }
                });
            });
        }
    }

    // --- Undo logic ---
    function showSnackbar(msg) {
        snackbarText.textContent = msg;
        snackbar.classList.add('show');
        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
            snackbar.classList.remove('show');
            lastDeletedLink = null;
        }, 5000);
    }

    btnUndo.addEventListener('click', async () => {
        if (lastDeletedLink) {
            await saveLinkToDB(lastDeletedLink);
            links.push(lastDeletedLink);
            lastDeletedLink = null;
            snackbar.classList.remove('show');
            renderChips();
            renderLinks(searchInput.value);
        }
    });

    // --- Highlighting Helper ---
    function highlightText(text, query) {
        if (!text) return '';
        const safeText = escapeHTML(text);
        if (!query) return safeText;
        
        const terms = query.trim().split(/\s+/).filter(t => t.length > 2);
        if (terms.length === 0) return safeText;
        
        try {
            const regex = new RegExp(`(${terms.join('|')})`, 'gi');
            return safeText.replace(regex, '<mark>$1</mark>');
        } catch(e) {
            return safeText;
        }
    }

    // --- Search with Debounce ---
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderLinks(e.target.value);
        }, 400);
    });

    // --- Modal Logic ---
    function openModal(initialUrl = '') {
        addModalOverlay.classList.remove('hidden');
        linkUrlInput.value = initialUrl;
        if (!initialUrl) linkNoteInput.value = ''; // Don't clear if editing
        metadataPreview.classList.add('hidden');
        if (initialUrl) linkNoteInput.focus();
        else linkUrlInput.focus();
    }

    function closeModal() {
        addModalOverlay.classList.add('hidden');
        setTimeout(() => {
            currentEditId = null;
            document.querySelector('.sheet-header h3').textContent = 'Save New Link';
        }, 300);
    }

    fabAdd.addEventListener('click', () => {
        currentEditId = null;
        document.querySelector('.sheet-header h3').textContent = 'Save New Link';
        openModal();
    });
    btnCloseModal.addEventListener('click', closeModal);
    addModalOverlay.addEventListener('click', (e) => {
        if (e.target === addModalOverlay) closeModal();
    });

    // --- URL Metadata Fetching ---
    async function fetchMetadata(url) {
        try {
            const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error("Network response was not ok");
            const data = await res.json();
            const html = data.contents;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const title = doc.querySelector('title')?.innerText || '';
            const descMeta = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
            const description = descMeta ? descMeta.getAttribute('content') : '';
            
            return { title, description };
        } catch (error) {
            return { title: '', description: '' };
        }
    }

    function getDomain(url) {
        try { return new URL(url).hostname.replace('www.', ''); } catch(e) { return url; }
    }

    // --- Form Submission (Create & Update) ---
    addLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = linkUrlInput.value.trim();
        const note = linkNoteInput.value.trim();
        if (!url) return;

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
        metadataPreview.classList.remove('hidden');

        if (currentEditId) {
            // Update Existing Link
            const index = links.findIndex(l => l.id === currentEditId);
            if (index > -1) {
                const oldLink = links[index];
                const urlChanged = oldLink.url !== url;
                const noteChanged = oldLink.note !== note;
                
                oldLink.url = url;
                oldLink.note = note;
                
                if (urlChanged) {
                    const meta = await fetchMetadata(url);
                    oldLink.title = meta.title;
                    oldLink.description = meta.description;
                }
                
                if (urlChanged || noteChanged) {
                    if (isAiReady && extractor) {
                        const textToEmbed = `${oldLink.title} ${oldLink.description} ${oldLink.note}`;
                        const out = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
                        oldLink.embedding = Array.from(out.data);
                    }
                    await saveLinkToDB(oldLink);
                }
            }
        } else {
            // Create New Link
            const meta = await fetchMetadata(url);
            const newLink = {
                id: Date.now().toString(),
                url: url,
                note: note,
                title: meta.title,
                description: meta.description,
                timestamp: Date.now()
            };

            if (isAiReady && extractor) {
                const textToEmbed = `${newLink.title} ${newLink.description} ${newLink.note}`;
                const out = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
                newLink.embedding = Array.from(out.data);
            }

            await saveLinkToDB(newLink);
            links.push(newLink);
        }

        renderChips();
        renderLinks(searchInput.value); 
        
        btnSave.disabled = false;
        btnSave.textContent = 'Save Link';
        closeModal();
    });

    // --- Speech Recognition ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
    } else {
        if(btnVoiceSearch) btnVoiceSearch.style.display = 'none';
        if(btnVoiceNote) btnVoiceNote.style.display = 'none';
    }

    function startListening(onResult, mode) {
        if (!recognition) return alert("Speech recognition not supported in this browser.");
        
        recognition.onstart = () => {
            voiceFeedback.classList.remove('hidden');
            voiceFeedbackText.textContent = mode === 'search' ? 'Listening for search...' : 'Dictating note...';
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
        };
        
        recognition.onerror = (event) => {
            voiceFeedback.classList.add('hidden');
        };
        
        recognition.onend = () => {
            voiceFeedback.classList.add('hidden');
        };

        recognition.start();
    }

    if(btnVoiceSearch) {
        btnVoiceSearch.addEventListener('click', () => {
            startListening((transcript) => {
                searchInput.value = transcript;
                renderLinks(transcript); 
            }, 'search');
        });
    }

    if(btnVoiceNote) {
        btnVoiceNote.addEventListener('click', () => {
            startListening((transcript) => {
                const current = linkNoteInput.value;
                linkNoteInput.value = current ? current + ' ' + transcript : transcript;
            }, 'note');
        });
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }

    // Initial render
    renderChips();
    renderLinks();
});
