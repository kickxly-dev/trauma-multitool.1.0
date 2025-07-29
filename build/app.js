document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const toolCards = document.querySelectorAll('.tool-card');
    const tabsContainer = document.querySelector('.tool-tabs');
    const toolContent = document.querySelector('.tool-content');
    
    // State
    let activeTabId = null;
    let tabs = [];
    let tabCounter = 0;

    // Tool configurations with API endpoints
    const toolConfigs = {
        'security-audit': {
            name: 'Security Auditor',
            icon: 'shield-alt',
            endpoint: '/api/security/scan',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'target', label: 'Target IP or Domain', placeholder: 'Enter IP (192.168.1.1) or domain (example.com)', required: true },
                { type: 'select', id: 'scanType', label: 'Scan Type', options: ['quick', 'full', 'vulnerability'], defaultValue: 'quick' }
            ]
        },
        'network-mapper': {
            name: 'Network Mapper',
            icon: 'network-wired',
            endpoint: '/api/network/map',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'network', label: 'Network Range', placeholder: 'Enter CIDR notation (e.g., 192.168.1.0/24)', required: true },
                { type: 'number', id: 'timeout', label: 'Timeout (ms)', placeholder: '1000', min: 100, max: 10000 }
            ]
        },
        'traceroute': {
            name: 'Traceroute',
            icon: 'route',
            endpoint: '/api/network/traceroute',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'target', label: 'Target Host', placeholder: 'Enter hostname or IP', required: true },
                { type: 'number', id: 'maxHops', label: 'Max Hops', placeholder: '30', min: 1, max: 64 },
                { type: 'select', id: 'protocol', label: 'Protocol', options: ['icmp', 'tcp', 'udp'], defaultValue: 'icmp' }
            ]
        },
        'ping-sweep': {
            name: 'Ping Sweep',
            icon: 'broadcast-tower',
            endpoint: '/api/network/ping-sweep',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'ipRange', label: 'IP Range', placeholder: '192.168.1.1-254', required: true },
                { type: 'number', id: 'count', label: 'Ping Count', placeholder: '1', min: 1, max: 10 },
                { type: 'number', id: 'timeout', label: 'Timeout (ms)', placeholder: '1000', min: 100, max: 5000 }
            ]
        },
        'ip-scanner': {
            name: 'IP Scanner',
            icon: 'search-location',
            endpoint: '/api/network/port-scan',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'target', label: 'Target IP', placeholder: '192.168.1.1', required: true },
                { type: 'text', id: 'ports', label: 'Ports', placeholder: '22,80,443,8080', required: true },
                { type: 'select', id: 'scanType', label: 'Scan Type', options: ['tcp', 'udp', 'syn'], defaultValue: 'tcp' }
            ]
        },
        'dns-lookup': {
            name: 'DNS Lookup',
            icon: 'globe-americas',
            endpoint: '/api/dns/lookup',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'domain', label: 'Domain', placeholder: 'example.com', required: true },
                { type: 'select', id: 'recordType', label: 'Record Type', options: ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'], defaultValue: 'A' }
            ]
        },
        'geo-ip': {
            name: 'Geo Location',
            icon: 'map-marked-alt',
            endpoint: '/api/geo/ip',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'ip', label: 'IP Address', placeholder: '8.8.8.8', required: true }
            ]
        },
        'port-scanner': {
            name: 'Port Scanner',
            icon: 'plug',
            endpoint: '/api/network/port-scan',
            method: 'POST',
            inputs: [
                { type: 'text', id: 'target', label: 'Target IP', placeholder: '192.168.1.1', required: true },
                { type: 'text', id: 'ports', label: 'Port Range', placeholder: '1-1024', required: true },
                { type: 'number', id: 'timeout', label: 'Timeout (ms)', placeholder: '1000', min: 100, max: 10000 }
            ]
        },
        // Default configuration for unknown tools
        'default': {
            name: 'Tool',
            icon: 'tools',
            inputs: [
                { type: 'text', id: 'input', label: 'Input', placeholder: 'Enter your input here...' }
            ]
        }
    };

    // Initialize the application
    function init() {
        setupEventListeners();
    }

    // Set up event listeners
    function setupEventListeners() {
        // Tool card clicks - using event delegation for dynamic content
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.tool-card');
            if (card) {
                e.preventDefault();
                const toolName = card.getAttribute('data-tool');
                if (toolName) {
                    openTool(toolName);
                } else {
                    console.error('Tool card is missing data-tool attribute');
                }
            }
        });

        // Touch feedback for tool cards
        document.addEventListener('mousedown', (e) => {
            const card = e.target.closest('.tool-card');
            if (card) card.classList.add('active');
        });

        document.addEventListener('mouseup', (e) => {
            document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
        });

        document.addEventListener('mouseleave', (e) => {
            document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
        });
    }

    // Open a tool in a new tab
    function openTool(toolName) {
        // Check if tool is already open
        const existingTab = tabs.find(tab => tab.name === toolName);
        if (existingTab) {
            switchToTab(existingTab.id);
            return;
        }

        // Create new tab
        const tabId = 'tab-' + (++tabCounter);
        const tab = {
            id: tabId,
            name: toolName,
            config: toolConfigs[toolName] || toolConfigs['default']
        };

        tabs.push(tab);
        renderTab(tab);
        renderToolContent(tab);
        switchToTab(tabId);
    }

    // Render a tab in the tab bar
    function renderTab(tab) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.innerHTML = `
            ${tab.name}
            <span class="close-tab" data-tab-id="${tab.id}">&times;</span>
        `;
        
        // Add click handler for the tab
        tabElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-tab')) {
                e.stopPropagation();
                closeTab(tab.id);
            } else {
                switchToTab(tab.id);
            }
        });

        tabsContainer.appendChild(tabElement);
    }

    // Render the content for a tool
    function renderToolContent(tab) {
        const toolConfig = toolConfigs[tab.name.toLowerCase()] || toolConfigs['default'];
        
        // Clear any existing content
        toolContent.innerHTML = '';
        
        // Create the form container
        const form = document.createElement('form');
        form.className = 'tool-form p-4';
        form.dataset.tabId = tab.id;
        
        // Add tool title
        const title = document.createElement('h3');
        title.className = 'mb-4';
        title.textContent = toolConfig.name || tab.name;
        
        // Create form inputs
        const formGroups = toolConfig.inputs.map(input => {
            const group = document.createElement('div');
            group.className = 'mb-3';
            
            const label = document.createElement('label');
            label.className = 'form-label';
            label.htmlFor = `${tab.id}-${input.id}`;
            label.textContent = input.label;
            
            let inputElement;
            
            if (input.type === 'select') {
                inputElement = document.createElement('select');
                inputElement.className = 'form-select';
                inputElement.id = `${tab.id}-${input.id}`;
                if (input.required) inputElement.required = true;
                
                input.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (input.defaultValue === opt) option.selected = true;
                    inputElement.appendChild(option);
                });
            } else {
                inputElement = document.createElement('input');
                inputElement.type = input.type || 'text';
                inputElement.className = 'form-control';
                inputElement.id = `${tab.id}-${input.id}`;
                if (input.placeholder) inputElement.placeholder = input.placeholder;
                if (input.defaultValue) inputElement.value = input.defaultValue;
                if (input.required) inputElement.required = true;
                if (input.min) inputElement.min = input.min;
                if (input.max) inputElement.max = input.max;
            }
            
            group.appendChild(label);
            group.appendChild(inputElement);
            return group;
        });
        
        // Create buttons container
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'd-flex gap-2 mt-4';
        
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.innerHTML = `<i class="fas fa-play me-2"></i>Run ${toolConfig.name || 'Tool'}`;
        
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn btn-outline-secondary';
        resetBtn.innerHTML = '<i class="fas fa-undo me-2"></i>Reset';
        resetBtn.dataset.action = 'reset';
        
        // Create results container
        const resultsDiv = document.createElement('div');
        resultsDiv.id = `${tab.id}-results`;
        resultsDiv.className = 'mt-4';
        
        // Assemble the form
        buttonGroup.appendChild(submitBtn);
        buttonGroup.appendChild(resetBtn);
        
        form.appendChild(title);
        formGroups.forEach(group => form.appendChild(group));
        form.appendChild(buttonGroup);
        form.appendChild(resultsDiv);

        // Add form submission handler
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            runTool(tab);
        });

        // Add reset button handler
        const resetBtn = form.querySelector('[data-action="reset"]');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                form.reset();
                const results = document.getElementById(`${tab.id}-results`);
                if (results) results.textContent = '';
            });
        }

        toolContent.appendChild(form);
    }

    // Switch to a specific tab
    function switchToTab(tabId) {
        // Update active tab in UI
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.dataset.tabId === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === `${tabId}-content`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Update state
        activeTabId = tabId;
    }

    // Close a tab
    function closeTab(tabId) {
        // Remove tab from DOM
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabElement) tabElement.remove();
        
        // Remove content from DOM
        const contentElement = document.querySelector(`#${tabId}-content`);
        if (contentElement) contentElement.remove();
        
        // Update tabs array
        tabs = tabs.filter(tab => tab.id !== tabId);
        
        // If we closed the active tab, switch to another one
        if (activeTabId === tabId) {
            if (tabs.length > 0) {
                switchToTab(tabs[tabs.length - 1].id);
            } else {
                activeTabId = null;
                // Show "no tool selected" message
                document.querySelectorAll('.tab-content').forEach(el => el.remove());
                toolContent.innerHTML = `
                    <div class="no-tool-selected">
                        <i class="fas fa-mouse-pointer"></i>
                        <p>Select a tool to get started</p>
                    </div>
                `;
            }
        }
    }

    // Format JSON with syntax highlighting
    function syntaxHighlight(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }
        
        // Escape HTML and add syntax highlighting
        return json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\s/g, '&nbsp;')
            .replace(/"(\w+)"\s*:/g, '<span class="json-key">"$1"</span>:')
            .replace(/:&nbsp;"(.*?)"/g, ':&nbsp;<span class="json-string">"$1"</span>')
            .replace(/:&nbsp;(\d+)/g, ':&nbsp;<span class="json-number">$1</span>')
            .replace(/:&nbsp;(true|false)/g, ':&nbsp;<span class="json-boolean">$1</span>')
            .replace(/:&nbsp;null/g, ':&nbsp;<span class="json-null">null</span>');
    }

    // Format IP address information
    function formatIpInfo(data) {
        if (!data) return '';
        
        return `
            <div class="result-item">
                <h5>${data.ip || 'IP Address'}</h5>
                <div class="result-details">
                    ${data.country ? `<p><strong>Country:</strong> ${data.country} ${data.countryFlag || ''}</p>` : ''}
                    ${data.city ? `<p><strong>City:</strong> ${data.city}</p>` : ''}
                    ${data.region ? `<p><strong>Region:</strong> ${data.region}</p>` : ''}
                    ${data.org ? `<p><strong>ISP:</strong> ${data.org}</p>` : ''}
                    ${data.loc ? `<p><strong>Location:</strong> ${data.loc}</p>` : ''}
                    ${data.timezone ? `<p><strong>Timezone:</strong> ${data.timezone}</p>` : ''}
                </div>
            </div>
        `;
    }

    // Format network scan results
    function formatNetworkScan(data) {
        if (!data || !data.hosts) return '';
        
        let html = `
            <div class="result-item">
                <h5>Network Scan Results</h5>
                <p><strong>Network:</strong> ${data.network}</p>
                <p><strong>Hosts found:</strong> ${data.hosts.length}</p>
                <div class="hosts-list">
        `;
        
        data.hosts.forEach(host => {
            html += `
                <div class="host-item">
                    <span class="host-ip">${host.ip}</span>
                    <span class="host-status ${host.status === 'up' ? 'status-success' : 'status-error'}">
                        ${host.status.toUpperCase()}
                    </span>
                    ${host.hostname ? `<span class="host-hostname">${host.hostname}</span>` : ''}
                    ${host.mac ? `<span class="host-mac">${host.mac}</span>` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    // Public API endpoints
    const PUBLIC_APIS = {
        ipInfo: 'https://ipapi.co',
        whois: 'https://whois.whoisxmlapi.com/api/v1',
        dns: 'https://dns.google/resolve',
        ping: 'https://networkcalc.com/api/ping'
    };
    
    // API Key for services that require it (you should use environment variables in production)
    const API_KEYS = {
        whois: 'YOUR_WHOIS_API_KEY' // You'll need to sign up for a free API key
    };
    
    // Run a tool using public APIs
    async function runTool(tab) {
        const results = document.getElementById(`${tab.id}-results`);
        if (!results) return;
        
        // Show loading state
        results.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Running ${tab.name}, please wait...</p>
            </div>
        `;
        
        // Get form data
        const form = document.querySelector(`form[data-tab-id="${tab.id}"]`);
        const formData = {};
        const inputs = form.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            formData[input.id.replace(`${tab.id}-`, '')] = input.value;
        });
        
        try {
            let result;
            let resultsHtml = '';
            
            // Make API call based on the tool
            switch (tab.name) {
                case 'Geo Location':
                    const ipOrDomain = formData.ipOrDomain || '';
                    const response = await fetch(`${PUBLIC_APIS.ipInfo}/${ipOrDomain || ''}/json/`);
                    if (!response.ok) throw new Error(`Failed to fetch IP info: ${response.statusText}`);
                    result = await response.json();
                    
                    resultsHtml = `
                        <div class="result-header">
                            <h4><i class="fas ${tab.config.icon}"></i> ${tab.name} Results</h4>
                            <small>${new Date().toISOString()}</small>
                        </div>
                        <div class="result-content">
                            <div class="ip-info">
                                <p><strong>IP Address:</strong> ${result.ip || 'N/A'}</p>
                                <p><strong>Location:</strong> ${result.city || 'N/A'}, ${result.region || 'N/A'}, ${result.country_name || 'N/A'}</p>
                                <p><strong>ISP:</strong> ${result.org || 'N/A'}</p>
                                <p><strong>Timezone:</strong> ${result.timezone || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="raw-data">
                            <button class="toggle-raw">Show Raw Data</button>
                            <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
                        </div>
                    `;
                    break;
                    
                case 'IP Scanner':
                    // Using a simple ping service
                    const targetIP = formData.ipRange || '127.0.0.1';
                    const pingResponse = await fetch(`${PUBLIC_APIS.ping}/${targetIP}`);
                    if (!pingResponse.ok) throw new Error(`Ping failed: ${pingResponse.statusText}`);
                    result = await pingResponse.json();
                    
                    resultsHtml = `
                        <div class="result-header">
                            <h4><i class="fas ${tab.config.icon}"></i> ${tab.name} Results</h4>
                            <small>${new Date().toISOString()}</small>
                        </div>
                        <div class="result-content">
                            <div class="result-item">
                                <h5>Ping to ${result.host}</h5>
                                <pre>${result.output || 'No output received'}</pre>
                            </div>
                        </div>
                        <div class="raw-data">
                            <button class="toggle-raw">Show Raw Data</button>
                            <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
                        </div>
                    `;
                    break;
                    
                case 'Network Mapper':
                    // For Network Mapper, we'll use a public API that provides network info
                    const ipResponse = await fetch(`${PUBLIC_APIS.ipInfo}/json/`);
                    if (!ipResponse.ok) throw new Error('Failed to fetch network information');
                    const ipData = await ipResponse.json();
                    
                    result = {
                        success: true,
                        interfaces: {
                            'Public IP': [{
                                address: ipData.ip,
                                isp: ipData.org,
                                location: `${ipData.city}, ${ipData.region}, ${ipData.country_name}`
                            }]
                        }
                    };
                    
                    resultsHtml = `
                        <div class="result-header">
                            <h4><i class="fas ${tab.config.icon}"></i> ${tab.name} Results</h4>
                            <small>${new Date().toISOString()}</small>
                        </div>
                        <div class="result-content">
                            <div class="network-info">
                                <h5>Public Network Information</h5>
                                <p><strong>IP Address:</strong> ${result.interfaces['Public IP'][0].address}</p>
                                <p><strong>ISP:</strong> ${result.interfaces['Public IP'][0].isp}</p>
                                <p><strong>Location:</strong> ${result.interfaces['Public IP'][0].location}</p>
                                <p class="note">Note: This shows public network information only. For local network scanning, a backend service is required.</p>
                            </div>
                        </div>
                        <div class="raw-data">
                            <button class="toggle-raw">Show Raw Data</button>
                            <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
                        </div>
                    `;
                    break;
                    
                case 'WHOIS Lookup':
                    const whoisResponse = await fetch(`${API_BASE_URL}/whois/${encodeURIComponent(formData.domain || 'example.com')}`);
                    if (!whoisResponse.ok) throw new Error(`WHOIS lookup failed: ${whoisResponse.statusText}`);
                    result = await whoisResponse.json();
                    
                    resultsHtml = `
                        <div class="result-header">
                            <h4><i class="fas fa-search"></i> WHOIS Lookup Results</h4>
                            <small>${new Date().toISOString()}</small>
                        </div>
                        <div class="result-content">
                            <div class="result-item">
                                <h5>Domain: ${result.domain}</h5>
                                <div class="json-result">
                                    ${syntaxHighlight(JSON.stringify(result.whois, null, 2))}
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'DNS Lookup':
                    const dnsResponse = await fetch(`${API_BASE_URL}/dns/${encodeURIComponent(formData.hostname || 'example.com')}?type=${formData.recordType || 'A'}`);
                    if (!dnsResponse.ok) throw new Error(`DNS lookup failed: ${dnsResponse.statusText}`);
                    result = await dnsResponse.json();
                    
                    resultsHtml = `
                        <div class="result-header">
                            <h4><i class="fas fa-server"></i> DNS Lookup Results</h4>
                            <small>${new Date().toISOString()}</small>
                        </div>
                        <div class="result-content">
                            <div class="result-item">
                                <h5>Raw Data <button class="btn btn-sm btn-outline-secondary" onclick="this.nextElementSibling.classList.toggle('d-none')">Toggle</button></h5>
                                <pre class="d-none bg-dark text-light p-3 rounded">${JSON.stringify(result, null, 2)}</pre>
                            </div>
            
            resultsHtml += `
                </div>
            `;
            
            results.innerHTML = resultsHtml;
            
            // Add copy to clipboard button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-small';
            copyBtn.style.marginLeft = '10px';
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
                }, 2000);
            };
            
            const header = results.querySelector('.result-header h4');
            if (header) {
                header.appendChild(copyBtn);
            }
            
        } catch (error) {
            results.innerHTML = `
                <div class="result-header">
                    <h4><i class="fas fa-exclamation-triangle"></i> Error</h4>
                </div>
                <div class="result-content">
                    <div class="result-item status-error">
                        <h5>Failed to run ${tab.name}</h5>
                        <p>${error.message || 'An unknown error occurred'}</p>
                        <pre>${error.stack || JSON.stringify(error, null, 2)}</pre>
                    </div>
                </div>
            `;
        }
        
        // Scroll to results
        results.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Generate mock data for demo purposes
    function generateMockData(toolName, formData) {
        const mockData = {
            'Geo Location': {
                ip: formData.ipOrDomain || '8.8.8.8',
                hostname: 'dns.google',
                city: 'Mountain View',
                region: 'California',
                country: 'United States',
                countryFlag: '🇺🇸',
                loc: '37.4056,-122.0775',
                org: 'Google LLC',
                postal: '94043',
                timezone: 'America/Los_Angeles',
                readme: 'https://ipinfo.io/missingauth'
            },
            'IP Scanner': {
                network: formData.ipRange || '192.168.1.1-100',
                timestamp: new Date().toISOString(),
                hosts: Array(5).fill(0).map((_, i) => ({
                    ip: `192.168.1.${i + 1}`,
                    status: Math.random() > 0.3 ? 'up' : 'down',
                    hostname: Math.random() > 0.5 ? `device-${i + 1}.local` : '',
                    mac: Math.random() > 0.7 ? `00:1A:2B:3C:4D:${i.toString(16).toUpperCase().padStart(2, '0')}` : '',
                    ports: Array(Math.floor(Math.random() * 5)).fill(0).map(() => ({
                        port: Math.floor(Math.random() * 1000) + 8000,
                        service: 'http',
                        state: 'open'
                    }))
                }))
            },
            'Network Mapper': {
                network: formData.network || '192.168.1.0/24',
                scanType: formData.scanType || 'Quick Scan',
                timestamp: new Date().toISOString(),
                hosts: Array(8).fill(0).map((_, i) => ({
                    ip: `192.168.1.${i + 1}`,
                    status: Math.random() > 0.2 ? 'up' : 'down',
                    hostname: `device-${i + 1}.local`,
                    mac: `00:1A:2B:3C:4D:${i.toString(16).toUpperCase().padStart(2, '0')}`
                }))
            },
            'Security Auditor': {
                target: formData.target || 'example.com',
                scanType: formData.scanType || 'Quick Scan',
                timestamp: new Date().toISOString(),
                vulnerabilities: [
                    { severity: 'high', title: 'Outdated Software Detected', description: 'Web server is running an outdated version with known vulnerabilities.' },
                    { severity: 'medium', title: 'Missing Security Headers', description: 'Important security headers like X-XSS-Protection are missing.' },
                    { severity: 'low', title: 'Information Disclosure', description: 'Server version information is exposed in HTTP headers.' }
                ],
                recommendations: [
                    'Update all server software to the latest stable version',
                    'Configure proper security headers',
                    'Disable directory listing',
                    'Implement rate limiting'
                ]
            }
        };
        
        return mockData[toolName] || {
            tool: toolName,
            input: formData,
            timestamp: new Date().toISOString(),
            message: 'This is a simulated response. In a real application, this would show actual tool output.'
        };
    }

    // Initialize the app
    init();
});
