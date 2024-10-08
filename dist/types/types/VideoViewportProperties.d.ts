import { ViewportProperties } from './ViewportProperties';
import Point2 from './Point2';
declare type VideoViewportProperties = ViewportProperties & {
    loop?: boolean;
    muted?: boolean;
    pan?: Point2;
    playbackRate?: number;
    scrollSpeed?: number;
};
export default VideoViewportProperties;
//# sourceMappingURL=VideoViewportProperties.d.ts.map