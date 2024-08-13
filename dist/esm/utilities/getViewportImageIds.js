import { VolumeViewport } from '../RenderingEngine';
import cache from '../cache';
function getViewportImageIds(viewport) {
    if (viewport instanceof VolumeViewport) {
        const defaultActor = viewport.getDefaultActor();
        const volumeId = defaultActor.uid;
        const volume = cache.getVolume(volumeId);
        return volume.imageIds;
    }
    else if (viewport.getImageIds) {
        return viewport.getImageIds();
    }
}
export default getViewportImageIds;
//# sourceMappingURL=getViewportImageIds.js.map