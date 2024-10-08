class CornerstoneEventTarget {
    constructor() {
        this.listeners = {};
        this.debouncedListeners = {};
    }
    reset() {
        this.listeners = {};
        this.debouncedListeners = {};
    }
    addEventListenerOnce(type, callback) {
        const onceWrapper = (event) => {
            this.removeEventListener(type, onceWrapper);
            callback.call(this, event);
        };
        this.addEventListener(type, onceWrapper);
    }
    addEventListener(type, callback) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        if (this.listeners[type].indexOf(callback) !== -1) {
            return;
        }
        this.listeners[type].push(callback);
    }
    addEventListenerDebounced(type, callback, delay) {
        this.debouncedListeners[type] = this.debouncedListeners[type] || {};
        const debouncedCallbacks = this.debouncedListeners[type];
        if (!debouncedCallbacks[callback]) {
            const handle = (event) => {
                if (debouncedCallbacks[callback]) {
                    clearTimeout(debouncedCallbacks[callback].timeoutId);
                }
                debouncedCallbacks[callback].timeoutId = setTimeout(() => {
                    callback.call(this, event);
                }, delay);
            };
            debouncedCallbacks[callback] = {
                original: callback,
                handle,
                timeoutId: null,
            };
            this.addEventListener(type, handle);
        }
    }
    removeEventListenerDebounced(type, callback) {
        if (this.debouncedListeners[type] &&
            this.debouncedListeners[type][callback]) {
            const debounced = this.debouncedListeners[type][callback];
            this.removeEventListener(type, debounced.handle);
            clearTimeout(debounced.timeoutId);
            delete this.debouncedListeners[type][callback];
        }
    }
    removeEventListener(type, callback) {
        if (!this.listeners[type]) {
            return;
        }
        const stack = this.listeners[type];
        const stackLength = stack.length;
        for (let i = 0; i < stackLength; i++) {
            if (stack[i] === callback) {
                stack.splice(i, 1);
                return;
            }
        }
    }
    dispatchEvent(event) {
        if (!this.listeners[event.type]) {
            return;
        }
        const stack = this.listeners[event.type].slice();
        const stackLength = stack.length;
        for (let i = 0; i < stackLength; i++) {
            try {
                stack[i].call(this, event);
            }
            catch (error) {
                console.error(`error in event listener of type:  ${event.type}`, error);
            }
        }
        return !event.defaultPrevented;
    }
}
const eventTarget = new CornerstoneEventTarget();
export default eventTarget;
//# sourceMappingURL=eventTarget.js.map