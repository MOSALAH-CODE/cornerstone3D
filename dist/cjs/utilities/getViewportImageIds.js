"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const RenderingEngine_1 = require("../RenderingEngine");
const cache_1 = __importDefault(require("../cache"));
function getViewportImageIds(viewport) {
    if (viewport instanceof RenderingEngine_1.VolumeViewport) {
        const defaultActor = viewport.getDefaultActor();
        const volumeId = defaultActor.uid;
        const volume = cache_1.default.getVolume(volumeId);
        return volume.imageIds;
    }
    else if (viewport.getImageIds) {
        return viewport.getImageIds();
    }
}
exports.default = getViewportImageIds;
//# sourceMappingURL=getViewportImageIds.js.map