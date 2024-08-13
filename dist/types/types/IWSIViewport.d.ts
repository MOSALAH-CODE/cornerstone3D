import { IViewport } from './IViewport';
import WSIViewportProperties from './WSIViewportProperties';
export default interface IWSIViewport extends IViewport {
    resize: () => void;
    setProperties(props: WSIViewportProperties, suppressEvents?: boolean): void;
    getProperties: () => WSIViewportProperties;
    setWSI: (imageIds: string[], client: any) => Promise<unknown>;
    resetProperties(): void;
    getCurrentImageId(): string;
    getFrameNumber(): number;
    setFrameNumber(frameNo: number): any;
    resetCamera(resetPan?: boolean, resetZoom?: boolean): boolean;
}
//# sourceMappingURL=IWSIViewport.d.ts.map