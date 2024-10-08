"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metaData_1 = require("../metaData");
let state = {};
const metadataProvider = {
    add: (imageId, payload) => {
        var _a;
        const type = payload.type;
        if (!state[imageId]) {
            state[imageId] = {};
        }
        state[imageId][type] =
            (_a = payload.rawMetadata) !== null && _a !== void 0 ? _a : structuredClone(payload.metadata);
    },
    get: (type, imageId) => {
        var _a;
        return (_a = state[imageId]) === null || _a === void 0 ? void 0 : _a[type];
    },
    clear: () => {
        state = {};
    },
};
(0, metaData_1.addProvider)(metadataProvider.get);
exports.default = metadataProvider;
//# sourceMappingURL=genericMetadataProvider.js.map