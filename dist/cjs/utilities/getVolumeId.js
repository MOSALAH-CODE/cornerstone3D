"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVolumeId = void 0;
const getVolumeId = (targetId) => {
    const prefix = 'volumeId:';
    const str = targetId.includes(prefix)
        ? targetId.substring(prefix.length)
        : targetId;
    const index = str.indexOf('?');
    return index === -1 ? str : str.substring(0, index);
};
exports.getVolumeId = getVolumeId;
//# sourceMappingURL=getVolumeId.js.map