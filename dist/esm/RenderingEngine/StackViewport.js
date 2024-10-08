import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkCamera from '@kitware/vtk.js/Rendering/Core/Camera';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import { mat4, vec2, vec3 } from 'gl-matrix';
import eventTarget from '../eventTarget';
import * as metaData from '../metaData';
import cloneDeep from 'lodash.clonedeep';
import { actorIsA, colormap as colormapUtils, createSigmoidRGBTransferFunction, imageIdToURI, imageRetrieveMetadataProvider, invertRgbTransferFunction, isEqual, isImageActor, triggerEvent, updateVTKImageDataWithCornerstoneImage, windowLevel as windowLevelUtil, } from '../utilities';
import Viewport from './Viewport';
import { getColormap } from './helpers/cpuFallback/colors/index';
import drawImageSync from './helpers/cpuFallback/drawImageSync';
import { Events, InterpolationType, MetadataModules, RequestType, VOILUTFunctionType, ViewportStatus, } from '../enums';
import { loadAndCacheImage } from '../loaders/imageLoader';
import imageLoadPoolManager from '../requestPool/imageLoadPoolManager';
import calculateTransform from './helpers/cpuFallback/rendering/calculateTransform';
import canvasToPixel from './helpers/cpuFallback/rendering/canvasToPixel';
import getDefaultViewport from './helpers/cpuFallback/rendering/getDefaultViewport';
import pixelToCanvas from './helpers/cpuFallback/rendering/pixelToCanvas';
import resize from './helpers/cpuFallback/rendering/resize';
import cache from '../cache';
import { getConfiguration, getShouldUseCPURendering } from '../init';
import { createProgressive } from '../loaders/ProgressiveRetrieveImages';
import createLinearRGBTransferFunction from '../utilities/createLinearRGBTransferFunction';
import { getTransferFunctionNodes, setTransferFunctionNodes, } from '../utilities/transferFunctionUtils';
import correctShift from './helpers/cpuFallback/rendering/correctShift';
import resetCamera from './helpers/cpuFallback/rendering/resetCamera';
import { Transform } from './helpers/cpuFallback/rendering/transform';
import { findMatchingColormap } from '../utilities/colormap';
const EPSILON = 1;
class StackViewport extends Viewport {
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
                resize(this._cpuFallbackEnabledElement);
            }
        };
        this.getFrameOfReferenceUID = (sliceIndex) => this.getImagePlaneReferenceData(sliceIndex)?.FrameOfReferenceUID;
        this.getCornerstoneImage = () => this.csImage;
        this.createActorMapper = (imageData) => {
            const mapper = vtkImageMapper.newInstance();
            mapper.setInputData(imageData);
            const actor = vtkImageSlice.newInstance();
            actor.setMapper(mapper);
            const { preferSizeOverAccuracy } = getConfiguration().rendering;
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
            return {
                ...this.globalDefaultProperties,
                rotation: this.getRotation(),
            };
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
                ? vec3.negate(vec3.create(), this.initialViewUp)
                : this.initialViewUp;
            const initialToCurrentViewUpAngle = (vec3.angle(initialViewUp, currentViewUp) * 180) / Math.PI;
            const initialToCurrentViewUpCross = vec3.cross(vec3.create(), initialViewUp, currentViewUp);
            const normalDot = vec3.dot(initialToCurrentViewUpCross, viewPlaneNormal);
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
            triggerEvent(this.element, Events.CAMERA_MODIFIED, eventDetail);
        };
        this.renderImageObject = (image) => {
            this._setCSImage(image);
            const renderFn = this.useCPURendering
                ? this._updateToDisplayImageCPU
                : this._updateActorToDisplayImageId;
            renderFn.call(this, image);
        };
        this._setCSImage = (image) => {
            image.isPreScaled = image.preScale?.scaled;
            this.csImage = image;
        };
        this.canvasToWorldCPU = (canvasPos, worldPos = [0, 0, 0]) => {
            if (!this._cpuFallbackEnabledElement.image) {
                return;
            }
            const [px, py] = canvasToPixel(this._cpuFallbackEnabledElement, canvasPos);
            const { origin, spacing, direction } = this.getImageData();
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            vec3.scaleAndAdd(worldPos, origin, iVector, px * spacing[0]);
            vec3.scaleAndAdd(worldPos, worldPos, jVector, py * spacing[1]);
            return worldPos;
        };
        this.worldToCanvasCPU = (worldPos) => {
            const { spacing, direction, origin } = this.getImageData();
            const iVector = direction.slice(0, 3);
            const jVector = direction.slice(3, 6);
            const diff = vec3.subtract(vec3.create(), worldPos, origin);
            const indexPoint = [
                vec3.dot(diff, iVector) / spacing[0],
                vec3.dot(diff, jVector) / spacing[1],
            ];
            const canvasPoint = pixelToCanvas(this._cpuFallbackEnabledElement, indexPoint);
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
                if (imageIdToURI(imageIds[i]) === imageURI) {
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
                drawImageSync(this._cpuFallbackEnabledElement, this.cpuRenderingInvalidated);
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
        this.useCPURendering = getShouldUseCPURendering();
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
        return getShouldUseCPURendering();
    }
    _configureRenderingPipeline(value) {
        this.useNativeDataType = this._shouldUseNativeDataType();
        this.useCPURendering = value ?? getShouldUseCPURendering();
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
            transform: new Transform(),
            viewport: { rotation: 0 },
        };
    }
    _resetGPUViewport() {
        const renderer = this.getRenderer();
        const camera = vtkCamera.newInstance();
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
        eventTarget.addEventListener(Events.ELEMENT_DISABLED, function elementDisabledHandler() {
            clearTimeout(this.debouncedTimeout);
            eventTarget.removeEventListener(Events.ELEMENT_DISABLED, elementDisabledHandler);
        });
    }
    getImageDataGPU() {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!isImageActor(defaultActor)) {
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
            calibration: { ...this.csImage.calibration, ...this.calibration },
            preScale: {
                ...this.csImage.preScale,
            },
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
                    const pixelCoord = canvasToPixel(this._cpuFallbackEnabledElement, canvasPoint);
                    return [pixelCoord[0], pixelCoord[1], 0];
                },
                indexToWorld: (point, destPoint) => {
                    const canvasPoint = pixelToCanvas(this._cpuFallbackEnabledElement, [
                        point[0],
                        point[1],
                    ]);
                    return this.canvasToWorldCPU(canvasPoint, destPoint);
                },
            },
            scalarData: this.cpuImagePixelData,
            hasPixelSpacing: this.hasPixelSpacing,
            calibration: { ...this.csImage.calibration, ...this.calibration },
            preScale: {
                ...this.csImage.preScale,
            },
        };
    }
    buildMetadata(image) {
        const imageId = image.imageId;
        const { pixelRepresentation, bitsAllocated, bitsStored, highBit, photometricInterpretation, samplesPerPixel, } = metaData.get('imagePixelModule', imageId);
        const { windowWidth, windowCenter, voiLUTFunction } = image;
        const { modality } = metaData.get('generalSeriesModule', imageId);
        const imageIdScalingFactor = metaData.get('scalingModule', imageId);
        const calibration = metaData.get(MetadataModules.CALIBRATION, imageId);
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
            ? ViewportStatus.PRE_RENDER
            : ViewportStatus.LOADING;
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
        this.viewportStatus = ViewportStatus.PRE_RENDER;
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
        this.setInterpolationType(InterpolationType.LINEAR);
        if (this.getRotation() !== 0) {
            this.setRotation(0);
        }
        const transferFunction = this.getTransferFunction();
        setTransferFunctionNodes(transferFunction, this.initialTransferFunctionNodes);
        const nodes = getTransferFunctionNodes(transferFunction);
        const RGBPoints = nodes.reduce((acc, node) => {
            acc.push(node[0], node[1], node[2], node[3]);
            return acc;
        }, []);
        const defaultActor = this.getDefaultActor();
        const matchedColormap = findMatchingColormap(RGBPoints, defaultActor.actor);
        this.setColormap(matchedColormap);
    }
    resetToDefaultProperties() {
        this.cpuRenderingInvalidated = true;
        this.viewportStatus = ViewportStatus.PRE_RENDER;
        this.fillWithBackgroundColor();
        if (this.useCPURendering) {
            this._cpuFallbackEnabledElement.renderingTools = {};
        }
        const currentImageId = this.getCurrentImageId();
        const properties = this.perImageIdDefaultProperties.get(currentImageId) ||
            this.globalDefaultProperties;
        if (properties.colormap?.name) {
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
        this.setInterpolationType(InterpolationType.LINEAR);
        this.setInvertColor(false);
        this.render();
    }
    _setPropertiesFromCache() {
        const { interpolationType, invert } = this;
        let voiRange;
        if (this.voiUpdatedWithSetProperties) {
            voiRange = this.voiRange;
        }
        else if (this._isCurrentImagePTPrescaled()) {
            voiRange = this._getDefaultPTPrescaledVOIRange();
        }
        else {
            voiRange = this._getVOIRangeForCurrentImage() ?? this.voiRange;
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
            const rotationMatrix = mat4.fromRotation(mat4.create(), (viewport.rotation * Math.PI) / 180, viewPlaneNormal);
            viewUp = vec3.transformMat4(vec3.create(), viewUp, rotationMatrix);
        }
        const canvasCenter = [
            this.element.clientWidth / 2,
            this.element.clientHeight / 2,
        ];
        const canvasCenterWorld = this.canvasToWorld(canvasCenter);
        const topLeftWorld = this.canvasToWorld([0, 0]);
        const bottomLeftWorld = this.canvasToWorld([0, this.element.clientHeight]);
        const parallelScale = vec3.distance(topLeftWorld, bottomLeftWorld) / 2;
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
            const focalPointPixel = canvasToPixel(this._cpuFallbackEnabledElement, focalPointCanvas);
            const prevFocalPointCanvas = this.worldToCanvasCPU(previousCamera.focalPoint);
            const prevFocalPointPixel = canvasToPixel(this._cpuFallbackEnabledElement, prevFocalPointCanvas);
            const deltaPixel = vec2.create();
            vec2.subtract(deltaPixel, vec2.fromValues(focalPointPixel[0], focalPointPixel[1]), vec2.fromValues(prevFocalPointPixel[0], prevFocalPointPixel[1]));
            const shift = correctShift({ x: deltaPixel[0], y: deltaPixel[1] }, viewport);
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
        this._cpuFallbackEnabledElement.transform = calculateTransform(this._cpuFallbackEnabledElement);
        const eventDetail = {
            previousCamera,
            camera: this.getCamera(),
            element: this.element,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
            rotation: this.getRotation(),
        };
        triggerEvent(this.element, Events.CAMERA_MODIFIED, eventDetail);
    }
    getPanCPU() {
        const { viewport } = this._cpuFallbackEnabledElement;
        return [viewport.translation.x, viewport.translation.y];
    }
    setPanCPU(pan) {
        const camera = this.getCameraCPU();
        this.setCameraCPU({
            ...camera,
            focalPoint: [...pan.map((p) => -p), 0],
        });
    }
    getZoomCPU() {
        const { viewport } = this._cpuFallbackEnabledElement;
        return viewport.scale;
    }
    setZoomCPU(zoom) {
        const camera = this.getCameraCPU();
        this.setCameraCPU({ ...camera, scale: zoom });
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
        const panSub = vec2.sub([0, 0], panFit, pan);
        this.setPan(panSub, false);
        const { flipVertical } = this.getCamera();
        const initialViewUp = flipVertical
            ? vec3.negate(vec3.create(), this.initialViewUp)
            : this.initialViewUp;
        this.setCameraNoEvent({
            viewUp: initialViewUp,
        });
        this.getVtkActiveCamera().roll(-rotation);
        const afterPan = this.getPan();
        const afterPanFit = this.getPan(this.fitToCanvasCamera);
        const newCenter = vec2.sub([0, 0], afterPan, afterPanFit);
        const newOffset = vec2.add([0, 0], panFit, newCenter);
        this.setPan(newOffset, false);
    }
    setInterpolationTypeGPU(interpolationType) {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!isImageActor(defaultActor)) {
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
            interpolationType === InterpolationType.LINEAR ? false : true;
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
        if (!isImageActor(defaultActor)) {
            return;
        }
        if (actorIsA(defaultActor, 'vtkVolume')) {
            const volumeActor = defaultActor.actor;
            const tfunc = volumeActor.getProperty().getRGBTransferFunction(0);
            if ((!this.invert && invert) || (this.invert && !invert)) {
                invertRgbTransferFunction(tfunc);
            }
            this.invert = invert;
        }
        else if (actorIsA(defaultActor, 'vtkImageSlice')) {
            const imageSliceActor = defaultActor.actor;
            const tfunc = imageSliceActor.getProperty().getRGBTransferFunction(0);
            if ((!this.invert && invert) || (this.invert && !invert)) {
                invertRgbTransferFunction(tfunc);
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
            const { lower, upper } = windowLevelUtil.toLowHighRange(wwToUse, wcToUse);
            voiRange = { lower, upper };
        }
        else {
            const { lower, upper } = voiRange;
            const { windowCenter, windowWidth } = windowLevelUtil.toWindowLevel(lower, upper);
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
            triggerEvent(this.element, Events.VOI_MODIFIED, eventDetail);
        }
    }
    getTransferFunction() {
        const defaultActor = this.getDefaultActor();
        if (!defaultActor) {
            return;
        }
        if (!isImageActor(defaultActor)) {
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
        if (!isImageActor(defaultActor)) {
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
        const isSigmoidTFun = this.VOILUTFunction === VOILUTFunctionType.SAMPLED_SIGMOID;
        if (isSigmoidTFun || !transferFunction || forceRecreateLUTFunction) {
            const transferFunctionCreator = isSigmoidTFun
                ? createSigmoidRGBTransferFunction
                : createLinearRGBTransferFunction;
            transferFunction = transferFunctionCreator(voiRangeToUse);
            if (this.invert) {
                invertRgbTransferFunction(transferFunction);
            }
            imageActor.getProperty().setRGBTransferFunction(0, transferFunction);
            this.initialTransferFunctionNodes =
                getTransferFunctionNodes(transferFunction);
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
        triggerEvent(this.element, Events.VOI_MODIFIED, eventDetail);
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
        const rowCosineVec = vec3.fromValues(rowCosines[0], rowCosines[1], rowCosines[2]);
        const colCosineVec = vec3.fromValues(columnCosines[0], columnCosines[1], columnCosines[2]);
        const scanAxisNormal = vec3.create();
        vec3.cross(scanAxisNormal, rowCosineVec, colCosineVec);
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
        const imagePlaneModule = metaData.get(MetadataModules.IMAGE_PLANE, imageId);
        if (!imagePlaneModule) {
            return;
        }
        const { imagePositionPatient, frameOfReferenceUID: FrameOfReferenceUID } = imagePlaneModule;
        let { rowCosines, columnCosines } = imagePlaneModule;
        rowCosines ||= [1, 0, 0];
        columnCosines ||= [0, 1, 0];
        const viewPlaneNormal = (vec3.cross([0, 0, 0], columnCosines, rowCosines));
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
        const scalarArray = vtkDataArray.newInstance({
            name: 'Pixels',
            numberOfComponents: numComps,
            values: values,
        });
        const imageData = vtkImageData.newInstance();
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
    async setStack(imageIds, currentImageIdIndex = 0) {
        this._throwIfDestroyed();
        this.imageIds = imageIds;
        this.currentImageIdIndex = currentImageIdIndex;
        this.targetImageIdIndex = currentImageIdIndex;
        const imageRetrieveConfiguration = metaData.get(imageRetrieveMetadataProvider.IMAGE_RETRIEVE_CONFIGURATION, imageIds[currentImageIdIndex], 'stack');
        this.imagesLoader = imageRetrieveConfiguration
            ? (imageRetrieveConfiguration.create || createProgressive)(imageRetrieveConfiguration)
            : this;
        this.stackInvalidated = true;
        this.flipVertical = false;
        this.flipHorizontal = false;
        this.voiRange = null;
        this.interpolationType = InterpolationType.LINEAR;
        this.invert = false;
        this.viewportStatus = ViewportStatus.LOADING;
        this.fillWithBackgroundColor();
        if (this.useCPURendering) {
            this._cpuFallbackEnabledElement.renderingTools = {};
            delete this._cpuFallbackEnabledElement.viewport.colormap;
        }
        const imageId = await this._setImageIdIndex(currentImageIdIndex);
        const eventDetail = {
            imageIds,
            viewportId: this.id,
            element: this.element,
            currentImageIdIndex: currentImageIdIndex,
        };
        triggerEvent(eventTarget, Events.STACK_VIEWPORT_NEW_STACK, eventDetail);
        return imageId;
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
        const isSameXSpacing = isEqual(xSpacing, image.columnPixelSpacing);
        const isSameYSpacing = isEqual(ySpacing, image.rowPixelSpacing);
        return ((isSameXSpacing ||
            (image.columnPixelSpacing === null && xSpacing === 1.0)) &&
            (isSameYSpacing ||
                (image.rowPixelSpacing === null && ySpacing === 1.0)) &&
            xVoxels === image.columns &&
            yVoxels === image.rows &&
            isEqual(imagePlaneModule.rowCosines, rowCosines) &&
            isEqual(imagePlaneModule.columnCosines, columnCosines) &&
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
        updateVTKImageDataWithCornerstoneImage(this._imageData, image);
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
                const scalingParams = preScale?.scalingParameters;
                const scaledWithNonIntegers = (preScale?.scaled && scalingParams?.rescaleIntercept % 1 !== 0) ||
                    scalingParams?.rescaleSlope % 1 !== 0;
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
                    image.preScale = {
                        ...image.preScale,
                        scaled: false,
                    };
                }
                this._setCSImage(image);
                this.viewportStatus = ViewportStatus.PRE_RENDER;
                const eventDetail = {
                    image,
                    imageId,
                    imageIdIndex,
                    viewportId: this.id,
                    renderingEngineId: this.renderingEngineId,
                };
                triggerEvent(this.element, Events.STACK_NEW_IMAGE, eventDetail);
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
                    triggerEvent(eventTarget, Events.IMAGE_LOAD_ERROR, eventDetail);
                }
                reject(error);
            }
            function sendRequest(imageId, imageIdIndex, options) {
                return loadAndCacheImage(imageId, options).then((image) => {
                    successCallback.call(this, image, imageIdIndex, imageId);
                }, (error) => {
                    errorCallback.call(this, error, imageIdIndex, imageId);
                });
            }
            const priority = -5;
            const requestType = RequestType.Interaction;
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
            triggerEvent(this.element, Events.PRE_STACK_NEW_IMAGE, eventDetail);
            imageLoadPoolManager.addRequest(sendRequest.bind(this, imageId, imageIdIndex, options), requestType, additionalDetails, priority);
        });
    }
    successCallback(imageId, image) {
        const imageIdIndex = this.imageIds.indexOf(imageId);
        if (this.currentImageIdIndex !== imageIdIndex) {
            return;
        }
        const csImgFrame = this.csImage?.imageFrame;
        const imgFrame = image?.imageFrame;
        const photometricInterpretation = csImgFrame?.photometricInterpretation ||
            this.csImage?.photometricInterpretation;
        const newPhotometricInterpretation = imgFrame?.photometricInterpretation || image?.photometricInterpretation;
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
        triggerEvent(this.element, Events.STACK_NEW_IMAGE, eventDetail);
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
        triggerEvent(eventTarget, Events.IMAGE_LOAD_ERROR, eventDetail);
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
            requestType: RequestType.Interaction,
            additionalDetails,
        };
        return options;
    }
    async loadImages(imageIds, listener) {
        const resultList = await Promise.allSettled(imageIds.map((imageId) => {
            const options = this.getLoaderImageOptions(imageId);
            return loadAndCacheImage(imageId, options).then((image) => {
                listener.successCallback(imageId, image);
                return imageId;
            }, (error) => {
                listener.errorCallback(imageId, true, error);
                return imageId;
            });
        }));
        const errorList = resultList.filter((item) => item.status === 'rejected');
        if (errorList && errorList.length) {
            const event = new CustomEvent(Events.IMAGE_LOAD_ERROR, {
                detail: errorList,
                cancelable: true,
            });
            eventTarget.dispatchEvent(event);
        }
        return resultList;
    }
    _loadAndDisplayImageGPU(imageId, imageIdIndex) {
        const eventDetail = {
            imageId,
            imageIdIndex,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
        };
        triggerEvent(this.element, Events.PRE_STACK_NEW_IMAGE, eventDetail);
        return this.imagesLoader.loadImages([imageId], this).then((v) => {
            return imageId;
        });
    }
    _updateToDisplayImageCPU(image) {
        const metadata = this.getImageDataMetadata(image);
        const viewport = getDefaultViewport(this.canvas, image, this.modality, this._cpuFallbackEnabledElement.viewport.colormap);
        const { windowCenter, windowWidth } = viewport.voi;
        this.voiRange = windowLevelUtil.toLowHighRange(windowWidth, windowCenter);
        this._cpuFallbackEnabledElement.image = image;
        this._cpuFallbackEnabledElement.metadata = {
            ...metadata,
        };
        this.cpuImagePixelData = image.getPixelData();
        const viewportSettingToUse = Object.assign({}, viewport, this._cpuFallbackEnabledElement.viewport);
        this._cpuFallbackEnabledElement.viewport = this.stackInvalidated
            ? viewport
            : viewportSettingToUse;
        this.stackInvalidated = false;
        this.cpuRenderingInvalidated = true;
        this._cpuFallbackEnabledElement.transform = calculateTransform(this._cpuFallbackEnabledElement);
    }
    addImages(stackInputs) {
        const actors = this.getActors();
        stackInputs.forEach((stackInput) => {
            const image = cache.getImage(stackInput.imageId);
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
        const previousCameraProps = cloneDeep(this.getCamera());
        if (sameImageData && !this.stackInvalidated) {
            this._updateVTKImageDataFromCornerstoneImage(image);
            const cameraProps = this.getCamera();
            const panCache = vec3.subtract(vec3.create(), this.cameraFocalPointOnRender, cameraProps.focalPoint);
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
        if (this.modality !== 'PT' || !this.csImage.isPreScaled) {
            return false;
        }
        if (!this.csImage.preScale?.scalingParameters?.suvbw) {
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
            return windowLevelUtil.toLowHighRange(width, center);
        }
    }
    async _setImageIdIndex(imageIdIndex) {
        if (imageIdIndex >= this.imageIds.length) {
            throw new Error(`ImageIdIndex provided ${imageIdIndex} is invalid, the stack only has ${this.imageIds.length} elements`);
        }
        this.currentImageIdIndex = imageIdIndex;
        this.hasPixelSpacing = true;
        this.viewportStatus = ViewportStatus.PRE_RENDER;
        const imageId = await this._loadAndDisplayImage(this.imageIds[imageIdIndex], imageIdIndex);
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
    }
    resetCameraCPU(resetPan, resetZoom) {
        const { image } = this._cpuFallbackEnabledElement;
        if (!image) {
            return;
        }
        resetCamera(this._cpuFallbackEnabledElement, resetPan, resetZoom);
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
        const imageAlreadyLoaded = cache.isLoaded(targetImageId);
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
            triggerEvent(this.element, Events.STACK_VIEWPORT_SCROLL, eventData);
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
        const newPosition = vec3.subtract(vec3.create(), position, panCache);
        const newFocal = vec3.subtract(vec3.create(), focalPoint, panCache);
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
            triggerEvent(this.element, Events.CAMERA_MODIFIED, eventDetail);
        }
    }
    triggerCalibrationEvent() {
        const { imageData } = this.getImageData();
        const eventDetail = {
            element: this.element,
            viewportId: this.id,
            renderingEngineId: this.renderingEngineId,
            imageId: this.getCurrentImageId(),
            imageData: imageData,
            worldToIndex: imageData.getWorldToIndex(),
            ...this._calibrationEvent,
        };
        if (!this.suppressEvents) {
            triggerEvent(this.element, Events.IMAGE_SPACING_CALIBRATED, eventDetail);
        }
        this._publishCalibratedEvent = false;
    }
    _getVOIRangeForCurrentImage() {
        const { windowCenter, windowWidth } = this.csImage;
        return this._getVOIRangeFromWindowLevel(windowWidth, windowCenter);
    }
    _getValidVOILUTFunction(voiLUTFunction) {
        if (Object.values(VOILUTFunctionType).indexOf(voiLUTFunction) === -1) {
            voiLUTFunction = VOILUTFunctionType.LINEAR;
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
        return referencedImageId?.endsWith(imageURI);
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
        const colormap = getColormap(colormapData.name, colormapData);
        this._cpuFallbackEnabledElement.viewport.colormap = colormap;
        this._cpuFallbackEnabledElement.renderingTools = {};
        this.fillWithBackgroundColor();
        this.cpuRenderingInvalidated = true;
        this.render();
        const eventDetail = {
            viewportId: this.id,
            colormap: colormapData,
        };
        triggerEvent(this.element, Events.COLORMAP_MODIFIED, eventDetail);
    }
    setColormapGPU(colormap) {
        const ActorEntry = this.getDefaultActor();
        const actor = ActorEntry.actor;
        const actorProp = actor.getProperty();
        const rgbTransferFunction = actorProp.getRGBTransferFunction();
        const colormapObj = colormapUtils.getColormap(colormap.name) ||
            vtkColorMaps.getPresetByName(colormap.name);
        if (!rgbTransferFunction) {
            const cfun = vtkColorTransferFunction.newInstance();
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
        triggerEvent(this.element, Events.COLORMAP_MODIFIED, eventDetail);
    }
    unsetColormapGPU() {
        throw new Error('unsetColormapGPU not implemented.');
    }
    _getImagePlaneModule(imageId) {
        const imagePlaneModule = metaData.get(MetadataModules.IMAGE_PLANE, imageId);
        this.calibration ||= imagePlaneModule.calibration;
        const newImagePlaneModule = {
            ...imagePlaneModule,
        };
        if (!newImagePlaneModule.columnPixelSpacing) {
            newImagePlaneModule.columnPixelSpacing = 1;
            this.hasPixelSpacing = this.calibration?.scale > 0;
        }
        if (!newImagePlaneModule.rowPixelSpacing) {
            newImagePlaneModule.rowPixelSpacing = 1;
            this.hasPixelSpacing = this.calibration?.scale > 0;
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
export default StackViewport;
//# sourceMappingURL=StackViewport.js.map