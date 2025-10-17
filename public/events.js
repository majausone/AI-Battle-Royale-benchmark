export const EVENTS = {
    DAMAGE_RECEIVED: 'damageReceived',
    DAMAGE_DONE: 'damageDone',
    DEATH: 'death',
    ATTACK: 'attack'
};

const eventListeners = new Map();

function getListeners(target, event) {
    if (!eventListeners.has(target)) {
        eventListeners.set(target, new Map());
    }
    
    const targetEvents = eventListeners.get(target);
    if (!targetEvents.has(event)) {
        targetEvents.set(event, new Set());
    }
    
    return targetEvents.get(event);
}

export function on(target, event, callback) {
    const listeners = getListeners(target, event);
    listeners.add(callback);
}

export function off(target, event, callback) {
    const targetEvents = eventListeners.get(target);
    if (targetEvents) {
        const listeners = targetEvents.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                targetEvents.delete(event);
            }
        }
        if (targetEvents.size === 0) {
            eventListeners.delete(target);
        }
    }
}

export function emit(target, event, data = {}) {
    const targetEvents = eventListeners.get(target);
    if (targetEvents) {
        const listeners = targetEvents.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
}

export function clearEvents(target) {
    eventListeners.delete(target);
}