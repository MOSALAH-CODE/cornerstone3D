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
const ColorTransferFunction_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ColorTransferFunction"));
const ColorMaps_1 = __importDefault(require("@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps"));
const PiecewiseFunction_1 = __importDefault(require("@kitware/vtk.js/Common/DataModel/PiecewiseFunction"));
const gl_matrix_1 = require("gl-matrix");
const cache_1 = __importDefault(require("../cache"));
const constants_1 = require("../constants");
const enums_1 = require("../enums");
const ViewportType_1 = __importDefault(require("../enums/ViewportType"));
const eventTarget_1 = __importDefault(require("../eventTarget"));
const init_1 = require("../init");
const volumeLoader_1 = require("../loaders/volumeLoader");
const utilities_1 = require("../utilities");
const helpers_1 = require("./helpers");
const volumeNewImageEventDispatcher_1 = __importStar(require("./helpers/volumeNewImageEventDispatcher"));
const Viewport_1 = __importDefault(require("./Viewport"));
const vtkSlabCamera_1 = __importDefault(require("./vtkClasses/vtkSlabCamera"));
const transformWorldToIndex_1 = __importDefault(require("../utilities/transformWorldToIndex"));
const colormap_1 = require("../utilities/colormap");
const transferFunctionUtils_1 = require("../utilities/transferFunctionUtils");
class BaseVolumeViewport extends Viewport_1.default {
    constructor(props) {
        super(props);
        this.useCPURendering = false;
        this.useNativeDataType = false;
        this.perVolumeIdDefaultProperties = new Map();
        this.viewportProperties = {};
        this.setRotation = (rotation) => {
            const panFit = this.getPan(this.fitToCanvasCamera);
            const pan = this.getPan();
            const previousCamera = this.getCamera();
            const panSub = gl_matrix_1.vec2.sub([0, 0], panFit, pan);
            this.setPan(panSub, false);
            const { flipVertical } = this.getCamera();
            const initialViewUp = flipVertical
                ? gl_matrix_1.vec3.negate([0, 0, 0], this.initialViewUp)
                : this.initialViewUp;
            this.setCameraNoEvent({
                viewUp: initialViewUp,
            });
            this.rotateCamera(rotation);
            const afterPan = this.getPan();
            const afterPanFit = this.getPan(this.fitToCanvasCamera);
            const newCenter = gl_matrix_1.vec2.sub([0, 0], afterPan, afterPanFit);
            const newOffset = gl_matrix_1.vec2.add([0, 0], panFit, newCenter);
            this.setPan(newOffset, false);
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
            this.viewportProperties.rotation = rotation;
        };
        this.getDefaultProperties = (volumeId) => {
            let volumeProperties;
            if (volumeId !== undefined) {
                volumeProperties = this.perVolumeIdDefaultProperties.get(volumeId);
            }
            if (volumeProperties !== undefined) {
                return volumeProperties;
            }
            return Object.assign({}, this.globalDefaultProperties);
        };
        this.getProperties = (volumeId) => {
            var _a, _b;
            const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
            if (!applicableVolumeActorInfo) {
                return;
            }
            const { colormap: latestColormap, VOILUTFunction, interpolationType, invert, slabThickness, rotation, preset, } = this.viewportProperties;
            const voiRanges = this.getActors()
                .map((actorEntry) => {
                var _a;
                const volumeActor = actorEntry.actor;
                const volumeId = actorEntry.uid;
                const volume = cache_1.default.getVolume(volumeId);
                if (!volume) {
                    return null;
                }
                const cfun = volumeActor.getProperty().getRGBTransferFunction(0);
                const [lower, upper] = ((_a = this.viewportProperties) === null || _a === void 0 ? void 0 : _a.VOILUTFunction) === 'SIGMOID'
                    ? (0, utilities_1.getVoiFromSigmoidRGBTransferFunction)(cfun)
                    : cfun.getRange();
                return { volumeId, voiRange: { lower, upper } };
            })
                .filter(Boolean);
            const voiRange = volumeId
                ? (_a = voiRanges.find((range) => range.volumeId === volumeId)) === null || _a === void 0 ? void 0 : _a.voiRange
                : (_b = voiRanges[0]) === null || _b === void 0 ? void 0 : _b.voiRange;
            const volumeColormap = this.getColormap(volumeId);
            const colormap = volumeId && volumeColormap ? volumeColormap : latestColormap;
            return {
                colormap: colormap,
                voiRange: voiRange,
                VOILUTFunction: VOILUTFunction,
                interpolationType: interpolationType,
                invert: invert,
                slabThickness: slabThickness,
                rotation: rotation,
                preset,
            };
        };
        this.getColormap = (volumeId) => {
            const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
            if (!applicableVolumeActorInfo) {
                return;
            }
            const { volumeActor } = applicableVolumeActorInfo;
            const cfun = volumeActor.getProperty().getRGBTransferFunction(0);
            const { nodes } = cfun.getState();
            const RGBPoints = nodes.reduce((acc, node) => {
                acc.push(node.x, node.r, node.g, node.b);
                return acc;
            }, []);
            const matchedColormap = (0, colormap_1.findMatchingColormap)(RGBPoints, volumeActor);
            return matchedColormap;
        };
        this.getRotation = () => {
            const { viewUp: currentViewUp, viewPlaneNormal, flipVertical, } = this.getCamera();
            const initialViewUp = flipVertical
                ? gl_matrix_1.vec3.negate([0, 0, 0], this.initialViewUp)
                : this.initialViewUp;
            if (!initialViewUp) {
                return 0;
            }
            const initialToCurrentViewUpAngle = (gl_matrix_1.vec3.angle(initialViewUp, currentViewUp) * 180) / Math.PI;
            const initialToCurrentViewUpCross = gl_matrix_1.vec3.cross([0, 0, 0], initialViewUp, currentViewUp);
            const normalDot = gl_matrix_1.vec3.dot(initialToCurrentViewUpCross, viewPlaneNormal);
            const value = normalDot >= 0
                ? initialToCurrentViewUpAngle
                : (360 - initialToCurrentViewUpAngle) % 360;
            return value;
        };
        this.getFrameOfReferenceUID = () => {
            return this._FrameOfReferenceUID;
        };
        this.canvasToWorld = (canvasPos) => {
            var _a, _b;
            const vtkCamera = this.getVtkActiveCamera();
            (_a = vtkCamera.setIsPerformingCoordinateTransformation) === null || _a === void 0 ? void 0 : _a.call(vtkCamera, true);
            const renderer = this.getRenderer();
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
            (_b = vtkCamera.setIsPerformingCoordinateTransformation) === null || _b === void 0 ? void 0 : _b.call(vtkCamera, false);
            return [worldCoord[0], worldCoord[1], worldCoord[2]];
        };
        this.worldToCanvas = (worldPos) => {
            var _a, _b;
            const vtkCamera = this.getVtkActiveCamera();
            (_a = vtkCamera.setIsPerformingCoordinateTransformation) === null || _a === void 0 ? void 0 : _a.call(vtkCamera, true);
            const renderer = this.getRenderer();
            const offscreenMultiRenderWindow = this.getRenderingEngine().offscreenMultiRenderWindow;
            const openGLRenderWindow = offscreenMultiRenderWindow.getOpenGLRenderWindow();
            const size = openGLRenderWindow.getSize();
            const displayCoord = openGLRenderWindow.worldToDisplay(...worldPos, renderer);
            displayCoord[1] = size[1] - displayCoord[1];
            const canvasCoord = [
                displayCoord[0] - this.sx,
                displayCoord[1] - this.sy,
            ];
            const devicePixelRatio = window.devicePixelRatio || 1;
            const canvasCoordWithDPR = [
                canvasCoord[0] / devicePixelRatio,
                canvasCoord[1] / devicePixelRatio,
            ];
            (_b = vtkCamera.setIsPerformingCoordinateTransformation) === null || _b === void 0 ? void 0 : _b.call(vtkCamera, false);
            return canvasCoordWithDPR;
        };
        this.hasImageURI = (imageURI) => {
            const volumeActors = this.getActors().filter((actorEntry) => (0, utilities_1.actorIsA)(actorEntry, 'vtkVolume'));
            return volumeActors.some(({ uid }) => {
                const volume = cache_1.default.getVolume(uid);
                if (!volume || !volume.imageIds) {
                    return false;
                }
                const volumeImageURIs = volume.imageIds.map(utilities_1.imageIdToURI);
                return volumeImageURIs.includes(imageURI);
            });
        };
        this.getImageIds = (volumeId) => {
            const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
            if (!applicableVolumeActorInfo) {
                throw new Error(`No actor found for the given volumeId: ${volumeId}`);
            }
            const volumeIdToUse = applicableVolumeActorInfo.volumeId;
            const imageVolume = cache_1.default.getVolume(volumeIdToUse);
            if (!imageVolume) {
                throw new Error(`imageVolume with id: ${volumeIdToUse} does not exist in cache`);
            }
            return imageVolume.imageIds;
        };
        this.useCPURendering = (0, init_1.getShouldUseCPURendering)();
        this.useNativeDataType = this._shouldUseNativeDataType();
        if (this.useCPURendering) {
            throw new Error('VolumeViewports cannot be used whilst CPU Fallback Rendering is enabled.');
        }
        const renderer = this.getRenderer();
        const camera = vtkSlabCamera_1.default.newInstance();
        renderer.setActiveCamera(camera);
        switch (this.type) {
            case ViewportType_1.default.ORTHOGRAPHIC:
                camera.setParallelProjection(true);
                break;
            case ViewportType_1.default.VOLUME_3D:
                camera.setParallelProjection(true);
                break;
            case ViewportType_1.default.PERSPECTIVE:
                camera.setParallelProjection(false);
                break;
            default:
                throw new Error(`Unrecognized viewport type: ${this.type}`);
        }
        this.initializeVolumeNewImageEventDispatcher();
    }
    static get useCustomRenderingPipeline() {
        return false;
    }
    applyViewOrientation(orientation, resetCamera = true) {
        const { viewPlaneNormal, viewUp } = this._getOrientationVectors(orientation);
        const camera = this.getVtkActiveCamera();
        camera.setDirectionOfProjection(-viewPlaneNormal[0], -viewPlaneNormal[1], -viewPlaneNormal[2]);
        camera.setViewUpFrom(viewUp);
        this.initialViewUp = viewUp;
        if (resetCamera) {
            this.resetCamera();
        }
    }
    initializeVolumeNewImageEventDispatcher() {
        const volumeNewImageHandlerBound = volumeNewImageHandler.bind(this);
        const volumeNewImageCleanUpBound = volumeNewImageCleanUp.bind(this);
        function volumeNewImageHandler(cameraEvent) {
            const { viewportId } = cameraEvent.detail;
            if (viewportId !== this.id || this.isDisabled) {
                return;
            }
            const viewportImageData = this.getImageData();
            if (!viewportImageData) {
                return;
            }
            (0, volumeNewImageEventDispatcher_1.default)(cameraEvent);
        }
        function volumeNewImageCleanUp(evt) {
            const { viewportId } = evt.detail;
            if (viewportId !== this.id) {
                return;
            }
            this.element.removeEventListener(enums_1.Events.CAMERA_MODIFIED, volumeNewImageHandlerBound);
            eventTarget_1.default.removeEventListener(enums_1.Events.ELEMENT_DISABLED, volumeNewImageCleanUpBound);
            (0, volumeNewImageEventDispatcher_1.resetVolumeNewImageState)(viewportId);
        }
        this.element.removeEventListener(enums_1.Events.CAMERA_MODIFIED, volumeNewImageHandlerBound);
        this.element.addEventListener(enums_1.Events.CAMERA_MODIFIED, volumeNewImageHandlerBound);
        eventTarget_1.default.addEventListener(enums_1.Events.ELEMENT_DISABLED, volumeNewImageCleanUpBound);
    }
    resetVolumeViewportClippingRange() {
        const activeCamera = this.getVtkActiveCamera();
        if (activeCamera.getParallelProjection()) {
            activeCamera.setClippingRange(-constants_1.RENDERING_DEFAULTS.MAXIMUM_RAY_DISTANCE, constants_1.RENDERING_DEFAULTS.MAXIMUM_RAY_DISTANCE);
        }
        else {
            activeCamera.setClippingRange(constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS, constants_1.RENDERING_DEFAULTS.MAXIMUM_RAY_DISTANCE);
        }
    }
    setVOILUTFunction(voiLUTFunction, volumeId, suppressEvents) {
        if (Object.values(enums_1.VOILUTFunctionType).indexOf(voiLUTFunction) === -1) {
            voiLUTFunction = enums_1.VOILUTFunctionType.LINEAR;
        }
        const { voiRange } = this.getProperties();
        this.setVOI(voiRange, volumeId, suppressEvents);
        this.viewportProperties.VOILUTFunction = voiLUTFunction;
    }
    setColormap(colormap, volumeId, suppressEvents) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        const cfun = ColorTransferFunction_1.default.newInstance();
        let colormapObj = utilities_1.colormap.getColormap(colormap.name);
        const { name } = colormap;
        if (!colormapObj) {
            colormapObj = ColorMaps_1.default.getPresetByName(name);
        }
        if (!colormapObj) {
            throw new Error(`Colormap ${colormap} not found`);
        }
        const range = volumeActor
            .getProperty()
            .getRGBTransferFunction(0)
            .getRange();
        cfun.applyColorMap(colormapObj);
        cfun.setMappingRange(range[0], range[1]);
        volumeActor.getProperty().setRGBTransferFunction(0, cfun);
        this.viewportProperties.colormap = colormap;
        if (!suppressEvents) {
            const eventDetail = {
                viewportId: this.id,
                colormap,
                volumeId,
            };
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.COLORMAP_MODIFIED, eventDetail);
        }
    }
    setOpacity(colormap, volumeId) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        const ofun = PiecewiseFunction_1.default.newInstance();
        if (typeof colormap.opacity === 'number') {
            const range = volumeActor
                .getProperty()
                .getRGBTransferFunction(0)
                .getRange();
            ofun.addPoint(range[0], colormap.opacity);
            ofun.addPoint(range[1], colormap.opacity);
        }
        else {
            colormap.opacity.forEach(({ opacity, value }) => {
                ofun.addPoint(value, opacity);
            });
        }
        volumeActor.getProperty().setScalarOpacity(0, ofun);
        if (!this.viewportProperties.colormap) {
            this.viewportProperties.colormap = {};
        }
        this.viewportProperties.colormap.opacity = colormap.opacity;
    }
    setInvert(inverted, volumeId, suppressEvents) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const volumeIdToUse = applicableVolumeActorInfo.volumeId;
        const cfun = this._getOrCreateColorTransferFunction(volumeIdToUse);
        (0, utilities_1.invertRgbTransferFunction)(cfun);
        this.viewportProperties.invert = inverted;
        if (!suppressEvents) {
            const eventDetail = Object.assign(Object.assign({}, this.getVOIModifiedEventDetail(volumeIdToUse)), { invertStateChanged: true });
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOI_MODIFIED, eventDetail);
        }
    }
    getVOIModifiedEventDetail(volumeId) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            throw new Error(`No actor found for the given volumeId: ${volumeId}`);
        }
        const volumeActor = applicableVolumeActorInfo.volumeActor;
        const transferFunction = volumeActor
            .getProperty()
            .getRGBTransferFunction(0);
        const range = transferFunction.getMappingRange();
        const matchedColormap = this.getColormap(volumeId);
        const { VOILUTFunction, invert } = this.getProperties(volumeId);
        return {
            viewportId: this.id,
            range: {
                lower: range[0],
                upper: range[1],
            },
            volumeId: applicableVolumeActorInfo.volumeId,
            VOILUTFunction: VOILUTFunction,
            colormap: matchedColormap,
            invert,
        };
    }
    _getOrCreateColorTransferFunction(volumeId) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return null;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        const rgbTransferFunction = volumeActor
            .getProperty()
            .getRGBTransferFunction(0);
        if (rgbTransferFunction) {
            return rgbTransferFunction;
        }
        const newRGBTransferFunction = ColorTransferFunction_1.default.newInstance();
        volumeActor.getProperty().setRGBTransferFunction(0, newRGBTransferFunction);
        return newRGBTransferFunction;
    }
    setInterpolationType(interpolationType, volumeId) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        const volumeProperty = volumeActor.getProperty();
        volumeProperty.setInterpolationType(interpolationType);
        this.viewportProperties.interpolationType = interpolationType;
    }
    setVOI(voiRange, volumeId, suppressEvents = false) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        const volumeIdToUse = applicableVolumeActorInfo.volumeId;
        let voiRangeToUse = voiRange;
        if (typeof voiRangeToUse === 'undefined') {
            const imageData = volumeActor.getMapper().getInputData();
            const range = imageData.getPointData().getScalars().getRange();
            const maxVoiRange = { lower: range[0], upper: range[1] };
            voiRangeToUse = maxVoiRange;
        }
        const { VOILUTFunction } = this.getProperties(volumeIdToUse);
        if (VOILUTFunction === enums_1.VOILUTFunctionType.SAMPLED_SIGMOID) {
            const cfun = (0, utilities_1.createSigmoidRGBTransferFunction)(voiRangeToUse);
            volumeActor.getProperty().setRGBTransferFunction(0, cfun);
        }
        else {
            const { lower, upper } = voiRangeToUse;
            volumeActor
                .getProperty()
                .getRGBTransferFunction(0)
                .setRange(lower, upper);
        }
        if (!suppressEvents) {
            const eventDetail = Object.assign({}, this.getVOIModifiedEventDetail(volumeIdToUse));
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOI_MODIFIED, eventDetail);
        }
        this.viewportProperties.voiRange = voiRangeToUse;
    }
    rotateCamera(rotation) {
        const rotationToApply = rotation - this.getRotation();
        this.getVtkActiveCamera().roll(-rotationToApply);
    }
    setDefaultProperties(ViewportProperties, volumeId) {
        if (volumeId == null) {
            this.globalDefaultProperties = ViewportProperties;
        }
        else {
            this.perVolumeIdDefaultProperties.set(volumeId, ViewportProperties);
        }
    }
    clearDefaultProperties(volumeId) {
        if (volumeId == null) {
            this.globalDefaultProperties = {};
            this.resetProperties();
        }
        else {
            this.perVolumeIdDefaultProperties.delete(volumeId);
            this.resetToDefaultProperties(volumeId);
        }
    }
    getViewReference(viewRefSpecifier = {}) {
        const target = super.getViewReference(viewRefSpecifier);
        const volumeId = this.getVolumeId(viewRefSpecifier);
        if ((viewRefSpecifier === null || viewRefSpecifier === void 0 ? void 0 : viewRefSpecifier.forFrameOfReference) !== false) {
            target.volumeId = volumeId;
        }
        if (typeof (viewRefSpecifier === null || viewRefSpecifier === void 0 ? void 0 : viewRefSpecifier.sliceIndex) !== 'number') {
            return target;
        }
        const { viewPlaneNormal } = target;
        const delta = viewRefSpecifier.sliceIndex - this.getSliceIndex();
        const { sliceRangeInfo } = (0, utilities_1.getVolumeViewportScrollInfo)(this, volumeId, true);
        const { sliceRange, spacingInNormalDirection, camera } = sliceRangeInfo;
        const { focalPoint, position } = camera;
        const { newFocalPoint } = (0, utilities_1.snapFocalPointToSlice)(focalPoint, position, sliceRange, viewPlaneNormal, spacingInNormalDirection, delta);
        target.cameraFocalPoint = newFocalPoint;
        return target;
    }
    isReferenceViewable(viewRef, options) {
        if (!viewRef.FrameOfReferenceUID) {
            return false;
        }
        if (!super.isReferenceViewable(viewRef, options)) {
            return false;
        }
        if (options === null || options === void 0 ? void 0 : options.withNavigation) {
            return true;
        }
        const currentSliceIndex = this.getSliceIndex();
        const { sliceIndex } = viewRef;
        if (Array.isArray(sliceIndex)) {
            return (sliceIndex[0] <= currentSliceIndex && currentSliceIndex <= sliceIndex[1]);
        }
        return sliceIndex === undefined || sliceIndex === currentSliceIndex;
    }
    scroll(delta = 1) {
        const volumeId = this.getVolumeId();
        const { sliceRangeInfo } = (0, utilities_1.getVolumeViewportScrollInfo)(this, volumeId, true);
        if (!sliceRangeInfo) {
            return;
        }
        const { sliceRange, spacingInNormalDirection, camera } = sliceRangeInfo;
        const { focalPoint, viewPlaneNormal, position } = camera;
        const { newFocalPoint, newPosition } = (0, utilities_1.snapFocalPointToSlice)(focalPoint, position, sliceRange, viewPlaneNormal, spacingInNormalDirection, delta);
        this.setCamera({
            focalPoint: newFocalPoint,
            position: newPosition,
        });
    }
    setViewReference(viewRef) {
        if (!viewRef) {
            return;
        }
        const volumeId = this.getVolumeId();
        const { viewPlaneNormal: refViewPlaneNormal, FrameOfReferenceUID: refFrameOfReference, cameraFocalPoint, viewUp, } = viewRef;
        let { sliceIndex } = viewRef;
        const { focalPoint, viewPlaneNormal, position } = this.getCamera();
        const isNegativeNormal = (0, utilities_1.isEqualNegative)(viewPlaneNormal, refViewPlaneNormal);
        const isSameNormal = (0, utilities_1.isEqual)(viewPlaneNormal, refViewPlaneNormal);
        if (typeof sliceIndex === 'number' &&
            viewRef.volumeId === volumeId &&
            (isNegativeNormal || isSameNormal)) {
            const { currentStepIndex, sliceRangeInfo, numScrollSteps } = (0, utilities_1.getVolumeViewportScrollInfo)(this, volumeId, true);
            const { sliceRange, spacingInNormalDirection } = sliceRangeInfo;
            if (isNegativeNormal) {
                sliceIndex = numScrollSteps - sliceIndex - 1;
            }
            const delta = sliceIndex - currentStepIndex;
            const { newFocalPoint, newPosition } = (0, utilities_1.snapFocalPointToSlice)(focalPoint, position, sliceRange, viewPlaneNormal, spacingInNormalDirection, delta);
            this.setCamera({ focalPoint: newFocalPoint, position: newPosition });
        }
        else if (refFrameOfReference === this.getFrameOfReferenceUID()) {
            if (refViewPlaneNormal && !isNegativeNormal && !isSameNormal) {
                this.setOrientation({ viewPlaneNormal: refViewPlaneNormal, viewUp });
                return this.setViewReference(viewRef);
            }
            if (cameraFocalPoint) {
                const focalDelta = gl_matrix_1.vec3.subtract([0, 0, 0], cameraFocalPoint, focalPoint);
                const useNormal = refViewPlaneNormal !== null && refViewPlaneNormal !== void 0 ? refViewPlaneNormal : viewPlaneNormal;
                const normalDot = gl_matrix_1.vec3.dot(focalDelta, useNormal);
                if (!(0, utilities_1.isEqual)(normalDot, 0)) {
                    gl_matrix_1.vec3.scale(focalDelta, useNormal, normalDot);
                }
                const newFocal = gl_matrix_1.vec3.add([0, 0, 0], focalPoint, focalDelta);
                const newPosition = gl_matrix_1.vec3.add([0, 0, 0], position, focalDelta);
                this.setCamera({ focalPoint: newFocal, position: newPosition });
            }
        }
        else {
            throw new Error(`Incompatible view refs: ${refFrameOfReference}!==${this.getFrameOfReferenceUID()}`);
        }
    }
    setProperties({ voiRange, VOILUTFunction, invert, colormap, preset, interpolationType, slabThickness, rotation, } = {}, volumeId, suppressEvents = false) {
        if (this.globalDefaultProperties == null) {
            this.setDefaultProperties({
                voiRange,
                VOILUTFunction,
                invert,
                colormap,
                preset,
                slabThickness,
                rotation,
            });
        }
        if (colormap === null || colormap === void 0 ? void 0 : colormap.name) {
            this.setColormap(colormap, volumeId, suppressEvents);
        }
        if ((colormap === null || colormap === void 0 ? void 0 : colormap.opacity) != null) {
            this.setOpacity(colormap, volumeId);
        }
        if (voiRange !== undefined) {
            this.setVOI(voiRange, volumeId, suppressEvents);
        }
        if (typeof interpolationType !== 'undefined') {
            this.setInterpolationType(interpolationType);
        }
        if (VOILUTFunction !== undefined) {
            this.setVOILUTFunction(VOILUTFunction, volumeId, suppressEvents);
        }
        if (invert !== undefined && this.viewportProperties.invert !== invert) {
            this.setInvert(invert, volumeId, suppressEvents);
        }
        if (preset !== undefined) {
            this.setPreset(preset, volumeId, suppressEvents);
        }
        if (slabThickness !== undefined) {
            this.setSlabThickness(slabThickness);
            this.viewportProperties.slabThickness = slabThickness;
        }
        if (rotation !== undefined) {
            this.setRotation(rotation);
        }
    }
    resetToDefaultProperties(volumeId) {
        var _a, _b;
        const properties = this.globalDefaultProperties;
        if ((_a = properties.colormap) === null || _a === void 0 ? void 0 : _a.name) {
            this.setColormap(properties.colormap, volumeId);
        }
        if (((_b = properties.colormap) === null || _b === void 0 ? void 0 : _b.opacity) != null) {
            this.setOpacity(properties.colormap, volumeId);
        }
        if (properties.voiRange !== undefined) {
            this.setVOI(properties.voiRange, volumeId);
        }
        if (properties.VOILUTFunction !== undefined) {
            this.setVOILUTFunction(properties.VOILUTFunction, volumeId);
        }
        if (properties.invert !== undefined) {
            this.setInvert(properties.invert, volumeId);
        }
        if (properties.slabThickness !== undefined) {
            this.setSlabThickness(properties.slabThickness);
            this.viewportProperties.slabThickness = properties.slabThickness;
        }
        if (properties.rotation !== undefined) {
            this.setRotation(properties.rotation);
        }
        this.render();
    }
    setPreset(presetNameOrObj, volumeId, suppressEvents) {
        const applicableVolumeActorInfo = this._getApplicableVolumeActor(volumeId);
        if (!applicableVolumeActorInfo) {
            return;
        }
        const { volumeActor } = applicableVolumeActorInfo;
        let preset = presetNameOrObj;
        if (typeof preset === 'string') {
            preset = constants_1.VIEWPORT_PRESETS.find((preset) => {
                return preset.name === presetNameOrObj;
            });
        }
        if (!preset) {
            return;
        }
        (0, utilities_1.applyPreset)(volumeActor, preset);
        this.viewportProperties.preset = preset;
        this.render();
        if (!suppressEvents) {
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.PRESET_MODIFIED, {
                viewportId: this.id,
                volumeId: applicableVolumeActorInfo.volumeId,
                actor: volumeActor,
                presetName: preset.name,
            });
        }
    }
    setVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const firstImageVolume = cache_1.default.getVolume(volumeInputArray[0].volumeId);
            if (!firstImageVolume) {
                throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
            }
            const FrameOfReferenceUID = firstImageVolume.metadata.FrameOfReferenceUID;
            yield this._isValidVolumeInputArray(volumeInputArray, FrameOfReferenceUID);
            this._FrameOfReferenceUID = FrameOfReferenceUID;
            const volumeActors = [];
            for (let i = 0; i < volumeInputArray.length; i++) {
                const { volumeId, actorUID, slabThickness } = volumeInputArray[i];
                const actor = yield (0, helpers_1.createVolumeActor)(volumeInputArray[i], this.element, this.id, suppressEvents, this.useNativeDataType);
                const uid = actorUID || volumeId;
                volumeActors.push({
                    uid,
                    actor,
                    slabThickness,
                    referenceId: volumeId,
                });
            }
            this._setVolumeActors(volumeActors);
            this.viewportStatus = enums_1.ViewportStatus.PRE_RENDER;
            this.initializeColorTransferFunction(volumeInputArray);
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOLUME_VIEWPORT_NEW_VOLUME, {
                viewportId: this.id,
                volumeActors,
            });
            if (immediate) {
                this.render();
            }
        });
    }
    addVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const firstImageVolume = cache_1.default.getVolume(volumeInputArray[0].volumeId);
            if (!firstImageVolume) {
                throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
            }
            const volumeActors = [];
            yield this._isValidVolumeInputArray(volumeInputArray, this._FrameOfReferenceUID);
            for (let i = 0; i < volumeInputArray.length; i++) {
                const { volumeId, visibility, actorUID, slabThickness } = volumeInputArray[i];
                const actor = yield (0, helpers_1.createVolumeActor)(volumeInputArray[i], this.element, this.id, suppressEvents, this.useNativeDataType);
                if (visibility === false) {
                    actor.setVisibility(false);
                }
                const uid = actorUID || volumeId;
                volumeActors.push({
                    uid,
                    actor,
                    slabThickness,
                    referenceId: volumeId,
                });
            }
            this.addActors(volumeActors);
            this.initializeColorTransferFunction(volumeInputArray);
            if (immediate) {
                this.render();
            }
        });
    }
    removeVolumeActors(actorUIDs, immediate = false) {
        this.removeActors(actorUIDs);
        if (immediate) {
            this.render();
        }
    }
    setOrientation(_orientation, _immediate = true) {
        console.warn('Method "setOrientation" needs implementation');
    }
    initializeColorTransferFunction(volumeInputArray) {
        const selectedVolumeId = volumeInputArray[0].volumeId;
        const colorTransferFunction = this._getOrCreateColorTransferFunction(selectedVolumeId);
        if (!this.initialTransferFunctionNodes) {
            this.initialTransferFunctionNodes = (0, transferFunctionUtils_1.getTransferFunctionNodes)(colorTransferFunction);
        }
    }
    _getApplicableVolumeActor(volumeId) {
        var _a;
        if (volumeId !== undefined && !this.getActor(volumeId)) {
            return;
        }
        const actorEntries = this.getActors();
        if (!actorEntries.length) {
            return;
        }
        let volumeActor;
        if (volumeId) {
            volumeActor = (_a = this.getActor(volumeId)) === null || _a === void 0 ? void 0 : _a.actor;
        }
        if (!volumeActor) {
            volumeActor = actorEntries[0].actor;
            volumeId = actorEntries[0].uid;
        }
        return { volumeActor, volumeId };
    }
    _isValidVolumeInputArray(volumeInputArray, FrameOfReferenceUID) {
        return __awaiter(this, void 0, void 0, function* () {
            const numVolumes = volumeInputArray.length;
            for (let i = 1; i < numVolumes; i++) {
                const volumeInput = volumeInputArray[i];
                const imageVolume = yield (0, volumeLoader_1.loadVolume)(volumeInput.volumeId);
                if (!imageVolume) {
                    throw new Error(`imageVolume with id: ${imageVolume.volumeId} does not exist`);
                }
                if (FrameOfReferenceUID !== imageVolume.metadata.FrameOfReferenceUID) {
                    throw new Error(`Volumes being added to viewport ${this.id} do not share the same FrameOfReferenceUID. This is not yet supported`);
                }
            }
            return true;
        });
    }
    getBounds() {
        const renderer = this.getRenderer();
        const bounds = renderer.computeVisiblePropBounds();
        return bounds;
    }
    flip(flipDirection) {
        super.flip(flipDirection);
    }
    hasVolumeId(volumeId) {
        const actorEntries = this.getActors();
        return actorEntries.some((actorEntry) => {
            return actorEntry.uid === volumeId;
        });
    }
    getImageData(volumeId) {
        var _a;
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        const { uid: defaultActorUID } = defaultActor;
        volumeId = volumeId !== null && volumeId !== void 0 ? volumeId : defaultActorUID;
        const actorEntry = this.getActor(volumeId);
        if (!(0, utilities_1.actorIsA)(actorEntry, 'vtkVolume')) {
            return;
        }
        const actor = actorEntry.actor;
        const volume = cache_1.default.getVolume(volumeId);
        const vtkImageData = actor.getMapper().getInputData();
        return {
            dimensions: vtkImageData.getDimensions(),
            spacing: vtkImageData.getSpacing(),
            origin: vtkImageData.getOrigin(),
            direction: vtkImageData.getDirection(),
            scalarData: vtkImageData.getPointData().getScalars().isDeleted()
                ? null
                : vtkImageData.getPointData().getScalars().getData(),
            imageData: actor.getMapper().getInputData(),
            metadata: {
                Modality: (_a = volume === null || volume === void 0 ? void 0 : volume.metadata) === null || _a === void 0 ? void 0 : _a.Modality,
            },
            scaling: volume === null || volume === void 0 ? void 0 : volume.scaling,
            hasPixelSpacing: true,
        };
    }
    _setVolumeActors(volumeActorEntries) {
        for (let i = 0; i < volumeActorEntries.length; i++) {
            this.viewportProperties.invert = false;
        }
        this.setActors(volumeActorEntries);
    }
    _getOrientationVectors(orientation) {
        if (typeof orientation === 'object') {
            if (orientation.viewPlaneNormal && orientation.viewUp) {
                return orientation;
            }
            else {
                throw new Error('Invalid orientation object. It must contain viewPlaneNormal and viewUp');
            }
        }
        else if (typeof orientation === 'string' &&
            constants_1.MPR_CAMERA_VALUES[orientation]) {
            this.viewportProperties.orientation = orientation;
            return constants_1.MPR_CAMERA_VALUES[orientation];
        }
        else {
            throw new Error(`Invalid orientation: ${orientation}. Valid orientations are: ${Object.keys(constants_1.MPR_CAMERA_VALUES).join(', ')}`);
        }
    }
    getSlabThickness() {
        const actors = this.getActors();
        let slabThickness = constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
        actors.forEach((actor) => {
            if (actor.slabThickness > slabThickness) {
                slabThickness = actor.slabThickness;
            }
        });
        return slabThickness;
    }
    getIntensityFromWorld(point) {
        const actorEntry = this.getDefaultActor();
        if (!(0, utilities_1.actorIsA)(actorEntry, 'vtkVolume')) {
            return;
        }
        const { actor, uid } = actorEntry;
        const imageData = actor.getMapper().getInputData();
        const volume = cache_1.default.getVolume(uid);
        const { dimensions } = volume;
        const index = (0, transformWorldToIndex_1.default)(imageData, point);
        const voxelIndex = index[2] * dimensions[0] * dimensions[1] +
            index[1] * dimensions[0] +
            index[0];
        return volume.getScalarData()[voxelIndex];
    }
    getVolumeId(specifier) {
        var _a, _b;
        const actorEntries = this.getActors();
        if (!actorEntries) {
            return;
        }
        if (!(specifier === null || specifier === void 0 ? void 0 : specifier.volumeId)) {
            return (_a = actorEntries.find((actorEntry) => actorEntry.actor.getClassName() === 'vtkVolume')) === null || _a === void 0 ? void 0 : _a.uid;
        }
        return (_b = actorEntries.find((actorEntry) => actorEntry.actor.getClassName() === 'vtkVolume' &&
            actorEntry.uid === specifier.volumeId)) === null || _b === void 0 ? void 0 : _b.uid;
    }
    getReferenceId(specifier = {}) {
        var _a;
        let { volumeId, sliceIndex: sliceIndex } = specifier;
        if (!volumeId) {
            const actorEntries = this.getActors();
            if (!actorEntries) {
                return;
            }
            volumeId = (_a = actorEntries.find((actorEntry) => actorEntry.actor.getClassName() === 'vtkVolume')) === null || _a === void 0 ? void 0 : _a.uid;
        }
        const currentIndex = this.getSliceIndex();
        sliceIndex !== null && sliceIndex !== void 0 ? sliceIndex : (sliceIndex = currentIndex);
        const { viewPlaneNormal, focalPoint } = this.getCamera();
        const querySeparator = volumeId.indexOf('?') > -1 ? '&' : '?';
        return `volumeId:${volumeId}${querySeparator}sliceIndex=${sliceIndex}&viewPlaneNormal=${viewPlaneNormal.join(',')}&focalPoint=${focalPoint.join(',')}`;
    }
}
exports.default = BaseVolumeViewport;
//# sourceMappingURL=BaseVolumeViewport.js.map