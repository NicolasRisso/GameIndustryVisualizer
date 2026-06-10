const uiPanel = document.getElementById('ui-panel');
const togglePanelBtn = document.getElementById('toggle-panel-btn');
const currentYearDisplay = document.getElementById('current-year-display');
const prevYearBtn = document.getElementById('prev-year');
const nextYearBtn = document.getElementById('next-year');
const companySelect = document.getElementById('company-select');
const depthSelect = document.getElementById('depth-select');
const graphContainer = document.getElementById('graph-container');
const infoPanel = document.getElementById('info-panel');
const nodeTitle = document.getElementById('node-title');
const nodeDetails = document.getElementById('node-details');


const YEARS = ["2023", "2024", "2025", "2026"];
let currentYearIndex = YEARS.length - 1; // Default to latest (2026)
let selectedCompany = "";

let fullYearData = { nodes: [], links: [] };
let Graph = null;
const nodeDepths = {}; // Maps node.id to its BFS depth level

// Helper to format dates
function formatDate(isoString) {
    if (!isoString) return "Unknown Date";
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Load data for the current year
async function loadYearData() {
    const year = YEARS[currentYearIndex];
    currentYearDisplay.innerText = year;
    
    try {
        const response = await fetch(`./data/${year}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        fullYearData = data;

        // Populate company select dropdown
        populateCompanyDropdown();
        
        // Render the graph
        renderGraph();

    } catch (error) {
        console.error(`Failed to load graph data for year ${year}:`, error);
        nodeTitle.innerText = "Error Loading Data";
        nodeDetails.innerText = `Could not fetch static/data/${year}.json. Please run the Odin engine to generate database extracts.`;
        infoPanel.classList.remove('hidden');
    }
}

// Populate the company select dropdown with all companies available in the current year
function populateCompanyDropdown() {
    // Collect all unique companies present in nodes
    const companies = fullYearData.nodes.map(n => n.name).sort();

    // Preserve selection if possible
    const previousSelection = selectedCompany;

    companySelect.innerHTML = '<option value="">All Companies (Full Network)</option>';
    
    companies.forEach(comp => {
        const opt = document.createElement('option');
        opt.value = comp;
        opt.textContent = comp;
        if (comp === previousSelection) {
            opt.selected = true;
            selectedCompany = comp;
        }
        companySelect.appendChild(opt);
    });

    // If previously selected company is not in this year's data, reset focus
    if (!companies.includes(previousSelection)) {
        selectedCompany = "";
        companySelect.value = "";
    }
}

// Filter and render the force graph
function renderGraph() {
    let filteredNodes = [];
    let filteredLinks = [];
    
    // Reset depths mapping
    for (const member in nodeDepths) delete nodeDepths[member];

    if (selectedCompany) {
        const depthLimit = parseInt(depthSelect.value) || 1;
        const visited = new Set();
        visited.add(selectedCompany);
        nodeDepths[selectedCompany] = 0;

        let currentLevel = [selectedCompany];

        // BFS traversal to find all nodes up to depthLimit
        for (let d = 1; d <= depthLimit; d++) {
            const nextLevel = [];
            
            fullYearData.links.forEach(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;

                if (currentLevel.includes(sId)) {
                    if (!visited.has(tId)) {
                        visited.add(tId);
                        nextLevel.push(tId);
                        nodeDepths[tId] = d;
                    }
                }
                if (currentLevel.includes(tId)) {
                    if (!visited.has(sId)) {
                        visited.add(sId);
                        nextLevel.push(sId);
                        nodeDepths[sId] = d;
                    }
                }
            });

            currentLevel = nextLevel;
            if (currentLevel.length === 0) break;
        }

        // Keep only visited nodes
        filteredNodes = fullYearData.nodes.filter(n => visited.has(n.id));

        // Keep links where both endpoints are in the visited set
        filteredLinks = fullYearData.links.filter(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return visited.has(sId) && visited.has(tId);
        });
    } else {
        // Display full network
        filteredNodes = fullYearData.nodes;
        filteredLinks = fullYearData.links;
    }

    const graphData = {
        nodes: filteredNodes.map(n => ({...n})), // clone to prevent force-graph mutations from bleeding
        links: filteredLinks.map(l => ({...l}))
    };

    // Calculate link counts for link thickness
    const linkCounts = {};
    graphData.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const key = `${Math.min(sId, tId)}-${Math.max(sId, tId)}`;
        linkCounts[key] = (linkCounts[key] || 0) + 1;
    });

    if (!Graph) {
        Graph = ForceGraph()(graphContainer)
            .backgroundColor('#0a0a0c')
            .nodeRelSize(6)
            .nodeColor(node => {
                if (selectedCompany) {
                    if (node.id === selectedCompany) {
                        return '#ffd700'; // Gold center node
                    }
                    const depth = nodeDepths[node.id];
                    if (depth === 1) {
                        return '#6b4cff'; // Level 1 (Purple)
                    } else if (depth === 2) {
                        return '#c86bfa'; // Level 2 (Lavender/Magenta)
                    } else if (depth === 3) {
                        return '#3cb371'; // Level 3 (Medium Sea Green)
                    }
                }
                return '#6b4cff'; // Default Purple
            })
            .nodeVal(node => {
                const baseVal = node.val || 1;
                if (selectedCompany) {
                    if (node.id === selectedCompany) {
                        return Math.max(Math.sqrt(baseVal) * 5, 20); // Large center node
                    }
                    const depth = nodeDepths[node.id];
                    if (depth === 1) {
                        return Math.sqrt(baseVal) * 3 + 2;
                    } else if (depth === 2) {
                        return Math.sqrt(baseVal) * 2 + 1;
                    } else {
                        return Math.sqrt(baseVal) * 1.5 + 1;
                    }
                }
                return Math.sqrt(baseVal) * 3 + 2;
            })
            .nodeLabel('name')
            .linkColor(link => {
                if (selectedCompany) {
                    const sId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tId = typeof link.target === 'object' ? link.target.id : link.target;
                    // Highlight center link connections, dim out other secondary links
                    if (sId === selectedCompany || tId === selectedCompany) {
                        return 'rgba(255, 255, 255, 0.4)';
                    }
                    return 'rgba(255, 255, 255, 0.08)';
                }
                return 'rgba(255, 255, 255, 0.15)';
            })
            .linkWidth(link => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;
                const key = `${Math.min(sId, tId)}-${Math.max(sId, tId)}`;
                const baseWidth = Math.min((linkCounts[key] || 1) * 1.5, 8);
                if (selectedCompany && (sId !== selectedCompany && tId !== selectedCompany)) {
                    return baseWidth * 0.7; // slightly thin secondary connections
                }
                return baseWidth;
            })
            .onNodeHover(node => {
                if (node) {
                    graphContainer.style.cursor = 'pointer';
                    showNodeInfo(node);
                } else {
                    graphContainer.style.cursor = 'default';
                    hideInfo();
                }
            })
            .onLinkHover(link => {
                if (link) {
                    showLinkInfo(link);
                }
            })
            // Force layout configurations
            .d3Force('charge', d3.forceManyBody().strength(-1500))
            .d3Force('link', d3.forceLink().distance(250));
    }

    Graph.graphData(graphData);

    // Apply specific centering force if a company is focused
    Graph.d3Force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
}

function showNodeInfo(node) {
    nodeTitle.innerText = node.name;
    let depthStr = "";
    if (selectedCompany) {
        const depth = nodeDepths[node.id];
        if (depth === 0) {
            depthStr = ` (Selected Focus Center)`;
        } else {
            depthStr = ` (Connection Depth: ${depth})`;
        }
    }
    nodeDetails.innerHTML = `
        <strong>Ecosystem Mentions:</strong> ${node.val || 1}<br>
        ${depthStr ? `<strong>Network Level:</strong>${depthStr}<br><br>` : `<br>`}
        <em>Hover connections or change focus to study this entity's partnerships.</em>
    `;
    infoPanel.classList.remove('hidden');
}

function showLinkInfo(link) {
    const sName = typeof link.source === 'object' ? link.source.name : link.source;
    const tName = typeof link.target === 'object' ? link.target.name : link.target;
    nodeTitle.innerText = `${sName} & ${tName}`;
    nodeDetails.innerHTML = `
        <strong>Co-occurrence Count:</strong> ${link.weight || 1}<br>
        <strong>Sample Article:</strong><br>
        <a href="${link.url}" target="_blank" style="color: #6b4cff; text-decoration: underline;">"${link.article}"</a><br><br>
        <strong>Published:</strong> ${formatDate(link.date)}
    `;
    infoPanel.classList.remove('hidden');
}

function hideInfo() {
    infoPanel.classList.add('hidden');
}

// Event Listeners
prevYearBtn.addEventListener('click', () => {
    if (currentYearIndex > 0) {
        currentYearIndex--;
        loadYearData();
    }
});

nextYearBtn.addEventListener('click', () => {
    if (currentYearIndex < YEARS.length - 1) {
        currentYearIndex++;
        loadYearData();
    }
});

companySelect.addEventListener('change', (e) => {
    selectedCompany = e.target.value;
    renderGraph();
});

depthSelect.addEventListener('change', () => {
    renderGraph();
});

togglePanelBtn.addEventListener('click', () => {
    uiPanel.classList.toggle('collapsed');
    if (uiPanel.classList.contains('collapsed')) {
        togglePanelBtn.innerHTML = '&#9660;'; // Down arrow ▼
        togglePanelBtn.title = "Show Controls";
    } else {
        togglePanelBtn.innerHTML = '&#9650;'; // Up arrow ▲
        togglePanelBtn.title = "Hide Controls";
    }
});

window.addEventListener('resize', () => {
    if (Graph) {
        Graph.width(window.innerWidth).height(window.innerHeight);
    }
});

// Initialize app
loadYearData();
