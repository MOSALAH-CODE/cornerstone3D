import { IWSIViewport, WSIViewportProperties, Point3, Point2, ICamera, WSIViewportInput } from '../types';
import { Transform } from './helpers/cpuFallback/rendering/transform';
import Viewport from './Viewport';
declare class WSIViewport extends Viewport implements IWSIViewport {
    modality: any;
    protected imageIds: string[];
    readonly uid: any;
    readonly renderingEngineId: string;
    private frameOfReferenceUID;
    protected metadata: any;
    protected metadataDicomweb: any;
    private microscopyElement;
    protected map: any;
    private internalCamera;
    private viewer;
    private voiRange;
    constructor(props: WSIViewportInput);
    static get useCustomRenderingPipeline(): boolean;
    private addEventListeners;
    private removeEventListeners;
    private elementDisabledHandler;
    private getImageDataMetadata;
    setFrameNumber(frame: number): Promise<void>;
    setProperties(props: WSIViewportProperties): void;
    getProperties: () => WSIViewportProperties;
    resetProperties(): void;
    protected getScalarData(): any;
    getImageData(): {
        dimensions: any;
        spacing: any;
        numComps: number;
        origin: any;
        direction: any;
        metadata: {
            Modality: any;
        };
        getScalarData: () => any;
        imageData: {
            getDirection: () => any;
            getDimensions: () => any;
            getRange: () => number[];
            getScalarData: () => any;
            getSpacing: () => any;
            worldToIndex: (point: Point3) => number[];
            indexToWorld: (point: Point3) => Point3;
        };
        hasPixelSpacing: boolean;
        calibration: import("../types").IImageCalibration;
        preScale: {
            scaled: boolean;
        };
    };
    hasImageURI(imageURI: string): boolean;
    setCamera(camera: ICamera): void;
    getCurrentImageId(): string;
    getFrameNumber(): number;
    getCamera(): ICamera;
    resetCamera: () => boolean;
    getNumberOfSlices: () => number;
    private getImportPath;
    getFrameOfReferenceUID: () => string;
    resize: () => void;
    canvasToWorld: (canvasPos: Point2) => Point3;
    worldToCanvas: (worldPos: Point3) => Point2;
    setDataIds(imageIds: string[]): void;
    setWSI(imageIds: string[], client: any): Promise<void>;
    postrender: () => void;
    scroll(delta: number): void;
    getRotation: () => number;
    protected canvasToIndex: (canvasPos: Point2) => Point2;
    protected indexToCanvas: (indexPos: Point2) => Point2;
    getSliceIndex(): number;
    getView(): any;
    private refreshRenderValues;
    customRenderViewportToCanvas: () => void;
    getZoom(): any;
    setZoom(zoom: number): void;
    protected getTransform(): Transform;
    getReferenceId(): string;
    getCurrentImageIdIndex(): number;
}
export default WSIViewport;
