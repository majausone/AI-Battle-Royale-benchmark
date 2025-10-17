import { loadedUnits } from './unitLoader.js';
import { requestUnits, simulateUnitRequest, requestUnitsForAI, simulateUnitRequestForAI, onRequestStatus } from './socketManager.js';
import { testMode } from './round-tab.js';
import { simpleBuyMode } from './aiBuy.js';
import { matchProcessPopup } from './matchProcessPopup.js';

export async function requestUnitsForTeams(matchId) {
    matchProcessPopup.show(matchId);
    
    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: { 
            type: 'progress', 
            process: 'requestUnits',
            message: 'Starting unit request process...'
        }
    }));
    
    if (testMode) {
        simulateUnitRequest(matchId);
    } else {
        requestUnits(matchId);
    }
}

export async function requestUnitsForSpecificAI(matchId, teamId, aiId) {
    matchProcessPopup.show(matchId);
    
    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: { 
            type: 'start',
            process: 'requestUnits'
        }
    }));
    
    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: { 
            type: 'progress', 
            process: 'requestUnits',
            message: `Requesting units for specific AI...`
        }
    }));
    
    const unsubscribe = onRequestStatus((data) => {
        if (data.status === 'completed') {
            setTimeout(() => {
                matchProcessPopup.hide();
                unsubscribe();
            }, 2000);
        }
    });
    
    if (testMode) {
        simulateUnitRequestForAI(matchId, teamId, aiId);
    } else {
        requestUnitsForAI(matchId, teamId, aiId);
    }
}