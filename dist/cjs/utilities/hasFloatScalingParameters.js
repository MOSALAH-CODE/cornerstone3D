"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasFloatScalingParameters = void 0;
const hasFloatScalingParameters = (scalingParameters) => {
    const hasFloatRescale = Object.values(scalingParameters).some((value) => typeof value === 'number' && !Number.isInteger(value));
    return hasFloatRescale;
};
exports.hasFloatScalingParameters = hasFloatScalingParameters;
//# sourceMappingURL=hasFloatScalingParameters.js.map