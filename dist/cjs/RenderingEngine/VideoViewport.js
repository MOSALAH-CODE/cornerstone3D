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
const gl_matrix_1 = require("gl-matrix");
const enums_1 = require("../enums");
const metaData = __importStar(require("../metaData"));
const transform_1 = require("./helpers/cpuFallback/rendering/transform");
const utilities_1 = require("../utilities");
const Viewport_1 = __importDefault(require("./Viewport"));
const helpers_1 = require("./helpers");
const CanvasActor_1 = __importDefault(require("./CanvasActor"));
const cache_1 = __importDefault(require("../cache"));
class VideoViewport extends Viewport_1.default {
    constructor(props) {
        super(Object.assign(Object.assign({}, props), { canvas: props.canvas || (0, helpers_1.getOrCreateCanvas)(props.element) }));
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.loop = true;
        this.mute = true;
        this.isPlaying = false;
        this.scrollSpeed = 1;
        this.playbackRate = 1;
        this.frameRange = [0, 0];
        this.fps = 30;
        this.videoCamera = {
            panWorld: [0, 0],
            parallelScale: 1,
        };
        this.voiRange = {
            lower: 0,
            upper: 255,
        };
        this.getProperties = () => {
            return {
                loop: this.videoElement.loop,
                muted: this.videoElement.muted,
                playbackRate: this.playbackRate,
                scrollSpeed: this.scrollSpeed,
                voiRange: Object.assign({}, this.voiRange),
            };
        };
        this.resetCamera = () => {
            this.refreshRenderValues();
            this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.isPlaying === false) {
                this.renderFrame();
            }
            return true;
        };
        this.getNumberOfSlices = () => {
            const computedSlices = Math.round((this.videoElement.duration * this.fps) / this.scrollSpeed);
            return isNaN(computedSlices) ? this.numberOfFrames : computedSlices;
        };
        this.getFrameOfReferenceUID = () => {
            return this.videoElement.src;
        };
        this.resize = () => {
            const canvas = this.canvas;
            const { clientWidth, clientHeight } = canvas;
            if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
                canvas.width = clientWidth;
                canvas.height = clientHeight;
            }
            this.refreshRenderValues();
            if (this.isPlaying === false) {
                this.renderFrame();
            }
        };
        this.canvasToWorld = (canvasPos, destPos = [0, 0, 0]) => {
            const pan = this.videoCamera.panWorld;
            const worldToCanvasRatio = this.getWorldToCanvasRatio();
            const panOffsetCanvas = [
                pan[0] * worldToCanvasRatio,
                pan[1] * worldToCanvasRatio,
            ];
            const subCanvasPos = [
                canvasPos[0] - panOffsetCanvas[0],
                canvasPos[1] - panOffsetCanvas[1],
            ];
            destPos.splice(0, 2, subCanvasPos[0] / worldToCanvasRatio, subCanvasPos[1] / worldToCanvasRatio);
            return destPos;
        };
        this.worldToCanvas = (worldPos) => {
            const pan = this.videoCamera.panWorld;
            const worldToCanvasRatio = this.getWorldToCanvasRatio();
            const canvasPos = [
                (worldPos[0] + pan[0]) * worldToCanvasRatio,
                (worldPos[1] + pan[1]) * worldToCanvasRatio,
            ];
            return canvasPos;
        };
        this.getRotation = () => 0;
        this.canvasToIndex = (canvasPos) => {
            const transform = this.getTransform();
            transform.invert();
            return transform.transformPoint(canvasPos.map((it) => it * devicePixelRatio));
        };
        this.indexToCanvas = (indexPos) => {
            const transform = this.getTransform();
            return (transform.transformPoint(indexPos).map((it) => it / devicePixelRatio));
        };
        this.customRenderViewportToCanvas = () => {
            this.renderFrame();
        };
        this.renderFrame = () => {
            var _a;
            const transform = this.getTransform();
            const transformationMatrix = transform.getMatrix();
            const ctx = this.canvasContext;
            ctx.resetTransform();
            ctx.transform(transformationMatrix[0], transformationMatrix[1], transformationMatrix[2], transformationMatrix[3], transformationMatrix[4], transformationMatrix[5]);
            ctx.drawImage(this.videoElement, 0, 0, this.videoWidth || 1024, this.videoHeight || 1024);
            for (const actor of this.getActors()) {
                actor.actor.render(this, this.canvasContext);
            }
            this.canvasContext.resetTransform();
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.STACK_NEW_IMAGE, {
                element: this.element,
                viewportId: this.id,
                viewport: this,
                renderingEngineId: this.renderingEngineId,
                time: this.videoElement.currentTime,
                duration: this.videoElement.duration,
            });
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.IMAGE_RENDERED, {
                element: this.element,
                viewportId: this.id,
                viewport: this,
                renderingEngineId: this.renderingEngineId,
                time: this.videoElement.currentTime,
                duration: this.videoElement.duration,
            });
            (_a = this.initialRender) === null || _a === void 0 ? void 0 : _a.call(this);
            const frame = this.getFrameNumber();
            if (this.isPlaying) {
                if (frame < this.frameRange[0]) {
                    this.setFrameNumber(this.frameRange[0]);
                }
                else if (frame > this.frameRange[1]) {
                    if (this.loop) {
                        this.setFrameNumber(this.frameRange[0]);
                    }
                    else {
                        this.pause();
                    }
                }
            }
        };
        this.renderWhilstPlaying = () => {
            this.renderFrame();
            if (this.isPlaying) {
                requestAnimationFrame(this.renderWhilstPlaying);
            }
        };
        this.canvasContext = this.canvas.getContext('2d');
        this.renderingEngineId = props.renderingEngineId;
        this.element.setAttribute('data-viewport-uid', this.id);
        this.element.setAttribute('data-rendering-engine-uid', this.renderingEngineId);
        this.videoElement = document.createElement('video');
        this.videoElement.muted = this.mute;
        this.videoElement.loop = this.loop;
        this.videoElement.autoplay = true;
        this.videoElement.crossOrigin = 'anonymous';
        this.addEventListeners();
        this.resize();
    }
    static get useCustomRenderingPipeline() {
        return true;
    }
    addEventListeners() {
        this.canvas.addEventListener(enums_1.Events.ELEMENT_DISABLED, this.elementDisabledHandler);
    }
    removeEventListeners() {
        this.canvas.removeEventListener(enums_1.Events.ELEMENT_DISABLED, this.elementDisabledHandler);
    }
    elementDisabledHandler() {
        this.removeEventListeners();
        this.videoElement.remove();
    }
    getImageDataMetadata(image) {
        const imageId = typeof image === 'string' ? image : image.imageId;
        const imagePlaneModule = metaData.get(enums_1.MetadataModules.IMAGE_PLANE, imageId);
        let rowCosines = imagePlaneModule.rowCosines;
        let columnCosines = imagePlaneModule.columnCosines;
        if (rowCosines == null || columnCosines == null) {
            rowCosines = [1, 0, 0];
            columnCosines = [0, 1, 0];
        }
        const rowCosineVec = gl_matrix_1.vec3.fromValues(rowCosines[0], rowCosines[1], rowCosines[2]);
        const colCosineVec = gl_matrix_1.vec3.fromValues(columnCosines[0], columnCosines[1], columnCosines[2]);
        const { rows, columns } = imagePlaneModule;
        const scanAxisNormal = gl_matrix_1.vec3.create();
        gl_matrix_1.vec3.cross(scanAxisNormal, rowCosineVec, colCosineVec);
        let origin = imagePlaneModule.imagePositionPatient;
        if (origin == null) {
            origin = [0, 0, 0];
        }
        const xSpacing = imagePlaneModule.columnPixelSpacing || 1;
        const ySpacing = imagePlaneModule.rowPixelSpacing || 1;
        const xVoxels = imagePlaneModule.columns;
        const yVoxels = imagePlaneModule.rows;
        const zSpacing = 1;
        const zVoxels = 1;
        this.hasPixelSpacing = !!imagePlaneModule.columnPixelSpacing;
        return {
            bitsAllocated: 8,
            numComps: 3,
            origin,
            rows,
            columns,
            direction: [...rowCosineVec, ...colCosineVec, ...scanAxisNormal],
            dimensions: [xVoxels, yVoxels, zVoxels],
            spacing: [xSpacing, ySpacing, zSpacing],
            hasPixelSpacing: this.hasPixelSpacing,
            numVoxels: xVoxels * yVoxels * zVoxels,
            imagePlaneModule,
        };
    }
    setDataIds(imageIds, options) {
        var _a;
        this.setVideo(imageIds[0], ((_a = options === null || options === void 0 ? void 0 : options.viewReference) === null || _a === void 0 ? void 0 : _a.sliceIndex) || 1);
    }
    setVideo(imageId, frameNumber) {
        this.imageId = Array.isArray(imageId) ? imageId[0] : imageId;
        const imageUrlModule = metaData.get(enums_1.MetadataModules.IMAGE_URL, imageId);
        if (!(imageUrlModule === null || imageUrlModule === void 0 ? void 0 : imageUrlModule.rendered)) {
            throw new Error(`Video Image ID ${imageId} does not have a rendered video view`);
        }
        const { rendered } = imageUrlModule;
        const generalSeries = metaData.get(enums_1.MetadataModules.GENERAL_SERIES, imageId);
        this.modality = generalSeries === null || generalSeries === void 0 ? void 0 : generalSeries.Modality;
        this.metadata = this.getImageDataMetadata(imageId);
        let { cineRate, numberOfFrames } = metaData.get(enums_1.MetadataModules.CINE, imageId);
        this.numberOfFrames = numberOfFrames;
        return this.setVideoURL(rendered).then(() => {
            if (!numberOfFrames || numberOfFrames === 1) {
                numberOfFrames = Math.round(this.videoElement.duration * (cineRate || 30));
            }
            if (!cineRate) {
                cineRate = Math.round(numberOfFrames / this.videoElement.duration);
            }
            this.fps = cineRate;
            this.numberOfFrames = numberOfFrames;
            this.setFrameRange([1, numberOfFrames]);
            this.initialRender = () => {
                this.initialRender = null;
                this.pause();
                this.setFrameNumber(frameNumber || 1);
            };
            return new Promise((resolve) => {
                window.setTimeout(() => {
                    this.setFrameNumber(frameNumber || 1);
                    resolve(this);
                }, 25);
            });
        });
    }
    setVideoURL(videoURL) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                this.videoElement.src = videoURL;
                this.videoElement.preload = 'auto';
                const loadedMetadataEventHandler = () => {
                    this.videoWidth = this.videoElement.videoWidth;
                    this.videoHeight = this.videoElement.videoHeight;
                    this.videoElement.removeEventListener('loadedmetadata', loadedMetadataEventHandler);
                    this.refreshRenderValues();
                    resolve(true);
                };
                this.videoElement.addEventListener('loadedmetadata', loadedMetadataEventHandler);
            });
        });
    }
    getImageIds() {
        const imageIds = new Array(this.numberOfFrames);
        const baseImageId = this.imageId.replace(/[0-9]+$/, '');
        for (let i = 0; i < this.numberOfFrames; i++) {
            imageIds[i] = `${baseImageId}${i + 1}`;
        }
        return imageIds;
    }
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
            return false;
        }
        else {
            this.play();
            return true;
        }
    }
    play() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isPlaying) {
                    yield this.videoElement.play();
                    this.isPlaying = true;
                    this.renderWhilstPlaying();
                }
            }
            catch (e) {
            }
        });
    }
    pause() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.videoElement.pause();
                this.isPlaying = false;
            }
            catch (e) {
            }
        });
    }
    scroll(delta = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pause();
            const videoElement = this.videoElement;
            const renderFrame = this.renderFrame;
            const currentTime = videoElement.currentTime;
            const newTime = currentTime + (delta * this.scrollSpeed) / this.fps;
            videoElement.currentTime = newTime;
            const seekEventListener = (evt) => {
                renderFrame();
                videoElement.removeEventListener('seeked', seekEventListener);
            };
            videoElement.addEventListener('seeked', seekEventListener);
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            const videoElement = this.videoElement;
            const renderFrame = this.renderFrame;
            videoElement.currentTime = 0;
            if (videoElement.paused) {
                const seekEventListener = (evt) => {
                    renderFrame();
                    videoElement.removeEventListener('seeked', seekEventListener);
                };
                videoElement.addEventListener('seeked', seekEventListener);
            }
        });
    }
    end() {
        return __awaiter(this, void 0, void 0, function* () {
            const videoElement = this.videoElement;
            const renderFrame = this.renderFrame;
            videoElement.currentTime = videoElement.duration;
            if (videoElement.paused) {
                const seekEventListener = (evt) => {
                    renderFrame();
                    videoElement.removeEventListener('seeked', seekEventListener);
                };
                videoElement.addEventListener('seeked', seekEventListener);
            }
        });
    }
    setTime(timeInSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const videoElement = this.videoElement;
            const renderFrame = this.renderFrame;
            videoElement.currentTime = timeInSeconds;
            if (videoElement.paused) {
                const seekEventListener = (evt) => {
                    renderFrame();
                    videoElement.removeEventListener('seeked', seekEventListener);
                };
                videoElement.addEventListener('seeked', seekEventListener);
            }
        });
    }
    setFrameNumber(frame) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setTime((frame - 1) / this.fps);
        });
    }
    setFrameRange(frameRange) {
        if (!frameRange) {
            this.frameRange = [1, this.numberOfFrames];
            return;
        }
        if (frameRange.length !== 2 || frameRange[0] === frameRange[1]) {
            return;
        }
        this.frameRange = [frameRange[0], frameRange[1]];
    }
    getFrameRange() {
        return this.frameRange;
    }
    setProperties(props) {
        if (props.loop !== undefined) {
            this.videoElement.loop = props.loop;
        }
        if (props.muted !== undefined) {
            this.videoElement.muted = props.muted;
        }
        if (props.playbackRate !== undefined) {
            this.setPlaybackRate(props.playbackRate);
        }
        if (props.scrollSpeed !== undefined) {
            this.setScrollSpeed(props.scrollSpeed);
        }
        if (props.voiRange) {
            this.setVOI(props.voiRange);
        }
    }
    setPlaybackRate(rate = 1) {
        this.playbackRate = rate;
        if (rate < 0.0625) {
            this.pause();
            return;
        }
        if (!this.videoElement) {
            return;
        }
        this.videoElement.playbackRate = rate;
        this.play();
    }
    setScrollSpeed(scrollSpeed = 1, unit = enums_1.VideoEnums.SpeedUnit.FRAME) {
        this.scrollSpeed =
            unit === enums_1.VideoEnums.SpeedUnit.SECOND
                ? scrollSpeed * this.fps
                : scrollSpeed;
    }
    resetProperties() {
        this.setProperties({
            loop: false,
            muted: true,
        });
    }
    getScalarData() {
        var _a;
        if (((_a = this.scalarData) === null || _a === void 0 ? void 0 : _a.frameNumber) === this.getFrameNumber()) {
            return this.scalarData;
        }
        const canvas = document.createElement('canvas');
        canvas.width = this.videoWidth;
        canvas.height = this.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(this.videoElement, 0, 0);
        const canvasData = context.getImageData(0, 0, this.videoWidth, this.videoHeight);
        const scalarData = canvasData.data;
        scalarData.getRange = () => [0, 255];
        scalarData.frameNumber = this.getFrameNumber();
        this.scalarData = scalarData;
        return scalarData;
    }
    getImageData() {
        const { metadata } = this;
        const spacing = metadata.spacing;
        const imageData = {
            dimensions: metadata.dimensions,
            spacing,
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
                indexToWorld: (point, destPoint) => {
                    const canvasPoint = this.indexToCanvas([point[0], point[1]]);
                    return this.canvasToWorld(canvasPoint, destPoint);
                },
            },
            hasPixelSpacing: this.hasPixelSpacing,
            calibration: this.calibration,
            preScale: {
                scaled: false,
            },
        };
        Object.defineProperty(imageData, 'scalarData', {
            get: () => this.getScalarData(),
            enumerable: true,
        });
        return imageData;
    }
    hasImageURI(imageURI) {
        const framesMatch = imageURI.match(VideoViewport.frameRangeExtractor);
        const testURI = framesMatch
            ? imageURI.substring(0, framesMatch.index)
            : imageURI;
        return this.imageId.indexOf(testURI) !== -1;
    }
    setVOI(voiRange) {
        this.voiRange = voiRange;
        this.setColorTransform();
    }
    setWindowLevel(windowWidth = 256, windowCenter = 128) {
        const lower = windowCenter - windowWidth / 2;
        const upper = windowCenter + windowWidth / 2 - 1;
        this.setVOI({ lower, upper });
        this.setColorTransform();
    }
    setAverageWhite(averageWhite) {
        this.averageWhite = averageWhite;
        this.setColorTransform();
    }
    setColorTransform() {
        if (!this.voiRange && !this.averageWhite) {
            this.feFilter = null;
            return;
        }
        const white = this.averageWhite || [255, 255, 255];
        const maxWhite = Math.max(...white);
        const scaleWhite = white.map((c) => maxWhite / c);
        const { lower = 0, upper = 255 } = this.voiRange || {};
        const wlScale = (upper - lower + 1) / 255;
        const wlDelta = lower / 255;
        this.feFilter = `url('data:image/svg+xml,\
      <svg xmlns="http://www.w3.org/2000/svg">\
        <filter id="colour" color-interpolation-filters="linearRGB">\
        <feColorMatrix type="matrix" \
        values="\
          ${scaleWhite[0] * wlScale} 0 0 0 ${wlDelta} \
          0 ${scaleWhite[1] * wlScale} 0 0 ${wlDelta} \
          0 0 ${scaleWhite[2] * wlScale} 0 ${wlDelta} \
          0 0 0 1 0" />\
        </filter>\
      </svg>#colour')`;
        this.canvas.style.filter = this.feFilter;
    }
    setCamera(camera) {
        const { parallelScale, focalPoint } = camera;
        if (parallelScale) {
            this.videoCamera.parallelScale =
                this.element.clientHeight / 2 / parallelScale;
        }
        if (focalPoint !== undefined) {
            const focalPointCanvas = this.worldToCanvas(focalPoint);
            const canvasCenter = [
                this.element.clientWidth / 2,
                this.element.clientHeight / 2,
            ];
            const panWorldDelta = [
                (focalPointCanvas[0] - canvasCenter[0]) /
                    this.videoCamera.parallelScale,
                (focalPointCanvas[1] - canvasCenter[1]) /
                    this.videoCamera.parallelScale,
            ];
            this.videoCamera.panWorld = [
                this.videoCamera.panWorld[0] - panWorldDelta[0],
                this.videoCamera.panWorld[1] - panWorldDelta[1],
            ];
        }
        this.canvasContext.fillStyle = 'rgba(0,0,0,1)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.isPlaying === false) {
            this.renderFrame();
        }
    }
    getCurrentImageId() {
        const current = this.imageId.replace('/frames/1', this.isPlaying
            ? `/frames/${this.frameRange[0]}-${this.frameRange[1]}`
            : `/frames/${this.getFrameNumber()}`);
        return current;
    }
    getReferenceId(specifier = {}) {
        const { sliceIndex: sliceIndex } = specifier;
        if (sliceIndex === undefined) {
            return `videoId:${this.getCurrentImageId()}`;
        }
        if (Array.isArray(sliceIndex)) {
            return `videoId:${this.imageId.substring(0, this.imageId.length - 1)}${sliceIndex[0] + 1}-${sliceIndex[1] + 1}`;
        }
        const baseTarget = this.imageId.replace('/frames/1', `/frames/${1 + sliceIndex}`);
        return `videoId:${baseTarget}`;
    }
    isReferenceViewable(viewRef, options = {}) {
        var _a;
        let { imageURI } = options;
        const { referencedImageId, sliceIndex: sliceIndex } = viewRef;
        if (!super.isReferenceViewable(viewRef)) {
            return false;
        }
        const imageId = this.getCurrentImageId();
        if (!imageURI) {
            const colonIndex = imageId.indexOf(':');
            imageURI = imageId.substring(colonIndex + 1, imageId.length - 1);
        }
        if (options.withNavigation) {
            return true;
        }
        const currentIndex = this.getSliceIndex();
        if (Array.isArray(sliceIndex)) {
            return currentIndex >= sliceIndex[0] && currentIndex <= sliceIndex[1];
        }
        if (sliceIndex !== undefined) {
            return currentIndex === sliceIndex;
        }
        if (!referencedImageId) {
            return false;
        }
        const match = referencedImageId.match(VideoViewport.frameRangeExtractor);
        if (!match || !match[2]) {
            return true;
        }
        const range = match[2].split('-').map((it) => Number(it));
        const frame = currentIndex + 1;
        return range[0] <= frame && frame <= ((_a = range[1]) !== null && _a !== void 0 ? _a : range[0]);
    }
    getViewReference(viewRefSpecifier) {
        let sliceIndex = viewRefSpecifier === null || viewRefSpecifier === void 0 ? void 0 : viewRefSpecifier.sliceIndex;
        if (!sliceIndex) {
            sliceIndex = this.isPlaying
                ? [this.frameRange[0] - 1, this.frameRange[1] - 1]
                : this.getCurrentImageIdIndex();
        }
        return Object.assign(Object.assign({}, super.getViewReference(viewRefSpecifier)), { referencedImageId: this.getReferenceId(viewRefSpecifier), sliceIndex: sliceIndex });
    }
    getFrameNumber() {
        return 1 + this.getCurrentImageIdIndex();
    }
    getCurrentImageIdIndex() {
        return Math.round(this.videoElement.currentTime * this.fps);
    }
    getSliceIndex() {
        return this.getCurrentImageIdIndex();
    }
    getCamera() {
        const { parallelScale } = this.videoCamera;
        const canvasCenter = [
            this.element.clientWidth / 2,
            this.element.clientHeight / 2,
        ];
        const canvasCenterWorld = this.canvasToWorld(canvasCenter);
        return {
            parallelProjection: true,
            focalPoint: canvasCenterWorld,
            position: [0, 0, 0],
            viewUp: [0, -1, 0],
            parallelScale: this.element.clientHeight / 2 / parallelScale,
            viewPlaneNormal: [0, 0, 1],
        };
    }
    getPan() {
        const panWorld = this.videoCamera.panWorld;
        return [panWorld[0], panWorld[1]];
    }
    refreshRenderValues() {
        let worldToCanvasRatio = this.canvas.offsetWidth / this.videoWidth;
        if (this.videoHeight * worldToCanvasRatio > this.canvas.height) {
            worldToCanvasRatio = this.canvas.offsetHeight / this.videoHeight;
        }
        const drawWidth = Math.floor(this.videoWidth * worldToCanvasRatio);
        const drawHeight = Math.floor(this.videoHeight * worldToCanvasRatio);
        const xOffsetCanvas = (this.canvas.offsetWidth - drawWidth) / 2;
        const yOffsetCanvas = (this.canvas.offsetHeight - drawHeight) / 2;
        const xOffsetWorld = xOffsetCanvas / worldToCanvasRatio;
        const yOffsetWorld = yOffsetCanvas / worldToCanvasRatio;
        this.videoCamera.panWorld = [xOffsetWorld, yOffsetWorld];
        this.videoCamera.parallelScale = worldToCanvasRatio;
    }
    getWorldToCanvasRatio() {
        return this.videoCamera.parallelScale;
    }
    getCanvasToWorldRatio() {
        return 1.0 / this.videoCamera.parallelScale;
    }
    getTransform() {
        const panWorld = this.videoCamera.panWorld;
        const devicePixelRatio = window.devicePixelRatio || 1;
        const worldToCanvasRatio = this.getWorldToCanvasRatio();
        const canvasToWorldRatio = this.getCanvasToWorldRatio();
        const halfCanvas = [
            this.canvas.offsetWidth / 2,
            this.canvas.offsetHeight / 2,
        ];
        const halfCanvasWorldCoordinates = [
            halfCanvas[0] * canvasToWorldRatio,
            halfCanvas[1] * canvasToWorldRatio,
        ];
        const transform = new transform_1.Transform();
        transform.scale(devicePixelRatio, devicePixelRatio);
        transform.translate(halfCanvas[0], halfCanvas[1]);
        transform.scale(worldToCanvasRatio, worldToCanvasRatio);
        transform.translate(panWorld[0], panWorld[1]);
        transform.translate(-halfCanvasWorldCoordinates[0], -halfCanvasWorldCoordinates[1]);
        return transform;
    }
    updateCameraClippingPlanesAndRange() {
    }
    addImages(stackInputs) {
        const actors = this.getActors();
        stackInputs.forEach((stackInput) => {
            const image = cache_1.default.getImage(stackInput.imageId);
            const imageActor = this.createActorMapper(image);
            if (imageActor) {
                actors.push({ uid: stackInput.actorUID, actor: imageActor });
                if (stackInput.callback) {
                    stackInput.callback({ imageActor, imageId: stackInput.imageId });
                }
            }
        });
        this.setActors(actors);
    }
    createActorMapper(image) {
        return new CanvasActor_1.default(this, image);
    }
}
VideoViewport.frameRangeExtractor = /(\/frames\/|[&?]frameNumber=)([^/&?]*)/i;
exports.default = VideoViewport;
//# sourceMappingURL=VideoViewport.js.map