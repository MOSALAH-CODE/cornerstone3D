"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const DataArray_1 = __importDefault(require("@kitware/vtk.js/Common/Core/DataArray"));
const ImageData_1 = __importDefault(require("@kitware/vtk.js/Common/DataModel/ImageData"));
const Camera_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/Camera"));
const ColorTransferFunction_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ColorTransferFunction"));
const ColorMaps_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps"));
const ImageMapper_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ImageMapper"));
const ImageSlice_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ImageSlice"));
const gl_matrix_1 = require("gl-matrix");
const eventTarget_1 = __importDefault(require("../eventTarget"));
const metaData = __importStar(require("../metaData"));
const lodash_clonedeep_1 = __importDefault(require("lodash.clonedeep"));
const utilities_1 = require("../utilities");
const Viewport_1 = __importDefault(require("./Viewport"));
const index_1 = require("./helpers/cpuFallback/colors/index");
const drawImageSync_1 = __importDefault(require("./helpers/cpuFallback/drawImageSync"));
const enums_1 = require("../enums");
const imageLoader_1 = require("../loaders/imageLoader");
const imageLoadPoolManager_1 = __importDefault(require("../requestPool/imageLoadPoolManager"));
const calculateTransform_1 = __importDefault(require("./helpers/cpuFallback/rendering/calculateTransform"));
const canvasToPixel_1 = __importDefault(require("./helpers/cpuFallback/rendering/canvasToPixel"));
const getDefaultViewport_1 = __importDefault(require("./helpers/cpuFallback/rendering/getDefaultViewport"));
const pixelToCanvas_1 = __importDefault(require("./helpers/cpuFallback/rendering/pixelToCanvas"));
const resize_1 = __importDefault(require("./helpers/cpuFallback/rendering/resize"));
const cache_1 = __importDefault(require("../cache"));
const init_1 = require("../init");
const ProgressiveRetrieveImages_1 = require("../loaders/ProgressiveRetrieveImages");
const createLinearRGBTransferFunction_1 = __importDefault(require("../utilities/createLinearRGBTransferFunction"));
const transferFunctionUtils_1 = require("../utilities/transferFunctionUtils");
const correctShift_1 = __importDefault(require("./helpers/cpuFallback/rendering/correctShift"));
const resetCamera_1 = __importDefault(require("./helpers/cpuFallback/rendering/resetCamera"));
const transform_1 = require("./helpers/cpuFallback/rendering/transform");
const colormap_1 = require("../utilities/colormap");
const EPSILON = 1;
class StackViewport extends Viewport_1.default {
    constructor(props) {
        super(props);
        this.imagesLoader = this;
        this.perImageIdDefaultProperties = new Map();
        this.voiUpdatedWithSetProperties = false;
        this.invert = false;
        this.initialInvert = false;
        this.initialTransferFunctionNodes = null;
        this.stackInvalidated = false;
        this._publishCalibratedEvent = false;
        this.useNativeDataType = false;
        this.updateRenderingPipeline = () => {
            this._configureRenderingPipeline();
        };
        this.resize = () => {
            if (this.useCPURendering) {
                this._resizeCPU();
            }
        };
        this._resizeCPU = () => {
            if (this._cpuFallbackEnabledElement.viewport) {
                (0, resize_1.default)(this._cpuFallbackEnabledElement);
            }
        };
        this.getFrameOfReferenceUID = (sliceIndex) => { var _a; return (_a = this.getImagePlaneReferenceData(sliceIndex)) === null || _a === void 0 ? void 0 : _a.FrameOfReferenceUID; };
        this.getCornerstoneImage = () => this.csImage;
        this.createActorMapper = (imageData) => {
            const mapper = ImageMapper_1.default.newInstance();
            mapper.setInputData(imageData);
            const actor = ImageSlice_1.default.newInstance();
            actor.setMapper(mapper);
            const { preferSizeOverAccuracy } = (0, init_1.getConfiguration)().rendering;
            if (preferSizeOverAccuracy) {
                mapper.setPreferSizeOverAccuracy(true);
            }
            if (imageData.getPointData().getNumberOfComponents() > 1) {
                actor.getProperty().setIndependentComponents(false);
            }
            return actor;
        };
        this.getNumberOfSlices = () => {
            return this.imageIds.length;
        };
        this.getDefaultProperties = (imageId) => {
            let imageProperties;
            if (imageId !== undefined) {
                imageProperties = this.perImageIdDefaultProperties.get(imageId);
            }
            if (imageProperties !== undefined) {
                return imageProperties;
            }
            return Object.assign(Object.assign({}, this.globalDefaultProperties), { rotation: this.getRotation() });
        };
        this.getProperties = () => {
            const { colormap, voiRange, VOILUTFunction, interpolationType, invert, voiUpdatedWithSetProperties, } = this;
            const rotation = this.getRotation();
            return {
                colormap,
                voiRange,
                VOILUTFunction,
                interpolationType,
                invert,
                rotation,
                isComputedVOI: !voiUpdatedWithSetProperties,
            };
        };
        this.getRotationCPU = () => {
            const { viewport } = this._cpuFallbackEnabledElement;
            return viewport.rotation;
        };
        this.getRotationGPU = () => {
            const { viewUp: currentViewUp, viewPlaneNormal, flipVertical, } = this.getCamera();
            const initialViewUp = flipVertical
                ? gl_matrix_1.vec3.negate(gl_matrix_1.vec3.create(), this.initialViewUp)
                : this.initialViewUp;
            const initialToCurrentViewUpAngle = (gl_matrix_1.vec3.angle(initialViewUp, currentViewUp) * 180) / Math.PI;
            const initialToCurrentViewUpCross = gl_matrix_1.vec3.cross(gl_matrix_1.vec3.create(), initialViewUp, currentViewUp);
            const normalDot = gl_matrix_1.vec3.dot(initialToCurrentViewUpCross, viewPlaneNormal);
            return normalDot >= 0
                ? initialToCurrentViewUpAngle
                : (360 - initialToCurrentViewUpAngle) % 360;
        };
        this.setRotation = (rotation) => {
            const previousCamera = this.getCamera();
            this.useCPURendering
                ? this.setRotationCPU(rotation)
                : this.setRotationGPU(rotation);
            if (this._suppressCameraModifiedEvents) {
                return;
            }
            const camera = this.getCamera();
            const eventDetail = {
                previousCamera,
                camera,
                element: this.element,
                viewportId: this.id,
                renderingEngineId: this.renderingEngineId,
                rotation,
            };
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.CAMERA_MODIFIED, eventDetail);
        };
        this.renderImageObject = (image) => {
            this._setCSImage(image);
            const renderFn = this.useCPURendering
                ? this._updateToDisplayImageCPU
                : this._updateActorToDisplayImageId;
            renderFn.call(this, image);
        };
        this._setCSImage = (image) => {
            var _a;
            image.isPreScaled = (_a = image.preScale) === null || _a === void 0 ? void 0 : _a.scaled;
            this.csImage = image;
        };
        this.canvasToWorldCPU = (canvasPos, worldPos = [0, 0, 0]) => {
            if (!this._cpuFallbackEnabledElement.image) {
                return;
            }
            const [px, py] = (0, canvasToPixel_1.default)(this._cpuFallbackEnabledElement, canvasPos);
            const { origin, spacing, direction } = this.getImageData();
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            gl_matrix_1.vec3.scaleAndAdd(worldPos, origin, iVector, px * spacing[0]);
            gl_matrix_1.vec3.scaleAndAdd(worldPos, worldPos, jVector, py * spacing[1]);
            return worldPos;
        };
        this.worldToCanvasCPU = (worldPos) => {
            const { spacing, direction, origin } = this.getImageData();
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            const diff = gl_matrix_1.vec3.subtract(gl_matrix_1.vec3.create(), worldPos, origin);
            const indexPoint = [
                gl_matrix_1.vec3.dot(diff, iVector) / spacing[0],
                gl_matrix_1.vec3.dot(diff, jVector) / spacing[1],
            ];
            const canvasPoint = (0, pixelToCanvas_1.default)(this._cpuFallbackEnabledElement, indexPoint);
            return canvasPoint;
        };
        this.canvasToWorldGPU = (canvasPos) => {
            const renderer = this.getRenderer();
            const vtkCamera = this.getVtkActiveCamera();
            const crange = vtkCamera.getClippingRange();
            const distance = vtkCamera.getDistance();
            vtkCamera.setClippingRange(distance, distance + 0.1);
            const offscreenMultiRenderWindow = this.getRenderingEngine().offscreenMultiRenderWindow;
            const openGLRenderWindow = offscreenMultiRenderWindow.getOpenGLRenderWindow();
            const size = openGLRenderWindow.getSize();
            const devicePixelRatio = window.devicePixelRatio || 1;
            const canvasPosWithDPR = [
                canvasPos[0] * devicePixelRatio,
                canvasPos[1] * devicePixelRatio,
            ];
            const displayCoord = [
                canvasPosWithDPR[0] + this.sx,
                canvasPosWithDPR[1] + this.sy,
            ];
            displayCoord[1] = size[1] - displayCoord[1];
            const worldCoord = openGLRenderWindow.displayToWorld(displayCoord[0], displayCoord[1], 0, renderer);
            vtkCamera.setClippingRange(crange[0], crange[1]);
            return [worldCoord[0], worldCoord[1], worldCoord[2]];
        };
        this.worldToCanvasGPU = (worldPos) => {
            const renderer = this.getRenderer();
            const vtkCamera = this.getVtkActiveCamera();
            const crange = vtkCamera.getClippingRange();
            const distance = vtkCamera.getDistance();
            vtkCamera.setClippingRange(distance, distance + 0.1);
            const offscreenMultiRenderWindow = this.getRenderingEngine().offscreenMultiRenderWindow;
            const openGLRenderWindow = offscreenMultiRenderWindow.getOpenGLRenderWindow();
            const size = openGLRenderWindow.getSize();
            const displayCoord = openGLRenderWindow.worldToDisplay(...worldPos, renderer);
            displayCoord[1] = size[1] - displayCoord[1];
            const canvasCoord = [
                displayCoord[0] - this.sx,
                displayCoord[1] - this.sy,
            ];
            vtkCamera.setClippingRange(crange[0], crange[1]);
            const devicePixelRatio = window.devicePixelRatio || 1;
            const canvasCoordWithDPR = [
                canvasCoord[0] / devicePixelRatio,
                canvasCoord[1] / devicePixelRatio,
            ];
            return canvasCoordWithDPR;
        };
        this.getCurrentImageIdIndex = () => {
            return this.currentImageIdIndex;
        };
        this.getSliceIndex = () => {
            return this.currentImageIdIndex;
        };
        this.getTargetImageIdIndex = () => {
            return this.targetImageIdIndex;
        };
        this.getImageIds = () => {
            return this.imageIds;
        };
        this.getCurrentImageId = () => {
            return this.imageIds[this.currentImageIdIndex];
        };
        this.hasImageId = (imageId) => {
            return this.imageIds.includes(imageId);
        };
        this.hasImageURI = (imageURI) => {
            const imageIds = this.imageIds;
            for (let i = 0; i < imageIds.length; i++) {
                if ((0, utilities_1.imageIdToURI)(imageIds[i]) === imageURI) {
                    return true;
                }
            }
            return false;
        };
        this.customRenderViewportToCanvas = () => {
            if (!this.useCPURendering) {
                throw new Error('Custom cpu rendering pipeline should only be hit in CPU rendering mode');
            }
            if (this._cpuFallbackEnabledElement.image) {
                (0, drawImageSync_1.default)(this._cpuFallbackEnabledElement, this.cpuRenderingInvalidated);
                this.cpuRenderingInvalidated = false;
            }
            else {
                this.fillWithBackgroundColor();
            }
            return {
                canvas: this.canvas,
                element: this.element,
                viewportId: this.id,
                renderingEngineId: this.renderingEngineId,
                viewportStatus: this.viewportStatus,
            };
        };
        this.renderingPipelineFunctions = {
            getImageData: {
                cpu: this.getImageDataCPU,
                gpu: this.getImageDataGPU,
            },
            setColormap: {
                cpu: this.setColormapCPU,
                gpu: this.setColormapGPU,
            },
            getCamera: {
                cpu: this.getCameraCPU,
                gpu: super.getCamera,
            },
            setCamera: {
                cpu: this.setCameraCPU,
                gpu: super.setCamera,
            },
            getPan: {
                cpu: this.getPanCPU,
                gpu: super.getPan,
            },
            setPan: {
                cpu: this.setPanCPU,
                gpu: super.setPan,
            },
            getZoom: {
                cpu: this.getZoomCPU,
                gpu: super.getZoom,
            },
            setZoom: {
                cpu: this.setZoomCPU,
                gpu: super.setZoom,
            },
            setVOI: {
                cpu: this.setVOICPU,
                gpu: this.setVOIGPU,
            },
            getRotation: {
                cpu: this.getRotationCPU,
                gpu: this.getRotationGPU,
            },
            setInterpolationType: {
                cpu: this.setInterpolationTypeCPU,
                gpu: this.setInterpolationTypeGPU,
            },
            setInvertColor: {
                cpu: this.setInvertColorCPU,
                gpu: this.setInvertColorGPU,
            },
            resetCamera: {
                cpu: (resetPan = true, resetZoom = true) => {
                    this.resetCameraCPU(resetPan, resetZoom);
                    return true;
                },
                gpu: (resetPan = true, resetZoom = true) => {
                    this.resetCameraGPU(resetPan, resetZoom);
                    return true;
                },
            },
            canvasToWorld: {
                cpu: this.canvasToWorldCPU,
                gpu: this.canvasToWorldGPU,
            },
            worldToCanvas: {
                cpu: this.worldToCanvasCPU,
                gpu: this.worldToCanvasGPU,
            },
            getRenderer: {
                cpu: () => this.getCPUFallbackError('getRenderer'),
                gpu: super.getRenderer,
            },
            getDefaultActor: {
                cpu: () => this.getCPUFallbackError('getDefaultActor'),
                gpu: super.getDefaultActor,
            },
            getActors: {
                cpu: () => this.getCPUFallbackError('getActors'),
                gpu: super.getActors,
            },
            getActor: {
                cpu: () => this.getCPUFallbackError('getActor'),
                gpu: super.getActor,
            },
            setActors: {
                cpu: () => this.getCPUFallbackError('setActors'),
                gpu: super.setActors,
            },
            addActors: {
                cpu: () => this.getCPUFallbackError('addActors'),
                gpu: super.addActors,
            },
            addActor: {
                cpu: () => this.getCPUFallbackError('addActor'),
                gpu: super.addActor,
            },
            removeAllActors: {
                cpu: () => this.getCPUFallbackError('removeAllActors'),
                gpu: super.removeAllActors,
            },
            unsetColormap: {
                cpu: this.unsetColormapCPU,
                gpu: this.unsetColormapGPU,
            },
        };
        this.scaling = {};
        this.modality = null;
        this.useCPURendering = (0, init_1.getShouldUseCPURendering)();
        this.useNativeDataType = this._shouldUseNativeDataType();
        this._configureRenderingPipeline();
        this.useCPURendering
            ? this._resetCPUFallbackElement()
            : this._resetGPUViewport();
        this.imageIds = [];
        this.currentImageIdIndex = 0;
        this.targetImageIdIndex = 0;
        this.cameraFocalPointOnRender = [0, 0, 0];
        this.resetCamera();
        this.initializeElementDisabledHandler();
    }
    setUseCPURendering(value) {
        this.useCPURendering = value;
        this._configureRenderingPipeline(value);
    }
    static get useCustomRenderingPipeline() {
        return (0, init_1.getShouldUseCPURendering)();
    }
    _configureRenderingPipeline(value) {
        this.useNativeDataType = this._shouldUseNativeDataType();
        this.useCPURendering = value !== null && value !== void 0 ? value : (0, init_1.getShouldUseCPURendering)();
        for (const [funcName, functions] of Object.entries(this.renderingPipelineFunctions)) {
            this[funcName] = this.useCPURendering ? functions.cpu : functions.gpu;
        }
        this.useCPURendering
            ? this._resetCPUFallbackElement()
            : this._resetGPUViewport();
    }
    _resetCPUFallbackElement() {
        this._cpuFallbackEnabledElement = {
            canvas: this.canvas,
            renderingTools: {},
            transform: new transform_1.Transform(),
            viewport: { rotation: 0 },
        };
    }
    _resetGPUViewport() {
        const renderer = this.getRenderer();
        const camera = Camera_1.default.newInstance();
        renderer.setActiveCamera(camera);
        const viewPlaneNormal = [0, 0, -1];
        this.initialViewUp = [0, -1, 0];
        camera.setDirectionOfProjection(-viewPlaneNormal[0], -viewPlaneNormal[1], -viewPlaneNormal[2]);
        camera.setViewUp(...this.initialViewUp);
        camera.setParallelProjection(true);
        camera.setThicknessFromFocalPoint(0.1);
        camera.setFreezeFocalPoint(true);
    }
    initializeElementDisabledHandler() {
        eventTarget_1.default.addEventListener(enums_1.Events.ELEMENT_DISABLED, function elementDisabledHandler() {
            clearTimeout(this.debouncedTimeout);
            eventTarget_1.default.removeEventListener(enums_1.Events.ELEMENT_DISABLED, elementDisabledHandler);
        });
    }
    getImageDataGPU() {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!(0, utilities_1.isImageActor)(defaultActor)) {
            return;
        }
        const { actor } = defaultActor;
        const vtkImageData = actor.getMapper().getInputData();
        return {
            dimensions: vtkImageData.getDimensions(),
            spacing: vtkImageData.getSpacing(),
            origin: vtkImageData.getOrigin(),
            direction: vtkImageData.getDirection(),
            scalarData: vtkImageData.getPointData().getScalars().getData(),
            imageData: actor.getMapper().getInputData(),
            metadata: { Modality: this.modality },
            scaling: this.scaling,
            hasPixelSpacing: this.hasPixelSpacing,
            calibration: Object.assign(Object.assign({}, this.csImage.calibration), this.calibration),
            preScale: Object.assign({}, this.csImage.preScale),
        };
    }
    getImageDataCPU() {
        const { metadata } = this._cpuFallbackEnabledElement;
        const spacing = metadata.spacing;
        return {
            dimensions: metadata.dimensions,
            spacing,
            origin: metadata.origin,
            direction: metadata.direction,
            metadata: { Modality: this.modality },
            scaling: this.scaling,
            imageData: {
                getDirection: () => metadata.direction,
                getDimensions: () => metadata.dimensions,
                getScalarData: () => this.cpuImagePixelData,
                getSpacing: () => spacing,
                worldToIndex: (point) => {
                    const canvasPoint = this.worldToCanvasCPU(point);
                    const pixelCoord = (0, canvasToPixel_1.default)(this._cpuFallbackEnabledElement, canvasPoint);
                    return [pixelCoord[0], pixelCoord[1], 0];
                },
                indexToWorld: (point, destPoint) => {
                    const canvasPoint = (0, pixelToCanvas_1.default)(this._cpuFallbackEnabledElement, [
                        point[0],
                        point[1],
                    ]);
                    return this.canvasToWorldCPU(canvasPoint, destPoint);
                },
            },
            scalarData: this.cpuImagePixelData,
            hasPixelSpacing: this.hasPixelSpacing,
            calibration: Object.assign(Object.assign({}, this.csImage.calibration), this.calibration),
            preScale: Object.assign({}, this.csImage.preScale),
        };
    }
    buildMetadata(image) {
        const imageId = image.imageId;
        const { pixelRepresentation, bitsAllocated, bitsStored, highBit, photometricInterpretation, samplesPerPixel, } = metaData.get('imagePixelModule', imageId);
        const { windowWidth, windowCenter, voiLUTFunction } = image;
        const { modality } = metaData.get('generalSeriesModule', imageId);
        const imageIdScalingFactor = metaData.get('scalingModule', imageId);
        const calibration = metaData.get(enums_1.MetadataModules.CALIBRATION, imageId);
        if (modality === 'PT' && imageIdScalingFactor) {
            this._addScalingToViewport(imageIdScalingFactor);
        }
        this.modality = modality;
        const voiLUTFunctionEnum = this._getValidVOILUTFunction(voiLUTFunction);
        this.VOILUTFunction = voiLUTFunctionEnum;
        this.calibration = calibration;
        let imagePlaneModule = this._getImagePlaneModule(imageId);
        if (!this.useCPURendering) {
            imagePlaneModule = this.calibrateIfNecessary(imageId, imagePlaneModule);
        }
        return {
            imagePlaneModule,
            imagePixelModule: {
                bitsAllocated,
                bitsStored,
                samplesPerPixel,
                highBit,
                photometricInterpretation,
                pixelRepresentation,
                windowWidth,
                windowCenter,
                modality,
                voiLUTFunction: voiLUTFunctionEnum,
            },
        };
    }
    calibrateIfNecessary(imageId, imagePlaneModule) {
        const calibration = metaData.get('calibratedPixelSpacing', imageId);
        const isUpdated = this.calibration !== calibration;
        const { scale } = calibration || {};
        this.hasPixelSpacing = scale > 0 || imagePlaneModule.rowPixelSpacing > 0;
        imagePlaneModule.calibration = calibration;
        if (!isUpdated) {
            return imagePlaneModule;
        }
        this.calibration = calibration;
        this._publishCalibratedEvent = true;
        this._calibrationEvent = {
            scale,
            calibration,
        };
        return imagePlaneModule;
    }
    setDefaultProperties(ViewportProperties, imageId) {
        if (imageId == null) {
            this.globalDefaultProperties = ViewportProperties;
        }
        else {
            this.perImageIdDefaultProperties.set(imageId, ViewportProperties);
            if (this.getCurrentImageId() === imageId) {
                this.setProperties(ViewportProperties);
            }
        }
    }
    clearDefaultProperties(imageId) {
        if (imageId == null) {
            this.globalDefaultProperties = {};
            this.resetProperties();
        }
        else {
            this.perImageIdDefaultProperties.delete(imageId);
            this.resetToDefaultProperties();
        }
    }
    setProperties({ colormap, voiRange, VOILUTFunction, invert, interpolationType, rotation, } = {}, suppressEvents = false) {
        this.viewportStatus = this.csImage
            ? enums_1.ViewportStatus.PRE_RENDER
            : enums_1.ViewportStatus.LOADING;
        if (this.globalDefaultProperties == null) {
            this.setDefaultProperties({
                colormap,
                voiRange,
                VOILUTFunction,
                invert,
                interpolationType,
                rotation,
            });
        }
        if (typeof colormap !== 'undefined') {
            this.setColormap(colormap);
        }
        if (typeof voiRange !== 'undefined') {
            const voiUpdatedWithSetProperties = true;
            this.setVOI(voiRange, { suppressEvents, voiUpdatedWithSetProperties });
        }
        if (typeof VOILUTFunction !== 'undefined') {
            this.setVOILUTFunction(VOILUTFunction, suppressEvents);
        }
        if (typeof invert !== 'undefined') {
            this.setInvertColor(invert);
        }
        if (typeof interpolationType !== 'undefined') {
            this.setInterpolationType(interpolationType);
        }
        if (typeof rotation !== 'undefined') {
            if (this.getRotation() !== rotation) {
                this.setRotation(rotation);
            }
        }
    }
    resetProperties() {
        this.cpuRenderingInvalidated = true;
        this.voiUpdatedWithSetProperties = false;
        this.viewportStatus = enums_1.ViewportStatus.PRE_RENDER;
        this.fillWithBackgroundColor();
        if (this.useCPURendering) {
            this._cpuFallbackEnabledElement.renderingTools = {};
        }
        this._resetProperties();
        this.render();
    }
    _resetProperties() {
        let voiRange;
        if (this._isCurrentImagePTPrescaled()) {
            voiRange = this._getDefaultPTPrescaledVOIRange();
        }
        else {
            voiRange = this._getVOIRangeForCurrentImage();
        }
        this.setVOI(voiRange);
        this.setInvertColor(this.initialInvert);
        this.setInterpolationType(enums_1.InterpolationType.LINEAR);
        if (this.getRotation() !== 0) {
            this.setRotation(0);
        }
        const transferFunction = this.getTransferFunction();
        (0, transferFunctionUtils_1.setTransferFunctionNodes)(transferFunction, this.initialTransferFunctionNodes);
        const nodes = (0, transferFunctionUtils_1.getTransferFunctionNodes)(transferFunction);
        const RGBPoints = nodes.reduce((acc, node) => {
            acc.push(node[0], node[1], node[2], node[3]);
            return acc;
        }, []);
        const defaultActor = this.getDefaultActor();
        const matchedColormap = (0, colormap_1.findMatchingColormap)(RGBPoints, defaultActor.actor);
        this.setColormap(matchedColormap);
    }
    resetToDefaultProperties() {
        var _a;
        this.cpuRenderingInvalidated = true;
        this.viewportStatus = enums_1.ViewportStatus.PRE_RENDER;
        this.fillWithBackgroundColor();
        if (this.useCPURendering) {
            this._cpuFallbackEnabledElement.renderingTools = {};
        }
        const currentImageId = this.getCurrentImageId();
        const properties = this.perImageIdDefaultProperties.get(currentImageId) ||
            this.globalDefaultProperties;
        if ((_a = properties.colormap) === null || _a === void 0 ? void 0 : _a.name) {
            this.setColormap(properties.colormap);
        }
        let voiRange;
        if (properties.voiRange == undefined) {
            voiRange = this._getVOIRangeForCurrentImage();
        }
        else {
            voiRange = properties.voiRange;
        }
        this.setVOI(voiRange);
        if (this.getRotation() !== 0) {
            this.setRotation(0);
        }
        this.setInterpolationType(enums_1.InterpolationType.LINEAR);
        this.setInvertColor(false);
        this.render();
    }
    _setPropertiesFromCache() {
        var _a;
        const { interpolationType, invert } = this;
        let voiRange;
        if (this.voiUpdatedWithSetProperties) {
            voiRange = this.voiRange;
        }
        else if (this._isCurrentImagePTPrescaled()) {
            voiRange = this._getDefaultPTPrescaledVOIRange();
        }
        else {
            voiRange = (_a = this._getVOIRangeForCurrentImage()) !== null && _a !== void 0 ? _a : this.voiRange;
        }
        this.setVOI(voiRange);
        this.setInterpolationType(interpolationType);
        this.setInvertColor(invert);
    }
    getCameraCPU() {
        const { metadata, viewport } = this._cpuFallbackEnabledElement;
        const { direction } = metadata;
        const viewPlaneNormal = direction.slice(6, 9).map((x) => -x);
        let viewUp = direction.slice(3, 6).map((x) => -x);
        if (viewport.rotation) {
            const rotationMatrix = gl_matrix_1.mat4.fromRotation(gl_matrix_1.mat4.create(), (viewport.rotation * Math.PI) / 180, viewPlaneNormal);
            viewUp = gl_matrix_1.vec3.transformMat4(gl_matrix_1.vec3.create(), viewUp, rotationMatrix);
        }
        const canvasCenter = [
            this.element.clientWidth / 2,
            this.element.clientHeight / 2,
        ];
        const canvasCenterWorld = this.canvasToWorld(canvasCenter);
        const topLeftWorld = this.canvasToWorld([0, 0]);
        const bottomLeftWorld = this.canvasToWorld([0, this.element.clientHeight]);
        const parallelScale = gl_matrix_1.vec3.distance(topLeftWorld, bottomLeftWorld) / 2;
        return {
            parallelProjection: true,
            focalPoint: canvasCenterWorld,
            position: [0, 0, 0],
            parallelScale,
            scale: viewport.scale,
            viewPlaneNormal: [
                viewPlaneNormal[0],
                viewPlaneNormal[1],
                viewPlaneNormal[2],
            ],
            viewUp: [viewUp[0], viewUp[1], viewUp[2]],
            flipHorizontal: this.flipHorizontal,
            flipVertical: this.flipVertical,
        };
    }
    setCameraCPU(cameraInterface) {
        const { viewport, image } = this._cpuFallbackEnabledElement;
        const previousCamera = this.getCameraCPU();
        const { focalPoint, parallelScale, scale, flipHorizontal, flipVertical } = cameraInterface;
        const { clientHeight } = this.element;
        if (focalPoint) {
            const focalPointCanvas = this.worldToCanvasCPU(focalPoint);
            const focalPointPixel = (0, canvasToPixel_1.default)(this._cpuFallbackEnabledElement, focalPointCanvas);
            const prevFocalPointCanvas = this.worldToCanvasCPU(previousCamera.focalPoint);
            const prevFocalPointPixel = (0, canvasToPixel_1.default)(this._cpuFallbackEnabledElement, prevFocalPointCanvas);
            const deltaPixel = gl_matrix_1.vec2.create();
            gl_matrix_1.vec2.subtract(deltaPixel, gl_matrix_1.vec2.fromValues(focalPointPixel[0], focalPointPixel[1]), gl_matrix_1.vec2.fromValues(prevFocalPointPixel[0], prevFocalPointPixel[1]));
            const shift = (0, correctShift_1.default)({ x: deltaPixel[0], y: deltaPixel[1] }, viewport);
            viewport.translation.x -= shift.x;
            viewport.translation.y -= shift.y;
        }
        if (parallelScale) {
            const { rowPixelSpacing } = image;
            const scale = (clientHeight * rowPixelSpacing * 0.5) / parallelScale;
            viewport.scale = scale;
            viewport.parallelScale = parallelScale;
        }
        if (scale) {
            const { rowPixelSpacing } = image;
            viewport.scale = scale;
            viewport.parallelScale = (clientHeight * rowPixelSpacing * 0.5) / scale;
        }
        if (flipHorizontal !== undefined || flipVertical !== undefined) {
            this.setFlipCPU({ flipHorizontal, flipVertical });
        }
        this._cpuFallbackEnabledElement.transform = (0, calculateTransform_1.default)(this._cpuFallbackEnabledElement);
        const eventDetail = {
            previousCamera,
            camera: this.getCamera(),
            element: this.element,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
            rotation: this.getRotation(),
        };
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.CAMERA_MODIFIED, eventDetail);
    }
    getPanCPU() {
        const { viewport } = this._cpuFallbackEnabledElement;
        return [viewport.translation.x, viewport.translation.y];
    }
    setPanCPU(pan) {
        const camera = this.getCameraCPU();
        this.setCameraCPU(Object.assign(Object.assign({}, camera), { focalPoint: [...pan.map((p) => -p), 0] }));
    }
    getZoomCPU() {
        const { viewport } = this._cpuFallbackEnabledElement;
        return viewport.scale;
    }
    setZoomCPU(zoom) {
        const camera = this.getCameraCPU();
        this.setCameraCPU(Object.assign(Object.assign({}, camera), { scale: zoom }));
    }
    setFlipCPU({ flipHorizontal, flipVertical }) {
        const { viewport } = this._cpuFallbackEnabledElement;
        if (flipHorizontal !== undefined) {
            viewport.hflip = flipHorizontal;
            this.flipHorizontal = viewport.hflip;
        }
        if (flipVertical !== undefined) {
            viewport.vflip = flipVertical;
            this.flipVertical = viewport.vflip;
        }
    }
    setVOILUTFunction(voiLUTFunction, suppressEvents) {
        if (this.useCPURendering) {
            throw new Error('VOI LUT function is not supported in CPU rendering');
        }
        const newVOILUTFunction = this._getValidVOILUTFunction(voiLUTFunction);
        let forceRecreateLUTFunction = false;
        if (this.VOILUTFunction !== newVOILUTFunction) {
            forceRecreateLUTFunction = true;
        }
        this.VOILUTFunction = newVOILUTFunction;
        const { voiRange } = this.getProperties();
        this.setVOI(voiRange, { suppressEvents, forceRecreateLUTFunction });
    }
    setRotationCPU(rotation) {
        const { viewport } = this._cpuFallbackEnabledElement;
        viewport.rotation = rotation;
    }
    setRotationGPU(rotation) {
        const panFit = this.getPan(this.fitToCanvasCamera);
        const pan = this.getPan();
        const panSub = gl_matrix_1.vec2.sub([0, 0], panFit, pan);
        this.setPan(panSub, false);
        const { flipVertical } = this.getCamera();
        const initialViewUp = flipVertical
            ? gl_matrix_1.vec3.negate(gl_matrix_1.vec3.create(), this.initialViewUp)
            : this.initialViewUp;
        this.setCameraNoEvent({
            viewUp: initialViewUp,
        });
        this.getVtkActiveCamera().roll(-rotation);
        const afterPan = this.getPan();
        const afterPanFit = this.getPan(this.fitToCanvasCamera);
        const newCenter = gl_matrix_1.vec2.sub([0, 0], afterPan, afterPanFit);
        const newOffset = gl_matrix_1.vec2.add([0, 0], panFit, newCenter);
        this.setPan(newOffset, false);
    }
    setInterpolationTypeGPU(interpolationType) {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!(0, utilities_1.isImageActor)(defaultActor)) {
            return;
        }
        const { actor } = defaultActor;
        const volumeProperty = actor.getProperty();
        volumeProperty.setInterpolationType(interpolationType);
        this.interpolationType = interpolationType;
    }
    setInterpolationTypeCPU(interpolationType) {
        const { viewport } = this._cpuFallbackEnabledElement;
        viewport.pixelReplication =
            interpolationType === enums_1.InterpolationType.LINEAR ? false : true;
        this.interpolationType = interpolationType;
    }
    setInvertColorCPU(invert) {
        const { viewport } = this._cpuFallbackEnabledElement;
        if (!viewport) {
            return;
        }
        viewport.invert = invert;
        this.invert = invert;
    }
    setInvertColorGPU(invert) {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!(0, utilities_1.isImageActor)(defaultActor)) {
            return;
        }
        if ((0, utilities_1.actorIsA)(defaultActor, 'vtkVolume')) {
            const volumeActor = defaultActor.actor;
            const tfunc = volumeActor.getProperty().getRGBTransferFunction(0);
            if ((!this.invert && invert) || (this.invert && !invert)) {
                (0, utilities_1.invertRgbTransferFunction)(tfunc);
            }
            this.invert = invert;
        }
        else if ((0, utilities_1.actorIsA)(defaultActor, 'vtkImageSlice')) {
            const imageSliceActor = defaultActor.actor;
            const tfunc = imageSliceActor.getProperty().getRGBTransferFunction(0);
            if ((!this.invert && invert) || (this.invert && !invert)) {
                (0, utilities_1.invertRgbTransferFunction)(tfunc);
            }
            this.invert = invert;
        }
    }
    setVOICPU(voiRange, options = {}) {
        const { suppressEvents = false } = options;
        const { viewport, image } = this._cpuFallbackEnabledElement;
        if (!viewport || !image) {
            return;
        }
        if (typeof voiRange === 'undefined') {
            const { windowWidth: ww, windowCenter: wc } = image;
            const wwToUse = Array.isArray(ww) ? ww[0] : ww;
            const wcToUse = Array.isArray(wc) ? wc[0] : wc;
            viewport.voi = {
                windowWidth: wwToUse,
                windowCenter: wcToUse,
            };
            const { lower, upper } = utilities_1.windowLevel.toLowHighRange(wwToUse, wcToUse);
            voiRange = { lower, upper };
        }
        else {
            const { lower, upper } = voiRange;
            const { windowCenter, windowWidth } = utilities_1.windowLevel.toWindowLevel(lower, upper);
            if (!viewport.voi) {
                viewport.voi = {
                    windowWidth: 0,
                    windowCenter: 0,
                };
            }
            viewport.voi.windowWidth = windowWidth;
            viewport.voi.windowCenter = windowCenter;
        }
        this.voiRange = voiRange;
        const eventDetail = {
            viewportId: this.id,
            range: voiRange,
        };
        if (!suppressEvents) {
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOI_MODIFIED, eventDetail);
        }
    }
    getTransferFunction() {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!(0, utilities_1.isImageActor)(defaultActor)) {
            return;
        }
        const imageActor = defaultActor.actor;
        return imageActor.getProperty().getRGBTransferFunction(0);
    }
    setVOIGPU(voiRange, options = {}) {
        const { suppressEvents = false, forceRecreateLUTFunction = false, voiUpdatedWithSetProperties = false, } = options;
        if (voiRange &&
            this.voiRange &&
            this.voiRange.lower === voiRange.lower &&
            this.voiRange.upper === voiRange.upper &&
            !forceRecreateLUTFunction &&
            !this.stackInvalidated) {
            return;
        }
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!(0, utilities_1.isImageActor)(defaultActor)) {
            return;
        }
        const imageActor = defaultActor.actor;
        let voiRangeToUse = voiRange;
        if (typeof voiRangeToUse === 'undefined') {
            const imageData = imageActor.getMapper().getInputData();
            const range = imageData.getPointData().getScalars().getRange();
            const maxVoiRange = { lower: range[0], upper: range[1] };
            voiRangeToUse = maxVoiRange;
        }
        imageActor.getProperty().setUseLookupTableScalarRange(true);
        let transferFunction = imageActor.getProperty().getRGBTransferFunction(0);
        const isSigmoidTFun = this.VOILUTFunction === enums_1.VOILUTFunctionType.SAMPLED_SIGMOID;
        if (isSigmoidTFun || !transferFunction || forceRecreateLUTFunction) {
            const transferFunctionCreator = isSigmoidTFun
                ? utilities_1.createSigmoidRGBTransferFunction
                : createLinearRGBTransferFunction_1.default;
            transferFunction = transferFunctionCreator(voiRangeToUse);
            if (this.invert) {
                (0, utilities_1.invertRgbTransferFunction)(transferFunction);
            }
            imageActor.getProperty().setRGBTransferFunction(0, transferFunction);
            this.initialTransferFunctionNodes =
                (0, transferFunctionUtils_1.getTransferFunctionNodes)(transferFunction);
        }
        if (!isSigmoidTFun) {
            transferFunction.setRange(voiRangeToUse.lower, voiRangeToUse.upper);
        }
        this.voiRange = voiRangeToUse;
        if (!this.voiUpdatedWithSetProperties) {
            this.voiUpdatedWithSetProperties = voiUpdatedWithSetProperties;
        }
        if (suppressEvents) {
            return;
        }
        const eventDetail = {
            viewportId: this.id,
            range: voiRangeToUse,
            VOILUTFunction: this.VOILUTFunction,
        };
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOI_MODIFIED, eventDetail);
    }
    _addScalingToViewport(imageIdScalingFactor) {
        if (this.scaling.PT) {
            return;
        }
        const { suvbw, suvlbm, suvbsa } = imageIdScalingFactor;
        const ptScaling = {};
        if (suvlbm) {
            ptScaling.suvbwToSuvlbm = suvlbm / suvbw;
        }
        if (suvbsa) {
            ptScaling.suvbwToSuvbsa = suvbsa / suvbw;
        }
        this.scaling.PT = ptScaling;
    }
    _getNumCompsFromPhotometricInterpretation(photometricInterpretation) {
        let numberOfComponents = 1;
        if (photometricInterpretation === 'RGB' ||
            photometricInterpretation.indexOf('YBR') !== -1 ||
            photometricInterpretation === 'PALETTE COLOR') {
            numberOfComponents = 3;
        }
        return numberOfComponents;
    }
    getImageDataMetadata(image) {
        const { imagePlaneModule, imagePixelModule } = this.buildMetadata(image);
        let rowCosines, columnCosines;
        rowCosines = imagePlaneModule.rowCosines;
        columnCosines = imagePlaneModule.columnCosines;
        if (rowCosines == null || columnCosines == null) {
            rowCosines = [1, 0, 0];
            columnCosines = [0, 1, 0];
        }
        const rowCosineVec = gl_matrix_1.vec3.fromValues(rowCosines[0], rowCosines[1], rowCosines[2]);
        const colCosineVec = gl_matrix_1.vec3.fromValues(columnCosines[0], columnCosines[1], columnCosines[2]);
        const scanAxisNormal = gl_matrix_1.vec3.create();
        gl_matrix_1.vec3.cross(scanAxisNormal, rowCosineVec, colCosineVec);
        let origin = imagePlaneModule.imagePositionPatient;
        if (origin == null) {
            origin = [0, 0, 0];
        }
        const xSpacing = imagePlaneModule.columnPixelSpacing || image.columnPixelSpacing;
        const ySpacing = imagePlaneModule.rowPixelSpacing || image.rowPixelSpacing;
        const xVoxels = image.columns;
        const yVoxels = image.rows;
        const zSpacing = EPSILON;
        const zVoxels = 1;
        const numComps = image.numComps ||
            this._getNumCompsFromPhotometricInterpretation(imagePixelModule.photometricInterpretation);
        return {
            bitsAllocated: imagePixelModule.bitsAllocated,
            numComps,
            origin,
            direction: [...rowCosineVec, ...colCosineVec, ...scanAxisNormal],
            dimensions: [xVoxels, yVoxels, zVoxels],
            spacing: [xSpacing, ySpacing, zSpacing],
            numVoxels: xVoxels * yVoxels * zVoxels,
            imagePlaneModule,
            imagePixelModule,
        };
    }
    getImagePlaneReferenceData(sliceIndex = this.getCurrentImageIdIndex()) {
        const imageId = this.imageIds[sliceIndex];
        if (!imageId) {
            return;
        }
        const imagePlaneModule = metaData.get(enums_1.MetadataModules.IMAGE_PLANE, imageId);
        if (!imagePlaneModule) {
            return;
        }
        const { imagePositionPatient, frameOfReferenceUID: FrameOfReferenceUID } = imagePlaneModule;
        let { rowCosines, columnCosines } = imagePlaneModule;
        rowCosines || (rowCosines = [1, 0, 0]);
        columnCosines || (columnCosines = [0, 1, 0]);
        const viewPlaneNormal = (gl_matrix_1.vec3.cross([0, 0, 0], columnCosines, rowCosines));
        return {
            FrameOfReferenceUID,
            viewPlaneNormal,
            cameraFocalPoint: imagePositionPatient,
            referencedImageId: imageId,
            sliceIndex,
        };
    }
    _getCameraOrientation(imageDataDirection) {
        const viewPlaneNormal = imageDataDirection.slice(6, 9).map((x) => -x);
        const viewUp = imageDataDirection.slice(3, 6).map((x) => -x);
        return {
            viewPlaneNormal: [
                viewPlaneNormal[0],
                viewPlaneNormal[1],
                viewPlaneNormal[2],
            ],
            viewUp: [viewUp[0], viewUp[1], viewUp[2]],
        };
    }
    createVTKImageData({ origin, direction, dimensions, spacing, numComps, pixelArray, }) {
        const values = new pixelArray.constructor(pixelArray.length);
        const scalarArray = DataArray_1.default.newInstance({
            name: 'Pixels',
            numberOfComponents: numComps,
            values: values,
        });
        const imageData = ImageData_1.default.newInstance();
        imageData.setDimensions(dimensions);
        imageData.setSpacing(spacing);
        imageData.setDirection(direction);
        imageData.setOrigin(origin);
        imageData.getPointData().setScalars(scalarArray);
        return imageData;
    }
    _createVTKImageData({ origin, direction, dimensions, spacing, numComps, pixelArray, }) {
        this._imageData = this.createVTKImageData({
            origin,
            direction,
            dimensions,
            spacing,
            numComps,
            pixelArray,
        });
    }
    setStack(imageIds, currentImageIdIndex = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            this._throwIfDestroyed();
            this.imageIds = imageIds;
            this.currentImageIdIndex = currentImageIdIndex;
            this.targetImageIdIndex = currentImageIdIndex;
            const imageRetrieveConfiguration = metaData.get(utilities_1.imageRetrieveMetadataProvider.IMAGE_RETRIEVE_CONFIGURATION, imageIds[currentImageIdIndex], 'stack');
            this.imagesLoader = imageRetrieveConfiguration
                ? (imageRetrieveConfiguration.create || ProgressiveRetrieveImages_1.createProgressive)(imageRetrieveConfiguration)
                : this;
            this.stackInvalidated = true;
            this.flipVertical = false;
            this.flipHorizontal = false;
            this.voiRange = null;
            this.interpolationType = enums_1.InterpolationType.LINEAR;
            this.invert = false;
            this.viewportStatus = enums_1.ViewportStatus.LOADING;
            this.fillWithBackgroundColor();
            if (this.useCPURendering) {
                this._cpuFallbackEnabledElement.renderingTools = {};
                delete this._cpuFallbackEnabledElement.viewport.colormap;
            }
            const imageId = yield this._setImageIdIndex(currentImageIdIndex);
            const eventDetail = {
                imageIds,
                viewportId: this.id,
                element: this.element,
                currentImageIdIndex: currentImageIdIndex,
            };
            (0, utilities_1.triggerEvent)(eventTarget_1.default, enums_1.Events.STACK_VIEWPORT_NEW_STACK, eventDetail);
            return imageId;
        });
    }
    _throwIfDestroyed() {
        if (this.isDisabled) {
            throw new Error('The stack viewport has been destroyed and is no longer usable. Renderings will not be performed. If you ' +
                'are using the same viewportId and have re-enabled the viewport, you need to grab the new viewport instance ' +
                'using renderingEngine.getViewport(viewportId), instead of using your lexical scoped reference to the viewport instance.');
        }
    }
    _checkVTKImageDataMatchesCornerstoneImage(image, imageData) {
        if (!imageData) {
            return false;
        }
        const [xSpacing, ySpacing] = imageData.getSpacing();
        const [xVoxels, yVoxels] = imageData.getDimensions();
        const imagePlaneModule = this._getImagePlaneModule(image.imageId);
        const direction = imageData.getDirection();
        const rowCosines = direction.slice(0, 3);
        const columnCosines = direction.slice(3, 6);
        const dataType = imageData.getPointData().getScalars().getDataType();
        const isSameXSpacing = (0, utilities_1.isEqual)(xSpacing, image.columnPixelSpacing);
        const isSameYSpacing = (0, utilities_1.isEqual)(ySpacing, image.rowPixelSpacing);
        return ((isSameXSpacing ||
            (image.columnPixelSpacing === null && xSpacing === 1.0)) &&
            (isSameYSpacing ||
                (image.rowPixelSpacing === null && ySpacing === 1.0)) &&
            xVoxels === image.columns &&
            yVoxels === image.rows &&
            (0, utilities_1.isEqual)(imagePlaneModule.rowCosines, rowCosines) &&
            (0, utilities_1.isEqual)(imagePlaneModule.columnCosines, columnCosines) &&
            (!this.useNativeDataType ||
                dataType === image.getPixelData().constructor.name));
    }
    _updateVTKImageDataFromCornerstoneImage(image) {
        const imagePlaneModule = this._getImagePlaneModule(image.imageId);
        let origin = imagePlaneModule.imagePositionPatient;
        if (origin == null) {
            origin = [0, 0, 0];
        }
        this._imageData.setOrigin(origin);
        (0, utilities_1.updateVTKImageDataWithCornerstoneImage)(this._imageData, image);
    }
    _loadAndDisplayImage(imageId, imageIdIndex) {
        return this.useCPURendering
            ? this._loadAndDisplayImageCPU(imageId, imageIdIndex)
            : this._loadAndDisplayImageGPU(imageId, imageIdIndex);
    }
    _loadAndDisplayImageCPU(imageId, imageIdIndex) {
        return new Promise((resolve, reject) => {
            function successCallback(image, imageIdIndex, imageId) {
                if (this.currentImageIdIndex !== imageIdIndex) {
                    return;
                }
                const pixelData = image.getPixelData();
                const preScale = image.preScale;
                const scalingParams = preScale === null || preScale === void 0 ? void 0 : preScale.scalingParameters;
                const scaledWithNonIntegers = ((preScale === null || preScale === void 0 ? void 0 : preScale.scaled) && (scalingParams === null || scalingParams === void 0 ? void 0 : scalingParams.rescaleIntercept) % 1 !== 0) ||
                    (scalingParams === null || scalingParams === void 0 ? void 0 : scalingParams.rescaleSlope) % 1 !== 0;
                if (pixelData instanceof Float32Array && scaledWithNonIntegers) {
                    const floatMinMax = {
                        min: image.maxPixelValue,
                        max: image.minPixelValue,
                    };
                    const floatRange = Math.abs(floatMinMax.max - floatMinMax.min);
                    const intRange = 65535;
                    const slope = floatRange / intRange;
                    const intercept = floatMinMax.min;
                    const numPixels = pixelData.length;
                    const intPixelData = new Uint16Array(numPixels);
                    let min = 65535;
                    let max = 0;
                    for (let i = 0; i < numPixels; i++) {
                        const rescaledPixel = Math.floor((pixelData[i] - intercept) / slope);
                        intPixelData[i] = rescaledPixel;
                        min = Math.min(min, rescaledPixel);
                        max = Math.max(max, rescaledPixel);
                    }
                    image.minPixelValue = min;
                    image.maxPixelValue = max;
                    image.slope = slope;
                    image.intercept = intercept;
                    image.getPixelData = () => intPixelData;
                    image.preScale = Object.assign(Object.assign({}, image.preScale), { scaled: false });
                }
                this._setCSImage(image);
                this.viewportStatus = enums_1.ViewportStatus.PRE_RENDER;
                const eventDetail = {
                    image,
                    imageId,
                    imageIdIndex,
                    viewportId: this.id,
                    renderingEngineId: this.renderingEngineId,
                };
                (0, utilities_1.triggerEvent)(this.element, enums_1.Events.STACK_NEW_IMAGE, eventDetail);
                this._updateToDisplayImageCPU(image);
                this.render();
                this.currentImageIdIndex = imageIdIndex;
                resolve(imageId);
            }
            function errorCallback(error, imageIdIndex, imageId) {
                const eventDetail = {
                    error,
                    imageIdIndex,
                    imageId,
                };
                if (!this.suppressEvents) {
                    (0, utilities_1.triggerEvent)(eventTarget_1.default, enums_1.Events.IMAGE_LOAD_ERROR, eventDetail);
                }
                reject(error);
            }
            function sendRequest(imageId, imageIdIndex, options) {
                return (0, imageLoader_1.loadAndCacheImage)(imageId, options).then((image) => {
                    successCallback.call(this, image, imageIdIndex, imageId);
                }, (error) => {
                    errorCallback.call(this, error, imageIdIndex, imageId);
                });
            }
            const priority = -5;
            const requestType = enums_1.RequestType.Interaction;
            const additionalDetails = { imageId, imageIdIndex };
            const options = {
                preScale: {
                    enabled: true,
                },
                useRGBA: true,
                requestType,
            };
            const eventDetail = {
                imageId,
                imageIdIndex,
                viewportId: this.id,
                renderingEngineId: this.renderingEngineId,
            };
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.PRE_STACK_NEW_IMAGE, eventDetail);
            imageLoadPoolManager_1.default.addRequest(sendRequest.bind(this, imageId, imageIdIndex, options), requestType, additionalDetails, priority);
        });
    }
    successCallback(imageId, image) {
        var _a, _b;
        const imageIdIndex = this.imageIds.indexOf(imageId);
        if (this.currentImageIdIndex !== imageIdIndex) {
            return;
        }
        const csImgFrame = (_a = this.csImage) === null || _a === void 0 ? void 0 : _a.imageFrame;
        const imgFrame = image === null || image === void 0 ? void 0 : image.imageFrame;
        const photometricInterpretation = (csImgFrame === null || csImgFrame === void 0 ? void 0 : csImgFrame.photometricInterpretation) ||
            ((_b = this.csImage) === null || _b === void 0 ? void 0 : _b.photometricInterpretation);
        const newPhotometricInterpretation = (imgFrame === null || imgFrame === void 0 ? void 0 : imgFrame.photometricInterpretation) || (image === null || image === void 0 ? void 0 : image.photometricInterpretation);
        if (photometricInterpretation !== newPhotometricInterpretation) {
            this.stackInvalidated = true;
        }
        this._setCSImage(image);
        const eventDetail = {
            image,
            imageId,
            imageIdIndex,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
        };
        this._updateActorToDisplayImageId(image);
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.STACK_NEW_IMAGE, eventDetail);
        this.render();
        this.currentImageIdIndex = imageIdIndex;
    }
    errorCallback(imageId, permanent, error) {
        if (!permanent) {
            return;
        }
        const imageIdIndex = this.imageIds.indexOf(imageId);
        const eventDetail = {
            error,
            imageIdIndex,
            imageId,
        };
        (0, utilities_1.triggerEvent)(eventTarget_1.default, enums_1.Events.IMAGE_LOAD_ERROR, eventDetail);
    }
    getLoaderImageOptions(imageId) {
        const imageIdIndex = this.imageIds.indexOf(imageId);
        const { transferSyntaxUID } = metaData.get('transferSyntax', imageId) || {};
        const additionalDetails = { imageId, imageIdIndex };
        const options = {
            targetBuffer: {
                type: this.useNativeDataType ? undefined : 'Float32Array',
            },
            preScale: {
                enabled: true,
            },
            useRGBA: false,
            transferSyntaxUID,
            useNativeDataType: this.useNativeDataType,
            priority: 5,
            requestType: enums_1.RequestType.Interaction,
            additionalDetails,
        };
        return options;
    }
    loadImages(imageIds, listener) {
        return __awaiter(this, void 0, void 0, function* () {
            const resultList = yield Promise.allSettled(imageIds.map((imageId) => {
                const options = this.getLoaderImageOptions(imageId);
                return (0, imageLoader_1.loadAndCacheImage)(imageId, options).then((image) => {
                    listener.successCallback(imageId, image);
                    return imageId;
                }, (error) => {
                    listener.errorCallback(imageId, true, error);
                    return imageId;
                });
            }));
            const errorList = resultList.filter((item) => item.status === 'rejected');
            if (errorList && errorList.length) {
                const event = new CustomEvent(enums_1.Events.IMAGE_LOAD_ERROR, {
                    detail: errorList,
                    cancelable: true,
                });
                eventTarget_1.default.dispatchEvent(event);
            }
            return resultList;
        });
    }
    _loadAndDisplayImageGPU(imageId, imageIdIndex) {
        const eventDetail = {
            imageId,
            imageIdIndex,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
        };
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.PRE_STACK_NEW_IMAGE, eventDetail);
        return this.imagesLoader.loadImages([imageId], this).then((v) => {
            return imageId;
        });
    }
    _updateToDisplayImageCPU(image) {
        const metadata = this.getImageDataMetadata(image);
        const viewport = (0, getDefaultViewport_1.default)(this.canvas, image, this.modality, this._cpuFallbackEnabledElement.viewport.colormap);
        const { windowCenter, windowWidth } = viewport.voi;
        this.voiRange = utilities_1.windowLevel.toLowHighRange(windowWidth, windowCenter);
        this._cpuFallbackEnabledElement.image = image;
        this._cpuFallbackEnabledElement.metadata = Object.assign({}, metadata);
        this.cpuImagePixelData = image.getPixelData();
        const viewportSettingToUse = Object.assign({}, viewport, this._cpuFallbackEnabledElement.viewport);
        this._cpuFallbackEnabledElement.viewport = this.stackInvalidated
            ? viewport
            : viewportSettingToUse;
        this.stackInvalidated = false;
        this.cpuRenderingInvalidated = true;
        this._cpuFallbackEnabledElement.transform = (0, calculateTransform_1.default)(this._cpuFallbackEnabledElement);
    }
    addImages(stackInputs) {
        const actors = this.getActors();
        stackInputs.forEach((stackInput) => {
            const image = cache_1.default.getImage(stackInput.imageId);
            const { origin, dimensions, direction, spacing, numComps } = this.getImageDataMetadata(image);
            const imagedata = this.createVTKImageData({
                origin,
                dimensions,
                direction,
                spacing,
                numComps,
                pixelArray: image.getPixelData(),
            });
            const imageActor = this.createActorMapper(imagedata);
            if (imageActor) {
                actors.push({ uid: stackInput.actorUID, actor: imageActor });
                if (stackInput.callback) {
                    stackInput.callback({ imageActor, imageId: stackInput.imageId });
                }
            }
        });
        this.setActors(actors);
    }
    _updateActorToDisplayImageId(image) {
        const sameImageData = this._checkVTKImageDataMatchesCornerstoneImage(image, this._imageData);
        const activeCamera = this.getRenderer().getActiveCamera();
        const previousCameraProps = (0, lodash_clonedeep_1.default)(this.getCamera());
        if (sameImageData && !this.stackInvalidated) {
            this._updateVTKImageDataFromCornerstoneImage(image);
            const cameraProps = this.getCamera();
            const panCache = gl_matrix_1.vec3.subtract(gl_matrix_1.vec3.create(), this.cameraFocalPointOnRender, cameraProps.focalPoint);
            this.resetCameraNoEvent();
            this.setCameraNoEvent({
                flipHorizontal: previousCameraProps.flipHorizontal,
                flipVertical: previousCameraProps.flipVertical,
                viewUp: previousCameraProps.viewUp,
            });
            const { focalPoint } = this.getCamera();
            this.cameraFocalPointOnRender = focalPoint;
            activeCamera.setFreezeFocalPoint(true);
            this._restoreCameraProps(cameraProps, previousCameraProps, panCache);
            this._setPropertiesFromCache();
            this.stackActorReInitialized = false;
            return;
        }
        const { origin, direction, dimensions, spacing, numComps, imagePixelModule, } = this.getImageDataMetadata(image);
        const pixelArray = image.getPixelData();
        this._createVTKImageData({
            origin,
            direction,
            dimensions,
            spacing,
            numComps,
            pixelArray,
        });
        this._updateVTKImageDataFromCornerstoneImage(image);
        const actor = this.createActorMapper(this._imageData);
        const oldActors = this.getActors();
        if (oldActors.length && oldActors[0].uid === this.id) {
            oldActors[0].actor = actor;
        }
        else {
            oldActors.unshift({ uid: this.id, actor });
        }
        this.setActors(oldActors);
        const { viewPlaneNormal, viewUp } = this._getCameraOrientation(direction);
        this.setCameraNoEvent({ viewUp, viewPlaneNormal });
        this.initialViewUp = viewUp;
        this.resetCameraNoEvent();
        this.triggerCameraEvent(this.getCamera(), previousCameraProps);
        activeCamera.setFreezeFocalPoint(true);
        const monochrome1 = imagePixelModule.photometricInterpretation === 'MONOCHROME1';
        this.stackInvalidated = true;
        this.setVOI(this._getInitialVOIRange(image), {
            forceRecreateLUTFunction: !!monochrome1,
        });
        this.initialInvert = !!monochrome1;
        this.setInvertColor(this.invert || this.initialInvert);
        this.cameraFocalPointOnRender = this.getCamera().focalPoint;
        this.stackInvalidated = false;
        this.stackActorReInitialized = true;
        if (this._publishCalibratedEvent) {
            this.triggerCalibrationEvent();
        }
    }
    _getInitialVOIRange(image) {
        if (this.voiRange && this.voiUpdatedWithSetProperties) {
            return this.globalDefaultProperties.voiRange;
        }
        const { windowCenter, windowWidth } = image;
        let voiRange = this._getVOIRangeFromWindowLevel(windowWidth, windowCenter);
        voiRange = this._getPTPreScaledRange() || voiRange;
        return voiRange;
    }
    _getPTPreScaledRange() {
        if (!this._isCurrentImagePTPrescaled()) {
            return undefined;
        }
        return this._getDefaultPTPrescaledVOIRange();
    }
    _isCurrentImagePTPrescaled() {
        var _a, _b;
        if (this.modality !== 'PT' || !this.csImage.isPreScaled) {
            return false;
        }
        if (!((_b = (_a = this.csImage.preScale) === null || _a === void 0 ? void 0 : _a.scalingParameters) === null || _b === void 0 ? void 0 : _b.suvbw)) {
            return false;
        }
        return true;
    }
    _getDefaultPTPrescaledVOIRange() {
        return { lower: 0, upper: 5 };
    }
    _getVOIRangeFromWindowLevel(windowWidth, windowCenter) {
        let center, width;
        if (typeof windowCenter === 'number' && typeof windowWidth === 'number') {
            center = windowCenter;
            width = windowWidth;
        }
        else if (Array.isArray(windowCenter) && Array.isArray(windowWidth)) {
            center = windowCenter[0];
            width = windowWidth[0];
        }
        if (center !== undefined && width !== undefined) {
            return utilities_1.windowLevel.toLowHighRange(width, center);
        }
    }
    _setImageIdIndex(imageIdIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            if (imageIdIndex >= this.imageIds.length) {
                throw new Error(`ImageIdIndex provided ${imageIdIndex} is invalid, the stack only has ${this.imageIds.length} elements`);
            }
            this.currentImageIdIndex = imageIdIndex;
            this.hasPixelSpacing = true;
            this.viewportStatus = enums_1.ViewportStatus.PRE_RENDER;
            const imageId = yield this._loadAndDisplayImage(this.imageIds[imageIdIndex], imageIdIndex);
            if (this.perImageIdDefaultProperties.size >= 1) {
                const defaultProperties = this.perImageIdDefaultProperties.get(imageId);
                if (defaultProperties !== undefined) {
                    this.setProperties(defaultProperties);
                }
                else if (this.globalDefaultProperties !== undefined) {
                    this.setProperties(this.globalDefaultProperties);
                }
            }
            return imageId;
        });
    }
    resetCameraCPU(resetPan, resetZoom) {
        const { image } = this._cpuFallbackEnabledElement;
        if (!image) {
            return;
        }
        (0, resetCamera_1.default)(this._cpuFallbackEnabledElement, resetPan, resetZoom);
        const { scale } = this._cpuFallbackEnabledElement.viewport;
        const { clientWidth, clientHeight } = this.element;
        const center = [clientWidth / 2, clientHeight / 2];
        const centerWorld = this.canvasToWorldCPU(center);
        this.setCameraCPU({
            focalPoint: centerWorld,
            scale,
        });
    }
    resetCameraGPU(resetPan, resetZoom) {
        this.setCamera({
            flipHorizontal: false,
            flipVertical: false,
            viewUp: this.initialViewUp,
        });
        const resetToCenter = true;
        return super.resetCamera(resetPan, resetZoom, resetToCenter);
    }
    scroll(delta, debounce = true, loop = false) {
        const imageIds = this.imageIds;
        const currentTargetImageIdIndex = this.targetImageIdIndex;
        const numberOfFrames = imageIds.length;
        let newTargetImageIdIndex = currentTargetImageIdIndex + delta;
        newTargetImageIdIndex = Math.max(0, newTargetImageIdIndex);
        if (loop) {
            newTargetImageIdIndex = newTargetImageIdIndex % numberOfFrames;
        }
        else {
            newTargetImageIdIndex = Math.min(numberOfFrames - 1, newTargetImageIdIndex);
        }
        this.targetImageIdIndex = newTargetImageIdIndex;
        const targetImageId = imageIds[newTargetImageIdIndex];
        const imageAlreadyLoaded = cache_1.default.isLoaded(targetImageId);
        if (imageAlreadyLoaded || !debounce) {
            this.setImageIdIndex(newTargetImageIdIndex);
        }
        else {
            clearTimeout(this.debouncedTimeout);
            this.debouncedTimeout = window.setTimeout(() => {
                this.setImageIdIndex(newTargetImageIdIndex);
            }, 40);
        }
        const eventData = {
            newImageIdIndex: newTargetImageIdIndex,
            imageId: targetImageId,
            direction: delta,
        };
        if (newTargetImageIdIndex !== currentTargetImageIdIndex) {
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.STACK_VIEWPORT_SCROLL, eventData);
        }
    }
    setImageIdIndex(imageIdIndex) {
        this._throwIfDestroyed();
        if (this.currentImageIdIndex === imageIdIndex) {
            return Promise.resolve(this.getCurrentImageId());
        }
        const imageIdPromise = this._setImageIdIndex(imageIdIndex);
        return imageIdPromise;
    }
    calibrateSpacing(imageId) {
        const imageIdIndex = this.getImageIds().indexOf(imageId);
        this.stackInvalidated = true;
        this._loadAndDisplayImage(imageId, imageIdIndex);
    }
    _restoreCameraProps({ parallelScale: prevScale }, previousCamera, panCache) {
        const renderer = this.getRenderer();
        const { position, focalPoint } = this.getCamera();
        const newPosition = gl_matrix_1.vec3.subtract(gl_matrix_1.vec3.create(), position, panCache);
        const newFocal = gl_matrix_1.vec3.subtract(gl_matrix_1.vec3.create(), focalPoint, panCache);
        this.setCameraNoEvent({
            parallelScale: prevScale,
            position: newPosition,
            focalPoint: newFocal,
        });
        const camera = this.getCamera();
        this.triggerCameraEvent(camera, previousCamera);
        const RESET_CAMERA_EVENT = {
            type: 'ResetCameraEvent',
            renderer,
        };
        renderer.invokeEvent(RESET_CAMERA_EVENT);
    }
    triggerCameraEvent(camera, previousCamera) {
        const eventDetail = {
            previousCamera,
            camera,
            element: this.element,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
        };
        if (!this.suppressEvents) {
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.CAMERA_MODIFIED, eventDetail);
        }
    }
    triggerCalibrationEvent() {
        const { imageData } = this.getImageData();
        const eventDetail = Object.assign({ element: this.element, viewportId: this.id, renderingEngineId: this.renderingEngineId, imageId: this.getCurrentImageId(), imageData: imageData, worldToIndex: imageData.getWorldToIndex() }, this._calibrationEvent);
        if (!this.suppressEvents) {
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.IMAGE_SPACING_CALIBRATED, eventDetail);
        }
        this._publishCalibratedEvent = false;
    }
    _getVOIRangeForCurrentImage() {
        const { windowCenter, windowWidth } = this.csImage;
        return this._getVOIRangeFromWindowLevel(windowWidth, windowCenter);
    }
    _getValidVOILUTFunction(voiLUTFunction) {
        if (Object.values(enums_1.VOILUTFunctionType).indexOf(voiLUTFunction) === -1) {
            voiLUTFunction = enums_1.VOILUTFunctionType.LINEAR;
        }
        return voiLUTFunction;
    }
    isReferenceViewable(viewRef, options = {}) {
        if (!super.isReferenceViewable(viewRef, options)) {
            return false;
        }
        let { imageURI } = options;
        const { referencedImageId, sliceIndex } = viewRef;
        if (viewRef.volumeId && !referencedImageId) {
            return options.asVolume === true;
        }
        let testIndex = this.getCurrentImageIdIndex();
        if (options.withNavigation && typeof sliceIndex === 'number') {
            testIndex = sliceIndex;
        }
        const imageId = this.imageIds[testIndex];
        if (!imageId) {
            return false;
        }
        if (!imageURI) {
            const colonIndex = imageId.indexOf(':');
            imageURI = imageId.substring(colonIndex + 1);
        }
        return referencedImageId === null || referencedImageId === void 0 ? void 0 : referencedImageId.endsWith(imageURI);
    }
    getViewReference(viewRefSpecifier = {}) {
        const { sliceIndex = this.getCurrentImageIdIndex() } = viewRefSpecifier;
        const reference = super.getViewReference(viewRefSpecifier);
        const referencedImageId = this.imageIds[sliceIndex];
        if (!referencedImageId) {
            return;
        }
        reference.referencedImageId = referencedImageId;
        if (this.getCurrentImageIdIndex() !== sliceIndex) {
            const referenceData = this.getImagePlaneReferenceData(sliceIndex);
            if (!referenceData) {
                return;
            }
            Object.assign(reference, referenceData);
        }
        return reference;
    }
    setViewReference(viewRef) {
        if (!viewRef) {
            return;
        }
        const { referencedImageId, sliceIndex, volumeId } = viewRef;
        if (typeof sliceIndex === 'number' &&
            referencedImageId &&
            referencedImageId === this.imageIds[sliceIndex]) {
            this.setImageIdIndex(sliceIndex);
        }
        else {
            const foundIndex = this.imageIds.indexOf(referencedImageId);
            if (foundIndex !== -1) {
                this.setImageIdIndex(foundIndex);
            }
            else {
                throw new Error('Unsupported - referenced image id not found');
            }
        }
    }
    getReferenceId(specifier = {}) {
        const { sliceIndex: sliceIndex = this.currentImageIdIndex } = specifier;
        if (Array.isArray(sliceIndex)) {
            throw new Error('Use of slice ranges for stacks not supported');
        }
        return `imageId:${this.imageIds[sliceIndex]}`;
    }
    getCPUFallbackError(method) {
        return new Error(`method ${method} cannot be used during CPU Fallback mode`);
    }
    fillWithBackgroundColor() {
        const renderingEngine = this.getRenderingEngine();
        if (renderingEngine) {
            renderingEngine.fillCanvasWithBackgroundColor(this.canvas, this.options.background);
        }
    }
    unsetColormapCPU() {
        delete this._cpuFallbackEnabledElement.viewport.colormap;
        this._cpuFallbackEnabledElement.renderingTools = {};
        this.cpuRenderingInvalidated = true;
        this.fillWithBackgroundColor();
        this.render();
    }
    setColormapCPU(colormapData) {
        this.colormap = colormapData;
        const colormap = (0, index_1.getColormap)(colormapData.name, colormapData);
        this._cpuFallbackEnabledElement.viewport.colormap = colormap;
        this._cpuFallbackEnabledElement.renderingTools = {};
        this.fillWithBackgroundColor();
        this.cpuRenderingInvalidated = true;
        this.render();
        const eventDetail = {
            viewportId: this.id,
            colormap: colormapData,
        };
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.COLORMAP_MODIFIED, eventDetail);
    }
    setColormapGPU(colormap) {
        const ActorEntry = this.getDefaultActor();
        const actor = ActorEntry.actor;
        const actorProp = actor.getProperty();
        const rgbTransferFunction = actorProp.getRGBTransferFunction();
        const colormapObj = utilities_1.colormap.getColormap(colormap.name) ||
            ColorMaps_1.default.getPresetByName(colormap.name);
        if (!rgbTransferFunction) {
            const cfun = ColorTransferFunction_1.default.newInstance();
            cfun.applyColorMap(colormapObj);
            cfun.setMappingRange(this.voiRange.lower, this.voiRange.upper);
            actorProp.setRGBTransferFunction(0, cfun);
        }
        else {
            rgbTransferFunction.applyColorMap(colormapObj);
            rgbTransferFunction.setMappingRange(this.voiRange.lower, this.voiRange.upper);
            actorProp.setRGBTransferFunction(0, rgbTransferFunction);
        }
        this.colormap = colormap;
        this.render();
        const eventDetail = {
            viewportId: this.id,
            colormap,
        };
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.COLORMAP_MODIFIED, eventDetail);
    }
    unsetColormapGPU() {
        throw new Error('unsetColormapGPU not implemented.');
    }
    _getImagePlaneModule(imageId) {
        var _a, _b;
        const imagePlaneModule = metaData.get(enums_1.MetadataModules.IMAGE_PLANE, imageId);
        this.calibration || (this.calibration = imagePlaneModule.calibration);
        const newImagePlaneModule = Object.assign({}, imagePlaneModule);
        if (!newImagePlaneModule.columnPixelSpacing) {
            newImagePlaneModule.columnPixelSpacing = 1;
            this.hasPixelSpacing = ((_a = this.calibration) === null || _a === void 0 ? void 0 : _a.scale) > 0;
        }
        if (!newImagePlaneModule.rowPixelSpacing) {
            newImagePlaneModule.rowPixelSpacing = 1;
            this.hasPixelSpacing = ((_b = this.calibration) === null || _b === void 0 ? void 0 : _b.scale) > 0;
        }
        if (!newImagePlaneModule.columnCosines) {
            newImagePlaneModule.columnCosines = [0, 1, 0];
        }
        if (!newImagePlaneModule.rowCosines) {
            newImagePlaneModule.rowCosines = [1, 0, 0];
        }
        if (!newImagePlaneModule.imagePositionPatient) {
            newImagePlaneModule.imagePositionPatient = [0, 0, 0];
        }
        if (!newImagePlaneModule.imageOrientationPatient) {
            newImagePlaneModule.imageOrientationPatient = new Float32Array([
                1, 0, 0, 0, 1, 0,
            ]);
        }
        return newImagePlaneModule;
    }
}
exports.default = StackViewport;
//# sourceMappingURL=StackViewport.js.map