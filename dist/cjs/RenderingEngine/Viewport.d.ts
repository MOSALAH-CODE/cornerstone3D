import type { vtkCamera } from '@kitware/vtk.js/Rendering/Core/Camera';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import ViewportStatus from '../enums/ViewportStatus';
import ViewportType from '../enums/ViewportType';
import type { ICamera, ActorEntry, IRenderingEngine, ViewportInputOptions, Point2, Point3, FlipDirection, DisplayArea, ViewPresentation, ViewReference, ViewportProperties } from '../types';
import type { ViewportInput, IViewport, ViewReferenceSpecifier, ReferenceCompatibleOptions, ViewPresentationSelector, DataSetOptions } from '../types/IViewport';
import type { vtkSlabCamera } from './vtkClasses/vtkSlabCamera';
import IImageCalibration from '../types/IImageCalibration';
import { InterpolationType } from '../enums';
declare class Viewport implements IViewport {
    static readonly CameraViewPresentation: ViewPresentationSelector;
    static readonly TransferViewPresentation: ViewPresentationSelector;
    readonly id: string;
    readonly element: HTMLDivElement;
    readonly canvas: HTMLCanvasElement;
    readonly renderingEngineId: string;
    readonly type: ViewportType;
    protected insetImageMultiplier: number;
    protected flipHorizontal: boolean;
    protected flipVertical: boolean;
    isDisabled: boolean;
    viewportStatus: ViewportStatus;
    sx: number;
    sy: number;
    sWidth: number;
    sHeight: number;
    _actors: Map<string, any>;
    readonly defaultOptions: Record<string, any>;
    options: ViewportInputOptions;
    _suppressCameraModifiedEvents: boolean;
    readonly suppressEvents: boolean;
    protected hasPixelSpacing: boolean;
    protected calibration: IImageCalibration;
    protected initialCamera: ICamera;
    protected fitToCanvasCamera: ICamera;
    constructor(props: ViewportInput);
    getRotation: () => number;
    getFrameOfReferenceUID: () => string;
    canvasToWorld: (canvasPos: Point2) => Point3;
    worldToCanvas: (worldPos: Point3) => Point2;
    customRenderViewportToCanvas: () => unknown;
    resize: () => void;
    getProperties: () => ViewportProperties;
    updateRenderingPipeline: () => void;
    getNumberOfSlices: () => number;
    protected setRotation: (_rotation: number) => void;
    static get useCustomRenderingPipeline(): boolean;
    private viewportWidgets;
    addWidget: (widgetId: any, widget: any) => void;
    getWidget: (id: any) => any;
    getWidgets: () => any[];
    removeWidgets: () => void;
    setRendered(): void;
    getRenderingEngine(): IRenderingEngine;
    getRenderer(): any;
    render(): void;
    setOptions(options: ViewportInputOptions, immediate?: boolean): void;
    reset(immediate?: boolean): void;
    protected flip({ flipHorizontal, flipVertical }: FlipDirection): void;
    private getDefaultImageData;
    getDefaultActor(): ActorEntry;
    getActors(): Array<ActorEntry>;
    getActorUIDs(): Array<string>;
    getActor(actorUID: string): ActorEntry;
    getActorUIDByIndex(index: number): string;
    getActorByIndex(index: number): ActorEntry;
    setActors(actors: Array<ActorEntry>): void;
    _removeActor(actorUID: string): void;
    removeActors(actorUIDs: Array<string>): void;
    addActors(actors: Array<ActorEntry>, resetCameraPanAndZoom?: boolean): void;
    addActor(actorEntry: ActorEntry): void;
    removeAllActors(): void;
    protected resetCameraNoEvent(): void;
    protected setCameraNoEvent(camera: ICamera): void;
    private _getViewImageDataIntersections;
    protected setInterpolationType(_interpolationType: InterpolationType, _arg?: any): void;
    setDisplayArea(displayArea: DisplayArea, suppressEvents?: boolean): void;
    protected setDisplayAreaScale(displayArea: DisplayArea): void;
    protected setDisplayAreaFit(displayArea: DisplayArea): void;
    getDisplayArea(): DisplayArea | undefined;
    resetCamera(resetPan?: boolean, resetZoom?: boolean, resetToCenter?: boolean, storeAsInitialCamera?: boolean): boolean;
    protected setInitialCamera(camera: ICamera): void;
    protected setFitToCanvasCamera(camera: ICamera): void;
    getPan(initialCamera?: ICamera): Point2;
    getCurrentImageIdIndex(): number;
    getSliceIndex(): number;
    getReferenceId(_specifier?: ViewReferenceSpecifier): string;
    setPan(pan: Point2, storeAsInitialCamera?: boolean): void;
    getZoom(compareCamera?: ICamera): number;
    setZoom(value: number, storeAsInitialCamera?: boolean): void;
    private _getFocalPointForViewPlaneReset;
    getCanvas(): HTMLCanvasElement;
    protected getVtkActiveCamera(): vtkCamera | vtkSlabCamera;
    getCamera(): ICamera;
    setCamera(cameraInterface: ICamera, storeAsInitialCamera?: boolean): void;
    triggerCameraModifiedEventIfNecessary(previousCamera: ICamera, updatedCamera: ICamera): void;
    updateCameraClippingPlanesAndRange(): void;
    protected updateClippingPlanesForActors(updatedCamera: ICamera): Promise<void>;
    setOrientationOfClippingPlanes(vtkPlanes: Array<vtkPlane>, slabThickness: number, viewPlaneNormal: Point3, focalPoint: Point3): void;
    getClippingPlanesForActor(actorEntry?: ActorEntry): vtkPlane[];
    private _getWorldDistanceViewUpAndViewRight;
    getViewReference(viewRefSpecifier?: ViewReferenceSpecifier): ViewReference;
    isReferenceViewable(viewRef: ViewReference, options?: ReferenceCompatibleOptions): boolean;
    getViewPresentation(viewPresSel?: ViewPresentationSelector): ViewPresentation;
    setViewReference(viewRef: ViewReference): void;
    setViewPresentation(viewPres: ViewPresentation): void;
    protected _shouldUseNativeDataType(): boolean;
    _getCorners(bounds: Array<number>): Array<number>[];
    _getFocalPointForResetCamera(centeredFocalPoint: Point3, previousCamera: ICamera, { resetPan, resetToCenter }: {
        resetPan?: boolean;
        resetToCenter?: boolean;
    }): Point3;
    _isInBounds(point: Point3, bounds: number[]): boolean;
    _getEdges(bounds: Array<number>): Array<[number[], number[]]>;
    static boundsRadius(bounds: number[]): number;
    setDataIds(_imageIds: string[], _options?: DataSetOptions): void;
}
export default Viewport;
