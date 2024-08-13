import { VideoEnums as VideoViewportEnum } from '../enums';
import type { IVideoViewport, VideoViewportProperties, Point3, Point2, ICamera, VideoViewportInput, VOIRange, IImage, ViewReferenceSpecifier, ViewReference, ReferenceCompatibleOptions, ImageSetOptions } from '../types';
import { Transform } from './helpers/cpuFallback/rendering/transform';
import Viewport from './Viewport';
import CanvasActor from './CanvasActor';
export declare type CanvasScalarData = Uint8ClampedArray & {
    frameNumber?: number;
    getRange?: () => [number, number];
};
declare class VideoViewport extends Viewport implements IVideoViewport {
    static frameRangeExtractor: RegExp;
    modality: any;
    protected imageId: string;
    readonly uid: any;
    readonly renderingEngineId: string;
    readonly canvasContext: CanvasRenderingContext2D;
    private videoElement?;
    private videoWidth;
    private videoHeight;
    private loop;
    private mute;
    private isPlaying;
    private scrollSpeed;
    private playbackRate;
    private scalarData;
    private initialRender;
    private frameRange;
    protected metadata: any;
    private fps;
    private numberOfFrames;
    private videoCamera;
    private feFilter;
    private averageWhite;
    private voiRange;
    constructor(props: VideoViewportInput);
    static get useCustomRenderingPipeline(): boolean;
    private addEventListeners;
    private removeEventListeners;
    private elementDisabledHandler;
    getImageDataMetadata(image: IImage | string): {
        bitsAllocated: number;
        numComps: number;
        origin: any;
        rows: any;
        columns: any;
        direction: number[];
        dimensions: any[];
        spacing: any[];
        hasPixelSpacing: boolean;
        numVoxels: number;
        imagePlaneModule: any;
    };
    setDataIds(imageIds: string[], options?: ImageSetOptions): void;
    setVideo(imageId: string, frameNumber?: number): Promise<unknown>;
    setVideoURL(videoURL: string): Promise<unknown>;
    getImageIds(): string[];
    togglePlayPause(): boolean;
    play(): Promise<void>;
    pause(): Promise<void>;
    scroll(delta?: number): Promise<void>;
    start(): Promise<void>;
    end(): Promise<void>;
    setTime(timeInSeconds: number): Promise<void>;
    setFrameNumber(frame: number): Promise<void>;
    setFrameRange(frameRange: number[]): void;
    getFrameRange(): [number, number];
    setProperties(props: VideoViewportProperties): void;
    setPlaybackRate(rate?: number): void;
    setScrollSpeed(scrollSpeed?: number, unit?: VideoViewportEnum.SpeedUnit): void;
    getProperties: () => VideoViewportProperties;
    resetProperties(): void;
    protected getScalarData(): CanvasScalarData;
    getImageData(): {
        dimensions: any;
        spacing: any;
        origin: any;
        direction: any;
        metadata: {
            Modality: any;
        };
        getScalarData: () => CanvasScalarData;
        imageData: {
            getDirection: () => any;
            getDimensions: () => any;
            getRange: () => number[];
            getScalarData: () => CanvasScalarData;
            getSpacing: () => any;
            worldToIndex: (point: Point3) => number[];
            indexToWorld: (point: Point2, destPoint?: Point3) => Point3;
        };
        hasPixelSpacing: boolean;
        calibration: import("../types").IImageCalibration;
        preScale: {
            scaled: boolean;
        };
    };
    hasImageURI(imageURI: string): boolean;
    setVOI(voiRange: VOIRange): void;
    setWindowLevel(windowWidth?: number, windowCenter?: number): void;
    setAverageWhite(averageWhite: [number, number, number]): void;
    protected setColorTransform(): void;
    setCamera(camera: ICamera): void;
    getCurrentImageId(): string;
    getReferenceId(specifier?: ViewReferenceSpecifier): string;
    isReferenceViewable(viewRef: ViewReference, options?: ReferenceCompatibleOptions): boolean;
    getViewReference(viewRefSpecifier?: ViewReferenceSpecifier): ViewReference;
    getFrameNumber(): number;
    getCurrentImageIdIndex(): number;
    getSliceIndex(): number;
    getCamera(): ICamera;
    resetCamera: () => boolean;
    getNumberOfSlices: () => number;
    getFrameOfReferenceUID: () => string;
    resize: () => void;
    canvasToWorld: (canvasPos: Point2, destPos?: Point3) => Point3;
    worldToCanvas: (worldPos: Point3) => Point2;
    getPan(): Point2;
    getRotation: () => number;
    protected canvasToIndex: (canvasPos: Point2) => Point2;
    protected indexToCanvas: (indexPos: Point2) => Point2;
    private refreshRenderValues;
    private getWorldToCanvasRatio;
    private getCanvasToWorldRatio;
    customRenderViewportToCanvas: () => void;
    protected getTransform(): Transform;
    updateCameraClippingPlanesAndRange(): void;
    addImages(stackInputs: Array<any>): void;
    protected createActorMapper(image: any): CanvasActor;
    private renderFrame;
    private renderWhilstPlaying;
}
export default VideoViewport;
