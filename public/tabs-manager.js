class TabManager {
    constructor() {
        this.tabs = new Map();
        this.secondaryTabs = new Map();
        this.activeTab = null;
        this.container = document.getElementById('tabs-content');
    }

    async registerTab(id, tabInstance, isSecondary = false) {
        if (isSecondary) {
            this.secondaryTabs.set(id, tabInstance);
        } else {
            this.tabs.set(id, tabInstance);
            if (!this.activeTab) {
                this.activeTab = id;
            }
        }
    }

    async showTab(id, isSecondary = false) {
        const allTabs = new Map([...this.tabs, ...this.secondaryTabs]);
        
        if (!allTabs.has(id)) return;
        
        for (const [tabId, tab] of allTabs.entries()) {
            const element = document.getElementById(tabId);
            if (element) {
                const isActive = tabId === id;
                element.style.display = isActive ? 'block' : 'none';
                
                if (isActive) {
                    try {
                        await tab.onShow?.();
                    } catch (error) {
                        console.error(`Error in onShow for tab ${tabId}:`, error);
                    }
                } else {
                    try {
                        tab.onHide?.();
                    } catch (error) {
                        console.error(`Error in onHide for tab ${tabId}:`, error);
                    }
                }
            }
        }
        
        this.activeTab = id;
        
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.dataset.tabId === id);
        });
        
        document.querySelectorAll('.secondary-tab-button').forEach(button => {
            button.classList.toggle('active', button.dataset.tabId === id);
        });
    }

    async init() {
        const tabButtons = document.createElement('div');
        tabButtons.id = 'tabs-navigation';
        
        for (const [id, tab] of this.tabs.entries()) {
            if (tab.init) {
                await tab.init();
            }
            
            const button = document.createElement('button');
            button.textContent = tab.title;
            button.className = 'tab-button';
            button.dataset.tabId = id;
            button.addEventListener('click', () => this.showTab(id, false));
            tabButtons.appendChild(button);
        }

        const secondaryTabButtons = document.createElement('div');
        secondaryTabButtons.id = 'secondary-tabs-navigation';
        
        for (const [id, tab] of this.secondaryTabs.entries()) {
            if (tab.init) {
                await tab.init();
            }
            
            const button = document.createElement('button');
            button.textContent = tab.title;
            button.className = 'secondary-tab-button';
            button.dataset.tabId = id;
            button.addEventListener('click', () => this.showTab(id, true));
            secondaryTabButtons.appendChild(button);
        }

        const sidebar = document.getElementById('sidebar');
        sidebar.insertBefore(tabButtons, sidebar.firstChild);
        
        if (this.secondaryTabs.size > 0) {
            sidebar.insertBefore(secondaryTabButtons, sidebar.childNodes[1]);
        }
        
        if (this.activeTab) {
            await this.showTab(this.activeTab, false);
        }
    }
}

const tabManager = new TabManager();
export default tabManager;