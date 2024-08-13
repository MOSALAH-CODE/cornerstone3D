import { vec3 } from 'gl-matrix';
import { Events as EVENTS, MetadataModules } from '../enums';
import * as metaData from '../metaData';
import { Transform } from './helpers/cpuFallback/rendering/transform';
import Viewport from './Viewport';
import { getOrCreateCanvas } from './helpers';
import { EPSILON } from '../constants';
import { triggerEvent } from '../utilities';
const _map = Symbol.for('map');
const EVENT_POSTRENDER = 'postrender';
class WSIViewport extends Viewport {
    constructor(props) {
        super({
            ...props,
            canvas: props.canvas || getOrCreateCanvas(props.element),
        });
        this.internalCamera = {
            rotation: 0,
            centerIndex: [0, 0],
            extent: [0, -2, 1, -1],
            xSpacing: 1,
            ySpacing: 1,
            resolution: 1,
            zoom: 1,
        };
        this.voiRange = {
            lower: 0,
            upper: 255,
        };
        this.getProperties = () => {
            return {};
        };
        this.resetCamera = () => {
            return true;
        };
        this.getNumberOfSlices = () => {
            return 1;
        };
        this.getFrameOfReferenceUID = () => {
            return this.frameOfReferenceUID;
        };
        this.resize = () => {
            const canvas = this.canvas;
            const { clientWidth, clientHeight } = canvas;
            if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
                canvas.width = clientWidth;
                canvas.height = clientHeight;
            }
            this.refreshRenderValues();
        };
        this.canvasToWorld = (canvasPos) => {
            if (!this.metadata) {
                return;
            }
            const [px, py] = this.canvasToIndex(canvasPos);
            const { origin, spacing, direction } = this.getImageData();
            const worldPos = vec3.fromValues(0, 0, 0);
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            vec3.scaleAndAdd(worldPos, origin, iVector, px * spacing[0]);
            vec3.scaleAndAdd(worldPos, worldPos, jVector, py * spacing[1]);
            return [worldPos[0], worldPos[1], worldPos[2]];
        };
        this.worldToCanvas = (worldPos) => {
            if (!this.metadata) {
                return;
            }
            const { spacing, direction, origin } = this.metadata;
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            const diff = vec3.subtract([0, 0, 0], worldPos, origin);
            const indexPoint = [
                vec3.dot(diff, iVector) / spacing[0],
                vec3.dot(diff, jVector) / spacing[1],
            ];
            const canvasPoint = this.indexToCanvas(indexPoint);
            return canvasPoint;
        };
        this.postrender = () => {
            this.refreshRenderValues();
            triggerEvent(this.element, EVENTS.IMAGE_RENDERED, {
                element: this.element,
                viewportId: this.id,
                viewport: this,
                renderingEngineId: this.renderingEngineId,
            });
        };
        this.getRotation = () => 0;
        this.canvasToIndex = (canvasPos) => {
            const transform = this.getTransform();
            transform.invert();
            return transform.transformPoint(canvasPos);
        };
        this.indexToCanvas = (indexPos) => {
            const transform = this.getTransform();
            return transform.transformPoint(indexPos);
        };
        this.customRenderViewportToCanvas = () => {
        };
        this.renderingEngineId = props.renderingEngineId;
        this.element.setAttribute('data-viewport-uid', this.id);
        this.element.setAttribute('data-rendering-engine-uid', this.renderingEngineId);
        this.element.style.position = 'relative';
        this.microscopyElement = document.createElement('div');
        this.microscopyElement.id = crypto.randomUUID();
        this.microscopyElement.innerText = 'Initial';
        this.microscopyElement.style.background = 'grey';
        this.microscopyElement.style.width = '100%';
        this.microscopyElement.style.height = '100%';
        this.microscopyElement.style.position = 'absolute';
        this.microscopyElement.style.left = '0';
        this.microscopyElement.style.top = '0';
        const cs3dElement = this.element.firstElementChild;
        cs3dElement.insertBefore(this.microscopyElement, cs3dElement.childNodes[1]);
        this.addEventListeners();
        this.resize();
    }
    static get useCustomRenderingPipeline() {
        return true;
    }
    addEventListeners() {
        this.canvas.addEventListener(EVENTS.ELEMENT_DISABLED, this.elementDisabledHandler);
    }
    removeEventListeners() {
        this.canvas.removeEventListener(EVENTS.ELEMENT_DISABLED, this.elementDisabledHandler);
    }
    elementDisabledHandler() {
        this.removeEventListeners();
    }
    getImageDataMetadata(imageIndex = 0) {
        const maxImage = this.metadataDicomweb.reduce((maxImage, image) => {
            return maxImage?.NumberOfFrames < image.NumberOfFrames ? image : maxImage;
        });
        const { TotalPixelMatrixColumns: columns, TotalPixelMatrixRows: rows, ImageOrientationSlide, ImagedVolumeWidth: width, ImagedVolumeHeight: height, ImagedVolumeDepth: depth, } = maxImage;
        const imagePlaneModule = metaData.get(MetadataModules.IMAGE_PLANE, this.imageIds[imageIndex]);
        let rowCosines = ImageOrientationSlide.slice(0, 3);
        let columnCosines = ImageOrientationSlide.slice(3, 6);
        if (rowCosines == null || columnCosines == null) {
            rowCosines = [1, 0, 0];
            columnCosines = [0, 1, 0];
        }
        const rowCosineVec = vec3.fromValues(rowCosines[0], rowCosines[1], rowCosines[2]);
        const colCosineVec = vec3.fromValues(columnCosines[0], columnCosines[1], columnCosines[2]);
        const scanAxisNormal = vec3.create();
        vec3.cross(scanAxisNormal, rowCosineVec, colCosineVec);
        const { XOffsetInSlideCoordinateSystem = 0, YOffsetInSlideCoordinateSystem = 0, ZOffsetInSlideCoordinateSystem = 0, } = maxImage.TotalPixelMatrixOriginSequence?.[0] || {};
        const origin = [
            XOffsetInSlideCoordinateSystem,
            YOffsetInSlideCoordinateSystem,
            ZOffsetInSlideCoordinateSystem,
        ];
        const xSpacing = width / columns;
        const ySpacing = height / rows;
        const xVoxels = columns;
        const yVoxels = rows;
        const zSpacing = depth;
        const zVoxels = 1;
        this.hasPixelSpacing = !!(width && height);
        return {
            bitsAllocated: 8,
            numComps: 3,
            origin,
            direction: [...rowCosineVec, ...colCosineVec, ...scanAxisNormal],
            dimensions: [xVoxels, yVoxels, zVoxels],
            spacing: [xSpacing, ySpacing, zSpacing],
            hasPixelSpacing: this.hasPixelSpacing,
            numVoxels: xVoxels * yVoxels * zVoxels,
            imagePlaneModule,
        };
    }
    async setFrameNumber(frame) {
    }
    setProperties(props) {
    }
    resetProperties() {
        this.setProperties({});
    }
    getScalarData() {
        return null;
    }
    getImageData() {
        const { metadata } = this;
        const spacing = metadata.spacing;
        return {
            dimensions: metadata.dimensions,
            spacing,
            numComps: 3,
            origin: metadata.origin,
            direction: metadata.direction,
            metadata: { Modality: this.modality },
            getScalarData: () => this.getScalarData(),
            imageData: {
                getDirection: () => metadata.direction,
                getDimensions: () => metadata.dimensions,
                getRange: () => [0, 255],
                getScalarData: () => this.getScalarData(),
                getSpacing: () => metadata.spacing,
                worldToIndex: (point) => {
                    const canvasPoint = this.worldToCanvas(point);
                    const pixelCoord = this.canvasToIndex(canvasPoint);
                    return [pixelCoord[0], pixelCoord[1], 0];
                },
                indexToWorld: (point) => {
                    const canvasPoint = this.indexToCanvas([point[0], point[1]]);
                    return this.canvasToWorld(canvasPoint);
                },
            },
            hasPixelSpacing: this.hasPixelSpacing,
            calibration: this.calibration,
            preScale: {
                scaled: false,
            },
        };
    }
    hasImageURI(imageURI) {
        return true;
    }
    setCamera(camera) {
        const previousCamera = this.getCamera();
        const { parallelScale, focalPoint } = camera;
        const view = this.getView();
        const { xSpacing } = this.internalCamera;
        if (parallelScale) {
            const worldToCanvasRatio = this.element.clientHeight / parallelScale;
            const resolution = 1 / xSpacing / worldToCanvasRatio;
            view.setResolution(resolution);
        }
        if (focalPoint) {
            const newCanvas = this.worldToCanvas(focalPoint);
            const newIndex = this.canvasToIndex(newCanvas);
            view.setCenter(newIndex);
        }
        const updatedCamera = this.getCamera();
        this.triggerCameraModifiedEventIfNecessary(previousCamera, updatedCamera);
    }
    getCurrentImageId() {
        return this.imageIds[0];
    }
    getFrameNumber() {
        return 1;
    }
    getCamera() {
        this.refreshRenderValues();
        const { resolution, xSpacing } = this.internalCamera;
        const canvasToWorldRatio = resolution * xSpacing;
        const canvasCenter = [
            this.element.clientWidth / 2,
            this.element.clientHeight / 2,
        ];
        const focalPoint = this.canvasToWorld(canvasCenter);
        return {
            parallelProjection: true,
            focalPoint,
            position: focalPoint,
            viewUp: [0, -1, 0],
            parallelScale: this.element.clientHeight * canvasToWorldRatio,
            viewPlaneNormal: [0, 0, 1],
        };
    }
    getImportPath() {
        return '/dicom-microscopy-viewer/dicomMicroscopyViewer.min.js';
    }
    setDataIds(imageIds) {
        const webClient = metaData.get(MetadataModules.WEB_CLIENT, imageIds[0]);
        if (!webClient) {
            throw new Error(`To use setDataIds on WSI data, you must provide metaData.webClient for ${imageIds[0]}`);
        }
        this.setWSI(imageIds, webClient);
    }
    async setWSI(imageIds, client) {
        this.microscopyElement.style.background = 'red';
        this.microscopyElement.innerText = 'Loading';
        this.imageIds = imageIds;
        await import(this.getImportPath());
        const DicomMicroscopyViewer = window.dicomMicroscopyViewer;
        this.frameOfReferenceUID = null;
        const metadataDicomweb = this.imageIds.map((imageId) => {
            const imageMetadata = client.getDICOMwebMetadata(imageId);
            Object.defineProperty(imageMetadata, 'isMultiframe', {
                value: imageMetadata.isMultiframe,
                enumerable: false,
            });
            Object.defineProperty(imageMetadata, 'frameNumber', {
                value: undefined,
                enumerable: false,
            });
            const imageType = imageMetadata['00080008']?.Value;
            if (imageType?.length === 1) {
                imageMetadata['00080008'].Value = imageType[0].split('\\');
            }
            const frameOfReference = imageMetadata['00200052']?.Value?.[0];
            if (!this.frameOfReferenceUID) {
                this.frameOfReferenceUID = frameOfReference;
            }
            else if (frameOfReference !== this.frameOfReferenceUID) {
                imageMetadata['00200052'].Value = [this.frameOfReferenceUID];
            }
            return imageMetadata;
        });
        const volumeImages = [];
        metadataDicomweb.forEach((m) => {
            const image = new DicomMicroscopyViewer.metadata.VLWholeSlideMicroscopyImage({
                metadata: m,
            });
            const imageFlavor = image.ImageType[2];
            if (imageFlavor === 'VOLUME' || imageFlavor === 'THUMBNAIL') {
                volumeImages.push(image);
            }
        });
        this.metadataDicomweb = volumeImages;
        const viewer = new DicomMicroscopyViewer.viewer.VolumeImageViewer({
            client,
            metadata: volumeImages,
            controls: [],
            bindings: {},
        });
        viewer.render({ container: this.microscopyElement });
        this.metadata = this.getImageDataMetadata();
        viewer.deactivateDragPanInteraction();
        this.viewer = viewer;
        this.map = viewer[_map];
        this.map.on(EVENT_POSTRENDER, this.postrender);
        this.resize();
        this.microscopyElement.innerText = '';
        Object.assign(this.microscopyElement.style, {
            '--ol-partial-background-color': 'rgba(127, 127, 127, 0.7)',
            '--ol-foreground-color': '#000000',
            '--ol-subtle-foreground-color': '#000',
            '--ol-subtle-background-color': 'rgba(78, 78, 78, 0.5)',
            background: 'none',
        });
    }
    scroll(delta) {
        const camera = this.getCamera();
        this.setCamera({
            parallelScale: camera.parallelScale * (1 + 0.1 * delta),
        });
    }
    getSliceIndex() {
        return 0;
    }
    getView() {
        if (!this.viewer) {
            return;
        }
        const map = this.viewer[_map];
        const anyWindow = window;
        anyWindow.map = map;
        anyWindow.viewer = this.viewer;
        anyWindow.view = map?.getView();
        anyWindow.wsi = this;
        return map?.getView();
    }
    refreshRenderValues() {
        const view = this.getView();
        if (!view) {
            return;
        }
        const resolution = view.getResolution();
        if (!resolution || resolution < EPSILON) {
            return;
        }
        const centerIndex = view.getCenter();
        const extent = view.getProjection().getExtent();
        const rotation = view.getRotation();
        const zoom = view.getZoom();
        const { metadata: { spacing: [xSpacing, ySpacing], }, } = this;
        const worldToCanvasRatio = 1 / resolution / xSpacing;
        Object.assign(this.internalCamera, {
            extent,
            centerIndex,
            worldToCanvasRatio,
            xSpacing,
            ySpacing,
            resolution,
            rotation,
            zoom,
        });
    }
    getZoom() {
        return this.getView()?.getZoom();
    }
    setZoom(zoom) {
        this.getView()?.setZoom(zoom);
    }
    getTransform() {
        this.refreshRenderValues();
        const { centerIndex: center, resolution, rotation } = this.internalCamera;
        const halfCanvas = [this.canvas.width / 2, this.canvas.height / 2];
        const transform = new Transform();
        transform.translate(halfCanvas[0], halfCanvas[1]);
        transform.rotate(rotation);
        transform.scale(1 / resolution, -1 / resolution);
        transform.translate(-center[0], -center[1]);
        return transform;
    }
    getReferenceId() {
        return `imageId:${this.getCurrentImageId()}`;
    }
    getCurrentImageIdIndex() {
        return 0;
    }
}
export default WSIViewport;
//# sourceMappingURL=WSIViewport.js.map